#!/usr/bin/env python3
"""
Inline css/styles.css and bundle.js into index.html to produce
fret-department-standalone.html — a single file with zero external dependencies.

Version is read from the VERSION file at the project root.
Workflow: edit VERSION → make standalone → git commit → git tag vX.Y.Z
"""
import re, pathlib, datetime

root = pathlib.Path(__file__).parent.parent

version    = 'v' + (root / "VERSION").read_text().strip()
build_date = datetime.date.today().isoformat()
stamp      = f'Fret Department: Guitar Chords &amp; Scales · {version} · {build_date}'

# --- 1. Stamp version into index.html so the dev server is always current ---
index_path = root / "index.html"
index_src  = index_path.read_text()
index_src  = re.sub(
    r'(<span class="footer-info">)[^<]*(</span>)',
    rf'\g<1>{stamp}\g<2>',
    index_src,
)
index_path.write_text(index_src)

# --- 2. Build standalone by inlining CSS and JS into the (now-stamped) HTML ---
html = index_src
css  = (root / "css" / "styles.css").read_text()
js   = (root / "bundle.js").read_text()

# Replace <link rel="stylesheet" href="css/styles.css"> with inlined <style>.
html = re.sub(
    r'[ \t]*<link\b[^>]*href="css/styles\.css"[^>]*>\n?',
    lambda _: '<style>\n' + css + '\n  </style>\n  ',
    html,
)

# Replace the comment + <script src="bundle.js"> with inlined <script>.
html = re.sub(
    r'[ \t]*<!--[^\n]*bundle[^\n]*-->\n[ \t]*<script src="bundle\.js"></script>',
    lambda _: '<script>\n' + js + '\n  </script>',
    html,
)

out = root / "fret-department-standalone.html"
out.write_text(html)
print(f"  wrote {out.name}  ({len(html)/1024:.1f} KB)")
