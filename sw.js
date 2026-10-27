// Cachea la app para abrirla sin conexión. Los datos viven en localStorage / Google Sheets.
const CACHE = 'finanzas-silva-v1';
const SHELL = ['./', 'index.html', 'css/styles.css', 'js/app.js', 'js/store.js', 'js/sheets.js', 'js/risk.js', 'js/format.js', 'js/schema.js', 'js/ui.js',
  'js/views/dashboard.js', 'js/views/movimientos.js', 'js/views/presupuestos.js', 'js/views/deudas.js', 'js/views/ingresos.js', 'js/views/riesgos.js', 'js/views/ajustes.js'];

self.addEventListener('install', (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // Apps Script y CDN van directo a la red
  // red primero (para ver actualizaciones), caché como respaldo offline
  e.respondWith(fetch(e.request).then((r) => {
    const copy = r.clone();
    caches.open(CACHE).then((c) => c.put(e.request, copy));
    return r;
  }).catch(() => caches.match(e.request)));
});
