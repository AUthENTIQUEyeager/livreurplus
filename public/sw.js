// Service worker LivreurPlus — mise en cache de la coquille de l'app pour
// limiter les rechargements réseau complets. Les données métier (commandes,
// catalogue, position live) passent TOUJOURS par le réseau : on ne met en
// cache aucun appel vers Supabase, pour ne jamais afficher un statut de
// livraison ou un stock périmé.

const VERSION = "v1";
const CACHE_STATIQUE = `livreurplus-statique-${VERSION}`;
const CACHE_PAGES = `livreurplus-pages-${VERSION}`;

const PRECACHE = [
  "/offline.html",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_STATIQUE).then((cache) => cache.addAll(PRECACHE))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((noms) =>
      Promise.all(
        noms
          .filter((n) => n !== CACHE_STATIQUE && n !== CACHE_PAGES)
          .map((n) => caches.delete(n))
      )
    )
  );
  self.clients.claim();
});

function estAppelDonnees(url) {
  // Tout ce qui va vers Supabase (API REST, Auth, Realtime, Storage) ne doit
  // jamais être servi depuis le cache : ce sont des données vivantes.
  return url.hostname.endsWith("supabase.co");
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin && !estAppelDonnees(url)) {
    return; // autres origines (ex. images distantes) : comportement par défaut
  }
  if (estAppelDonnees(url)) return; // toujours réseau, jamais de cache

  // Navigation (pages HTML) : réseau d'abord, cache en secours, puis page
  // offline si rien n'est disponible.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((reponse) => {
          const copie = reponse.clone();
          caches.open(CACHE_PAGES).then((cache) => cache.put(request, copie));
          return reponse;
        })
        .catch(
          () =>
            caches.match(request).then((r) => r || caches.match("/offline.html"))
        )
    );
    return;
  }

  // Assets statiques Next.js (JS/CSS/fonts locales, contenu hashé donc sûr à
  // mettre en cache de façon agressive) : cache d'abord, réseau en secours.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(request).then(
        (reponse) =>
          reponse ||
          fetch(request).then((reseau) => {
            const copie = reseau.clone();
            caches.open(CACHE_STATIQUE).then((cache) => cache.put(request, copie));
            return reseau;
          })
      )
    );
    return;
  }

  // Reste (images produits, etc.) : réseau d'abord, cache en secours.
  event.respondWith(
    fetch(request)
      .then((reponse) => {
        const copie = reponse.clone();
        caches.open(CACHE_PAGES).then((cache) => cache.put(request, copie));
        return reponse;
      })
      .catch(() => caches.match(request))
  );
});
