"""Generates the "Colours & shapes" card deck (public/cards/abstract/NN.svg).

Our own generative artwork: soft shapes and colours with no fixed meaning, for
projective work on feelings and states. Re-running gives the same cards (fixed seeds).
Run: python3 scripts/decks/abstract.py
"""
import math, random, os

OUT = os.path.join(os.path.dirname(__file__), "..", "..", "apps", "web", "public", "cards", "abstract")
W, H = 320, 480

# Palettes: [background top, background bottom, shape colours...]
PALETTES = {
    "calm":   ["#E8EFEA", "#C9D9D0", "#8FB09D", "#6B8F7B", "#F4F1EA", "#A9C3B6"],
    "dawn":   ["#F6E3D4", "#EBC9B5", "#E3A688", "#F2D39B", "#C98A5B", "#FFF4E8"],
    "sea":    ["#DCE7EE", "#A9C1D0", "#527486", "#8FA9B8", "#E9F0F3", "#3F5E6E"],
    "dusk":   ["#3B3A55", "#5D5675", "#C9A38A", "#E3C16F", "#8C7BA8", "#2A2840"],
    "storm":  ["#5E6670", "#2F353C", "#9AA4AD", "#D8DDE1", "#1E2328", "#7E8A94"],
    "fire":   ["#F3D2B8", "#D08E6A", "#A3573F", "#E3C16F", "#7A3B2A", "#F6E6D6"],
    "earth":  ["#E9E0D2", "#CDBBA0", "#8A6A4F", "#A3896B", "#5E4A3A", "#D9C7AE"],
    "spring": ["#F1F4E4", "#DDE8C4", "#9DBF7A", "#E7B7C0", "#F2D39B", "#6E9A5A"],
    "night":  ["#1E2430", "#2E3A4E", "#E8E2CF", "#8FA9B8", "#4A5A78", "#F4F1EA"],
    "rose":   ["#F5E6E8", "#E6C3C9", "#C98A97", "#A35D6E", "#F7EFEA", "#7A9E9F"],
    "fog":    ["#F1EFEC", "#DAD6D1", "#B8B2AB", "#8F8984", "#FFFFFF", "#C9C4BE"],
    "bright": ["#FFF6DD", "#FBE3A8", "#E5775B", "#4F8FBF", "#F2C14E", "#6BB38A"],
}

def blob(rnd, cx, cy, r, points=7, wobble=0.35):
    pts = []
    for i in range(points):
        a = 2 * math.pi * i / points
        rr = r * (1 + rnd.uniform(-wobble, wobble))
        pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a) * rnd.uniform(0.8, 1.2)))
    # Smooth closed curve through the points (Catmull-Rom → Bézier).
    d = f"M{pts[0][0]:.1f} {pts[0][1]:.1f}"
    n = len(pts)
    for i in range(n):
        p0, p1, p2, p3 = pts[(i - 1) % n], pts[i], pts[(i + 1) % n], pts[(i + 2) % n]
        c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
        d += f" C{c1[0]:.1f} {c1[1]:.1f} {c2[0]:.1f} {c2[1]:.1f} {p2[0]:.1f} {p2[1]:.1f}"
    return d + "Z"

def wave_path(rnd, y, amp, freq, phase):
    d = f"M-10 {y:.1f}"
    for x in range(-10, W + 20, 10):
        d += f" L{x} {y + amp * math.sin(x / W * freq * 2 * math.pi + phase):.1f}"
    return d

def card(seed, style, pal):
    rnd = random.Random(seed)
    p = PALETTES[pal]
    bg1, bg2, cols = p[0], p[1], p[2:]
    els = []
    pick = lambda: rnd.choice(cols)
    if style == "blobs":
        for _ in range(rnd.randint(2, 4)):
            els.append(f'<path d="{blob(rnd, rnd.uniform(60, 260), rnd.uniform(90, 400), rnd.uniform(40, 110))}" fill="{pick()}" opacity="{rnd.uniform(0.45, 0.85):.2f}"/>')
    elif style == "one":
        c = pick()
        els.append(f'<path d="{blob(rnd, 160, rnd.uniform(200, 280), rnd.uniform(70, 100), 9, 0.25)}" fill="{c}" opacity="0.85"/>')
        if rnd.random() < 0.6:
            els.append(f'<circle cx="{rnd.uniform(70, 250):.0f}" cy="{rnd.uniform(60, 140):.0f}" r="{rnd.uniform(8, 18):.0f}" fill="{pick()}" opacity="0.8"/>')
    elif style == "waves":
        for i in range(rnd.randint(3, 6)):
            y = 120 + i * rnd.uniform(45, 70)
            els.append(f'<path d="{wave_path(rnd, y, rnd.uniform(8, 30), rnd.uniform(1, 2.5), rnd.uniform(0, 6))} L{W + 20} {H + 10} L-10 {H + 10}Z" fill="{pick()}" opacity="{rnd.uniform(0.35, 0.7):.2f}"/>')
    elif style == "circles":
        for _ in range(rnd.randint(3, 7)):
            r = rnd.uniform(14, 90)
            els.append(f'<circle cx="{rnd.uniform(40, 280):.0f}" cy="{rnd.uniform(60, 420):.0f}" r="{r:.0f}" fill="{pick()}" opacity="{rnd.uniform(0.4, 0.8):.2f}"/>')
    elif style == "rings":
        cx, cy = rnd.uniform(110, 210), rnd.uniform(180, 300)
        for i in range(rnd.randint(4, 8)):
            els.append(f'<circle cx="{cx:.0f}" cy="{cy:.0f}" r="{18 + i * rnd.uniform(14, 22):.0f}" fill="none" stroke="{pick()}" stroke-width="{rnd.uniform(3, 9):.1f}" opacity="0.8"/>')
    elif style == "shards":
        for _ in range(rnd.randint(5, 9)):
            x, y = rnd.uniform(20, 300), rnd.uniform(40, 440)
            pts = " ".join(f"{x + rnd.uniform(-70, 70):.0f},{y + rnd.uniform(-90, 90):.0f}" for _ in range(3))
            els.append(f'<polygon points="{pts}" fill="{pick()}" opacity="{rnd.uniform(0.5, 0.9):.2f}"/>')
    elif style == "tangle":
        d = f"M{rnd.uniform(40, 280):.0f} {rnd.uniform(60, 420):.0f}"
        for _ in range(rnd.randint(10, 16)):
            d += f" Q{rnd.uniform(0, W):.0f} {rnd.uniform(0, H):.0f} {rnd.uniform(30, 290):.0f} {rnd.uniform(50, 430):.0f}"
        els.append(f'<path d="{d}" fill="none" stroke="{pick()}" stroke-width="{rnd.uniform(3, 6):.1f}" stroke-linecap="round" opacity="0.85"/>')
    elif style == "split":
        x = rnd.uniform(130, 190)
        els.append(f'<rect x="0" y="0" width="{x:.0f}" height="{H}" fill="{pick()}" opacity="0.75"/>')
        els.append(f'<path d="{blob(rnd, x + rnd.uniform(-20, 60), rnd.uniform(160, 320), rnd.uniform(40, 70))}" fill="{pick()}" opacity="0.8"/>')
    elif style == "horizon":
        y = rnd.uniform(220, 340)
        els.append(f'<rect x="0" y="{y:.0f}" width="{W}" height="{H}" fill="{pick()}" opacity="0.8"/>')
        els.append(f'<circle cx="{rnd.uniform(70, 250):.0f}" cy="{y - rnd.uniform(40, 120):.0f}" r="{rnd.uniform(20, 46):.0f}" fill="{pick()}" opacity="0.9"/>')
    elif style == "lines":
        c = pick()
        for i in range(rnd.randint(6, 14)):
            x = rnd.uniform(20, 300)
            els.append(f'<path d="M{x:.0f} {rnd.uniform(-10, 160):.0f} Q{x + rnd.uniform(-60, 60):.0f} {rnd.uniform(160, 320):.0f} {x + rnd.uniform(-40, 40):.0f} {rnd.uniform(330, 490):.0f}" fill="none" stroke="{c if rnd.random() < 0.7 else pick()}" stroke-width="{rnd.uniform(2, 7):.1f}" stroke-linecap="round" opacity="0.75"/>')
    elif style == "contained":
        cx, cy, r = 160, rnd.uniform(200, 280), rnd.uniform(90, 120)
        els.append(f'<circle cx="{cx}" cy="{cy:.0f}" r="{r:.0f}" fill="none" stroke="{pick()}" stroke-width="5" opacity="0.85"/>')
        for _ in range(rnd.randint(1, 5)):
            a, rr = rnd.uniform(0, 6.28), rnd.uniform(0, r - 25)
            els.append(f'<circle cx="{cx + rr * math.cos(a):.0f}" cy="{cy + rr * math.sin(a):.0f}" r="{rnd.uniform(8, 20):.0f}" fill="{pick()}" opacity="0.85"/>')
        if rnd.random() < 0.6:
            a = rnd.uniform(0, 6.28)
            els.append(f'<circle cx="{cx + (r + 45) * math.cos(a):.0f}" cy="{cy + (r + 45) * math.sin(a):.0f}" r="{rnd.uniform(8, 16):.0f}" fill="{pick()}" opacity="0.9"/>')
    elif style == "dots":
        c = pick()
        for _ in range(rnd.randint(25, 70)):
            els.append(f'<circle cx="{rnd.gauss(160, 70):.0f}" cy="{rnd.gauss(240, 110):.0f}" r="{rnd.uniform(2, 9):.1f}" fill="{c if rnd.random() < 0.8 else pick()}" opacity="{rnd.uniform(0.5, 0.95):.2f}"/>')
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">
<defs><linearGradient id="bg" x1="0" y1="0" x2="{rnd.uniform(0, 1):.2f}" y2="1"><stop offset="0" stop-color="{bg1}"/><stop offset="1" stop-color="{bg2}"/></linearGradient>
<filter id="soft" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="2" seed="{seed}"/><feDisplacementMap in="SourceGraphic" scale="6"/></filter></defs>
<rect width="{W}" height="{H}" fill="url(#bg)"/>
<g filter="url(#soft)">{"".join(els)}</g>
</svg>
'''

# 40 cards: each style in a few moods, so the deck covers calm, joy, tension, heaviness and change.
PLAN = [
    ("one", "calm"), ("blobs", "dawn"), ("waves", "sea"), ("shards", "storm"), ("rings", "spring"),
    ("tangle", "fire"), ("split", "fog"), ("horizon", "dusk"), ("lines", "earth"), ("contained", "rose"),
    ("dots", "night"), ("circles", "bright"), ("one", "storm"), ("blobs", "spring"), ("waves", "dusk"),
    ("shards", "fire"), ("rings", "sea"), ("tangle", "fog"), ("split", "bright"), ("horizon", "calm"),
    ("lines", "night"), ("contained", "earth"), ("dots", "dawn"), ("circles", "rose"), ("one", "fire"),
    ("blobs", "night"), ("waves", "calm"), ("shards", "bright"), ("rings", "dusk"), ("tangle", "spring"),
    ("split", "storm"), ("horizon", "sea"), ("lines", "rose"), ("contained", "fog"), ("dots", "fire"),
    ("circles", "earth"), ("one", "dawn"), ("blobs", "storm"), ("waves", "fire"), ("horizon", "night"),
]

if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for i, (style, pal) in enumerate(PLAN, 1):
        with open(os.path.join(OUT, f"{i:02d}.svg"), "w") as f:
            f.write(card(1000 + i * 7, style, pal))
    print(len(PLAN), "cards written to", os.path.normpath(OUT))
