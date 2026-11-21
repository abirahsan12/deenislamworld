// বিল্ডের সময় quran.com থেকে হাফেজী (১৫ লাইন) মুসহাফের পৃষ্ঠা-ডেটা নামিয়ে www/mushaf.json বানায়।
// এটা APK-র ভেতরে যায়, তাই অ্যাপ ইন্টারনেট ছাড়াও পৃষ্ঠা খুলতে পারে।
const fs = require('fs');

// মুসহাফের লেআউট আইডি: ৬ = কুদরতুল্লাহ ছাপা, ১৪ = বাংলাদেশের প্রচলিত ১৫ লাইন (অনুমান)।
// প্রথমে সূরা বাকারার ২য় ও ৩য় পৃষ্ঠা মিলিয়ে দেখা হয়, যেটা বেশি মেলে সেটা নেওয়া হয়।
const CANDIDATES = [[6, 610], [14, 610], [13, 610]];
const URLP = (id, p) => 'https://api.quran.com/api/v4/verses/by_page/' + p +
  '?mushaf=' + id + '&words=true&word_fields=text_indopak,line_number,page_number&per_page=50';

const getPage = async (id, p) => {
  for (let t = 0; t < 5; t++) {
    try {
      const r = await fetch(URLP(id, p), { headers: { Accept: 'application/json' } });
      if (r.ok) return await r.json();
      if (r.status === 400 || r.status === 404) return null;
    } catch (e) {}
    await new Promise(r => setTimeout(r, 800 * (t + 1)));
  }
  return null;
};

// একটি পৃষ্ঠাকে ছোট করে সাজানো: লাইন নম্বর -> শব্দ, আর আয়াত শেষের চিহ্ন।
const build = j => {
  const lines = {}, starts = {};
  (j.verses || []).forEach(v => {
    const ch = +String(v.verse_key).split(':')[0];
    (v.words || []).forEach((w, i) => {
      const L = w.line_number; if (!L) return;
      const txt = w.char_type_name === 'end' ? '⟦' + v.verse_number + '⟧' : (w.text_indopak || w.text || '');
      (lines[L] = lines[L] || []).push(txt);
      if (v.verse_number === 1 && i === 0) starts[L] = ch;
    });
  });
  const L = Object.keys(lines).map(Number).sort((a, b) => a - b);
  if (!L.length) return null;
  return { r: L.map(n => lines[n].join(' ')), s: starts, c: (j.verses[0] || {}).verse_key ? +String(j.verses[0].verse_key).split(':')[0] : 0 };
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
    const score = (p2[1] === '2:4') + (p3[0] === '2:5') + (p3[1] === '2:15');
    console.log('layout ' + c[0] + ': page2 ends ' + p2[1] + ', page3 ' + p3[0] + ' .. ' + p3[1] + ' -> match ' + score + '/3');
    if (score > bestScore) { best = c; bestScore = score; }
  }
  console.log(bestScore >= 2 ? 'chosen layout: ' + best[0]
    : '::warning::কোনো লেআউটই বইয়ের পৃষ্ঠা-ভাগের সাথে মেলেনি, ডিফল্ট ' + best[0] + ' নেওয়া হয়েছে');
  return best;
}

(async () => {
  const [id, total] = await pickLayout();
  const out = {}, miss = []; let next = 1;
  const worker = async () => {
    while (next <= total) {
      const p = next++;
      const j = await getPage(id, p);
      const b = j && build(j);
      if (b) out[p] = b; else miss.push(p);
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  out._ = { i: id, n: total };
  fs.mkdirSync('www', { recursive: true });
  fs.writeFileSync('www/mushaf.json', JSON.stringify(out));
  const n = Object.keys(out).length - 1;
  console.log('mushaf layout', id, 'pages:', n, '/', total, 'missing:', miss.length,
    'size KB:', Math.round(fs.statSync('www/mushaf.json').size / 1024));
  if (n < total - 10) console.log('::warning::Mushaf data incomplete (' + n + '/' + total + ').');
})();