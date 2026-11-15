// বিল্ডের সময় চলে: হাফেজী ১৫ লাইনের ৬১০ পৃষ্ঠার লেআউট ডাউনলোড করে www/mushaf.json বানায়,
// ফলে অ্যাপে পৃষ্ঠা-ভিত্তিক কুরআন ইন্টারনেট ছাড়াই চলে।
const fs = require('fs');
// বাংলাদেশের প্রচলিত হাফেজী কুরআনের (১৫ লাইন) সাথে যে লেআউটের পৃষ্ঠা-ভাগ মেলে, বিল্ড নিজেই তা খুঁজে নেয়।
// মাপকাঠি: সূরা বাকারার ২য় পৃষ্ঠা ২:৪-এ শেষ, ৩য় পৃষ্ঠা ২:৫ থেকে ২:১৫ পর্যন্ত।
const CANDIDATES = [[6, 610], [14, 610], [13, 610]];
const URLP = (id, p) => 'https://api.quran.com/api/v4/verses/by_page/' + p + '?mushaf=' + id + '&words=true&word_fields=text_indopak,line_number,page_number&per_page=50';
const getPage = async (id, p) => {
  for (let t = 0; t < 5; t++) {
    try { const r = await fetch(URLP(id, p), { headers: { Accept: 'application/json' } }); if (r.ok) return await r.json(); if (r.status === 400 || r.status === 404) return null; } catch (e) {}
    await new Promise(r => setTimeout(r, 800 * (t + 1)));
  }
  return null;
};
const keys = j => { const v = (j && j.verses) || []; return v.length ? [v[0].verse_key, v[v.length - 1].verse_key] : ['-', '-']; };
async function pickLayout() {
  if (process.env.MUSHAF_ID) { const id = +process.env.MUSHAF_ID; return CANDIDATES.find(c => c[0] === id) || [id, 610]; }
  let best = CANDIDATES[0], bestScore = -1;
  for (const c of CANDIDATES) {
    const p2 = keys(await getPage(c[0], 2)), p3 = keys(await getPage(c[0], 3));
    const score = (p2[1] === '2:4') + (p3[0] === '2:5') + (p3[1] === '2:15');
    console.log('layout ' + c[0] + ': page2 ends ' + p2[1] + ', page3 ' + p3[0] + ' .. ' + p3[1] + ' -> match ' + score + '/3');
    if (score > bestScore) { best = c; bestScore = score; }
  }
  console.log(bestScore >= 2 ? 'chosen layout: ' + best[0] : '::warning::কোনো লেআউটই ওই বইয়ের পৃষ্ঠা-ভাগের সাথে মেলেনি, ডিফল্ট ' + best[0] + ' নেওয়া হয়েছে');
  return best;
}

// একটি পৃষ্ঠাকে লাইনের তালিকায় রূপ দেয়: সাধারণ লাইন = লেখা (আয়াত শেষে ⟦নম্বর⟧), "#সূরা" = সূরার শিরোনাম, "@" = বিসমিল্লাহ, "" = ফাঁকা
function build(j) {
  const lines = {}, starts = {};
  let maxL = 0, juz = 0, ch0 = 0;
  (j.verses || []).forEach(v => {
    juz = juz || v.juz_number || 0;
    const ch = +String(v.verse_key).split(':')[0]; ch0 = ch0 || ch;
    (v.words || []).forEach((w, i) => {
      const L = w.line_number; if (!L) return;
      (lines[L] = lines[L] || []).push(w.char_type_name === 'end' ? '\u27E6' + v.verse_number + '\u27E7' : (w.text_indopak || w.text || ''));
      if (L > maxL) maxL = L;
      if (v.verse_number === 1 && i === 0) starts[L] = ch;
    });
  });
  if (!maxL) return null;
  const rows = []; let last = 0;
  for (let L = 1; L <= maxL; L++) {
    if (lines[L]) { rows.push(lines[L].join(' ')); last = L; continue; }
    let n2 = L; while (n2 <= maxL && !lines[n2]) n2++;
    const ch = starts[n2], total = n2 - last - 1, off = L - last;
    if (ch) {
      if (total >= 2 && off === 2) rows.push(ch === 9 ? '' : '@');
      else rows.push('#' + ch);
    } else rows.push('');
  }
  return { j: juz, c: ch0, r: rows };
}
module.exports = { build };

if (require.main === module) {
  (async () => {
    const [id, total] = await pickLayout();
    const out = {}, miss = []; let next = 1;
    const W = async () => {
      while (next <= total) {
        const p = next++, j = await getPage(id, p), b = j && build(j);
        if (b) out[p] = b; else miss.push(p);
      }
    };
    await Promise.all([W(), W(), W(), W()]);
    out._ = { i: id, n: total };
    fs.mkdirSync('www', { recursive: true });
    fs.writeFileSync('www/mushaf.json', JSON.stringify(out));
    const n = Object.keys(out).length - 1;
    console.log('mushaf layout', id, 'pages:', n, '/', total, 'missing:', miss.length, 'size KB:', Math.round(fs.statSync('www/mushaf.json').size / 1024));
    if (n < total - 10) console.log('::warning::Mushaf data incomplete (' + n + '/' + total + '). Missing pages will load from internet in the app.');
  })();
}
