#!/usr/bin/env python3
"""Génère les assets de la carte (pass-model/) — DA premium napolitain.
Logo : utilise brand/logo-hd.png si présent, sinon brand/ig_logo.jpg.
Strip : brand/strip_src.jpg + dégradé espresso.
"""
from PIL import Image, ImageDraw
import os

HERE = os.path.dirname(os.path.abspath(__file__))
BRAND = os.path.join(HERE, "brand")
MODEL = os.path.join(HERE, "pass-model")
os.makedirs(MODEL, exist_ok=True)

LOGO_SRC = os.path.join(BRAND, "logo-hd.png")
if not os.path.exists(LOGO_SRC):
    LOGO_SRC = os.path.join(BRAND, "ig_logo.jpg")
STRIP_SRC = os.path.join(BRAND, "strip_src.jpg")

def cover(img, w, h):
    iw, ih = img.size
    s = max(w / iw, h / ih)
    img = img.resize((int(iw * s), int(ih * s)), Image.LANCZOS)
    nw, nh = img.size
    l, t = (nw - w) // 2, (nh - h) // 2
    return img.crop((l, t, l + w, t + h))

# STRIP : photo + dégradé espresso (sombre à gauche pour le texte, vignette bas)
def make_strip(path, w, h):
    base = cover(Image.open(STRIP_SRC).convert("RGB"), w, h)
    ov = Image.new("L", (w, h), 0)
    px = ov.load()
    for x in range(w):
        gx = max(190 - int(150 * x / w), 0)
        for y in range(h):
            px[x, y] = min(gx + int(75 * y / h), 230)
    dark = Image.new("RGB", (w, h), (34, 23, 16))
    Image.composite(dark, base, ov).save(path)

for s, (w, h) in {"": (375, 144), "@2x": (750, 288), "@3x": (1125, 432)}.items():
    make_strip(os.path.join(MODEL, f"strip{s}.png"), w, h)

# LOGO : rond
def make_logo(path, size):
    img = cover(Image.open(LOGO_SRC).convert("RGB"), size, size).convert("RGBA")
    m = Image.new("L", (size, size), 0)
    ImageDraw.Draw(m).ellipse((0, 0, size, size), fill=255)
    img.putalpha(m)
    img.save(path)

for s, mult in {"": 1, "@2x": 2, "@3x": 3}.items():
    make_logo(os.path.join(MODEL, f"logo{s}.png"), 50 * mult)

# ICON : carré arrondi
def make_icon(path, size):
    img = cover(Image.open(LOGO_SRC).convert("RGB"), size, size).convert("RGBA")
    m = Image.new("L", (size, size), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, size - 1, size - 1), radius=int(size * 0.22), fill=255)
    img.putalpha(m)
    img.save(path)

for s, mult in {"": 1, "@2x": 2, "@3x": 3}.items():
    make_icon(os.path.join(MODEL, f"icon{s}.png"), 29 * mult)

print(f"assets régénérés depuis {os.path.basename(LOGO_SRC)} + strip_src.jpg")
