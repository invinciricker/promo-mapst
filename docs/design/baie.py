"""Draws « la Baie », the Promo MAPST illustration: the Baie des Anges seen from the
Promenade, with the Colline du Château on the left, the sea, the pebbles, two blue chairs
and a palm tree. One SVG per moment of the day: aube, jour, couchant, nuit.
Usage: python3 baie.py OUT_DIR"""
import math, os, random, sys

W, H, HZ = 390, 844, 540          # canvas and horizon line

P = {
    "aube": dict(
        sky=[(0, "#A9D0F0"), (.48, "#F5D7E3"), (.84, "#FFD6AD"), (1, "#FFC48A")],
        sun=(238, 552, 44), sun_c=("#FFD37E", "#F39A12"), glow=("#FFC07A", .62), glitter="#FFE0B0",
        back="#A7AEDA", front="#8E95CB", cape="#C2C6E6", far="#D7D6EE",
        sea=[(0, "#A9BFE8"), (.32, "#5B98D2"), (.78, "#24B5BF"), (1, "#86E6D3")],
        foam="#EAFBF6", beach=("#F0E5D9", "#E4D6C6"), pebble="#D2C3B2", walk=("#F8F2EA", "#F1E8DC"),
        chair="#1070B0", chair_hi="#4A9BD3", palm="#2E4B69", palm_o=.92),
    "jour": dict(
        sky=[(0, "#4FB2F0"), (.62, "#A9DCFA"), (1, "#E2F4FD")],
        sun=(302, 428, 21), sun_c=("#FFFDF3", "#FFE9A6"), glow=("#FFF6CF", .85), glitter="#E9F8FF",
        back="#79A4B8", front="#558D9F", cape="#9CC0D0", far="#BCD6E2",
        sea=[(0, "#2C8BD0"), (.4, "#1572BA"), (.82, "#18B8C4"), (1, "#7FE3D6")],
        foam="#F0FCF9", beach=("#EEE9E1", "#E2DACE"), pebble="#CFC6B9", walk=("#F8F6F1", "#F0ECE4"),
        chair="#1070B0", chair_hi="#4A9BD3", palm="#1E3D57", palm_o=.95),
    "couchant": dict(
        sky=[(0, "#4057A8"), (.38, "#B9689D"), (.74, "#FF9763"), (1, "#FFC172")],
        sun=(296, 534, 46), sun_c=("#FFC56A", "#FF6A3D"), glow=("#FF9F62", .7), glitter="#FFC79A",
        back="#6B5A8E", front="#56497C", cape="#8B6E9A", far="#A9849F",
        sea=[(0, "#E39A86"), (.3, "#8E6FA6"), (.72, "#40609F"), (1, "#5C93BE")],
        foam="#F5E4E6", beach=("#DCC6BC", "#CDB4AA"), pebble="#BCA195", walk=("#EADCD2", "#E0CFC4"),
        chair="#1D5E9C", chair_hi="#4B86C2", palm="#2A2142", palm_o=.95),
    "nuit": dict(
        sky=[(0, "#0A1C30"), (.66, "#14365A"), (1, "#2A5478")],
        sun=(268, 418, 15), sun_c=("#FFFFFF", "#E8F0FA"), glow=("#B9D3F0", .5), glitter="#A9C8E8",
        back="#0F2A42", front="#0A2236", cape="#123150", far="#183A5A",
        sea=[(0, "#22507A"), (.45, "#143756"), (1, "#0F2C46")],
        foam="#5E7C98", beach=("#2B3F52", "#24374A"), pebble="#3A4F63", walk=("#33485C", "#2C4053"),
        chair="#3B88C6", chair_hi="#6AA8DA", palm="#06121E", palm_o=1, stars=True, lights=True),
}


def grad(gid, stops, x1=0, y1=0, x2=0, y2=1):
    s = "".join(f'<stop offset="{o}" stop-color="{c}"/>' for o, c in stops)
    return f'<linearGradient id="{gid}" x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}">{s}</linearGradient>'


def leaf(x0, y0, ang, L, wdt, droop):
    a = math.radians(ang)
    tx, ty = x0 + L * math.cos(a), y0 + L * math.sin(a) + droop
    mx, my = x0 + .55 * L * math.cos(a), y0 + .55 * L * math.sin(a) + droop * .2
    nx, ny = -math.sin(a), math.cos(a)
    c1 = (mx + nx * wdt, my + ny * wdt - droop * .15)
    c2 = (mx - nx * wdt * .55, my - ny * wdt * .55 + droop * .25)
    return (f'M{x0:.1f},{y0:.1f} Q{c1[0]:.1f},{c1[1]:.1f} {tx:.1f},{ty:.1f} '
            f'Q{c2[0]:.1f},{c2[1]:.1f} {x0:.1f},{y0:.1f}Z')


def chair(x, y, s, c, hi):
    g = [f'<ellipse cx="{x + 11 * s:.1f}" cy="{y + 40 * s:.1f}" rx="{15 * s:.1f}" ry="{2.6 * s:.1f}" fill="#000" opacity=".10"/>',
         f'<rect x="{x + 2 * s:.1f}" y="{y + 22 * s:.1f}" width="{2.6 * s:.1f}" height="{17 * s:.1f}" rx="{1.2 * s:.1f}" fill="{c}"/>',
         f'<rect x="{x + 17.4 * s:.1f}" y="{y + 22 * s:.1f}" width="{2.6 * s:.1f}" height="{17 * s:.1f}" rx="{1.2 * s:.1f}" fill="{c}"/>',
         f'<rect x="{x - 3 * s:.1f}" y="{y + 15 * s:.1f}" width="{28 * s:.1f}" height="{3.2 * s:.1f}" rx="{1.6 * s:.1f}" fill="{c}"/>',
         f'<path d="M{x:.1f},{y + 4 * s:.1f} Q{x:.1f},{y:.1f} {x + 4 * s:.1f},{y:.1f} H{x + 18 * s:.1f} '
         f'Q{x + 22 * s:.1f},{y:.1f} {x + 22 * s:.1f},{y + 4 * s:.1f} V{y + 24 * s:.1f} H{x:.1f}Z" fill="{c}"/>',
         f'<path d="M{x + 3 * s:.1f},{y + 2.6 * s:.1f} H{x + 19 * s:.1f}" stroke="{hi}" stroke-width="{1.4 * s:.1f}" stroke-linecap="round" opacity=".8"/>']
    return "".join(g)


def scene(name, p):
    rnd = random.Random(7)
    sx, sy, sr = p["sun"]
    d = [grad(f"{name}-sky", p["sky"]), grad(f"{name}-sea", p["sea"]), grad(f"{name}-beach", list(zip((0, 1), p["beach"]))),
         grad(f"{name}-walk", list(zip((0, 1), p["walk"]))),
         f'<radialGradient id="{name}-glow"><stop offset="0" stop-color="{p["glow"][0]}" stop-opacity="{p["glow"][1]}"/>'
         f'<stop offset="1" stop-color="{p["glow"][0]}" stop-opacity="0"/></radialGradient>',
         f'<radialGradient id="{name}-sun" cx=".42" cy=".38"><stop offset="0" stop-color="{p["sun_c"][0]}"/>'
         f'<stop offset="1" stop-color="{p["sun_c"][1]}"/></radialGradient>']
    o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" '
         f'preserveAspectRatio="xMidYMid slice" role="img" aria-label="La Baie des Anges, {name}">',
         f'<defs>{"".join(d)}</defs>',
         f'<rect width="{W}" height="{HZ + 20}" fill="url(#{name}-sky)"/>']
    if p.get("stars"):
        for _ in range(46):
            x, y, r = rnd.uniform(4, W - 4), rnd.uniform(8, HZ - 90), rnd.choice((.6, .8, .8, 1.1, 1.4))
            o.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r}" fill="#fff" opacity="{rnd.uniform(.35, .9):.2f}"/>')
    o.append(f'<circle cx="{sx}" cy="{sy}" r="{sr * 4.2:.0f}" fill="url(#{name}-glow)"/>')
    o.append(f'<circle cx="{sx}" cy="{sy}" r="{sr}" fill="url(#{name}-sun)"/>')
    # far mountains (Estérel) and the Cap d'Antibes, on the right
    o.append(f'<path d="M232,{HZ} L262,{HZ - 11} L281,{HZ - 7} L303,{HZ - 23} L322,{HZ - 14} L341,{HZ - 21} '
             f'L362,{HZ - 10} L390,{HZ - 16} V{HZ}Z" fill="{p["far"]}"/>')
    o.append(f'<path d="M246,{HZ} C276,{HZ - 9} 312,{HZ - 11} 340,{HZ - 9} C362,{HZ - 8} 378,{HZ - 6} 390,{HZ - 7} V{HZ}Z" fill="{p["cape"]}"/>')
    # Mont Boron and the Colline du Château, on the left
    o.append(f'<path d="M0,{HZ - 82} C34,{HZ - 93} 70,{HZ - 90} 104,{HZ - 74} C138,{HZ - 57} 164,{HZ - 30} 214,{HZ - 8} '
             f'C232,{HZ - 2} 250,{HZ} 262,{HZ} H0Z" fill="{p["back"]}"/>')
    o.append(f'<path d="M0,{HZ - 46} C22,{HZ - 57} 52,{HZ - 65} 78,{HZ - 59} C104,{HZ - 52} 122,{HZ - 32} 146,{HZ - 14} '
             f'C158,{HZ - 6} 172,{HZ - 1} 190,{HZ} H0Z" fill="{p["front"]}"/>')
    if p.get("lights"):
        for _ in range(38):
            x = rnd.uniform(4, 180); top = HZ - 56 + (x / 180) * 50
            y = rnd.uniform(top, HZ - 3)
            o.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{rnd.choice((.7, .9, 1.1))}" fill="#FFD27A" opacity="{rnd.uniform(.55, .95):.2f}"/>')
        for x in range(262, 388, 9):
            o.append(f'<circle cx="{x + rnd.uniform(-3, 3):.1f}" cy="{HZ - rnd.uniform(2, 7):.1f}" r=".8" fill="#FFD27A" opacity=".7"/>')
    # the sea
    o.append(f'<rect y="{HZ}" width="{W}" height="{690 - HZ}" fill="url(#{name}-sea)"/>')
    for i in range(26):
        y = HZ + 4 + i * 4.6 + rnd.uniform(-1, 1)
        spread = 6 + i * 1.6
        w = max(3, (26 - i * .8) * rnd.uniform(.35, 1))
        x = sx - w / 2 + rnd.uniform(-spread, spread)
        o.append(f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="1.6" rx=".8" fill="{p["glitter"]}" opacity="{max(.08, .85 - i * .03):.2f}"/>')
    bx, by = 128, HZ + 26
    o.append(f'<path d="M{bx},{by} L{bx + 9},{by} L{bx + 7.5},{by + 3} L{bx + 1.5},{by + 3}Z" fill="{p["front"]}" opacity=".85"/>'
             f'<path d="M{bx + 4.6},{by - 13} L{bx + 4.6},{by - 1} L{bx + 10},{by - 1}Z" fill="#fff" opacity=".92"/>'
             f'<path d="M{bx + 3.8},{by - 10} L{bx + 3.8},{by - 1} L{bx},{by - 1}Z" fill="#fff" opacity=".8"/>')
    for i, y in enumerate((640, 664, 678)):
        x = 30 + rnd.uniform(0, 200)
        o.append(f'<path d="M{x:.0f},{y} q22,-2.2 44,0" stroke="#fff" stroke-width="1.1" fill="none" stroke-linecap="round" opacity="{.22 + i * .08:.2f}"/>')
    # the shore, the pebbles, the Promenade
    o.append(f'<path d="M0,688 C40,682 70,692 112,686 C156,680 190,692 236,686 C282,680 320,692 390,684 V700 H0Z" fill="{p["foam"]}" opacity=".9"/>')
    o.append(f'<rect y="694" width="{W}" height="34" fill="url(#{name}-beach)"/>')
    for _ in range(70):
        x, y = rnd.uniform(0, W), rnd.uniform(698, 726)
        o.append(f'<ellipse cx="{x:.1f}" cy="{y:.1f}" rx="{rnd.uniform(1.4, 3.2):.1f}" ry="{rnd.uniform(.9, 1.8):.1f}" fill="{p["pebble"]}" opacity=".9"/>')
    o.append(f'<rect y="728" width="{W}" height="{H - 728}" fill="url(#{name}-walk)"/>')
    o.append(f'<rect y="726" width="{W}" height="3" fill="{p["pebble"]}" opacity=".7"/>')
    o.append(chair(262, 690, 1.0, p["chair"], p["chair_hi"]))
    o.append(chair(300, 694, .94, p["chair"], p["chair_hi"]))
    # a palm tree on the left
    pts_l, pts_r = [], []
    for i in range(13):
        t = i / 12
        x = 30 + 22 * t + 9 * math.sin(t * 2.2)
        y = H + 10 - (H + 10 - 640) * t
        w = 5.4 - 2.2 * t
        pts_l.append((x - w, y)); pts_r.append((x + w, y))
    trunk = " ".join(f"{x:.1f},{y:.1f}" for x, y in pts_l + pts_r[::-1])
    o.append(f'<g fill="{p["palm"]}" opacity="{p["palm_o"]}"><polygon points="{trunk}"/>')
    tx, ty = pts_l[-1][0] + 2.2, 640
    for ang, L, wd, dr in ((-172, 78, 13, 34), (-150, 74, 14, 16), (-124, 58, 12, 2), (-96, 46, 10, -2), (-66, 58, 12, 2),
                           (-36, 76, 14, 14), (-10, 84, 13, 34), (18, 70, 12, 40), (160, 68, 12, 38), (-56, 40, 9, -4)):
        o.append(f'<path d="{leaf(tx, ty, ang, L, wd, dr)}"/>')
    o.append("</g></svg>")
    return "".join(o)


if __name__ == "__main__":
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)
    for name, p in P.items():
        with open(os.path.join(out, f"baie-{name}.svg"), "w", encoding="utf-8") as f:
            f.write(scene(name, p) + "\n")
    print("written:", ", ".join(f"baie-{n}.svg" for n in P))
