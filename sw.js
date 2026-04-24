// DIÁRIO.FIT — Service Worker
// Cache do app shell pra funcionar offline.
// Estratégia: stale-while-revalidate pros assets estáticos, network-first pra análise de IA.

const VERSION = "v2.2.4";
const CACHE = "diariofit-" + VERSION;

const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "https://unpkg.com/react@18/umd/react.production.min.js",
  "https://unpkg.com/react-dom@18/umd/react-dom.production.min.js",
  "https://unpkg.com/@babel/standalone/babel.min.js",
  "https://cdn.jsdelivr.net/npm/idb-keyval@6/dist/umd.js",
  "https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL).catch((e) => console.warn("SW: cache addAll partial", e)))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => (k.startsWith("diariofit-") || k.startsWith("planobarriga-")) && k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Nunca cacheia POST (inclui chamadas pro proxy de IA)
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Chamadas pro Worker da Anthropic (proxy) — passam direto, sem cache
  if (url.pathname === "/v1/messages" || url.hostname.includes("workers.dev") || url.hostname.includes("anthropic.com")) {
    return;
  }

  // Stale-while-revalidate pro resto
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((res) => {
          if (res && res.status === 200 && (res.type === "basic" || res.type === "cors")) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});

// Permite mensagens pra forçar update
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});
