"""Tekent de app-iconen en het deelplaatje uit één vorm: het blauwe
wegwijzerbord met witte binnenrand en de gele afslagpijl (zie favicon.svg).

    py tools/build-icons.py

Schrijft:
    icons/icon-192.png, icons/icon-512.png      afgeronde hoeken, doorzichtig erbuiten
    icons/icon-maskable-512.png                 vlak blauw tot de rand, pijl in de veilige zone
    icons/apple-touch-icon.png                  180 px, vlak blauw (iOS rondt zelf af)
    favicon.ico                                 16, 32 en 48 px
    og-image.png                                1200 × 630, voor een gedeelde link

Vereist Pillow. De tekst op het deelplaatje staat in Arial Narrow Bold, de
terugvalletter van de app voor Barlow Condensed; Pillow leest geen woff2.
"""
import os, sys, math
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BLAUW = (15, 76, 151, 255)
GEEL = (245, 197, 24, 255)
WIT = (255, 255, 255, 255)
PAPIER = (242, 234, 215, 255)
RASTER = (215, 205, 175, 255)
INKT = (20, 21, 24, 255)
INKT3 = (95, 92, 85, 255)
SS = 4  # supersampling tegen kartelranden; Pillow tekent zonder antialiasing


def roteer(punten, hoek, cx, cy):
    r = math.radians(hoek)
    uit = []
    for x, y in punten:
        dx, dy = x - cx, y - cy
        uit.append((cx + dx * math.cos(r) - dy * math.sin(r), cy + dx * math.sin(r) + dy * math.cos(r)))
    return uit


def pijl(draw, W, schaal=1.0):
    """De afslagpijl: schacht plus punt, 45° omhoog naar rechts, om het midden."""
    c = W / 2
    def s(v):  # eenheidscoördinaat -> pixel, geschaald om het midden
        return c + (v - 0.5) * W * schaal
    schacht = [(s(.20), s(.435)), (s(.58), s(.435)), (s(.58), s(.565)), (s(.20), s(.565))]
    punt = [(s(.55), s(.29)), (s(.55), s(.71)), (s(.82), s(.50))]
    draw.polygon(roteer(schacht, -45, c, c), fill=GEEL)
    draw.polygon(roteer(punt, -45, c, c), fill=GEEL)


def bord(S, afgerond=True, rand=True, pijlschaal=1.0):
    W = S * SS
    im = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if afgerond:
        d.rounded_rectangle([0, 0, W - 1, W - 1], radius=int(W * .16), fill=BLAUW)
    else:
        d.rectangle([0, 0, W - 1, W - 1], fill=BLAUW)
    if rand:
        i = int(W * .07)
        d.rounded_rectangle([i, i, W - 1 - i, W - 1 - i], radius=int(W * .10), outline=WIT, width=int(W * .035))
    pijl(d, W, pijlschaal)
    return im.resize((S, S), Image.LANCZOS)


def deelplaatje():
    W, H = 1200, 630
    im = Image.new("RGBA", (W, H), PAPIER)
    d = ImageDraw.Draw(im)
    for x in range(0, W, 26):
        d.line([(x, 0), (x, H)], fill=RASTER, width=1)
    for y in range(0, H, 26):
        d.line([(0, y), (W, y)], fill=RASTER, width=1)
    icoon = bord(220, afgerond=True, rand=True)
    im.alpha_composite(icoon, (96, 150))
    x, rechts = 360, W - 96
    pad = os.path.join(os.environ.get("WINDIR", r"C:\Windows"), "Fonts", "ARIALNB.TTF")

    def passend(tekst, maat, breedte):
        """De grootste letter (vanaf `maat`) waarmee de tekst in `breedte` past."""
        while maat > 12:
            try:
                f = ImageFont.truetype(pad, maat)
            except OSError:
                return ImageFont.load_default()
            if d.textlength(tekst, font=f) <= breedte:
                return f
            maat -= 2
        return ImageFont.truetype(pad, maat)

    kop = "GRENSCHECKLIST"
    d.text((x, 150), kop, font=passend(kop, 128, rechts - x), fill=INKT)
    d.line([(x, 300), (rechts, 300)], fill=INKT, width=3)
    d.line([(x, 307), (rechts, 307)], fill=INKT, width=1)
    sub = "JE AUTO-REISASSISTENT VOOR EUROPA"
    d.text((x, 330), sub, font=passend(sub, 46, rechts - x), fill=INKT3)
    # de gele afslag onderaan, als de knop in de app
    d.rectangle([x, 430, rechts, 520], fill=GEEL, outline=INKT, width=4)
    regel = "VIGNETTEN · MILIEUZONES · TOL · VERPLICHTE SPULLEN"
    d.text((x + 28, 455), regel, font=passend(regel, 34, rechts - x - 56), fill=INKT)
    noot = "GRATIS · GEEN ACCOUNT · WERKT OFFLINE"
    d.text((x + 28, 540), noot, font=passend(noot, 34, rechts - x - 56), fill=INKT3)
    return im.convert("RGB")


def main():
    os.makedirs(os.path.join(ROOT, "icons"), exist_ok=True)
    bord(192).save(os.path.join(ROOT, "icons", "icon-192.png"), optimize=True)
    bord(512).save(os.path.join(ROOT, "icons", "icon-512.png"), optimize=True)
    bord(512, afgerond=False, rand=False, pijlschaal=.78).save(
        os.path.join(ROOT, "icons", "icon-maskable-512.png"), optimize=True)
    bord(180, afgerond=False, rand=True).convert("RGB").save(
        os.path.join(ROOT, "icons", "apple-touch-icon.png"), optimize=True)
    bord(64).save(os.path.join(ROOT, "favicon.ico"), sizes=[(16, 16), (32, 32), (48, 48)])
    deelplaatje().save(os.path.join(ROOT, "og-image.png"), optimize=True)
    for naam in ["icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png",
                 "icons/apple-touch-icon.png", "favicon.ico", "og-image.png"]:
        print(f"{naam:32} {os.path.getsize(os.path.join(ROOT, naam)) // 1024 + 1:4} KB")


if __name__ == "__main__":
    sys.exit(main())
