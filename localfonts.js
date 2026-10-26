// বিল্ডের সময় চলে: Inter, Noto Sans, Noto Sans Bengali ফন্ট অ্যাপের ভেতরে ঢুকিয়ে দেয় (ইন্টারনেট ছাড়াই চলবে)
const fs = require('fs'), path = require('path');
const out = path.join('www', 'fonts');
fs.mkdirSync(out, { recursive: true });
const RANGE = {
  latin: 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD',
  bengali: 'U+0951-0952,U+0964-0965,U+0980-09FE,U+1CD0,U+1CD2,U+1CD5-1CD6,U+1CD8,U+1CE1,U+1CEA,U+1CED,U+1CF2,U+1CF5-1CF7,U+200C-200D,U+20B9,U+25CC'
};
const fams = [
  { pkg: 'inter', name: 'Inter', weights: [500, 600, 700], subsets: ['latin'] },
  { pkg: 'noto-sans', name: 'Noto Sans', weights: [400, 500, 600, 700], subsets: ['latin'] },
  { pkg: 'noto-sans-bengali', name: 'Noto Sans Bengali', weights: [400, 500, 600, 700], subsets: ['bengali', 'latin'] }
];
let css = '', count = 0;
for (const f of fams) {
  const dir = path.join('node_modules', '@fontsource', f.pkg, 'files');
  for (const s of f.subsets) for (const w of f.weights) {
    const file = `${f.pkg}-${s}-${w}-normal.woff2`;
    const src = path.join(dir, file);
    if (!fs.existsSync(src)) { console.log('missing:', file); continue; }
    fs.copyFileSync(src, path.join(out, file));
    css += `@font-face{font-family:'${f.name}';font-style:normal;font-weight:${w};font-display:swap;src:url('${file}') format('woff2');unicode-range:${RANGE[s]}}\n`;
    count++;
  }
}
if (count < 8) { console.log('ফন্ট পর্যাপ্ত পাওয়া যায়নি (' + count + '), অনলাইন ফন্টই থাকছে'); process.exit(0); }
fs.writeFileSync(path.join(out, 'fonts.css'), css);
let h = fs.readFileSync(path.join('www', 'index.html'), 'utf8');
h = h.split('\n').filter(l => !/<link[^>]+(fonts\.googleapis\.com|fonts\.gstatic\.com)/.test(l)).join('\n');
h = h.replace('<style>', '<link rel="stylesheet" href="fonts/fonts.css">\n<style>');
fs.writeFileSync(path.join('www', 'index.html'), h);
console.log('লোকাল ফন্ট যোগ হয়েছে:', count);
