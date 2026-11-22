// বিল্ডের সময় quran.com থেকে হাফেজী (১৫ লাইন) মুসহাফের পৃষ্ঠা-ডেটা নামিয়ে www/mushaf.json বানায়।
// এটা APK-র ভেতরে যায়, তাই অ্যাপ ইন্টারনেট ছাড়াও পৃষ্ঠা খুলতে পারে।
// ফাইলের গঠন:
//   "১".."৬১০": { r: [১৫টি লাইনের লেখা, ফাঁকা লাইন = ""], s: { লাইন: সূরা-নম্বর }, c: প্রথম সূরা }
//   m: { "সূরা:আয়াত": [অনুরূপ আয়াতের কী ..., (শেষে মোট সংখ্যা, যদি দেখানোর চেয়ে বেশি থাকে)] }
//   _: { i: লেআউট আইডি, n: মোট পৃষ্ঠা }
// আয়াতের শেষে লেখায় থাকে ⟦সূরা:আয়াত⟧ চিহ্ন।
const fs = require('fs');

// মুসহাফের লেআউট আইডি: ৬ = কুদরতুল্লাহ ছাপা, ১৪ = বাংলাদেশের প্রচলিত ১৫ লাইন (অনুমান)।
// প্রথমে সূরা বাকারার ২য় ও ৩য় পৃষ্ঠা মিলিয়ে দেখা হয়, যেটা বেশি মেলে সেটা নেওয়া হয়।
const CANDIDATES = [[6, 610], [14, 610], [13, 610]];
const URLP = (id, p) => 'https://api.quran.com/api/v4/verses/by_page/' + p +
  '?mushaf=' + id + '&words=true&word_fields=text_indopak,line_number,page_number&per_page=50';
const URLC = n => 'https://api.quran.com/api/v4/quran/verses/indopak?chapter_number=' + n;

const sleep = ms => new Promise(r => setTimeout(r, ms));

const getJson = async url => {
  for (let t = 0; t < 5; t++) {
    try {
      const r = await fetch(url, { headers: { Accept: 'application/json' } });
      if (r.ok) return await r.json();
      if (r.status === 400 || r.status === 404) return null;
    } catch (e) {}
    await sleep(800 * (t + 1));
  }
  return null;
};
const getPage = (id, p) => getJson(URLP(id, p));

// একটি পৃষ্ঠাকে ছোট করে সাজানো: ১৫টি লাইন, আর কোন লাইনে কোন সূরা শুরু।
const build = (j, pageNo) => {
  const lines = {}, starts = {};
  let maxLine = 15, juz = 0;
  (j.verses || []).forEach(v => {
    if (!juz && v.juz_number) juz = v.juz_number;
    const ch = +String(v.verse_key).split(':')[0];
    (v.words || []).forEach((w, i) => {
      const L = w.line_number; if (!L) return;
      // আয়াত দুই পৃষ্ঠায় ভাগ হলে শুধু এই পৃষ্ঠার শব্দ নেওয়া হয়
      if (w.page_number && pageNo && w.page_number !== pageNo) return;
      const txt = w.char_type_name === 'end' ? '⟦' + ch + ':' + v.verse_number + '⟧' : (w.text_indopak || w.text || '');
      (lines[L] = lines[L] || []).push(txt);
      if (L > maxLine) maxLine = L;
      if (v.verse_number === 1 && i === 0) starts[L] = ch;
    });
  });
  const ks = Object.keys(lines);
  if (!ks.length) return null;
  const r = [];
  for (let n = 1; n <= maxLine; n++) r.push(lines[n] ? lines[n].join(' ') : '');
  const first = (j.verses[0] || {}).verse_key;
  return { r, s: starts, c: first ? +String(first).split(':')[0] : 0, j: juz };
};

const keys = j => { const v = (j && j.verses) || []; return v.length ? [v[0].verse_key, v[v.length - 1].verse_key] : ['-', '-']; };

async function pickLayout() {
  if (process.env.MUSHAF_ID) {
    const id = +process.env.MUSHAF_ID;
    return CANDIDATES.find(c => c[0] === id) || [id, 610];
  }
  let best = CANDIDATES[0], bestScore = -1;
  for (const c of CANDIDATES) {
    const p2 = keys(await getPage(c[0], 2)), p3 = keys(await getPage(c[0], 3));
    const score = (p2[1] === '2:5') + (p3[0] === '2:6') + (p3[1] === '2:16');
    console.log('layout ' + c[0] + ': page2 ends ' + p2[1] + ', page3 ' + p3[0] + ' .. ' + p3[1] + ' -> match ' + score + '/3');
    if (score > bestScore) { best = c; bestScore = score; }
  }
  console.log(bestScore >= 2 ? 'chosen layout: ' + best[0]
    : '::warning::কোনো লেআউটই বইয়ের পৃষ্ঠা-ভাগের সাথে মেলেনি, ডিফল্ট ' + best[0] + ' নেওয়া হয়েছে');
  return best;
}

/* ---------- অনুরূপ শব্দের আয়াত (মুতাশাবিহাত) ----------
   পুরো কুরআনের আয়াতগুলো হরকত ছাড়া শব্দে ভেঙে মিলিয়ে দেখা হয়: যে আয়াতগুলোর পরপর
   অনেকগুলো শব্দ হুবহু এক, সেগুলোকে একে অপরের অনুরূপ ধরা হয়।
   এটা কম্পিউটারে মেলানো শব্দ-সাদৃশ্য; আলেমদের সংকলিত মুতাশাবিহাত তালিকার সাথে হুবহু নাও মিলতে পারে। */
const GRAM = 4, SHOW = 3;
const MARKS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640\u08D3-\u08FF\uFE70-\uFE7F]/g;
const norm = t => String(t || '').replace(MARKS, '')
  .replace(/[\u0622\u0623\u0625\u0671]/g, '\u0627')
  .replace(/[\u0649\u06CC\u06D2]/g, '\u064A')
  .replace(/\u06A9/g, '\u0643')
  .replace(/[\u0629\u06C1\u06D5\u06C3]/g, '\u0647')
  .split(/\s+/).map(w => w.replace(/[^\u0621-\u064A]/g, '')).filter(Boolean);

const longestRun = (a, b) => {
  let best = 0, prev = new Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    const cur = new Array(b.length + 1).fill(0);
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) { cur[j] = prev[j - 1] + 1; if (cur[j] > best) best = cur[j]; }
    }
    prev = cur;
  }
  return best;
};

// list: [{ k: "সূরা:আয়াত", w: [শব্দ...] }] -> { k: [অনুরূপ কী..., মোট?] }
function similar(list) {
  const idx = new Map();
  list.forEach((v, i) => {
    const seen = new Set();
    for (let a = 0; a + GRAM <= v.w.length; a++) {
      const g = v.w.slice(a, a + GRAM).join(' ');
      if (seen.has(g)) continue; seen.add(g);
      let l = idx.get(g); if (!l) idx.set(g, l = []); l.push(i);
    }
  });
  const res = {};
  list.forEach((v, i) => {
    if (v.w.length < GRAM) return;
    const cand = new Set();
    for (let a = 0; a + GRAM <= v.w.length; a++) {
      (idx.get(v.w.slice(a, a + GRAM).join(' ')) || []).forEach(j => { if (j !== i) cand.add(j); });
    }
    const ok = [];
    cand.forEach(j => {
      const o = list[j], L = longestRun(v.w, o.w), sc = L / Math.min(v.w.length, o.w.length);
      if (L >= GRAM && (L >= 7 || sc >= 0.6)) ok.push({ k: o.k, sc, L, j });
    });
    if (!ok.length) return;
    ok.sort((x, y) => y.sc - x.sc || y.L - x.L || x.j - y.j);
    const out = ok.slice(0, SHOW).map(x => x.k);
    if (ok.length > SHOW) out.push(ok.length);
    res[v.k] = out;
  });
  return res;
}

async function buildSimilar() {
  const list = []; let miss = 0;
  for (let n = 1; n <= 114; n++) {
    const j = await getJson(URLC(n));
    if (!j || !j.verses) { miss++; continue; }
    j.verses.forEach(v => {
      const key = String(v.verse_key || '');
      if (!key) return;
      list.push({ k: key, w: norm(v.text_indopak) });
    });
  }
  console.log('similar: verses', list.length, 'missing chapters', miss);
  if (miss > 10 || list.length < 6000) return null;
  return similar(list);
}

async function main() {
  const [id, total] = await pickLayout();
  const out = {}, miss = []; let next = 1;
  const worker = async () => {
    while (next <= total) {
      const p = next++;
      const j = await getPage(id, p);
      const b = j && build(j, p);
      if (b) out[p] = b; else miss.push(p);
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  const n = Object.keys(out).length;
  if (n < total / 2) { console.log('::warning::Mushaf data too incomplete (' + n + '/' + total + '), skipping mushaf.json'); return; }
  out._ = { i: id, n: total };
  try { const m = await buildSimilar(); if (m) out.m = m; else console.log('::warning::অনুরূপ আয়াতের তালিকা বানানো যায়নি।'); }
  catch (e) { console.log('::warning::অনুরূপ আয়াত: ' + e.message); }
  fs.mkdirSync('www', { recursive: true });
  fs.writeFileSync('www/mushaf.json', JSON.stringify(out));
  console.log('mushaf layout', id, 'pages:', n, '/', total, 'missing:', miss.length,
    'similar verses:', out.m ? Object.keys(out.m).length : 0,
    'size KB:', Math.round(fs.statSync('www/mushaf.json').size / 1024));
  if (n < total - 10) console.log('::warning::Mushaf data incomplete (' + n + '/' + total + ').');
}

if (require.main === module) main().catch(e => { console.log('::warning::mushaf.json বানানো যায়নি: ' + e.message); });
module.exports = { build, norm, similar };
