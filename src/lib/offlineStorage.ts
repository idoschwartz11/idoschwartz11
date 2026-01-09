// IndexedDB Offline Storage Module

const DB_NAME = 'shopping-list-offline';
const DB_VERSION = 1;

export interface OfflineItem {
  id: string;
  name: string;
  quantity: number;
  bought: boolean;
  created_at: string;
  updated_at: string;
}

export interface PendingSyncAction {
  id: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  data: any;
  timestamp: number;
}

let db: IDBDatabase | null = null;

export async function initOfflineDB(): Promise<IDBDatabase> {
  if (db) return db;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;

      // Items store
      if (!database.objectStoreNames.contains('items')) {
        database.createObjectStore('items', { keyPath: 'id' });
      }

      // Pending sync queue
      if (!database.objectStoreNames.contains('pendingSync')) {
        const syncStore = database.createObjectStore('pendingSync', { keyPath: 'id' });
        syncStore.createIndex('timestamp', 'timestamp', { unique: false });
      }

      // Price cache
      if (!database.objectStoreNames.contains('priceCache')) {
        database.createObjectStore('priceCache', { keyPath: 'query' });
      }
    };
  });
}

// Items operations
export async function getAllItems(): Promise<OfflineItem[]> {
  const database = await initOfflineDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['items'], 'readonly');
    const store = transaction.objectStore('items');
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

export async function saveItem(item: OfflineItem): Promise<void> {
  const database = await initOfflineDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['items'], 'readwrite');
    const store = transaction.objectStore('items');
    const request = store.put(item);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function deleteItemLocal(id: string): Promise<void> {
  const database = await initOfflineDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['items'], 'readwrite');
    const store = transaction.objectStore('items');
    const request = store.delete(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function clearAllItems(): Promise<void> {
  const database = await initOfflineDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['items'], 'readwrite');
    const store = transaction.objectStore('items');
    const request = store.clear();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function saveAllItems(items: OfflineItem[]): Promise<void> {
  const database = await initOfflineDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['items'], 'readwrite');
    const store = transaction.objectStore('items');
    
    // Clear existing items first
    store.clear();
    
    // Add all items
    items.forEach(item => store.put(item));
    
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

// Pending sync operations
export async function addPendingSync(action: Omit<PendingSyncAction, 'id'>): Promise<void> {
  const database = await initOfflineDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['pendingSync'], 'readwrite');
    const store = transaction.objectStore('pendingSync');
    const syncAction: PendingSyncAction = {
      ...action,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
    const request = store.add(syncAction);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function getAllPendingSync(): Promise<PendingSyncAction[]> {
  const database = await initOfflineDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['pendingSync'], 'readonly');
    const store = transaction.objectStore('pendingSync');
    const index = store.index('timestamp');
    const request = index.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

export async function clearPendingSync(): Promise<void> {
  const database = await initOfflineDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['pendingSync'], 'readwrite');
    const store = transaction.objectStore('pendingSync');
    const request = store.clear();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function removePendingSync(id: string): Promise<void> {
  const database = await initOfflineDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['pendingSync'], 'readwrite');
    const store = transaction.objectStore('pendingSync');
    const request = store.delete(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function hasPendingSync(): Promise<boolean> {
  const pending = await getAllPendingSync();
  return pending.length > 0;
}
