/* Amah service worker.
 * - Navigations: network first; offline falls back to a friendly /offline page.
 * - /_next/static: cache first (content-hashed, immutable).
 * - Everything else (API, Supabase, realtime, auth): never cached. Private data must stay live.
 */
const VERSION = "amah-v2";
const OFFLINE = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll([OFFLINE, "/icon.svg"])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE)));
    return;
  }

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(VERSION).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
  }
});
/* Push notifications. The payload is JSON: { title, body, url, tag }. */
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Amah";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      // The same tag replaces the previous notification (one per chat, one per game).
      tag: data.tag || "amah",
      // Quiet updates (a game moving on) replace the notification without buzzing again.
      renotify: !!data.tag && !data.quiet,
      icon: "/icons/192",
      badge: "/icons/192",
      data: { url: data.url || "/room" },
    }),
  );
});

/* Tapping a notification: reuse an open Amah window if there is one, else open a new one. */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/room", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (new URL(w.url).origin === self.location.origin && "focus" in w) {
          return w.focus().then((f) => (f && "navigate" in f ? f.navigate(target) : f));
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
