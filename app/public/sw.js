/**
 * Service Worker — Novo Jeito Academy (app do aluno)
 * Cache básico do "app shell" para carregamento instantâneo e funcionamento offline parcial.
 * Não faz cache de dados dinâmicos (aulas, progresso) — isso sempre vem da rede.
 */

const CACHE_NAME = "novo-jeito-academy-v1";
const APP_SHELL = ["/", "/index.html", "/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // network-first: sempre tenta buscar da rede primeiro (dados atualizados),
  // só usa o cache como fallback se estiver offline
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
