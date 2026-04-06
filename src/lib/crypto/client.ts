"use client";

import {
  refillOneTimePreKeysAction,
  rotateSignedPreKeyAction,
} from "@/actions";
import {
  decryptMessage,
  deriveSharedSecret,
  importPublicKey,
} from "@/lib/crypto";
import { cryptoStore } from "@/lib/crypto-store";
import type { Message } from "@/lib/db/schema";
import type { SafeUserWithDevices } from "@/lib/safe-user";
import { decodeBase64, encodeBase64 } from "../encoding";
import { initRatchetAsResponder, ratchetDecrypt } from "./double-ratchet";
import { ed25519Sign, generateX25519KeyPair, type KeyPair } from "./primitives";
import { sessionStore } from "./session-store";
import {
  isRatchetMessagePayload,
  parseStoredMessagePayload,
  transportToEnvelope,
  type X3DHTransportData,
} from "./wire-format";
import { respondX3DH } from "./x3dh";

const OPK_REFILL_THRESHOLD = 5;
const OPK_BATCH_SIZE = 20;
const SIGNED_PREKEY_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const sessionLocks = new Map<number, Promise<void>>();

interface LegacyMessagePayload {
  senderDeviceId: number;
  recipients: Record<number, string>;
}

export interface DecryptConversationMessageInput {
  message: Message;
  currentUserId: number;
  contact: SafeUserWithDevices;
}

function randomUint32(): number {
  return globalThis.crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;
}

export function generateKeyId(): number {
  // PostgreSQL `integer` is signed 32-bit, so keep random key IDs in int31 range.
  const keyId = randomUint32() & 0x7fffffff;
  return keyId === 0 ? 1 : keyId;
}

async function getOwnDeviceId(): Promise<number> {
  const ownDeviceId = await cryptoStore.getDeviceId();
  if (!ownDeviceId) {
    throw new Error("This device has not been configured for encryption.");
  }

  const parsed = Number.parseInt(ownDeviceId, 10);
  if (!Number.isInteger(parsed)) {
    throw new Error("Stored device ID is invalid.");
  }

  return parsed;
}

async function withSessionLock<T>(
  remoteDeviceId: number,
  task: () => Promise<T>,
): Promise<T> {
  const previous = (
    sessionLocks.get(remoteDeviceId) ?? Promise.resolve()
  ).catch(() => undefined);

  let release: (() => void) | undefined;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const queued = previous.then(() => current);
  sessionLocks.set(remoteDeviceId, queued);

  await previous;

  try {
    return await task();
  } finally {
    release?.();
    if (sessionLocks.get(remoteDeviceId) === queued) {
      sessionLocks.delete(remoteDeviceId);
    }
  }
}

function isLegacyPayload(value: unknown): value is LegacyMessagePayload {
  return (
    typeof value === "object" &&
    value !== null &&
    "senderDeviceId" in value &&
    "recipients" in value &&
    !("v" in value)
  );
}

function decodeTransportKey(value: string): Uint8Array {
  return decodeBase64(value);
}

async function decryptLegacyConversationMessage(
  payload: LegacyMessagePayload,
  message: Message,
  currentUserId: number,
  contact: SafeUserWithDevices,
  ownDeviceId: number,
): Promise<string> {
  const ownPrivateKey = await cryptoStore.getKey("privateKey");
  if (!ownPrivateKey) {
    throw new Error("Legacy private key is not available on this device.");
  }

  if (message.senderId === currentUserId) {
    const contactRecipientId = Object.keys(payload.recipients)
      .map((deviceId) => Number.parseInt(deviceId, 10))
      .find((deviceId) =>
        contact.devices.some((device) => device.id === deviceId),
      );

    if (!contactRecipientId) {
      throw new Error(
        "This sent message is not available on the current device.",
      );
    }

    const contactDevice = contact.devices.find(
      (device) => device.id === contactRecipientId,
    );
    if (!contactDevice) {
      throw new Error("Recipient device details are unavailable.");
    }

    const contactPublicKey = await importPublicKey(contactDevice.publicKey);
    const sharedKey = await deriveSharedSecret(ownPrivateKey, contactPublicKey);
    return decryptMessage(sharedKey, payload.recipients[contactRecipientId]);
  }

  const ciphertext = payload.recipients[ownDeviceId];
  if (!ciphertext) {
    throw new Error("This message was not encrypted for the current device.");
  }

  const senderDevice = contact.devices.find(
    (device) => device.id === payload.senderDeviceId,
  );
  if (!senderDevice) {
    throw new Error("Sender device details are unavailable.");
  }

  const senderPublicKey = await importPublicKey(senderDevice.publicKey);
  const sharedKey = await deriveSharedSecret(ownPrivateKey, senderPublicKey);
  return decryptMessage(sharedKey, ciphertext);
}

async function buildSharedSecretFromX3DH(
  transport: X3DHTransportData,
): Promise<Uint8Array> {
  const identityKeys = await sessionStore.getIdentityKeys();
  if (!identityKeys) {
    throw new Error("Identity keys are not available on this device.");
  }

  const signedPreKey = await sessionStore.getSignedPreKey(
    transport.usedSignedPreKeyId,
  );
  if (!signedPreKey) {
    throw new Error("Signed pre-key is unavailable for this message.");
  }

  const oneTimePreKey =
    transport.usedOneTimePreKeyId !== undefined
      ? await sessionStore.getOneTimePreKey(transport.usedOneTimePreKeyId)
      : null;

  const sharedSecret = await respondX3DH(
    identityKeys.dhKeyPair.privateKey,
    signedPreKey.keyPair.privateKey,
    oneTimePreKey?.privateKey ?? null,
    decodeTransportKey(transport.senderIdentityDHKey),
    decodeTransportKey(transport.senderEphemeralKey),
  );

  if (transport.usedOneTimePreKeyId !== undefined) {
    await sessionStore.deleteOneTimePreKey(transport.usedOneTimePreKeyId);
  }

  return sharedSecret;
}

async function decryptRatchetConversationMessage(
  message: Message,
  ownDeviceId: number,
): Promise<string> {
  const payload = parseStoredMessagePayload(message.content);
  if (!payload || !isRatchetMessagePayload(payload)) {
    throw new Error("Invalid ratchet message payload.");
  }

  const recipientPayload = payload.recipients[ownDeviceId];
  if (!recipientPayload) {
    if (payload.senderDeviceId === ownDeviceId) {
      throw new Error(
        "This sent message is only cached locally on the sending device.",
      );
    }
    throw new Error(
      "This ratchet message was not encrypted for the current device.",
    );
  }

  return withSessionLock(payload.senderDeviceId, async () => {
    const cached = await sessionStore.getCachedPlaintext(
      message.id,
      ownDeviceId,
    );
    if (cached?.protocolVersion === 2) {
      return cached.plaintext;
    }

    const envelope = transportToEnvelope(recipientPayload);
    let session = await sessionStore.getSession(payload.senderDeviceId);

    if (recipientPayload.x3dh) {
      const sharedSecret = await buildSharedSecretFromX3DH(
        recipientPayload.x3dh,
      );
      const signedPreKey = await sessionStore.getSignedPreKey(
        recipientPayload.x3dh.usedSignedPreKeyId,
      );

      if (!signedPreKey) {
        throw new Error("Local signed pre-key record is missing.");
      }

      session = initRatchetAsResponder(
        sharedSecret,
        signedPreKey.keyPair,
        payload.senderDeviceId,
      );
    }

    if (!session) {
      throw new Error("Ratchet session is unavailable for this sender device.");
    }

    const decrypted = await ratchetDecrypt(session, envelope);
    await sessionStore.saveSession(payload.senderDeviceId, decrypted.session);
    const plaintext = decoder.decode(decrypted.plaintext);
    await sessionStore.cachePlaintext(message.id, ownDeviceId, plaintext, 2);
    await refillOneTimePreKeysIfNeeded(ownDeviceId);
    return plaintext;
  });
}

export function generateOneTimePreKeyBatch(
  count = OPK_BATCH_SIZE,
): Array<{ id: number; keyPair: KeyPair }> {
  return Array.from({ length: count }, () => ({
    id: generateKeyId(),
    keyPair: generateX25519KeyPair(),
  }));
}

export async function cachePlaintextForMessage(
  messageId: number,
  plaintext: string,
  protocolVersion: number,
): Promise<void> {
  const ownDeviceId = await getOwnDeviceId();
  await sessionStore.cachePlaintext(
    messageId,
    ownDeviceId,
    plaintext,
    protocolVersion,
  );
}

export async function refillOneTimePreKeysIfNeeded(
  deviceId: number,
  knownCount?: number,
): Promise<void> {
  const existingCount =
    knownCount ?? (await sessionStore.countOneTimePreKeys());
  if (existingCount >= OPK_REFILL_THRESHOLD) {
    return;
  }

  const batch = generateOneTimePreKeyBatch();
  const result = await refillOneTimePreKeysAction(
    deviceId,
    batch.map((key) => ({
      keyId: key.id,
      publicKey: encodeBase64(key.keyPair.publicKey),
    })),
  );

  if (!result.success) {
    throw new Error(result.message);
  }

  await sessionStore.saveOneTimePreKeys(batch);
}

export async function rotateSignedPreKeyIfNeeded(
  deviceId: number,
  createdAt: Date | number | string | null | undefined,
): Promise<void> {
  if (!createdAt) {
    return;
  }

  const createdAtMs =
    createdAt instanceof Date
      ? createdAt.getTime()
      : typeof createdAt === "string"
        ? new Date(createdAt).getTime()
        : createdAt;

  if (!Number.isFinite(createdAtMs)) {
    return;
  }

  if (Date.now() - createdAtMs < SIGNED_PREKEY_MAX_AGE_MS) {
    return;
  }

  const identityKeys = await sessionStore.getIdentityKeys();
  if (!identityKeys) {
    throw new Error("Identity signing key is not available.");
  }

  const previousSignedPreKey = await sessionStore.getActiveSignedPreKey();
  const nextSignedPreKeyId = generateKeyId();
  const nextSignedPreKey = generateX25519KeyPair();
  const signature = ed25519Sign(
    identityKeys.signingKeyPair.privateKey,
    nextSignedPreKey.publicKey,
  );

  const result = await rotateSignedPreKeyAction({
    deviceId,
    signedPreKey: {
      keyId: nextSignedPreKeyId,
      publicKey: encodeBase64(nextSignedPreKey.publicKey),
      signature: encodeBase64(signature),
    },
  });

  if (!result.success) {
    throw new Error(result.message);
  }

  if (previousSignedPreKey) {
    await sessionStore.markSignedPreKeyInactive(previousSignedPreKey.id);
  }

  await sessionStore.saveSignedPreKey(
    nextSignedPreKeyId,
    nextSignedPreKey,
    signature,
  );
}

export async function decryptConversationMessage(
  input: DecryptConversationMessageInput,
): Promise<string> {
  const ownDeviceId = await getOwnDeviceId();
  const cached = await sessionStore.getCachedPlaintext(
    input.message.id,
    ownDeviceId,
  );
  if (cached?.protocolVersion === input.message.protocolVersion) {
    return cached.plaintext;
  }

  const payload = parseStoredMessagePayload(input.message.content);
  if (!payload) {
    return input.message.content;
  }

  if (isRatchetMessagePayload(payload)) {
    return decryptRatchetConversationMessage(input.message, ownDeviceId);
  }

  if (!isLegacyPayload(payload)) {
    return input.message.content;
  }

  const plaintext = await decryptLegacyConversationMessage(
    payload,
    input.message,
    input.currentUserId,
    input.contact,
    ownDeviceId,
  );
  await sessionStore.cachePlaintext(
    input.message.id,
    ownDeviceId,
    plaintext,
    1,
  );
  return plaintext;
}

export function encodePlaintext(plaintext: string): Uint8Array {
  return encoder.encode(plaintext);
}

export function decodePlaintext(plaintext: Uint8Array): string {
  return decoder.decode(plaintext);
}
