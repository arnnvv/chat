import { ed25519, x25519 } from "@noble/curves/ed25519.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { hmac } from "@noble/hashes/hmac.js";
import { sha256 } from "@noble/hashes/sha2.js";

export interface KeyPair {
  privateKey: Uint8Array;
  publicKey: Uint8Array;
}

const AES_KEY_LENGTH = 32;

function getSubtle(): SubtleCrypto {
  return globalThis.crypto.subtle;
}

function normalizeBytes(bytes: Uint8Array): Uint8Array {
  return Uint8Array.from(bytes);
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const normalized = normalizeBytes(bytes);
  const buffer = new ArrayBuffer(normalized.byteLength);
  new Uint8Array(buffer).set(normalized);
  return buffer;
}

export function generateX25519KeyPair(): KeyPair {
  const privateKey = x25519.utils.randomSecretKey();
  const publicKey = x25519.getPublicKey(privateKey);
  return { privateKey, publicKey };
}

export function x25519DH(
  privateKey: Uint8Array,
  publicKey: Uint8Array,
): Uint8Array {
  return x25519.getSharedSecret(privateKey, publicKey);
}

export function generateEd25519KeyPair(): KeyPair {
  const privateKey = ed25519.utils.randomSecretKey();
  const publicKey = ed25519.getPublicKey(privateKey);
  return { privateKey, publicKey };
}

export function ed25519Sign(
  privateKey: Uint8Array,
  message: Uint8Array,
): Uint8Array {
  return ed25519.sign(message, privateKey);
}

export function ed25519Verify(
  publicKey: Uint8Array,
  message: Uint8Array,
  signature: Uint8Array,
): boolean {
  return ed25519.verify(signature, message, publicKey);
}

export function hkdfDerive(
  ikm: Uint8Array,
  salt: Uint8Array,
  info: string,
  length: number,
): Uint8Array {
  return hkdf(sha256, ikm, salt, new TextEncoder().encode(info), length);
}

export function hmacSHA256(key: Uint8Array, data: Uint8Array): Uint8Array {
  return hmac(sha256, key, data);
}

async function importAesKey(rawKey: Uint8Array): Promise<CryptoKey> {
  const normalizedKey = normalizeBytes(rawKey);
  if (normalizedKey.length !== AES_KEY_LENGTH) {
    throw new Error("AES-GCM key must be 32 bytes.");
  }

  return getSubtle().importKey(
    "raw",
    toArrayBuffer(normalizedKey),
    {
      name: "AES-GCM",
      length: 256,
    },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function aeadEncrypt(
  key: Uint8Array,
  plaintext: Uint8Array,
  ad: Uint8Array,
): Promise<{ ciphertext: Uint8Array; nonce: Uint8Array }> {
  const cryptoKey = await importAesKey(key);
  const nonce = generateNonce();
  const normalizedPlaintext = normalizeBytes(plaintext);
  const normalizedAd = normalizeBytes(ad);
  const ciphertext = await getSubtle().encrypt(
    {
      name: "AES-GCM",
      iv: toArrayBuffer(nonce),
      additionalData: toArrayBuffer(normalizedAd),
    },
    cryptoKey,
    toArrayBuffer(normalizedPlaintext),
  );

  return {
    ciphertext: new Uint8Array(ciphertext),
    nonce,
  };
}

export async function aeadDecrypt(
  key: Uint8Array,
  ciphertext: Uint8Array,
  nonce: Uint8Array,
  ad: Uint8Array,
): Promise<Uint8Array> {
  const cryptoKey = await importAesKey(key);
  const normalizedCiphertext = normalizeBytes(ciphertext);
  const normalizedNonce = normalizeBytes(nonce);
  const normalizedAd = normalizeBytes(ad);
  const plaintext = await getSubtle().decrypt(
    {
      name: "AES-GCM",
      iv: toArrayBuffer(normalizedNonce),
      additionalData: toArrayBuffer(normalizedAd),
    },
    cryptoKey,
    toArrayBuffer(normalizedCiphertext),
  );

  return new Uint8Array(plaintext);
}

export function generateNonce(): Uint8Array {
  return globalThis.crypto.getRandomValues(new Uint8Array(12));
}

export function concat(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, current) => sum + current.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;

  for (const array of arrays) {
    result.set(array, offset);
    offset += array.length;
  }

  return result;
}

export function wipe(array: Uint8Array): void {
  array.fill(0);
}

export function equal(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }

  return diff === 0;
}
