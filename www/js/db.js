// ===== Penyimpanan lokal (IndexedDB) — semua data tetap di perangkat =====
const DB_NAME = 'afnan-assistant';
const DB_VER = 1;
let dbp = null;

function open() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      if (!db.objectStoreNames.contains('blobs')) db.createObjectStore('blobs');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

async function tx(store, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    let out;
    const r = fn(s);
    if (r && 'onsuccess' in r) r.onsuccess = () => { out = r.result; };
    t.oncomplete = () => resolve(out);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export const kvGet = (k) => tx('kv', 'readonly', (s) => s.get(k));
export const kvSet = (k, v) => tx('kv', 'readwrite', (s) => s.put(v, k));
export const blobGet = (k) => tx('blobs', 'readonly', (s) => s.get(k));
export const blobSet = (k, v) => tx('blobs', 'readwrite', (s) => s.put(v, k));
export const blobDel = (k) => tx('blobs', 'readwrite', (s) => s.delete(k));
export const blobKeys = () => tx('blobs', 'readonly', (s) => s.getAllKeys());
export async function blobAll() {
  const db = await open();
  return new Promise((resolve, reject) => {
    const out = {};
    const t = db.transaction('blobs', 'readonly');
    const c = t.objectStore('blobs').openCursor();
    c.onsuccess = () => { const cur = c.result; if (cur) { out[cur.key] = cur.value; cur.continue(); } };
    t.oncomplete = () => resolve(out);
    t.onerror = () => reject(t.error);
  });
}
export const blobClear = () => tx('blobs', 'readwrite', (s) => s.clear());

// Minta penyimpanan persisten agar tidak dibersihkan otomatis oleh sistem
export async function requestPersist() {
  try { if (navigator.storage?.persist) await navigator.storage.persist(); } catch (_) { /* abaikan */ }
}
