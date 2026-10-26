const CACHE = 'deen-islam-v7';
const CORE = ['./', 'index.html', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png', 'almushaf.ttf'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(CORE.map(u => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => clients.claim())
  );
});

function save(req, res) {
  if (res && (res.ok || res.type === 'opaque')) {
    const copy = res.clone();
    caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
  }
  return res;
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);

  // অডিও (তিলাওয়াত) ক্যাশ করা হয় না
  if (req.headers.has('range') || /\.mp3($|\?)/.test(u.pathname) || u.hostname.endsWith('mp3quran.net')) return;

  // নামাজের সময়: আগে ইন্টারনেট, না থাকলে সর্বশেষ সংরক্ষিত
  if (u.hostname === 'api.aladhan.com') {
    e.respondWith(
      fetch(req).then(r => save(req, r)).catch(() => caches.match(req))
    );
    return;
  }

  // বাকি সব (অ্যাপ ফাইল, ফন্ট, কুরআন): আগে ক্যাশ, পেছনে নতুন করে আপডেট
  e.respondWith(
    caches.match(req).then(hit => {
      const net = fetch(req).then(r => save(req, r)).catch(() => null);
      if (hit) return hit;
      return net.then(r => r || (req.mode === 'navigate' ? caches.match('index.html') : Response.error()));
    })
  );
});
