const DB_NAME = "chat-crypto-db";
const DB_VERSION = 1;
const KEY_STORE_NAME = "crypto-keys";
const CONFIG_STORE_NAME = "device-config";

let db: IDBDatabase | null = null;

const getDB = (): Promise<IDBDatabase> => {
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
      const dbInstance = target.result;
      if (!dbInstance.objectStoreNames.contains(KEY_STORE_NAME)) {
        dbInstance.createObjectStore(KEY_STORE_NAME);
      }
      if (!dbInstance.objectStoreNames.contains(CONFIG_STORE_NAME)) {
        dbInstance.createObjectStore(CONFIG_STORE_NAME);
      }
    };
  });
};

const performTransaction = async <T>(
  storeName: string,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> => {
  const dbInstance = await getDB();

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
