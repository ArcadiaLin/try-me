import type { AnnotationsDocument, LyricLine } from "../types.ts";

const DB_NAME = "try_me_annotator_pwa_db";
const STORE_NAME = "draft_snapshots";
const DRAFT_KEY = "active_draft_v1";

export interface OfflineDraftRecord {
  savedAtUtc: string;
  revision: string | null;
  annotations: AnnotationsDocument | null;
  lyricsLines: LyricLine[] | null;
  hasUnsyncedChanges: boolean;
}

function openDraftDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function saveIdbDraft(record: OfflineDraftRecord): Promise<void> {
  const db = await openDraftDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(record, DRAFT_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function loadIdbDraft(): Promise<OfflineDraftRecord | null> {
  const db = await openDraftDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(DRAFT_KEY);
      req.onsuccess = () =>
        resolve((req.result as OfflineDraftRecord) || null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function clearIdbDraft(): Promise<void> {
  const db = await openDraftDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(DRAFT_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}
