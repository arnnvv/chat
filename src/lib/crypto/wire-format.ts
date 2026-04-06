import { decodeBase64, encodeBase64 } from "../encoding";
import type { EncryptedEnvelope, MessageHeader } from "./double-ratchet";

export interface X3DHTransportData {
  senderIdentityDHKey: string;
  senderEphemeralKey: string;
  usedSignedPreKeyId: number;
  usedOneTimePreKeyId?: number;
}

export interface RatchetRecipientPayload {
  header: {
    dhPub: string;
    pn: number;
    n: number;
  };
  ct: string;
  nonce: string;
  x3dh?: X3DHTransportData;
}

export interface RatchetMessagePayload {
  v: 2;
  senderDeviceId: number;
  recipients: Record<number, RatchetRecipientPayload>;
}

export interface LegacyMessagePayload {
  senderDeviceId: number;
  recipients: Record<number, string>;
}

export type StoredMessagePayload = LegacyMessagePayload | RatchetMessagePayload;

export function isRatchetMessagePayload(
  payload: StoredMessagePayload | unknown,
): payload is RatchetMessagePayload {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "v" in payload &&
    (payload as { v?: number }).v === 2
  );
}

export function envelopeToTransport(
  envelope: EncryptedEnvelope,
  x3dh?: X3DHTransportData,
): RatchetRecipientPayload {
  return {
    header: {
      dhPub: encodeBase64(envelope.header.dhPublicKey),
      pn: envelope.header.prevChainLength,
      n: envelope.header.messageNumber,
    },
    ct: encodeBase64(envelope.ciphertext),
    nonce: encodeBase64(envelope.nonce),
    ...(x3dh ? { x3dh } : {}),
  };
}

export function transportToEnvelope(
  payload: RatchetRecipientPayload,
): EncryptedEnvelope {
  return {
    header: {
      dhPublicKey: decodeBase64(payload.header.dhPub),
      prevChainLength: payload.header.pn,
      messageNumber: payload.header.n,
    } satisfies MessageHeader,
    ciphertext: decodeBase64(payload.ct),
    nonce: decodeBase64(payload.nonce),
  };
}

export function parseStoredMessagePayload(
  content: string,
): StoredMessagePayload | null {
  try {
    return JSON.parse(content) as StoredMessagePayload;
  } catch {
    return null;
  }
}
