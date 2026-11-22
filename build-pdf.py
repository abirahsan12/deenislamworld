#!/usr/bin/env python3
# Deen Islam: www/mushaf.json থেকে পারাভিত্তিক PDF বানায়।
# - কোনো স্ক্যান বা বাইরের ছবি নেই; লেখা almushaf.ttf ফন্ট দিয়ে আসে।
# - কোনো ওয়েবসাইটের লিংক বা হেডার নেই; শুধু "দ্বীন ইসলাম" ফুটার।
# - প্রতিটি পারার জন্য আলাদা PDF: www/pdf/para-01.pdf ... para-30.pdf
#
# ব্যবহার:  python3 build-pdf.py
# পরিবেশ:    MUSHAF_JSON, MUSHAF_FONT, PDF_DIR (ঐচ্ছিক)
import json
import os
import sys
import urllib.request
from html import escape

from weasyprint import HTML

SRC = os.environ.get('MUSHAF_JSON', 'www/mushaf.json')
FONT = os.path.abspath(os.environ.get('MUSHAF_FONT', 'almushaf.ttf'))
OUT = os.environ.get('PDF_DIR', 'www/pdf')
BRAND = 'দ্বীন ইসলাম'

AR_DIGITS = '٠١٢٣٤٥٦٧٨٩'


def ar(n):
    return ''.join(AR_DIGITS[int(c)] if c.isdigit() else c for c in str(n))


def bn(n):
    return ''.join('০১২৩৪৫৬৭৮৯'[int(c)] if c.isdigit() else c for c in str(n))


def load_surah_names():
    """সূরার আরবি নাম quran.com থেকে; না পেলে শুধু নম্বর।"""
    names = {}
    headers = {'User-Agent': 'Mozilla/5.0 (DeenIslam PDF builder)', 'Accept': 'application/json'}
    sources = [
        ('https://api.quran.com/api/v4/chapters', 'chapters', 'id', 'name_arabic'),
        ('https://api.alquran.cloud/v1/surah', 'data', 'number', 'name'),
    ]
    for url, key, idk, nk in sources:
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=20) as r:
                for c in json.loads(r.read().decode('utf-8')).get(key, []):
                    names[int(c[idk])] = c.get(nk) or str(c[idk])
            if names:
                break
        except Exception as e:  # নেটওয়ার্ক না থাকলেও বিল্ড থামবে না
            print('::warning::সূরার নাম ' + url + ' থেকে আনা যায়নি: ' + str(e))
    return names


def ayah_mark(key):
    # key = "সূরা:আয়াত"; পৃষ্ঠায় শুধু আয়াত নম্বর দেখাই
    return '<span class="ae">' + ar(key.split(':')[1]) + '</span>'


def render_line(text):
    out = []
    for w in text.split(' '):
        if not w:
            continue
        if w.startswith('⟦') and w.endswith('⟧'):
            out.append(ayah_mark(w[1:-1]))
        else:
            out.append('<span>' + escape(w) + '</span>')
    return ''.join(out)


def page_html(p, d, names):
    lines = d.get('r', [])
    starts = d.get('s', {})
    rows = []
    for L in range(1, 16):
        text = lines[L - 1] if L - 1 < len(lines) else ''
        if str(L) in starts:
            c = int(starts[str(L)])
            name = names.get(c, 'সূরা ' + bn(c))
            rows.append('<div class="row head"><span>' + escape(name) + '</span></div>')
            continue
        if not text:
            rows.append('<div class="row"></div>')
            continue
        rows.append('<div class="row">' + render_line(text) + '</div>')
    return (
        '<section class="page">'
        '<div class="frame"><div class="inner">'
        + ''.join(rows) +
        '</div></div>'
        '<div class="ft"><span>' + BRAND + '</span><span>' + bn(p) + '</span></div>'
        '</section>'
    )


CSS = """
@font-face { font-family: 'AlMushaf'; src: url('file://%FONT%') format('truetype'); }
@page { size: A4; margin: 12mm 14mm; background: #fbf6e9; }
body { margin: 0; color: #1b1407; font-family: 'AlMushaf', serif; direction: rtl; }
.page { page-break-after: always; height: 270mm; position: relative; }
.page:last-child { page-break-after: auto; }
.frame { border: 2.2px solid #c8962e; padding: 3px; height: 236mm; }
.inner { border: 0.7px solid #c8962e; height: 100%; box-sizing: border-box;
         padding: 10mm 12mm; display: flex; flex-direction: column; justify-content: space-between; }
.row { font-size: 19pt; line-height: 1; text-align: justify; text-align-last: justify; white-space: nowrap; }
.row.head { text-align: center; text-align-last: center; font-size: 18pt; color: #0d7a66;
            border: 1.2px solid #c8962e; border-radius: 6px; padding: 2px 0; }
.ae { display: inline-block; border: 1.1px solid #c8962e; border-radius: 50%; min-width: 1.3em;
      text-align: center; font-size: 13pt; color: #8a5d12; padding: 0 2px; margin: 0 2px; }
.ft { position: absolute; bottom: 0; left: 0; right: 0; display: flex; justify-content: space-between;
      font-family: sans-serif; font-size: 9pt; color: #6b5a3a; direction: ltr; }
.ft span:last-child { font-family: 'AlMushaf', serif; font-size: 12pt; direction: rtl; }
"""


def build():
    with open(SRC, encoding='utf-8') as f:
        data = json.load(f)
    total = int(data.get('_', {}).get('n', 610))
    names = load_surah_names()

    # পারা অনুযায়ী পৃষ্ঠা ভাগ
    by_juz = {}
    for p in range(1, total + 1):
        d = data.get(str(p))
        if not d:
            continue
        j = int(d.get('j') or 0)
        by_juz.setdefault(j, []).append((p, d))
    if not by_juz:
        print('::error::mushaf.json-এ কোনো পৃষ্ঠা নেই')
        sys.exit(1)

    os.makedirs(OUT, exist_ok=True)
    css = CSS.replace('%FONT%', FONT)
    made = 0
    for j in sorted(by_juz):
        body = ''.join(page_html(p, d, names) for p, d in by_juz[j])
        html = '<!doctype html><html lang="ar"><head><meta charset="utf-8"><style>' + css + \
               '</style></head><body>' + body + '</body></html>'
        name = 'para-%02d.pdf' % j if j else 'mushaf-unknown.pdf'
        HTML(string=html, base_url=os.getcwd()).write_pdf(os.path.join(OUT, name))
        made += 1
    print('PDF তৈরি:', made, 'টি পারা, পৃষ্ঠা:', sum(len(v) for v in by_juz.values()))


if __name__ == '__main__':
    build()
