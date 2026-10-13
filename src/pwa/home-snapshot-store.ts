import {
  chooseHomeSnapshot,
  HOME_SNAPSHOT_KEY,
  parseHomeSnapshot,
  serializeHomeSnapshot,
  type HomeSnapshot,
} from "./home-snapshot";

const DB_NAME = "inga";
const STORE = "snapshots";

function openDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function readHomeSnapshot(): Promise<HomeSnapshot | null> {
  const legacy = parseHomeSnapshot(window.localStorage.getItem(HOME_SNAPSHOT_KEY));
  try {
    const db = await openDb();
    const raw = await new Promise<string | null>((resolve, reject) => {
      const request = db.transaction(STORE, "readonly").objectStore(STORE).get(HOME_SNAPSHOT_KEY);
      request.onsuccess = () => resolve(typeof request.result === "string" ? request.result : null);
      request.onerror = () => reject(request.error);
    });
    db.close();
    const stored = parseHomeSnapshot(raw);
    const chosen = chooseHomeSnapshot(stored, legacy);
    if (!stored && chosen) await writeHomeSnapshot(chosen);
    return chosen;
  } catch {
    return legacy;
  }
}

export async function writeHomeSnapshot(snapshot: HomeSnapshot) {
  const raw = serializeHomeSnapshot(snapshot);
  try {
    window.localStorage.setItem(HOME_SNAPSHOT_KEY, raw);
  } catch {
    /* storage unavailable */
  }
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(raw, HOME_SNAPSHOT_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    /* indexedDB unavailable */
  }
}

export async function clearHomeSnapshot() {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(HOME_SNAPSHOT_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    /* indexedDB unavailable */
  }
}
