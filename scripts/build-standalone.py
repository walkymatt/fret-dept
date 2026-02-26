#!/usr/bin/env python3
"""
Inline css/styles.css and bundle.js into index.html to produce
guitar-standalone.html — a single file with zero external dependencies.
"""
import re, pathlib

root = pathlib.Path(__file__).parent.parent

html = (root / "index.html").read_text()
css  = (root / "css" / "styles.css").read_text()
js   = (root / "bundle.js").read_text()

# Replace <link rel="stylesheet" href="css/styles.css"> with inlined <style>.
# Use a lambda for the replacement so backslashes in css are treated literally.
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

out = root / "guitar-standalone.html"
out.write_text(html)
print(f"  wrote {out.name}  ({len(html)/1024:.1f} KB)")
