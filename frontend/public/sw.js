/* global workbox */
importScripts("https://storage.googleapis.com/workbox-cdn/releases/7.1.0/workbox-sw.js");

workbox.core.skipWaiting();
workbox.core.clientsClaim();

workbox.precaching.precacheAndRoute(self.__WB_MANIFEST || []);

workbox.routing.registerRoute(
  ({ request }) => request.destination === "script" || request.destination === "style" || request.destination === "image",
  new workbox.strategies.CacheFirst({ cacheName: "foodex-static-v1" })
);

workbox.routing.registerRoute(
  ({ url }) => url.pathname.startsWith("/api"),
  new workbox.strategies.NetworkFirst({ cacheName: "foodex-api-v1", networkTimeoutSeconds: 5 })
);

self.addEventListener("sync", (event) => {
  if (event.tag === "cart-sync-queue") {
    event.waitUntil(Promise.resolve());
  }
});
