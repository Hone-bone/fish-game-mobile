const CACHE_NAME = "fish-game-cache-v1";
const urlsToCache = [
  "/",
  "/index.html",
  "/css/style.css",
  "/js/game.js",
  "/assets/poi.svg",
  "/assets/broken-poi.svg",
  "/assets/fish1.svg",
  "/assets/fish2.svg",
  "/assets/fish3.svg",
  "/assets/fish4.svg",
  "/assets/app-icon.png",
];

// キャッシュのインストール
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("キャッシュを開きました");
      return cache.addAll(urlsToCache);
    })
  );
});

// キャッシュされたレスポンスを返す
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) {
        return response;
      }
      return fetch(event.request);
    })
  );
});

// 古いキャッシュの削除
self.addEventListener("activate", (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
