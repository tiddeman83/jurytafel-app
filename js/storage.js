import { migrate } from './clock.js';

const DB_NAME = 'jurytafel';
const DB_VER = 1;

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('indexedDB ontbreekt'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function getKv(db, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('kv', 'readonly');
    const req = tx.objectStore('kv').get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function chooseCurrent(fromIdb, fromLocal) {
  const a = fromIdb ? migrate(fromIdb) : null;
  const b = fromLocal ? migrate(fromLocal) : null;
  if (!a) return b || migrate(null);
  if (!b) return a;
  return (a.savedAt || 0) >= (b.savedAt || 0) ? a : b;
}

function readLocal() {
  try {
    const raw = localStorage.getItem('jt');
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    return null;
  }
}

export async function loadAll() {
  let idbCurrent = null;
  let archive = [];
  let meta = { installDismissed: false };
  let idbOk = false;
  try {
    const db = await openDb();
    idbCurrent = await getKv(db, 'current');
    archive = (await getKv(db, 'archive')) || [];
    meta = { installDismissed: false, ...(await getKv(db, 'meta') || {}) };
    idbOk = true;
    db.close();
  } catch (err) {
    idbOk = false;
  }
  const current = chooseCurrent(idbCurrent, readLocal());
  if (!Array.isArray(archive)) archive = [];
  archive = archive.filter((item) => item && item.state).map((item) => ({
    ...item,
    state: migrate(item.state),
  }));
  meta.idbOk = idbOk;
  const packed = { current, archive, meta };
  await saveAll(packed);
  return packed;
}

export async function saveAll({ current, archive, meta }) {
  current.savedAt = Date.now();
  try {
    localStorage.setItem('jt', JSON.stringify(current));
  } catch (err) {
    /* privémodus kan localStorage weigeren */
  }
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction('kv', 'readwrite');
      const store = tx.objectStore('kv');
      store.put(current, 'current');
      store.put(archive, 'archive');
      store.put(meta, 'meta');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    meta.idbOk = true;
  } catch (err) {
    meta.idbOk = false;
  }
}

let chain = Promise.resolve();

export function scheduleSave(data) {
  chain = chain.then(() => saveAll(data)).catch(() => {});
  return chain;
}

export function flushSave() {
  return chain;
}

export async function askPersist() {
  try {
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch (err) {
    return false;
  }
  return false;
}

export async function persistenceInfo() {
  try {
    const persisted = navigator.storage?.persisted ? await navigator.storage.persisted() : false;
    const estimate = navigator.storage?.estimate ? await navigator.storage.estimate() : null;
    return { persisted, estimate };
  } catch (err) {
    return { persisted: false, estimate: null };
  }
}
