/**
 * Persistent asset cache (Cache Storage API).
 *
 * Big, rarely-changing files (helmet .glb models and the face-tracker model) are stored in the
 * browser's Cache Storage the first time they are downloaded, so later visits / reloads read them
 * straight from disk instead of the network. Works on any secure context (HTTPS or localhost),
 * including the dev server, and falls back to a normal fetch if Cache Storage is unavailable.
 *
 * Bump CACHE_NAME if you replace a file without changing its URL.
 */
const CACHE_NAME = 'helmetar-assets-v1';

export const TRACKER_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

async function openCache() {
  try {
    if (typeof caches !== 'undefined') return await caches.open(CACHE_NAME);
  } catch { /* private mode etc. */ }
  return null;
}

async function readWithProgress(res, onProgress) {
  const total = Number(res.headers.get('content-length')) || 0;
  if (!res.body || !onProgress || !total) return res.arrayBuffer();
  const reader = res.body.getReader();
  const chunks = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    onProgress(Math.min(loaded / total, 1));
  }
  const out = new Uint8Array(loaded);
  let offset = 0;
  for (const c of chunks) { out.set(c, offset); offset += c.length; }
  return out.buffer;
}

/** Fetch a file as an ArrayBuffer, served from Cache Storage when we have it. */
export async function cachedFetchBuffer(url, onProgress) {
  const cache = await openCache();
  if (cache) {
    try {
      const hit = await cache.match(url);
      if (hit) { onProgress?.(1); return await hit.arrayBuffer(); }
    } catch { /* fall through to network */ }
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load ${url} (${res.status})`);
  if (cache) cache.put(url, res.clone()).catch(() => {}); // store in the background
  return readWithProgress(res, onProgress);
}

/** Download the face-tracker model ahead of time so the try-on screen starts faster. */
export function warmTracker() {
  return cachedFetchBuffer(TRACKER_MODEL_URL).catch(() => {});
}
