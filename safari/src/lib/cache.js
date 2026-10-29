/**
 * Service Worker 重启后仍可用的会话级翻译缓存。
 * 数据只存在 chrome.storage.session 中，关闭浏览器即消失。
 */

const STORAGE_KEY = "xy_translation_cache_v1";
const MAX_ENTRIES = 350;
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

let cache = new Map();
let initPromise = null;
let saveTimer = null;

function schedulePersist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const entries = Array.from(cache.entries());
    chrome.storage.session.set({ [STORAGE_KEY]: entries }).catch(() => {});
  }, 250);
}

function evictOverflow() {
  while (cache.size > MAX_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey === undefined) break;
    cache.delete(oldestKey);
  }
}

export function initCache() {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const stored = await chrome.storage.session.get(STORAGE_KEY);
      const entries = stored?.[STORAGE_KEY];
      if (!Array.isArray(entries)) return;
      const now = Date.now();
      for (const entry of entries) {
        if (!Array.isArray(entry) || entry.length !== 2) continue;
        const [key, value] = entry;
        if (typeof key !== "string" || !value || !Number.isFinite(value.at)) continue;
        if (now - value.at > TTL_MS) continue;
        cache.set(key, value);
      }
      evictOverflow();
    } catch {
      // 缓存不可用时静默降级为纯内存缓存。
    }
  })();

  return initPromise;
}

export async function getCached(key) {
  await initCache();
  const entry = cache.get(key);
  if (!entry) return null;
  if (!entry.at || Date.now() - entry.at > TTL_MS) {
    cache.delete(key);
    schedulePersist();
    return null;
  }

  // LRU：命中后移到队尾。
  cache.delete(key);
  cache.set(key, entry);

  return {
    ...entry.result,
    cached: true,
    elapsedMs: 0
  };
}

export async function setCached(key, result) {
  await initCache();
  cache.delete(key);
  cache.set(key, { at: Date.now(), result });
  evictOverflow();
  schedulePersist();
}

export function clearCache() {
  cache.clear();
  clearTimeout(saveTimer);
  return chrome.storage.session.remove(STORAGE_KEY).catch(() => {});
}
