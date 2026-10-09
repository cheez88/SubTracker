// SubTracker service worker
// Bump VERSION whenever you upload a new version of the app.
var VERSION = 'v2';
var CACHE = 'subtracker-' + VERSION;
var APP_SHELL = [
  './',
  'index.html',
  'manifest.json',
  'apple-touch-icon.png',
  'icon-192.png',
  'icon-512.png',
  'icon-maskable-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(APP_SHELL); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) {
        return k.indexOf('subtracker-') === 0 && k !== CACHE;
      }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

// Network with a short timeout, falling back to the cache (weak signal at the ground)
function networkFirst(req) {
  return new Promise(function (resolve) {
    var settled = false;
    var timer = setTimeout(function () {
      caches.match(req).then(function (hit) {
        if (hit && !settled) { settled = true; resolve(hit); }
      });
    }, 3000);
    fetch(req).then(function (res) {
      clearTimeout(timer);
      var copy = res.clone();
      caches.open(CACHE).then(function (c) { c.put(req, copy); });
      if (!settled) { settled = true; resolve(res); }
    }).catch(function () {
      clearTimeout(timer);
      caches.match(req).then(function (hit) {
        if (!settled) { settled = true; resolve(hit || caches.match('index.html')); }
      });
    });
  });
}

// Cache first, then network (icons, fonts)
function cacheFirst(req) {
  return caches.match(req).then(function (hit) {
    return hit || fetch(req).then(function (res) {
      if (res && (res.ok || res.type === 'opaque')) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
      }
      return res;
    });
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);

  if (req.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('/')) {
    e.respondWith(networkFirst(req));
  } else if (url.origin === location.origin ||
             url.hostname === 'fonts.googleapis.com' ||
             url.hostname === 'fonts.gstatic.com') {
    e.respondWith(cacheFirst(req));
  }
});

// Tapping a notification brings the app back to the front
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      if (list.length) return list[0].focus();
      return self.clients.openWindow('./');
    })
  );
});
