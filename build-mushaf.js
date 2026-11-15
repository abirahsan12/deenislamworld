// বিল্ডের সময় চলে: হাফেজী ১৫ লাইনের ৬১০ পৃষ্ঠার লেআউট ডাউনলোড করে www/mushaf.json বানায়,
// ফলে অ্যাপে পৃষ্ঠা-ভিত্তিক কুরআন ইন্টারনেট ছাড়াই চলে।
const fs = require('fs');
const URLP = p => 'https://api.quran.com/api/v4/verses/by_page/' + p + '?mushaf=6&words=true&word_fields=text_indopak,line_number,page_number&per_page=50';

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
    const get = async p => {
      for (let t = 0; t < 5; t++) {
        try { const r = await fetch(URLP(p), { headers: { Accept: 'application/json' } }); if (r.ok) return await r.json(); } catch (e) {}
        await new Promise(r => setTimeout(r, 800 * (t + 1)));
      }
      return null;
    };
    const out = {}, miss = []; let next = 1;
    const W = async () => {
      while (next <= 610) {
        const p = next++, j = await get(p), b = j && build(j);
        if (b) out[p] = b; else miss.push(p);
      }
    };
    await Promise.all([W(), W(), W(), W()]);
    fs.mkdirSync('www', { recursive: true });
    fs.writeFileSync('www/mushaf.json', JSON.stringify(out));
    const n = Object.keys(out).length;
    console.log('mushaf pages:', n, 'missing:', miss.length, 'size KB:', Math.round(fs.statSync('www/mushaf.json').size / 1024));
    if (n < 600) console.log('::warning::Mushaf data incomplete (' + n + '/610). Missing pages will load from internet in the app.');
  })();
}
