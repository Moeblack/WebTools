/**
 * Service Worker
 * - 统一兼容本地与 GitHub Pages 子路径：基于 registration.scope 计算 BASE 前缀
 * - 预缓存应用壳
 * - CDN 资源运行时缓存（cache-first）
 * - 导航请求离线回退
 */

const VERSION = "v1.0.2";
const CACHE_NAME = `webtools-cache-${VERSION}`;

// 基于 SW 注册作用域计算 BASE 前缀（如 "/" 或 "/WebTools/"）
const SCOPE_PATH = new URL(self.registration?.scope || "./", self.location).pathname;
const BASE = SCOPE_PATH.endsWith("/") ? SCOPE_PATH : SCOPE_PATH + "/";

// 预缓存核心资源（相对 BASE）
const PRECACHE_FILES = [
  "", // 根（用于导航回退）
  "index.html",
  "manifest.webmanifest",
  "gif.worker.js",
];
const PRECACHE_URLS = PRECACHE_FILES.map((p) => BASE + p);

// CDN runtime caching targets
const RUNTIME_CDN_PATTERNS = [
  // Tailwind CDN
  /^https:\/\/cdn\.tailwindcss\.com\/?/i,
  // Google Fonts
  /^https:\/\/fonts\.googleapis\.com\/?/i,
  /^https:\/\/fonts\.gstatic\.com\/?/i,
  // Icons8 icons
  /^https:\/\/img\.icons8\.com\/?/i,
  // OpenCC and other UMD libs via jsDelivr/CDNJS if used later
  /^https:\/\/cdn\.jsdelivr\.net\/?/i,
  /^https:\/\/cdnjs\.cloudflare\.com\/?/i,
];

// Simple helper: cache-first for requests
async function cacheFirst(event, cacheName = CACHE_NAME) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(event.request);
  if (cached) return cached;
  try {
    const response = await fetch(event.request);
    // Only cache successful and basic/opaque responses
    if (response && (response.status === 200 || response.type === "opaque")) {
      try {
        await cache.put(event.request, response.clone());
      } catch (_) {}
    }
    return response;
  } catch (err) {
    // network failed; return cached if any
    if (cached) return cached;
    throw err;
  }
}

// Install: precache app shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => {
      return self.skipWaiting();
    })
  );
});

// Activate: cleanup old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      const deletions = keys
        .filter((key) => key.startsWith("webtools-cache-") && key !== CACHE_NAME)
        .map((key) => caches.delete(key));
      await Promise.all(deletions);
      await self.clients.claim();
    })()
  );
});

// Fetch: handle navigation offline fallback, precached, and CDN runtime cache-first
self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Only handle GET requests
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Navigation requests: offline fallback to cached index.html
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          // Try network first to get latest
          const fresh = await fetch(req);
          // Optionally warm cache
          const cache = await caches.open(CACHE_NAME);
          try {
            await cache.put(BASE + "index.html", fresh.clone());
          } catch (_) {}
          return fresh;
        } catch (_) {
          // Offline fallback: cached index.html
          const cache = await caches.open(CACHE_NAME);
          const cached = await cache.match(BASE + "index.html");
          if (cached) return cached;
          // Last resort: a minimal offline response
          return new Response(
            "<h1>离线模式</h1><p>当前无法连接网络，且尚未缓存应用壳。</p>",
            { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
          );
        }
      })()
    );
    return;
  }

  // Same-origin under BASE 前缀：优先缓存（覆盖预缓存静态资源）
  if (url.origin === self.location.origin && url.pathname.startsWith(BASE)) {
    event.respondWith(cacheFirst(event));
    return;
  }

  // Runtime CDN cache-first: check patterns
  if (RUNTIME_CDN_PATTERNS.some((re) => re.test(req.url))) {
    event.respondWith(cacheFirst(event));
    return;
  }

  // Default: pass-through network
  // You can still do stale-while-revalidate here if desired, but keep simple.
});
