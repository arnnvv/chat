export const DB_NAME = "chat-crypto-db";
export const DB_VERSION = 2;
export const KEY_STORE_NAME = "crypto-keys";
export const CONFIG_STORE_NAME = "device-config";
export const IDENTITY_KEY_STORE_NAME = "identity-keys";
export const SIGNED_PREKEY_STORE_NAME = "signed-prekeys";
export const ONE_TIME_PREKEY_STORE_NAME = "one-time-prekeys";
export const RATCHET_SESSION_STORE_NAME = "ratchet-sessions";
export const SKIPPED_MESSAGE_KEY_STORE_NAME = "skipped-message-keys";
export const MESSAGE_CACHE_STORE_NAME = "message-cache";

let db: IDBDatabase | null = null;

const upgradeCryptoDB = (dbInstance: IDBDatabase): void => {
  if (!dbInstance.objectStoreNames.contains(KEY_STORE_NAME)) {
    dbInstance.createObjectStore(KEY_STORE_NAME);
  }

  if (!dbInstance.objectStoreNames.contains(CONFIG_STORE_NAME)) {
    dbInstance.createObjectStore(CONFIG_STORE_NAME);
  }

  if (!dbInstance.objectStoreNames.contains(IDENTITY_KEY_STORE_NAME)) {
    dbInstance.createObjectStore(IDENTITY_KEY_STORE_NAME);
  }

  if (!dbInstance.objectStoreNames.contains(SIGNED_PREKEY_STORE_NAME)) {
    const store = dbInstance.createObjectStore(SIGNED_PREKEY_STORE_NAME, {
      keyPath: "id",
    });
    store.createIndex("isActive", "isActive", { unique: false });
  }

  if (!dbInstance.objectStoreNames.contains(ONE_TIME_PREKEY_STORE_NAME)) {
    dbInstance.createObjectStore(ONE_TIME_PREKEY_STORE_NAME, {
      keyPath: "id",
    });
  }

  if (!dbInstance.objectStoreNames.contains(RATCHET_SESSION_STORE_NAME)) {
    dbInstance.createObjectStore(RATCHET_SESSION_STORE_NAME, {
      keyPath: "remoteDeviceId",
    });
  }

  if (!dbInstance.objectStoreNames.contains(SKIPPED_MESSAGE_KEY_STORE_NAME)) {
    const store = dbInstance.createObjectStore(SKIPPED_MESSAGE_KEY_STORE_NAME, {
      keyPath: "id",
    });
    store.createIndex("remoteDeviceId", "remoteDeviceId", { unique: false });
  }

  if (!dbInstance.objectStoreNames.contains(MESSAGE_CACHE_STORE_NAME)) {
    const store = dbInstance.createObjectStore(MESSAGE_CACHE_STORE_NAME, {
      keyPath: "id",
    });
    store.createIndex("messageId", "messageId", { unique: false });
  }
};

export const getCryptoDB = (): Promise<IDBDatabase> => {
  if (db) {
    return Promise.resolve(db);
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error("Failed to open IndexedDB."));
    };

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const target = event.target as IDBOpenDBRequest | null;
      if (!target) return;
      upgradeCryptoDB(target.result);
    };
  });
};

export const performTransaction = async <T>(
  storeName: string,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> => {
  const dbInstance = await getCryptoDB();

  return new Promise((resolve, reject) => {
    const transaction = dbInstance.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    const request = action(store);

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
};

export const cryptoStore = {
  saveKey: async (keyName: string, key: CryptoKey): Promise<void> => {
    await performTransaction(KEY_STORE_NAME, "readwrite", (store) =>
      store.put(key, keyName),
    );
  },

  getKey: async (keyName: string): Promise<CryptoKey | undefined> => {
    return await performTransaction(KEY_STORE_NAME, "readonly", (store) =>
      store.get(keyName),
    );
  },

  saveDeviceId: async (deviceId: string): Promise<void> => {
    await performTransaction(CONFIG_STORE_NAME, "readwrite", (store) =>
      store.put(deviceId, "deviceId"),
    );
  },

  getDeviceId: async (): Promise<string | undefined> => {
    return await performTransaction(CONFIG_STORE_NAME, "readonly", (store) =>
      store.get("deviceId"),
    );
  },

  clearAll: async (): Promise<void> => {
    await Promise.all([
      performTransaction(KEY_STORE_NAME, "readwrite", (store) => store.clear()),
      performTransaction(CONFIG_STORE_NAME, "readwrite", (store) =>
        store.clear(),
      ),
    ]);
  },
};
