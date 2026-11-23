"""Write the site files that differ between the preview and the live app.
   python3 tools/brand.py preview <dir>   orange "Tooz Preview" (own name, icon, cache, version marked preview)
   python3 tools/brand.py live <dir>      the normal "Tooz" app, straight from src/site/
<dir>/index.html must already be a fresh unbranded build (cd src && python3 assemble.py)."""
import sys, json, re, shutil, os
mode, d = sys.argv[1], sys.argv[2]
site = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src', 'site')
ver = re.search(r"APP_VERSION='([^']*)'", open(f'{d}/index.html').read()).group(1)
for n in ('sw.js', 'manifest.json', 'icon-180.png', 'icon-512.png'):
    shutil.copyfile(f'{site}/{n}', f'{d}/{n}')
if mode == 'live': sys.exit(0)
assert mode == 'preview', mode
from PIL import Image, ImageOps
m = json.load(open(f'{d}/manifest.json'))
m.update(name='Tooz Preview', short_name='Tooz Preview', theme_color='#D9661F')
json.dump(m, open(f'{d}/manifest.json', 'w'), indent=2)
h = open(f'{d}/index.html').read()
for a, b in [('<meta name="apple-mobile-web-app-title" content="Tooz">', '<meta name="apple-mobile-web-app-title" content="Tooz Preview">'),
             ('<title>Tooz eReader</title>', '<title>Tooz Preview</title>'),
             (f"APP_VERSION='{ver}'", f"APP_VERSION='{ver} preview'")]:
    assert a in h, a
    h = h.replace(a, b)
open(f'{d}/index.html', 'w').write(h)
s = open(f'{d}/sw.js').read()
s = re.sub(r"const CACHE = '[^']*'", f"const CACHE = 'tooz-preview-{ver}'", s)
open(f'{d}/sw.js', 'w').write(s)
for n in ('icon-180.png', 'icon-512.png'):
    im = Image.open(f'{d}/{n}').convert('RGB')
    ImageOps.colorize(ImageOps.grayscale(im), black='#3A1500', white='#FFE2C8', mid='#D9661F').save(f'{d}/{n}')
