import { decodeBase64, encodeBase64 } from "../encoding";
import {
  CONFIG_STORE_NAME,
  getCryptoDB,
  IDENTITY_KEY_STORE_NAME,
  KEY_STORE_NAME,
  MESSAGE_CACHE_STORE_NAME,
  ONE_TIME_PREKEY_STORE_NAME,
  RATCHET_SESSION_STORE_NAME,
  SIGNED_PREKEY_STORE_NAME,
  SKIPPED_MESSAGE_KEY_STORE_NAME,
} from "../crypto-store";
import type { RatchetSession, SkippedMessageKey } from "./double-ratchet";
import type { KeyPair } from "./primitives";

interface SerializedKeyPair {
  privateKey: string;
  publicKey: string;
}

interface IdentityKeyRecord {
  signingKeyPair: SerializedKeyPair;
  dhKeyPair: SerializedKeyPair;
}

interface SignedPreKeyRecord {
  id: number;
  keyPair: SerializedKeyPair;
  signature: string;
  createdAt: number;
  isActive: boolean;
}

interface OneTimePreKeyRecord {
  id: number;
  keyPair: SerializedKeyPair;
}

interface RatchetSessionRecord {
  remoteDeviceId: number;
  dhKeyPair: SerializedKeyPair;
  remoteDHPublicKey: string | null;
  rootKey: string;
  sendingChainKey: string | null;
  sendMessageNumber: number;
  receivingChainKey: string | null;
  recvMessageNumber: number;
  previousSendingChainLength: number;
}

interface SkippedMessageKeyRecord {
  id: string;
  remoteDeviceId: number;
  lookupKey: string;
  messageKey: string;
  timestamp: number;
}

interface MessageCacheRecord {
  id: string;
  messageId: number;
  deviceId: number;
  plaintext: string;
  protocolVersion: number;
  updatedAt: number;
}

function serializeKeyPair(keyPair: KeyPair): SerializedKeyPair {
  return {
    privateKey: encodeBase64(keyPair.privateKey),
    publicKey: encodeBase64(keyPair.publicKey),
  };
}

function deserializeKeyPair(keyPair: SerializedKeyPair): KeyPair {
  return {
    privateKey: decodeBase64(keyPair.privateKey),
    publicKey: decodeBase64(keyPair.publicKey),
  };
}

function serializeSession(session: RatchetSession): RatchetSessionRecord {
  return {
    remoteDeviceId: session.remoteDeviceId,
    dhKeyPair: serializeKeyPair(session.dhKeyPair),
    remoteDHPublicKey: session.remoteDHPublicKey
      ? encodeBase64(session.remoteDHPublicKey)
      : null,
    rootKey: encodeBase64(session.rootKey),
    sendingChainKey: session.sendingChainKey
      ? encodeBase64(session.sendingChainKey)
      : null,
    sendMessageNumber: session.sendMessageNumber,
    receivingChainKey: session.receivingChainKey
      ? encodeBase64(session.receivingChainKey)
      : null,
    recvMessageNumber: session.recvMessageNumber,
    previousSendingChainLength: session.previousSendingChainLength,
  };
}

function deserializeSession(
  session: RatchetSessionRecord,
  skippedKeys: Map<string, SkippedMessageKey>,
): RatchetSession {
  return {
    remoteDeviceId: session.remoteDeviceId,
    dhKeyPair: deserializeKeyPair(session.dhKeyPair),
    remoteDHPublicKey: session.remoteDHPublicKey
      ? decodeBase64(session.remoteDHPublicKey)
      : null,
    rootKey: decodeBase64(session.rootKey),
    sendingChainKey: session.sendingChainKey
      ? decodeBase64(session.sendingChainKey)
      : null,
    sendMessageNumber: session.sendMessageNumber,
    receivingChainKey: session.receivingChainKey
      ? decodeBase64(session.receivingChainKey)
      : null,
    recvMessageNumber: session.recvMessageNumber,
    previousSendingChainLength: session.previousSendingChainLength,
    skippedKeys,
  };
}

function waitForRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function waitForTransaction(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

async function getAllSkippedKeys(
  remoteDeviceId: number,
): Promise<Map<string, SkippedMessageKey>> {
  const db = await getCryptoDB();
  const transaction = db.transaction(
    SKIPPED_MESSAGE_KEY_STORE_NAME,
    "readonly",
  );
  const store = transaction.objectStore(SKIPPED_MESSAGE_KEY_STORE_NAME);
  const index = store.index("remoteDeviceId");
  const request = index.getAll(remoteDeviceId);
  const records = await waitForRequest(
    request as IDBRequest<SkippedMessageKeyRecord[]>,
  );
  await waitForTransaction(transaction);

  return new Map(
    records.map((record) => [
      record.lookupKey,
      {
        messageKey: decodeBase64(record.messageKey),
        timestamp: record.timestamp,
      },
    ]),
  );
}

async function clearStore(storeName: string): Promise<void> {
  const db = await getCryptoDB();
  const transaction = db.transaction(storeName, "readwrite");
  transaction.objectStore(storeName).clear();
  await waitForTransaction(transaction);
}

export const sessionStore = {
  saveIdentityKeys: async (
    signingKeyPair: KeyPair,
    dhKeyPair: KeyPair,
  ): Promise<void> => {
    const db = await getCryptoDB();
    const transaction = db.transaction(IDENTITY_KEY_STORE_NAME, "readwrite");
    const store = transaction.objectStore(IDENTITY_KEY_STORE_NAME);
    store.put(
      {
        signingKeyPair: serializeKeyPair(signingKeyPair),
        dhKeyPair: serializeKeyPair(dhKeyPair),
      } satisfies IdentityKeyRecord,
      "identityKeys",
    );
    await waitForTransaction(transaction);
  },

  getIdentityKeys: async (): Promise<{
    signingKeyPair: KeyPair;
    dhKeyPair: KeyPair;
  } | null> => {
    const db = await getCryptoDB();
    const transaction = db.transaction(IDENTITY_KEY_STORE_NAME, "readonly");
    const store = transaction.objectStore(IDENTITY_KEY_STORE_NAME);
    const record = (await waitForRequest(store.get("identityKeys"))) as
      | IdentityKeyRecord
      | undefined;
    await waitForTransaction(transaction);

    if (!record) {
      return null;
    }

    return {
      signingKeyPair: deserializeKeyPair(record.signingKeyPair),
      dhKeyPair: deserializeKeyPair(record.dhKeyPair),
    };
  },

  saveSignedPreKey: async (
    id: number,
    keyPair: KeyPair,
    signature: Uint8Array,
    options?: {
      createdAt?: number;
      isActive?: boolean;
    },
  ): Promise<void> => {
    const db = await getCryptoDB();
    const transaction = db.transaction(SIGNED_PREKEY_STORE_NAME, "readwrite");
    const store = transaction.objectStore(SIGNED_PREKEY_STORE_NAME);
    store.put({
      id,
      keyPair: serializeKeyPair(keyPair),
      signature: encodeBase64(signature),
      createdAt: options?.createdAt ?? Date.now(),
      isActive: options?.isActive ?? true,
    } satisfies SignedPreKeyRecord);
    await waitForTransaction(transaction);
  },

  getSignedPreKey: async (
    id: number,
  ): Promise<{
    keyPair: KeyPair;
    signature: Uint8Array;
    createdAt: number;
    isActive: boolean;
  } | null> => {
    const db = await getCryptoDB();
    const transaction = db.transaction(SIGNED_PREKEY_STORE_NAME, "readonly");
    const store = transaction.objectStore(SIGNED_PREKEY_STORE_NAME);
    const record = (await waitForRequest(store.get(id))) as
      | SignedPreKeyRecord
      | undefined;
    await waitForTransaction(transaction);

    if (!record) {
      return null;
    }

    return {
      keyPair: deserializeKeyPair(record.keyPair),
      signature: decodeBase64(record.signature),
      createdAt: record.createdAt,
      isActive: record.isActive,
    };
  },

  markSignedPreKeyInactive: async (id: number): Promise<void> => {
    const db = await getCryptoDB();
    const transaction = db.transaction(SIGNED_PREKEY_STORE_NAME, "readwrite");
    const store = transaction.objectStore(SIGNED_PREKEY_STORE_NAME);
    const record = (await waitForRequest(store.get(id))) as
      | SignedPreKeyRecord
      | undefined;
    if (record) {
      store.put({ ...record, isActive: false } satisfies SignedPreKeyRecord);
    }
    await waitForTransaction(transaction);
  },

  getActiveSignedPreKey: async (): Promise<{
    id: number;
    keyPair: KeyPair;
    signature: Uint8Array;
    createdAt: number;
  } | null> => {
    const db = await getCryptoDB();
    const transaction = db.transaction(SIGNED_PREKEY_STORE_NAME, "readonly");
    const store = transaction.objectStore(SIGNED_PREKEY_STORE_NAME);
    const records = (await waitForRequest(
      store.getAll(),
    )) as SignedPreKeyRecord[];
    await waitForTransaction(transaction);

    const active = records
      .sort((a, b) => b.createdAt - a.createdAt)
      .find((record) => record.isActive);

    if (!active) {
      return null;
    }

    return {
      id: active.id,
      keyPair: deserializeKeyPair(active.keyPair),
      signature: decodeBase64(active.signature),
      createdAt: active.createdAt,
    };
  },

  saveOneTimePreKeys: async (
    keys: Array<{ id: number; keyPair: KeyPair }>,
  ): Promise<void> => {
    const db = await getCryptoDB();
    const transaction = db.transaction(ONE_TIME_PREKEY_STORE_NAME, "readwrite");
    const store = transaction.objectStore(ONE_TIME_PREKEY_STORE_NAME);

    for (const key of keys) {
      store.put({
        id: key.id,
        keyPair: serializeKeyPair(key.keyPair),
      } satisfies OneTimePreKeyRecord);
    }

    await waitForTransaction(transaction);
  },

  replaceOneTimePreKeys: async (
    keys: Array<{ id: number; keyPair: KeyPair }>,
  ): Promise<void> => {
    const db = await getCryptoDB();
    const transaction = db.transaction(ONE_TIME_PREKEY_STORE_NAME, "readwrite");
    const store = transaction.objectStore(ONE_TIME_PREKEY_STORE_NAME);
    store.clear();

    for (const key of keys) {
      store.put({
        id: key.id,
        keyPair: serializeKeyPair(key.keyPair),
      } satisfies OneTimePreKeyRecord);
    }

    await waitForTransaction(transaction);
  },

  getOneTimePreKey: async (id: number): Promise<KeyPair | null> => {
    const db = await getCryptoDB();
    const transaction = db.transaction(ONE_TIME_PREKEY_STORE_NAME, "readonly");
    const store = transaction.objectStore(ONE_TIME_PREKEY_STORE_NAME);
    const record = (await waitForRequest(store.get(id))) as
      | OneTimePreKeyRecord
      | undefined;
    await waitForTransaction(transaction);

    return record ? deserializeKeyPair(record.keyPair) : null;
  },

  deleteOneTimePreKey: async (id: number): Promise<void> => {
    const db = await getCryptoDB();
    const transaction = db.transaction(ONE_TIME_PREKEY_STORE_NAME, "readwrite");
    transaction.objectStore(ONE_TIME_PREKEY_STORE_NAME).delete(id);
    await waitForTransaction(transaction);
  },

  countOneTimePreKeys: async (): Promise<number> => {
    const db = await getCryptoDB();
    const transaction = db.transaction(ONE_TIME_PREKEY_STORE_NAME, "readonly");
    const count = await waitForRequest(
      transaction.objectStore(ONE_TIME_PREKEY_STORE_NAME).count(),
    );
    await waitForTransaction(transaction);
    return count;
  },

  saveSession: async (
    remoteDeviceId: number,
    session: RatchetSession,
  ): Promise<void> => {
    const db = await getCryptoDB();
    const transaction = db.transaction(
      [RATCHET_SESSION_STORE_NAME, SKIPPED_MESSAGE_KEY_STORE_NAME],
      "readwrite",
    );
    const sessionStoreRef = transaction.objectStore(RATCHET_SESSION_STORE_NAME);
    const skippedStoreRef = transaction.objectStore(
      SKIPPED_MESSAGE_KEY_STORE_NAME,
    );
    const skippedIndex = skippedStoreRef.index("remoteDeviceId");

    sessionStoreRef.put(serializeSession({ ...session, remoteDeviceId }));

    const existingSkippedKeys = (await waitForRequest(
      skippedIndex.getAll(remoteDeviceId),
    )) as SkippedMessageKeyRecord[];
    for (const record of existingSkippedKeys) {
      skippedStoreRef.delete(record.id);
    }

    for (const [lookupKey, entry] of session.skippedKeys.entries()) {
      skippedStoreRef.put({
        id: `${remoteDeviceId}:${lookupKey}`,
        remoteDeviceId,
        lookupKey,
        messageKey: encodeBase64(entry.messageKey),
        timestamp: entry.timestamp,
      } satisfies SkippedMessageKeyRecord);
    }

    await waitForTransaction(transaction);
  },

  getSession: async (
    remoteDeviceId: number,
  ): Promise<RatchetSession | null> => {
    const db = await getCryptoDB();
    const transaction = db.transaction(RATCHET_SESSION_STORE_NAME, "readonly");
    const record = (await waitForRequest(
      transaction.objectStore(RATCHET_SESSION_STORE_NAME).get(remoteDeviceId),
    )) as RatchetSessionRecord | undefined;
    await waitForTransaction(transaction);

    if (!record) {
      return null;
    }

    const skippedKeys = await getAllSkippedKeys(remoteDeviceId);
    return deserializeSession(record, skippedKeys);
  },

  deleteSession: async (remoteDeviceId: number): Promise<void> => {
    const db = await getCryptoDB();
    const transaction = db.transaction(
      [RATCHET_SESSION_STORE_NAME, SKIPPED_MESSAGE_KEY_STORE_NAME],
      "readwrite",
    );
    transaction.objectStore(RATCHET_SESSION_STORE_NAME).delete(remoteDeviceId);
    const skippedStoreRef = transaction.objectStore(
      SKIPPED_MESSAGE_KEY_STORE_NAME,
    );
    const skippedIndex = skippedStoreRef.index("remoteDeviceId");
    const existingSkippedKeys = (await waitForRequest(
      skippedIndex.getAll(remoteDeviceId),
    )) as SkippedMessageKeyRecord[];
    for (const record of existingSkippedKeys) {
      skippedStoreRef.delete(record.id);
    }
    await waitForTransaction(transaction);
  },

  hasSession: async (remoteDeviceId: number): Promise<boolean> => {
    const db = await getCryptoDB();
    const transaction = db.transaction(RATCHET_SESSION_STORE_NAME, "readonly");
    const count = await waitForRequest(
      transaction.objectStore(RATCHET_SESSION_STORE_NAME).count(remoteDeviceId),
    );
    await waitForTransaction(transaction);
    return count > 0;
  },

  cachePlaintext: async (
    messageId: number,
    deviceId: number,
    plaintext: string,
    protocolVersion: number,
  ): Promise<void> => {
    const db = await getCryptoDB();
    const transaction = db.transaction(MESSAGE_CACHE_STORE_NAME, "readwrite");
    transaction.objectStore(MESSAGE_CACHE_STORE_NAME).put({
      id: `${deviceId}:${messageId}`,
      messageId,
      deviceId,
      plaintext,
      protocolVersion,
      updatedAt: Date.now(),
    } satisfies MessageCacheRecord);
    await waitForTransaction(transaction);
  },

  getCachedPlaintext: async (
    messageId: number,
    deviceId: number,
  ): Promise<{ plaintext: string; protocolVersion: number } | null> => {
    const db = await getCryptoDB();
    const transaction = db.transaction(MESSAGE_CACHE_STORE_NAME, "readonly");
    const record = (await waitForRequest(
      transaction
        .objectStore(MESSAGE_CACHE_STORE_NAME)
        .get(`${deviceId}:${messageId}`),
    )) as MessageCacheRecord | undefined;
    await waitForTransaction(transaction);

    if (!record) {
      return null;
    }

    return {
      plaintext: record.plaintext,
      protocolVersion: record.protocolVersion,
    };
  },

  clearAll: async (): Promise<void> => {
    await Promise.all([
      clearStore(KEY_STORE_NAME),
      clearStore(CONFIG_STORE_NAME),
      clearStore(IDENTITY_KEY_STORE_NAME),
      clearStore(SIGNED_PREKEY_STORE_NAME),
      clearStore(ONE_TIME_PREKEY_STORE_NAME),
      clearStore(RATCHET_SESSION_STORE_NAME),
      clearStore(SKIPPED_MESSAGE_KEY_STORE_NAME),
      clearStore(MESSAGE_CACHE_STORE_NAME),
    ]);
  },
};
