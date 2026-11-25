// Работа без интернета. Этот файл — «служебный работник» браузера: он запоминает файлы игры
// и отдаёт их из памяти, когда сети нет.
//
// Правила простые:
//   - файлы сборки в папке assets (у них в имени отпечаток содержимого, они никогда не меняются)
//     берутся из памяти, а в сеть идём только за теми, которых там ещё нет;
//   - всё остальное (страница, модели машин, значки) сначала пробуем взять из сети — так обновление
//     игры приходит сразу, — а без сети отдаём последнюю запомненную копию.
const CACHE = 'racing3d-v1';
const CORE = ['./', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'models/cars.bin'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(CORE))
      .catch(() => undefined),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Страница сообщает, какие файлы сборки она загрузила: запоминаем их, а файлы прошлых сборок забываем.
self.addEventListener('message', (event) => {
  const list = event.data && event.data.assets;
  if (!Array.isArray(list)) return;
  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      const wanted = new Set(list);
      for (const request of await cache.keys()) {
        if (request.url.includes('/assets/') && !wanted.has(request.url)) await cache.delete(request);
      }
      for (const url of list) {
        if (!(await cache.match(url))) await cache.add(url).catch(() => undefined);
      }
    }),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(url.pathname.includes('/assets/') ? fromCacheFirst(request) : fromNetworkFirst(request));
});

async function fromCacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

async function fromNetworkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    // Сети нет. Страницу ищем без учёта «хвоста» адреса (?debug, ?unlock) — она одна и та же.
    const cached = await cache.match(request, { ignoreSearch: request.mode === 'navigate' });
    if (cached) return cached;
    throw error;
  }
}
