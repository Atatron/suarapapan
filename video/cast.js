// cast.js: SuaraPapan v2 character rigs (Bu Wulan, Bima, Arka, Laras, Tara + background classmates).
// Every character is a pure function of its options -> SVG markup, so any frame re-renders identically.
// Kid local frame: origin = hip centre, y grows downward, head centre at (0,-262), shoulders at (+-72,-128).
(function () {
  const OL = '#2E2420';      // one warm outline colour for the whole cast
  const LW = 5;              // outline width in character units
  const SHIRT = '#FBFAF6', SHIRT_SH = '#DCE3E8', RED = '#D6343C', RED_SH = '#A9242B';
  const MOUTH_IN = '#6E2626', TONGUE = '#E9837F';

  const PAL = {
    bima:  { skin: '#B97A51', sh: '#9A6241', hair: '#1E1814', hairHi: '#47392F', iris: '#3B2416', boy: true },
    arka:  { skin: '#CC9268', sh: '#AD744E', hair: '#2B1D15', hairHi: '#5A4434', iris: '#3D2617', boy: true },
    laras: { skin: '#D9A77D', sh: '#BB8960', hair: '#26180F', hairHi: '#55402F', iris: '#3A2414', boy: false },
    tara:  { skin: '#A96D49', sh: '#8B5636', hijab: '#F7F6F0', hijabSh: '#D9D8CE', iris: '#2E1C10', boy: false },
    wulan: { skin: '#E2A97F', sh: '#C68C64', hijab: '#2E8C80', hijabSh: '#22695F', hijabHi: '#5BB3A6', iris: '#3A2416', lips: '#B9564F' },
    // background classmates (back view only)
    x1: { skin: '#C08559', sh: '#A06A44', hair: '#231812', hairHi: '#433227', boy: true, style: 'short' },
    x2: { skin: '#B07550', sh: '#90603F', hijab: '#F7F6F0', hijabSh: '#D9D8CE', boy: false, style: 'hijab' },
    x3: { skin: '#D3A07A', sh: '#B5845F', hair: '#2A1B12', hairHi: '#4C3829', boy: false, style: 'pony' },
    x4: { skin: '#C48E66', sh: '#A6734D', hair: '#1B1511', hairHi: '#3B302A', boy: true, style: 'buzz' },
  };

  let uidN = 0;
  const uid = p => `${p}${++uidN}`;
  const n = v => Math.round(v * 10) / 10;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  const P = (d, fill, stroke = OL, sw = LW, extra = '') =>
    `<path d="${d}" fill="${fill}"${stroke ? ` stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round"` : ''} ${extra}/>`;
  const E = (cx, cy, rx, ry, fill, stroke = OL, sw = LW, extra = '') =>
    `<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(rx)}" ry="${n(ry)}" fill="${fill}"${stroke ? ` stroke="${stroke}" stroke-width="${sw}"` : ''} ${extra}/>`;
  const C = (cx, cy, r, fill, stroke = OL, sw = LW, extra = '') => E(cx, cy, r, r, fill, stroke, sw, extra);

  // A thick rounded limb with an outline: outline stroke underneath, colour stroke on top.
  function limb(pts, w, col) {
    const d = 'M' + pts.map(p => `${n(p[0])},${n(p[1])}`).join(' L');
    return `<path d="${d}" fill="none" stroke="${OL}" stroke-width="${w + 2 * LW}" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<path d="${d}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
  }

  // Two-bone IK: elbow placed on the side given by `bend` (+1/-1).
  function ikNat(s, h, L1, L2, side) {
    const A = ik(s, h, L1, L2, 1), B = ik(s, h, L1, L2, -1);
    const sc = r => side * r.e[0] + .6 * r.e[1];
    return sc(A) >= sc(B) ? A : B;
  }
  function ik(s, h, L1, L2, bend) {
    let dx = h[0] - s[0], dy = h[1] - s[1];
    let d = Math.hypot(dx, dy) || 0.001;
    const dd = clamp(d, Math.abs(L1 - L2) + 0.5, L1 + L2 - 0.5);
    const a = Math.atan2(dy, dx);
    const b = Math.acos(clamp((L1 * L1 + dd * dd - L2 * L2) / (2 * L1 * dd), -1, 1));
    const ea = a + bend * b;
    const e = [s[0] + L1 * Math.cos(ea), s[1] + L1 * Math.sin(ea)];
    const hh = [s[0] + dd * Math.cos(a), s[1] + dd * Math.sin(a)];
    return { e, h: hh };
  }

  // ---------- faces ----------
  function faceD(rx, ry) {
    return `M${-rx},0 C${-rx},${n(-ry * .62)} ${n(-rx * .56)},${-ry} 0,${-ry} C${n(rx * .56)},${-ry} ${rx},${n(-ry * .62)} ${rx},0 ` +
      `C${rx},${n(ry * .56)} ${n(rx * .6)},${ry} 0,${ry} C${n(-rx * .6)},${ry} ${-rx},${n(ry * .56)} ${-rx},0 Z`;
  }

  // eye: kinds open | closed | happy | squeeze | wide.  side = -1 (screen left) / +1
  function eye(cx, cy, side, o) {
    const rx = o.rx || 25, ry = o.ry || 29;
    const kind = o.eyes || 'open';
    const open = kind === 'open' || kind === 'wide' ? clamp(o.open == null ? 1 : o.open, 0, 1) : 1;
    let s = '';
    if (kind === 'happy') return P(`M${n(cx - rx * .92)},${n(cy + 7)} Q${n(cx)},${n(cy - 17)} ${n(cx + rx * .92)},${n(cy + 7)}`, 'none', OL, 6.5);
    if (kind === 'squeeze') {
      const a = side < 0 ? 1 : -1; // > on the left eye, < on the right eye
      return P(`M${n(cx - a * rx * .8)},${n(cy - 13)} L${n(cx + a * rx * .55)},${n(cy)} L${n(cx - a * rx * .8)},${n(cy + 13)}`, 'none', OL, 6.5);
    }
    if (kind === 'closed' || open < 0.14) return P(`M${n(cx - rx * .95)},${n(cy + 2)} Q${n(cx)},${n(cy + 13)} ${n(cx + rx * .95)},${n(cy + 2)}`, 'none', OL, 6);
    const wide = kind === 'wide' ? 1.12 : 1;
    const R = rx * wide, Ry = ry * wide * open;
    const ecy = cy + ry * wide * (1 - open) * 0.62; // lid comes down from the top
    const id = uid('e');
    const look = o.look || [0, 0];
    const ir = (o.ir || 18.5) * (kind === 'wide' ? .86 : 1);
    const ix = cx + look[0] * (R - ir * .45) * .78, iy = cy + look[1] * (ry - ir * .45) * .62 + 2;
    s += `<clipPath id="${id}"><ellipse cx="${n(cx)}" cy="${n(ecy)}" rx="${n(R)}" ry="${n(Ry)}"/></clipPath>`;
    s += E(cx, ecy, R, Ry, '#FFFFFF', null);
    s += `<g clip-path="url(#${id})">` +
      C(ix, iy, ir, o.iris || '#3B2416', null) +
      E(ix, iy + ir * .45, ir * .78, ir * .42, 'rgba(255,255,255,.13)', null) +
      C(ix, iy, ir * .52, '#120A06', null) +
      C(ix + ir * .34, iy - ir * .42, ir * .34, '#FFFFFF', null) +
      C(ix - ir * .38, iy + ir * .34, ir * .15, '#FFFFFF', null) +
      `</g>`;
    s += E(cx, ecy, R, Ry, 'none', OL, 3, 'opacity=".55"');
    // upper lash line follows the lid
    s += P(`M${n(cx - R)},${n(ecy)} A${n(R)},${n(Ry)} 0 0 1 ${n(cx + R)},${n(ecy)}`, 'none', OL, o.lash || 6.5);
    if (o.girl) s += P(`M${n(cx + side * R * .98)},${n(ecy - 2)} l${n(side * 9)},${-8}`, 'none', OL, 5);
    return s;
  }

  const BROWS = { neutral: [0, 0, 0, 0], up: [0, -12, 0, -12], worried: [-15, -6, 15, -6], angry: [13, 4, -13, 4],
    focus: [8, 3, -8, 3], confused: [-6, -12, -9, 3], sad: [-13, 0, 13, 0], soft: [-4, -3, 4, -3] };
  function brow(cx, cy, side, kind, col, w = 38, th = 8.5) {
    const [aL, dL, aR, dR] = BROWS[kind] || BROWS.neutral;
    const a = side < 0 ? aL : aR, d = side < 0 ? dL : dR;
    return `<g transform="translate(0,${d}) rotate(${a},${n(cx)},${n(cy)})">` +
      P(`M${n(cx - w / 2)},${n(cy + 3)} Q${n(cx)},${n(cy - 7)} ${n(cx + w / 2)},${n(cy + 3)}`, 'none', col, th) + `</g>`;
  }

  function mouth(mx, my, kind, t, sc = 1, lip = null) {
    const g = (inner) => `<g transform="translate(${n(mx)},${n(my)}) scale(${sc})">${inner}</g>`;
    const line = lip || OL;
    switch (kind) {
      case 'talk': {
        const tt = clamp(t || 0, 0, 1);
        if (tt < .08) return g(P('M-17,0 Q0,9 17,0', 'none', line, 5));
        const w = 15 + 9 * tt, h = 5 + 20 * tt;
        return g(P(`M${-w},0 Q0,${n(-h * .22)} ${w},0 Q${n(w * .8)},${n(h * 1.15)} 0,${n(h * 1.2)} Q${n(-w * .8)},${n(h * 1.15)} ${-w},0 Z`, MOUTH_IN, line, 4.5) +
          (tt > .35 ? E(0, h * .82, w * .5, h * .26, TONGUE, null) : ''));
      }
      case 'smile': return g(P('M-21,-2 Q0,15 21,-2', 'none', line, 5.2));
      case 'soft': return g(P('M-15,0 Q0,8 15,0', 'none', line, 5));
      case 'grin': return g(P('M-29,-5 Q0,5 29,-5 Q23,31 0,33 Q-23,31 -29,-5 Z', MOUTH_IN, line, 4.8) +
        P('M-25,-3 Q0,6 25,-3 L23,5 Q0,13 -23,5 Z', '#FFFFFF', null) + E(0, 23, 12, 6, TONGUE, null));
      case 'o': return g(E(0, 4, 9, 11, MOUTH_IN, line, 4.5));
      case 'bigo': return g(E(0, 6, 14, 18, MOUTH_IN, line, 4.8) + E(0, 15, 8, 5, TONGUE, null));
      case 'flat': return g(P('M-15,2 L15,2', 'none', line, 5));
      case 'frown': return g(P('M-17,8 Q0,-5 17,8', 'none', line, 5));
      case 'small': return g(P('M-9,2 Q0,7 9,2', 'none', line, 5));
      case 'wavy': return g(P('M-19,3 Q-10,-5 -1,3 Q8,11 17,3', 'none', line, 4.6));
      case 'grit': return g(`<rect x="-25" y="-10" width="50" height="21" rx="8" fill="#fff" stroke="${OL}" stroke-width="4.5"/>` +
        P('M-25,0.5 L25,0.5 M-12,-10 L-12,11 M0,-10 L0,11 M12,-10 L12,11', 'none', OL, 3));
      default: return g(P('M-17,0 Q0,9 17,0', 'none', line, 5));
    }
  }

  const EXPR = {
    neutral: { eyes: 'open', brows: 'neutral', mouth: 'soft' },
    happy: { eyes: 'open', brows: 'soft', mouth: 'smile' },
    joy: { eyes: 'happy', brows: 'up', mouth: 'grin' },
    talk: { eyes: 'open', brows: 'soft', mouth: 'talk' },
    confused: { eyes: 'open', brows: 'confused', mouth: 'small' },
    worried: { eyes: 'open', brows: 'worried', mouth: 'wavy' },
    sad: { eyes: 'open', brows: 'sad', mouth: 'frown' },
    overwhelmed: { eyes: 'squeeze', brows: 'worried', mouth: 'grit' },
    surprised: { eyes: 'wide', brows: 'up', mouth: 'o' },
    wow: { eyes: 'wide', brows: 'up', mouth: 'bigo' },
    focus: { eyes: 'open', brows: 'focus', mouth: 'small' },
    squint: { eyes: 'open', brows: 'focus', mouth: 'flat', open: .5 },
    dream: { eyes: 'open', brows: 'soft', mouth: 'smile', look: [.7, -.8] },
  };

  // blink: deterministic, every ~3.4-4.6 s, 0.15 s long
  function blink(t, seed) {
    const per = 3.4 + (seed % 7) * .17;
    const ph = (t + seed * .61) % per;
    if (ph < .15) return 1 - Math.sin(Math.PI * ph / .15);
    return 1;
  }

  // ---------- hair / hijab (kids) ----------
  function hairBack(id, p) {
    switch (id) {
      case 'bima': return P('M-118,6 C-126,-64 -84,-124 -6,-126 C74,-128 124,-74 120,4 C116,-24 104,-40 92,-46 L-96,-46 C-108,-38 -116,-20 -118,6 Z', p.hair);
      case 'arka': return P('M-120,8 C-130,-50 -104,-96 -76,-112 L-82,-140 L-48,-122 L-34,-154 L-8,-128 L18,-158 L32,-126 L66,-146 L66,-112 C100,-96 128,-56 120,8 C110,-30 96,-44 84,-48 L-90,-48 C-104,-40 -114,-22 -120,8 Z', p.hair);
      case 'laras': return P('M-122,30 C-132,-60 -88,-126 -2,-128 C86,-128 132,-60 122,30 C122,58 114,78 100,92 L-100,92 C-114,78 -122,58 -122,30 Z', p.hair);
      default: return '';
    }
  }
  function hairFront(id, p) {
    switch (id) {
      case 'bima': return P('M-108,-14 C-110,-70 -66,-112 -10,-114 C54,-116 108,-80 112,-18 C100,-46 76,-62 46,-66 C30,-58 8,-52 -26,-54 C-24,-62 -22,-70 -16,-78 C-40,-66 -64,-52 -80,-44 C-92,-40 -102,-28 -108,-14 Z', p.hair) +
        P('M-6,-100 C24,-104 58,-94 82,-74', 'none', p.hairHi, 7, 'opacity=".9"');
      case 'arka': return P('M-112,-8 C-116,-62 -78,-108 -12,-112 C58,-114 110,-76 114,-12 L92,-40 L84,-14 L64,-52 L44,-24 L28,-62 L8,-32 L-10,-66 L-26,-30 L-46,-62 L-60,-28 L-80,-54 L-92,-22 Z', p.hair) +
        P('M4,-110 C2,-140 22,-160 44,-150 C30,-150 22,-138 24,-118', p.hair) + // cowlick
        P('M-40,-96 C-6,-104 30,-100 60,-88', 'none', p.hairHi, 6, 'opacity=".9"');
      case 'laras': return P('M-114,6 C-118,-64 -76,-114 -2,-116 C74,-116 118,-64 114,6 C106,-20 98,-34 90,-40 L84,-34 L74,-46 L64,-36 L50,-48 L36,-38 L22,-50 L6,-40 L-10,-50 L-26,-38 L-40,-50 L-56,-38 L-70,-48 L-82,-36 L-92,-40 C-100,-30 -108,-16 -114,6 Z', p.hair) +
        P('M-60,-96 C-24,-108 22,-108 60,-96', 'none', p.hairHi, 6, 'opacity=".9"') +
        // little yellow star clip
        P('M70,-74 l6,12 13,2 -9,9 2,13 -12,-6 -12,6 2,-13 -9,-9 13,-2 Z', '#F6C744', OL, 3.5);
      default: return '';
    }
  }
  // braids hang in front of the shoulders (drawn after the torso)
  function braids(p, side) {
    let s = '';
    for (const sx of side ? [side] : [-1, 1]) {
      const x0 = sx * 104, y0 = -232;
      for (let i = 0; i < 5; i++) {
        const y = y0 + i * 26, x = x0 + sx * (i * 2.2);
        s += E(x, y, 19 - i * .8, 17, p.hair, OL, 4.5);
        s += P(`M${n(x - 12)},${n(y - 4)} Q${n(x)},${n(y + 8)} ${n(x + 12)},${n(y - 4)}`, 'none', p.hairHi, 3.5, 'opacity=".8"');
      }
      const ty = y0 + 5 * 26 - 6;
      s += `<rect x="${n(x0 + sx * 11 - 11)}" y="${ty - 7}" width="22" height="13" rx="5" fill="#D8323E" stroke="${OL}" stroke-width="4"/>`;
      s += P(`M${n(x0 + sx * 11 - 9)},${ty + 6} L${n(x0 + sx * 11)},${ty + 30} L${n(x0 + sx * 11 + 9)},${ty + 6} Z`, p.hair, OL, 4);
    }
    return s;
  }

  // hijab: drape behind face, plus front band over forehead. Head-local coords (head centre 0,0).
  function hijabBack(p, k = 1) {
    return P(`M${-128 * k},20 C${-134 * k},-74 ${-80 * k},-128 0,-130 C${80 * k},-128 ${134 * k},-74 ${128 * k},20 C${130 * k},64 ${120 * k},96 ${112 * k},118 L${-112 * k},118 C${-120 * k},96 ${-130 * k},64 ${-128 * k},20 Z`, p.hijab);
  }
  function hijabFront(p, k = 1) {
    return P(`M${-104 * k},10 C${-108 * k},-62 ${-62 * k},-104 0,-104 C${62 * k},-104 ${108 * k},-62 ${104 * k},10 C${96 * k},-28 ${72 * k},-62 0,-66 C${-72 * k},-62 ${-96 * k},-28 ${-104 * k},10 Z`, p.hijab) +
      P(`M${-66 * k},-84 C${-30 * k},-98 ${30 * k},-98 ${66 * k},-84`, 'none', p.hijabSh, 5, 'opacity=".9"');
  }
  // the part of the hijab that covers the chest (body coords), drawn over the torso top
  function hijabDrape(p, w = 1, y0 = -196, y1 = -92) {
    return P(`M${-104 * w},${y0} C${-118 * w},${y0 + 40} ${-112 * w},${y1 - 20} ${-86 * w},${y1} C${-40 * w},${y1 + 18} ${40 * w},${y1 + 18} ${86 * w},${y1} C${112 * w},${y1 - 20} ${118 * w},${y0 + 40} ${104 * w},${y0} Z`, p.hijab) +
      P(`M${-70 * w},${y1 - 6} C${-30 * w},${y1 + 6} ${30 * w},${y1 + 6} ${70 * w},${y1 - 6}`, 'none', p.hijabSh, 6) +
      P(`M${-40 * w},${y0 + 20} C${-30 * w},${y0 + 60} ${-34 * w},${y1 - 26} ${-46 * w},${y1 - 8}`, 'none', p.hijabSh, 4.5, 'opacity=".8"');
  }

  // ---------- kid ----------
  function armPose(name, side, o, t) {
    // returns hand target in kid coords. side -1 = screen-left arm (character's right arm)
    const sx = side * 72, sy = -128;
    switch (name) {
      case 'down': return [side * 94, -8];
      case 'desk': return [side * 50, -30];
      case 'write': return [side * 26, -36];
      case 'raise': return [side * 150, -276];
      case 'wave': { const w = Math.sin((t || 0) * 9) * 16; return [side * 166 + w, -236 - Math.abs(w) * .6]; }
      case 'cheer': return [side * 172, -256];
      case 'ears': return [side * 104, -262];
      case 'chin': return [side * 18, -176];
      case 'point': return [side * 210, -246];
      case 'tap': return [side * 150, -262];
      case 'hips': return [side * 96, -40];
      case 'scratch': return [side * 118, -330];
      default: return Array.isArray(name) ? name : [sx + side * 20, 0];
    }
  }

  function kidArm(side, pose, p, o, t, longSleeve) {
    const sh = [side * 72, -128];
    const hand = armPose(pose, side, o, t);
    const { e, h } = ikNat(sh, hand, 72, 66, side);
    let s = '';
    const sleeveEnd = longSleeve ? h : [sh[0] + (e[0] - sh[0]) * .62, sh[1] + (e[1] - sh[1]) * .62];
    if (!longSleeve) s += limb([sh, e, h], 25, p.skin);
    else s += limb([sh, e, [h[0] + (e[0] - h[0]) * .16, h[1] + (e[1] - h[1]) * .16]], 30, SHIRT);
    if (!longSleeve) s += limb([sh, sleeveEnd], 34, SHIRT);
    // hand + thumb
    s += C(h[0], h[1], 17, p.skin) + E(h[0] - side * 12, h[1] - 6, 7, 9, p.skin, OL, 4);
    return s;
  }

  function kidTorso(id, p, o) {
    const pal = p;
    let s = '';
    // neck
    s += `<rect x="-17" y="-170" width="34" height="40" rx="10" fill="${pal.skin}" stroke="${OL}" stroke-width="${LW}"/>`;
    s += P('M-15,-150 Q0,-138 15,-150 L15,-134 L-15,-134 Z', pal.sh, null);
    // shirt
    const hem = o.untucked ? 22 : 4;
    s += P(`M-70,-140 Q-90,-134 -90,-112 L-80,${hem - 14} Q-78,${hem} -62,${hem} L62,${hem} Q78,${hem} 80,${hem - 14} L90,-112 Q90,-134 70,-140 Q38,-150 0,-150 Q-38,-150 -70,-140 Z`, SHIRT);
    s += P(`M66,-136 Q86,-128 86,-110 L77,${hem - 16} Q74,${hem - 4} 62,${hem - 3} L52,${hem - 3} L60,-110 Q62,-128 66,-136 Z`, SHIRT_SH, null);
    if (o.untucked) s += P(`M-62,${hem} L-40,${hem - 9} L-20,${hem} M20,${hem} L44,${hem - 8} L62,${hem}`, 'none', SHIRT_SH, 3);
    // collar
    s += P('M-34,-148 L0,-122 L-8,-108 L-42,-134 Z', SHIRT) + P('M34,-148 L0,-122 L8,-108 L42,-134 Z', SHIRT);
    // tie
    const tilt = o.tieTilt || 0;
    s += `<g transform="rotate(${tilt},0,-122)">` + P('M-9,-126 L9,-126 L7,-112 L-7,-112 Z', RED) +
      P('M-7,-112 L7,-112 L13,-60 L0,-46 L-13,-60 Z', RED) + P('M2,-110 L6,-110 L11,-62 L3,-52 Z', RED_SH, null) + `</g>`;
    // pocket + badge (character's left = screen right)
    s += P('M26,-104 L60,-104 L58,-74 Q58,-70 54,-70 L32,-70 Q28,-70 28,-74 Z', SHIRT, OL, 3.5);
    s += P('M36,-118 L50,-118 L50,-106 Q43,-100 36,-106 Z', '#2F6FB5', OL, 3) + C(43, -111, 3, '#F6C744', null);
    // name tag (character's right = screen left)
    if (o.nameTag !== false && id !== 'x') {
      s += `<rect x="-66" y="-104" width="50" height="17" rx="4" fill="#fff" stroke="${OL}" stroke-width="3"/>` +
        `<text x="-41" y="-91" font-family="Fredoka" font-weight="700" font-size="12" text-anchor="middle" fill="${OL}">${(o.label || id).toUpperCase()}</text>`;
    }
    // belt
    if (!o.untucked) s += `<rect x="-78" y="-12" width="156" height="14" rx="5" fill="#2B2B33" stroke="${OL}" stroke-width="3.5"/>` +
      `<rect x="-12" y="-14" width="24" height="18" rx="4" fill="#C9C4B8" stroke="${OL}" stroke-width="3.5"/>`;
    return s;
  }

  function kidLegs(id, p, o, t) {
    let s = '';
    const girl = !p.boy;
    if (id === 'tara') {
      // long skirt
      s += P('M-74,-4 L74,-4 L96,152 Q0,166 -96,152 Z', RED);
      s += P('M40,-2 L52,-2 L74,150 L58,154 Z', RED_SH, null);
      s += P('M-60,154 Q-60,140 -44,140 L-12,140 Q-4,140 -4,154 L-4,166 L-62,166 Z', '#25242A') +
        P('M60,154 Q60,140 44,140 L12,140 Q4,140 4,154 L4,166 L62,166 Z', '#25242A');
      return s;
    }
    // legs
    for (const sx of [-1, 1]) {
      s += limb([[sx * 34, 40], [sx * 36, 128]], 30, p.skin);
      s += `<rect x="${sx * 36 - 17}" y="112" width="34" height="26" rx="6" fill="#FFFFFF" stroke="${OL}" stroke-width="4"/>`;
      s += P(`M${sx * 36 - 22},152 Q${sx * 36 - 22},136 ${sx * 36 - 6},136 L${sx * 36 + 10},136 Q${sx * 36 + 34 * sx * 0 + 30},138 ${sx * 36 + 32},152 L${sx * 36 + 32},162 L${sx * 36 - 22},162 Z`, '#25242A');
    }
    if (girl) {
      s += P('M-78,-6 L78,-6 L98,70 Q0,84 -98,70 Z', RED) +
        P('M-46,0 L-58,72 M0,2 L0,78 M46,0 L58,72', 'none', RED_SH, 4);
    } else {
      s += P('M-78,-6 L78,-6 L82,58 L10,58 L4,24 L-4,24 L-10,58 L-82,58 Z', RED) +
        P('M50,-4 L58,-4 L62,56 L46,56 Z', RED_SH, null);
    }
    return s;
  }

  function kidHead(id, p, o, t) {
    const ex = Object.assign({}, EXPR[o.expr || 'neutral'] || EXPR.neutral);
    for (const k of ['eyes', 'brows', 'mouth', 'look', 'open']) if (o[k] != null) ex[k] = o[k];
    const open = ex.open != null ? Math.min(ex.open, o.blinkOpen == null ? 1 : o.blinkOpen) : (o.blinkOpen == null ? 1 : o.blinkOpen);
    const turn = o.turn || 0;
    const fx = turn * 15;
    let s = '';
    const hij = !!p.hijab;
    // ears
    if (!hij) {
      for (const sx of [-1, 1]) s += E(sx * 108 + turn * -4, 10, 21, 27, p.skin) + P(`M${sx * 108 - sx * 6},0 Q${sx * 114},10 ${sx * 106},22`, 'none', p.sh, 4);
      if (id === 'bima') { // behind-the-ear hearing aid on his left ear (screen right)
        s += P('M118,-22 C138,-20 142,10 130,28 C126,34 118,30 120,22 C126,8 124,-6 114,-12 Z', '#3E9AD6', OL, 4);
        s += P('M118,-18 C108,-12 104,0 106,8', 'none', '#BFE4F7', 4.5);
        s += C(106, 9, 4.5, '#BFE4F7', OL, 3);
      }
    }
    // face
    const frx = hij ? 92 : 112, fry = hij ? 94 : 104;
    const fid = uid('f');
    s += `<clipPath id="${fid}"><path d="${faceD(frx, fry)}"/></clipPath>`;
    s += P(faceD(frx, fry), p.skin, null);
    s += `<g clip-path="url(#${fid})">` + E(frx * 1.08 + fx * .5, fry * .1, frx * .42, fry * 1.25, p.sh, null, 0, 'opacity=".42"') +
      E(0, fry * 1.05, frx * .9, fry * .22, p.sh, null, 0, 'opacity=".28"') + `</g>`;
    s += P(faceD(frx, fry), 'none');
    if (hij) s += hijabFront(p);
    s += hairFront(id, p);
    // cheeks
    const bl = .33 + .5 * (o.blush || 0);
    s += E(-66 + fx, 50, 21, 11, '#F07F72', null, 0, `opacity="${bl}"`) + E(66 + fx, 50, 21, 11, '#F07F72', null, 0, `opacity="${bl}"`);
    if (id === 'laras') for (const [x, y] of [[-74, 36], [-62, 30], [-80, 44], [74, 36], [62, 30], [80, 44]]) s += C(x + fx, y, 2.6, '#B07650', null);
    // eyes
    const eo = { eyes: ex.eyes, open, look: ex.look || [0, 0], iris: p.iris, girl: !p.boy };
    s += eye(-40 + fx, 12, -1, eo) + eye(40 + fx, 12, 1, eo);
    // brows
    const bcol = p.hair || '#3A2A20';
    s += brow(-40 + fx, -34, -1, ex.brows, hij ? '#2A1D15' : bcol) + brow(40 + fx, -34, 1, ex.brows, hij ? '#2A1D15' : bcol);
    // nose
    s += P(`M${-7 + fx * 1.2},46 Q${fx * 1.2},53 ${7 + fx * 1.2},46`, 'none', p.sh, 4.5);
    // mouth
    s += mouth(fx * 1.1, 72, ex.mouth, o.talk);
    if (id === 'arka') s += `<g transform="translate(${70 + fx},28) rotate(-22)"><rect x="-18" y="-8" width="36" height="16" rx="6" fill="#F2C9A0" stroke="${OL}" stroke-width="3.5"/>` +
      C(-6, -2, 1.6, '#C99A70', null) + C(6, 2, 1.6, '#C99A70', null) + C(-6, 3, 1.6, '#C99A70', null) + C(6, -3, 1.6, '#C99A70', null) + `</g>`;
    if (o.sweat) s += P('M104,-62 C96,-46 98,-34 108,-34 C118,-34 118,-46 104,-62 Z', '#9ED6F5', OL, 3.5);
    if (o.tear) s += P(`M${-30 + fx},38 C${-36 + fx},52 ${-34 + fx},60 ${-28 + fx},60 C${-22 + fx},60 ${-22 + fx},52 ${-30 + fx},38 Z`, '#9ED6F5', OL, 3);
    return s;
  }

  // back view head (seen from behind)
  function kidHeadBack(id, p) {
    let s = '';
    const style = p.style || id;
    if (p.hijab || style === 'hijab' || id === 'tara') {
      s += P('M-128,20 C-134,-74 -80,-130 0,-130 C80,-130 134,-74 128,20 C132,70 124,110 116,140 L-116,140 C-124,110 -132,70 -128,20 Z', p.hijab || '#F7F6F0');
      s += P('M-60,-100 C-20,-112 30,-110 70,-92', 'none', p.hijabSh || '#D9D8CE', 6) + P('M-30,40 C-26,80 -30,110 -38,136 M34,40 C30,80 32,110 40,136', 'none', p.hijabSh || '#D9D8CE', 5);
      return s;
    }
    for (const sx of [-1, 1]) s += E(sx * 108, 10, 20, 26, p.skin);
    s += P(faceD(112, 104), p.skin);
    const hair = p.hair;
    if (style === 'laras' || style === 'pony') {
      s += P('M-116,40 C-126,-60 -84,-122 0,-124 C84,-122 126,-60 116,40 C108,74 70,92 0,94 C-70,92 -108,74 -116,40 Z', hair);
      if (style === 'pony') s += P('M-14,30 C-30,70 -24,120 -8,150 C4,160 18,150 16,132 C10,100 20,60 14,30 Z', hair) + `<rect x="-14" y="20" width="28" height="14" rx="5" fill="#E8A33D" stroke="${OL}" stroke-width="4"/>`;
    } else if (style === 'arka') {
      s += P('M-118,30 C-128,-50 -104,-96 -76,-112 L-82,-140 L-48,-122 L-34,-154 L-8,-128 L18,-158 L32,-126 L66,-146 L66,-112 C104,-96 128,-50 118,30 L100,44 L92,68 L70,58 L56,82 L34,64 L14,88 L-6,66 L-26,86 L-44,62 L-62,80 L-74,56 L-96,64 L-100,42 Z', hair);
    } else {
      s += P('M-116,30 C-126,-62 -82,-124 0,-126 C82,-124 126,-62 116,30 C110,62 76,80 0,82 C-76,80 -110,62 -116,30 Z', hair);
    }
    s += P('M-50,-90 C-16,-104 26,-102 60,-88', 'none', p.hairHi || '#444', 7, 'opacity=".8"');
    return s;
  }

  function kidTorsoBack(id, p, o) {
    let s = `<rect x="-17" y="-170" width="34" height="40" rx="10" fill="${p.skin}" stroke="${OL}" stroke-width="${LW}"/>`;
    s += P('M-70,-140 Q-90,-134 -90,-112 L-80,-10 Q-78,4 -62,4 L62,4 Q78,4 80,-10 L90,-112 Q90,-134 70,-140 Q38,-150 0,-150 Q-38,-150 -70,-140 Z', SHIRT);
    s += P('M-38,-148 Q0,-132 38,-148', 'none', OL, 4);
    s += P('M-86,-110 L-78,-14 Q-76,-4 -64,-2 L-54,-2 L-60,-110 Q-62,-128 -66,-136 Q-84,-128 -86,-110 Z', SHIRT_SH, null);
    return s;
  }

  // Public: kid(id, opts) -> <g>. opts: x, y, s, view, crop, tilt, turn, lean, bob, expr, eyes, brows, mouth,
  // look, open (blink), talk, blush, armL, armR, sweat, tear, t (time, for wave/fidget), flip
  function kid(id, o = {}) {
    const p = PAL[id];
    const t = o.t || 0;
    const back = o.view === 'back';
    const long = id === 'tara' || p.style === 'hijab';
    const tilt = o.tilt || 0, lean = o.lean || 0, bob = o.bob || 0;
    const breathe = 1 + .012 * Math.sin(t * 2 * Math.PI / 3.3 + (id.length * 1.7));
    let body = '';
    if (!back && o.crop !== 'seated' && o.crop !== 'bust') body += kidLegs(id, p, o, t);
    if (back) body += kidTorsoBack(id, p, o);
    else body += kidTorso(id, p, Object.assign({ untucked: id === 'arka', tieTilt: id === 'arka' ? 9 : 0, label: id }, o));
    if (!back && p.hijab) body += hijabDrape(p, .78, -176, -96);
    let arms = '';
    if (o.armR !== 'none') arms += kidArm(-1, o.armR || 'desk', p, o, t, long);
    if (o.armL !== 'none') arms += kidArm(1, o.armL || 'desk', p, o, t, long);
    const head = back ? kidHeadBack(id, p) : kidHead(id, p, Object.assign({ blinkOpen: o.open }, o), t);
    const hT = `translate(0,${n(-262 + (o.headDy || 0))}) rotate(${n(tilt)},0,104)`;
    const headG = `<g transform="${hT}">${head}</g>`;
    const headBackG = back ? '' : `<g transform="${hT}">${p.hijab ? hijabBack(p) : ''}${hairBack(id, p)}</g>`;
    const braid = !back && id === 'laras' ? braids(p) : '';
    const armsFront = o.armsFront || ['ears', 'chin', 'scratch'].includes(o.armL) || ['ears', 'chin', 'scratch'].includes(o.armR);
    let inner = headBackG + body;
    if (armsFront) inner += braid + headG + arms;
    else inner += arms + braid + headG;
    if (back && id === 'laras') inner = body + arms + headG + braidsBack(p);
    const sc = o.s || 1;
    return `<g transform="translate(${n(o.x || 0)},${n((o.y || 0) + bob)}) scale(${o.flip ? -sc : sc},${sc}) rotate(${n(lean)},0,0) scale(1,${n(breathe * 1000) / 1000})">${inner}</g>`;
  }
  function braidsBack(p) {
    let s = '';
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 5; i++) s += E(sx * 46, -190 + i * 24, 17, 15, p.hair, OL, 4.5);
      s += `<rect x="${sx * 46 - 11}" y="-82" width="22" height="13" rx="5" fill="#D8323E" stroke="${OL}" stroke-width="4"/>`;
    }
    return s;
  }

  // ---------- Bu Wulan (adult) ----------
  // Local frame: origin = hip centre; shoulders (+-80,-204); head centre (0,-300); feet at y=+340.
  function wulanArm(side, pose, p, t) {
    const sh = [side * 80, -200];
    let hand;
    switch (pose) {
      case 'down': hand = [side * 100, -20]; break;
      case 'point': hand = [side * 250, -300]; break;          // pointing at the board
      case 'pointUp': hand = [side * 200, -420]; break;
      case 'open': hand = [side * 170, -150]; break;            // open-palm explaining gesture
      case 'chest': hand = [side * 26, -150]; break;
      case 'hold': hand = [side * 40, -96]; break;               // holding a book/laptop at the waist
      case 'wave': { const w = Math.sin(t * 8) * 30; hand = [side * 150 + w, -420]; break; }
      case 'ask': hand = [side * 150, -260]; break;              // asking gesture, palm up
      case 'write': hand = [side * 230, -380]; break;
      case 'type': hand = [side * 60, -60]; break;
      default: hand = Array.isArray(pose) ? pose : [side * 100, -20];
    }
    const { e, h } = ikNat(sh, hand, 96, 90, side);
    let s = limb([sh, e, [h[0] + (e[0] - h[0]) * .14, h[1] + (e[1] - h[1]) * .14]], 34, '#D9A13A');
    s += limb([[h[0] + (e[0] - h[0]) * .2, h[1] + (e[1] - h[1]) * .2], [h[0] + (e[0] - h[0]) * .12, h[1] + (e[1] - h[1]) * .12]], 30, '#C58F2E');
    s += C(h[0], h[1], 16, p.skin) + E(h[0] - side * 11, h[1] - 7, 6.5, 8.5, p.skin, OL, 4);
    if (pose === 'write' || pose === 'point') s += `<rect x="${n(h[0] - 4)}" y="${n(h[1] - 26)}" width="9" height="22" rx="3" fill="#fff" stroke="${OL}" stroke-width="3" transform="rotate(${side * 30},${n(h[0])},${n(h[1])})"/>`;
    return s;
  }

  function wulan(o = {}) {
    const p = PAL.wulan, t = o.t || 0;
    const ex = Object.assign({}, EXPR[o.expr || 'happy'] || EXPR.happy);
    for (const k of ['eyes', 'brows', 'mouth', 'look', 'open']) if (o[k] != null) ex[k] = o[k];
    const open = Math.min(ex.open == null ? 1 : ex.open, o.open == null ? 1 : o.open);
    const turn = o.turn || 0, fx = turn * 10;
    let s = '';
    // skirt + shoes
    if (o.crop !== 'bust') {
      s += P('M-78,-10 L78,-10 L104,330 Q0,346 -104,330 Z', '#3B4256') + P('M44,-8 L58,-8 L86,328 L66,332 Z', '#2E3445', null);
      s += P('M-70,330 Q-70,316 -52,316 L-14,316 Q-6,316 -6,330 L-6,344 L-72,344 Z', '#3A2A22') + P('M70,330 Q70,316 52,316 L14,316 Q6,316 6,330 L6,344 L72,344 Z', '#3A2A22');
    }
    // blouse (batik)
    s += P('M-78,-208 Q-98,-200 -98,-176 L-86,24 Q-84,36 -70,36 L70,36 Q84,36 86,24 L98,-176 Q98,-200 78,-208 Q40,-220 0,-220 Q-40,-220 -78,-208 Z', 'url(#batik)');
    s += P('M60,-206 Q92,-196 94,-172 L82,24 Q80,32 70,33 L58,33 L68,-170 Q70,-194 60,-206 Z', 'rgba(90,50,10,.22)', null);
    // hijab drape over the chest
    s += hijabDrape(p, 1.02, -236, -128);
    s += C(0, -156, 6, '#E9C15A', OL, 3); // brooch
    const arms = wulanArm(-1, o.armR || 'down', p, t) + wulanArm(1, o.armL || 'down', p, t);
    // head
    let h = '';
    const wf = uid('f');
    h += `<clipPath id="${wf}"><path d="${faceD(72, 80)}"/></clipPath>`;
    h += P(faceD(72, 80), p.skin, null);
    h += `<g clip-path="url(#${wf})">` + E(72 * 1.08 + fx * .5, 8, 30, 100, p.sh, null, 0, 'opacity=".4"') + `</g>`;
    h += P(faceD(72, 80), 'none');
    h += hijabFront(p, .78);
    h += E(-46 + fx, 34, 15, 8, '#F07F72', null, 0, 'opacity=".33"') + E(46 + fx, 34, 15, 8, '#F07F72', null, 0, 'opacity=".33"');
    const eo = { eyes: ex.eyes, open, look: ex.look || [0, 0], iris: p.iris, girl: true, rx: 17, ry: 19, ir: 12.5, lash: 5.5 };
    h += eye(-28 + fx, 6, -1, eo) + eye(28 + fx, 6, 1, eo);
    // glasses
    h += C(-29 + fx, 7, 26, 'rgba(255,255,255,.10)', '#5A3A2C', 4.5) + C(29 + fx, 7, 26, 'rgba(255,255,255,.10)', '#5A3A2C', 4.5) +
      P(`M${-4 + fx},4 Q${fx},0 ${4 + fx},4`, 'none', '#5A3A2C', 4.5);
    h += brow(-29 + fx, -30, -1, ex.brows, '#3A2A20', 30, 6.5) + brow(29 + fx, -30, 1, ex.brows, '#3A2A20', 30, 6.5);
    h += P(`M${-5 + fx},36 Q${fx},41 ${5 + fx},36`, 'none', p.sh, 4);
    h += mouth(fx, 54, ex.mouth, o.talk, .78, p.lips);
    const wT = `translate(0,${-300 + (o.headDy || 0)}) rotate(${n(o.tilt || 0)},0,80)`;
    const headG = `<g transform="${wT}">${h}</g>`;
    s = `<g transform="${wT}">${hijabBack(p, .8)}</g>` + s;
    const sc = o.s || 1;
    const breathe = 1 + .01 * Math.sin(t * 2 * Math.PI / 3.6);
    return `<g transform="translate(${n(o.x || 0)},${n((o.y || 0) + (o.bob || 0))}) scale(${o.flip ? -sc : sc},${sc}) rotate(${n(o.lean || 0)},0,0) scale(1,${n(breathe * 1000) / 1000})">${s}${o.armsFront ? headG + arms : arms + headG}</g>`;
  }

  const DEFS = `<pattern id="batik" width="44" height="44" patternUnits="userSpaceOnUse">
      <rect width="44" height="44" fill="#D9A13A"/>
      <g fill="#8A5524" opacity=".85">
        <ellipse cx="22" cy="10" rx="5" ry="8"/><ellipse cx="22" cy="34" rx="5" ry="8"/>
        <ellipse cx="10" cy="22" rx="8" ry="5"/><ellipse cx="34" cy="22" rx="8" ry="5"/>
      </g>
      <circle cx="22" cy="22" r="3" fill="#5E3713"/><circle cx="0" cy="0" r="3" fill="#5E3713"/><circle cx="44" cy="0" r="3" fill="#5E3713"/>
      <circle cx="0" cy="44" r="3" fill="#5E3713"/><circle cx="44" cy="44" r="3" fill="#5E3713"/>
      <g fill="#F3D27A" opacity=".9"><circle cx="22" cy="10" r="1.6"/><circle cx="22" cy="34" r="1.6"/><circle cx="10" cy="22" r="1.6"/><circle cx="34" cy="22" r="1.6"/></g>
    </pattern>`;

  window.CAST = { kid, wulan, blink, EXPR, PAL, DEFS, reset: () => { uidN = 0; }, OL };
})();
