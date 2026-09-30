import type { ProjectFile } from '@/types';

export interface WorkspaceRecord {
  projects: ProjectFile[];
  selectedId: string | null;
}

const DB_NAME = 'minecad-workspace';
const STORE = 'state';
const KEY = 'current';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function loadWorkspace(): Promise<WorkspaceRecord | null> {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const request = tx.objectStore(STORE).get(KEY);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

let saveQueue: Promise<void> = Promise.resolve();
export function saveWorkspace(value: WorkspaceRecord): Promise<void> {
  saveQueue = saveQueue.catch(() => {}).then(async () => {
    const db = await openDatabase();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(value, KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  });
  return saveQueue;
}

export function isProjectFile(value: unknown): value is ProjectFile {
  if (!value || typeof value !== 'object') return false;
  const p = value as Partial<ProjectFile>;
  return typeof p.name === 'string' && p.name.length <= 120 &&
    typeof p.object_type === 'string' && !!p.properties && typeof p.properties === 'object' &&
    !!p.geometry && Array.isArray(p.geometry.primitives) && Array.isArray(p.geometry.meshes) &&
    Array.isArray(p.geometry.layers) && !!p.geometry.bounds;
}
