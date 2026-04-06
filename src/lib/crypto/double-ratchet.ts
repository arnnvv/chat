import { advanceChainKey } from "./kdf-chain";
import {
  aeadDecrypt,
  aeadEncrypt,
  concat,
  equal,
  generateX25519KeyPair,
  hkdfDerive,
  type KeyPair,
  wipe,
  x25519DH,
} from "./primitives";

const ROOT_KEY_LENGTH = 32;
const CHAIN_KEY_LENGTH = 32;
const MAX_SKIP = 256;
const SKIPPED_KEY_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const EMPTY_ROOT_KEY = new Uint8Array(ROOT_KEY_LENGTH);

export interface MessageHeader {
  dhPublicKey: Uint8Array;
  prevChainLength: number;
  messageNumber: number;
}

export interface EncryptedEnvelope {
  header: MessageHeader;
  ciphertext: Uint8Array;
  nonce: Uint8Array;
}

export interface SkippedMessageKey {
  messageKey: Uint8Array;
  timestamp: number;
}

export interface RatchetSession {
  remoteDeviceId: number;
  dhKeyPair: KeyPair;
  remoteDHPublicKey: Uint8Array | null;
  rootKey: Uint8Array;
  sendingChainKey: Uint8Array | null;
  sendMessageNumber: number;
  receivingChainKey: Uint8Array | null;
  recvMessageNumber: number;
  previousSendingChainLength: number;
  skippedKeys: Map<string, SkippedMessageKey>;
}

function cloneKeyPair(keyPair: KeyPair): KeyPair {
  return {
    privateKey: new Uint8Array(keyPair.privateKey),
    publicKey: new Uint8Array(keyPair.publicKey),
  };
}

function cloneSession(session: RatchetSession): RatchetSession {
  return {
    remoteDeviceId: session.remoteDeviceId,
    dhKeyPair: cloneKeyPair(session.dhKeyPair),
    remoteDHPublicKey: session.remoteDHPublicKey
      ? new Uint8Array(session.remoteDHPublicKey)
      : null,
    rootKey: new Uint8Array(session.rootKey),
    sendingChainKey: session.sendingChainKey
      ? new Uint8Array(session.sendingChainKey)
      : null,
    sendMessageNumber: session.sendMessageNumber,
    receivingChainKey: session.receivingChainKey
      ? new Uint8Array(session.receivingChainKey)
      : null,
    recvMessageNumber: session.recvMessageNumber,
    previousSendingChainLength: session.previousSendingChainLength,
    skippedKeys: new Map(
      Array.from(session.skippedKeys.entries(), ([key, value]) => [
        key,
        {
          messageKey: new Uint8Array(value.messageKey),
          timestamp: value.timestamp,
        },
      ]),
    ),
  };
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

function buildLookupKey(publicKey: Uint8Array, messageNumber: number): string {
  return `${bytesToHex(publicKey)}:${messageNumber}`;
}

export function serializeHeader(header: MessageHeader): Uint8Array {
  const buffer = new Uint8Array(40);
  buffer.set(header.dhPublicKey, 0);
  const view = new DataView(buffer.buffer);
  view.setUint32(32, header.prevChainLength, false);
  view.setUint32(36, header.messageNumber, false);
  return buffer;
}

function deriveRootAndChainKey(
  rootKey: Uint8Array,
  dhOutput: Uint8Array,
): { rootKey: Uint8Array; chainKey: Uint8Array } {
  const derived = hkdfDerive(
    dhOutput,
    rootKey.length === 0 ? EMPTY_ROOT_KEY : rootKey,
    "ratchet",
    ROOT_KEY_LENGTH + CHAIN_KEY_LENGTH,
  );

  return {
    rootKey: derived.slice(0, ROOT_KEY_LENGTH),
    chainKey: derived.slice(ROOT_KEY_LENGTH),
  };
}

function pruneExpiredSkippedKeys(session: RatchetSession): void {
  const cutoff = Date.now() - SKIPPED_KEY_TTL_MS;
  for (const [lookupKey, entry] of session.skippedKeys.entries()) {
    if (entry.timestamp < cutoff) {
      session.skippedKeys.delete(lookupKey);
    }
  }
}

function skipMessageKeys(
  session: RatchetSession,
  targetMessageNumber: number,
): RatchetSession {
  if (!session.receivingChainKey) {
    if (targetMessageNumber !== 0) {
      throw new Error("Receiving chain is not initialized.");
    }
    return session;
  }

  if (targetMessageNumber - session.recvMessageNumber > MAX_SKIP) {
    throw new Error("Too many skipped messages.");
  }

  let nextSession = cloneSession(session);
  while (nextSession.recvMessageNumber < targetMessageNumber) {
    if (!nextSession.receivingChainKey || !nextSession.remoteDHPublicKey) {
      throw new Error("Receiving chain is not initialized.");
    }

    const { nextChainKey, messageKey } = advanceChainKey(
      nextSession.receivingChainKey,
    );
    nextSession.skippedKeys.set(
      buildLookupKey(
        nextSession.remoteDHPublicKey,
        nextSession.recvMessageNumber,
      ),
      {
        messageKey,
        timestamp: Date.now(),
      },
    );
    nextSession.receivingChainKey = nextChainKey;
    nextSession.recvMessageNumber += 1;
  }

  return nextSession;
}

function performDHRatchet(
  session: RatchetSession,
  remoteDHPublicKey: Uint8Array,
): RatchetSession {
  let nextSession = cloneSession(session);

  const receivingDhOutput = x25519DH(
    nextSession.dhKeyPair.privateKey,
    remoteDHPublicKey,
  );
  const receivingStep = deriveRootAndChainKey(
    nextSession.rootKey,
    receivingDhOutput,
  );

  nextSession.rootKey = receivingStep.rootKey;
  nextSession.receivingChainKey = receivingStep.chainKey;
  nextSession.remoteDHPublicKey = new Uint8Array(remoteDHPublicKey);
  nextSession.recvMessageNumber = 0;
  nextSession.previousSendingChainLength = nextSession.sendMessageNumber;

  const nextDhKeyPair = generateX25519KeyPair();
  const sendingDhOutput = x25519DH(
    nextDhKeyPair.privateKey,
    nextSession.remoteDHPublicKey,
  );
  const sendingStep = deriveRootAndChainKey(
    nextSession.rootKey,
    sendingDhOutput,
  );

  nextSession.rootKey = sendingStep.rootKey;
  nextSession.sendingChainKey = sendingStep.chainKey;
  nextSession.sendMessageNumber = 0;
  nextSession.dhKeyPair = nextDhKeyPair;

  return nextSession;
}

export function initRatchetAsInitiator(
  sharedSecret: Uint8Array,
  remotePublicKey: Uint8Array,
  remoteDeviceId = 0,
): RatchetSession {
  const dhKeyPair = generateX25519KeyPair();
  const dhOutput = x25519DH(dhKeyPair.privateKey, remotePublicKey);
  const { rootKey, chainKey } = deriveRootAndChainKey(sharedSecret, dhOutput);

  return {
    remoteDeviceId,
    dhKeyPair,
    remoteDHPublicKey: new Uint8Array(remotePublicKey),
    rootKey,
    sendingChainKey: chainKey,
    sendMessageNumber: 0,
    receivingChainKey: null,
    recvMessageNumber: 0,
    previousSendingChainLength: 0,
    skippedKeys: new Map(),
  };
}

export function initRatchetAsResponder(
  sharedSecret: Uint8Array,
  ownKeyPair: KeyPair,
  remoteDeviceId = 0,
): RatchetSession {
  return {
    remoteDeviceId,
    dhKeyPair: cloneKeyPair(ownKeyPair),
    remoteDHPublicKey: null,
    rootKey: new Uint8Array(sharedSecret),
    sendingChainKey: null,
    sendMessageNumber: 0,
    receivingChainKey: null,
    recvMessageNumber: 0,
    previousSendingChainLength: 0,
    skippedKeys: new Map(),
  };
}

export async function ratchetEncrypt(
  session: RatchetSession,
  plaintext: Uint8Array,
): Promise<{ session: RatchetSession; envelope: EncryptedEnvelope }> {
  let nextSession = cloneSession(session);
  pruneExpiredSkippedKeys(nextSession);

  if (!nextSession.sendingChainKey) {
    if (!nextSession.remoteDHPublicKey) {
      throw new Error("Remote ratchet public key is not set.");
    }

    nextSession.previousSendingChainLength = nextSession.sendMessageNumber;
    nextSession.dhKeyPair = generateX25519KeyPair();
    const dhOutput = x25519DH(
      nextSession.dhKeyPair.privateKey,
      nextSession.remoteDHPublicKey,
    );
    const { rootKey, chainKey } = deriveRootAndChainKey(
      nextSession.rootKey,
      dhOutput,
    );
    nextSession.rootKey = rootKey;
    nextSession.sendingChainKey = chainKey;
    nextSession.sendMessageNumber = 0;
  }

  const { nextChainKey, messageKey } = advanceChainKey(
    nextSession.sendingChainKey,
  );
  const header: MessageHeader = {
    dhPublicKey: new Uint8Array(nextSession.dhKeyPair.publicKey),
    prevChainLength: nextSession.previousSendingChainLength,
    messageNumber: nextSession.sendMessageNumber,
  };
  const associatedData = serializeHeader(header);
  const { ciphertext, nonce } = await aeadEncrypt(
    messageKey,
    plaintext,
    associatedData,
  );

  wipe(messageKey);

  nextSession.sendingChainKey = nextChainKey;
  nextSession.sendMessageNumber += 1;

  return {
    session: nextSession,
    envelope: {
      header,
      ciphertext,
      nonce,
    },
  };
}

export async function ratchetDecrypt(
  session: RatchetSession,
  envelope: EncryptedEnvelope,
): Promise<{ session: RatchetSession; plaintext: Uint8Array }> {
  let nextSession = cloneSession(session);
  pruneExpiredSkippedKeys(nextSession);

  const lookupKey = buildLookupKey(
    envelope.header.dhPublicKey,
    envelope.header.messageNumber,
  );
  const skippedKey = nextSession.skippedKeys.get(lookupKey);
  const associatedData = serializeHeader(envelope.header);

  if (skippedKey) {
    nextSession.skippedKeys.delete(lookupKey);
    try {
      const plaintext = await aeadDecrypt(
        skippedKey.messageKey,
        envelope.ciphertext,
        envelope.nonce,
        associatedData,
      );
      wipe(skippedKey.messageKey);
      return { session: nextSession, plaintext };
    } catch (error) {
      wipe(skippedKey.messageKey);
      throw error;
    }
  }

  const needsDHRatchet =
    !nextSession.remoteDHPublicKey ||
    !equal(nextSession.remoteDHPublicKey, envelope.header.dhPublicKey);

  if (needsDHRatchet) {
    nextSession = skipMessageKeys(nextSession, envelope.header.prevChainLength);
    nextSession = performDHRatchet(nextSession, envelope.header.dhPublicKey);
  }

  nextSession = skipMessageKeys(nextSession, envelope.header.messageNumber);

  if (!nextSession.receivingChainKey) {
    throw new Error("Receiving chain is not initialized.");
  }

  const { nextChainKey, messageKey } = advanceChainKey(
    nextSession.receivingChainKey,
  );
  const plaintext = await aeadDecrypt(
    messageKey,
    envelope.ciphertext,
    envelope.nonce,
    associatedData,
  );

  wipe(messageKey);

  nextSession.receivingChainKey = nextChainKey;
  nextSession.recvMessageNumber += 1;

  return { session: nextSession, plaintext };
}
