// world.js: SuaraPapan v2 sets and props: classroom (front wall), POV foreground, portrait backdrop,
// the projected SuaraPapan board UI, bubbles, tags. All pure functions of their options -> SVG markup.
(function () {
  const OL = '#2E2420';
  const n = v => Math.round(v * 10) / 10;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const P = (d, fill, stroke = OL, sw = 5, extra = '') =>
    `<path d="${d}" fill="${fill}"${stroke ? ` stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round"` : ''} ${extra}/>`;
  const R = (x, y, w, h, fill, rx = 0, stroke = OL, sw = 5, extra = '') =>
    `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="${rx}" fill="${fill}"${stroke ? ` stroke="${stroke}" stroke-width="${sw}"` : ''} ${extra}/>`;
  const E = (cx, cy, rx, ry, fill, stroke = null, sw = 5, extra = '') =>
    `<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(rx)}" ry="${n(ry)}" fill="${fill}"${stroke ? ` stroke="${stroke}" stroke-width="${sw}"` : ''} ${extra}/>`;
  const T = (x, y, txt, size, fill, w = 700, anchor = 'middle', extra = '') =>
    `<text x="${n(x)}" y="${n(y)}" font-family="Fredoka" font-size="${size}" font-weight="${w}" fill="${fill}" text-anchor="${anchor}" ${extra}>${txt}</text>`;

  const DEFS = `
    <linearGradient id="wallG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F6EAD3"/><stop offset="1" stop-color="#EBD6B4"/></linearGradient>
    <linearGradient id="skyG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9ED8F2"/><stop offset="1" stop-color="#E4F5FB"/></linearGradient>
    <linearGradient id="floorG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#CFAA7C"/><stop offset="1" stop-color="#DDBC90"/></linearGradient>
    <linearGradient id="beamG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFF8E1" stop-opacity=".55"/><stop offset="1" stop-color="#FFF8E1" stop-opacity="0"/></linearGradient>
    <radialGradient id="vig" cx=".5" cy=".5" r=".75"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#1A1008" stop-opacity=".42"/></radialGradient>
    <radialGradient id="glowG" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#FFFBE8" stop-opacity=".9"/><stop offset="1" stop-color="#FFFBE8" stop-opacity="0"/></radialGradient>
    <linearGradient id="beamP" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#FFFDEB" stop-opacity=".35"/><stop offset="1" stop-color="#FFFDEB" stop-opacity="0"/></linearGradient>
    <filter id="b3" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="3"/></filter>
    <filter id="b6" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="6"/></filter>
    <filter id="b12" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="12"/></filter>
    <filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="14"/></filter>
    <clipPath id="boardClip"><rect x="580" y="220" width="760" height="360" rx="4"/></clipPath>
    <clipPath id="winClip"><rect x="92" y="172" width="326" height="366"/></clipPath>
  `;

  // exact text widths from the loaded Fredoka font (cached only once the font is ready)
  const _cv = document.createElement('canvas').getContext('2d'); const _tw = {};
  function tw(txt, size, weight = 700) {
    const key = weight + '|' + size + '|' + txt;
    if (_tw[key]) return _tw[key];
    _cv.font = `${weight} ${size}px Fredoka`;
    const w = _cv.measureText(txt).width;
    if (document.fonts.check(`${weight} ${size}px Fredoka`)) _tw[key] = w;
    return w;
  }
  // deterministic pseudo-noise
  const hash = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const noise = (t, seed = 0) => Math.sin(t * 1.7 + seed) * .5 + Math.sin(t * 2.9 + seed * 2.1) * .3 + Math.sin(t * 5.3 + seed * .7) * .2;

  // ---------------- classroom: front wall ----------------
  function clock(cx, cy, t) {
    const sec = Math.floor(t + 23); // ticks once per second
    const sa = sec * 6 - 90, ma = 10 * 6 + sec * .1 - 90, ha = (9 + 10 / 60) * 30 - 90;
    const hand = (a, L, w, c) => `<line x1="${cx}" y1="${cy}" x2="${n(cx + L * Math.cos(a * Math.PI / 180))}" y2="${n(cy + L * Math.sin(a * Math.PI / 180))}" stroke="${c}" stroke-width="${w}" stroke-linecap="round"/>`;
    let s = E(cx + 4, cy + 6, 50, 50, 'rgba(60,40,20,.15)') + E(cx, cy, 48, 48, '#D6343C', OL, 5) + E(cx, cy, 38, 38, '#FFFFFF', OL, 3);
    for (let i = 0; i < 12; i++) { const a = i * 30 * Math.PI / 180; s += `<line x1="${n(cx + 31 * Math.cos(a))}" y1="${n(cy + 31 * Math.sin(a))}" x2="${n(cx + 35 * Math.cos(a))}" y2="${n(cy + 35 * Math.sin(a))}" stroke="${OL}" stroke-width="${i % 3 ? 2 : 4}"/>`; }
    s += hand(ha, 18, 6, OL) + hand(ma, 27, 4.5, OL) + hand(sa, 30, 2.2, '#D6343C') + E(cx, cy, 4, 4, OL);
    return s;
  }

  function fan(cx, cy, t, spin = 1, osc = 1) {
    const yaw = Math.sin(t * .9) * .22 * osc;
    const sx = 1 - Math.abs(yaw) * .8;
    let s = `<g>` + R(cx - 10, cy - 70, 20, 50, '#BFC3C7', 6, OL, 4) + R(cx - 34, cy - 84, 68, 22, '#D9DDE0', 8, OL, 4);
    s += `<g transform="translate(${cx},${cy}) scale(${n(sx * 100) / 100},1)">`;
    s += E(0, 0, 70, 70, 'rgba(255,255,255,.35)', '#8E969C', 5);
    // blades: when spinning fast, smear into translucent discs
    const ang = (t * 1500 * spin) % 360;
    if (spin > .5) {
      for (let k = 0; k < 6; k++) s += `<g transform="rotate(${n(ang + k * 20)})" opacity=".18">` + [0, 120, 240].map(a => `<ellipse cx="0" cy="-36" rx="17" ry="34" fill="#4BA3C7" transform="rotate(${a})"/>`).join('') + `</g>`;
    } else {
      s += `<g transform="rotate(${n(ang)})">` + [0, 120, 240].map(a => `<ellipse cx="0" cy="-36" rx="17" ry="34" fill="#4BA3C7" stroke="${OL}" stroke-width="3.5" transform="rotate(${a})"/>`).join('') + `</g>`;
    }
    for (let k = 0; k < 8; k++) { const a = k * 22.5 * Math.PI / 180; s += `<line x1="${n(-70 * Math.cos(a))}" y1="${n(-70 * Math.sin(a))}" x2="${n(70 * Math.cos(a))}" y2="${n(70 * Math.sin(a))}" stroke="#8E969C" stroke-width="2"/>`; }
    s += E(0, 0, 16, 16, '#E8ECEE', OL, 4) + `</g></g>`;
    return s;
  }

  function bird(x, y, t, pose = 'sit', flip = false) {
    // a small round sparrow; pose: sit | hop | fly
    const hop = pose === 'hop' ? -Math.abs(Math.sin(t * 9)) * 14 : 0;
    const wing = pose === 'fly' ? Math.sin(t * 30) * 30 : 0;
    let s = `<g transform="translate(${n(x)},${n(y + hop)}) scale(${flip ? -1 : 1},1)">`;
    s += P('M18,-6 L40,-14 L34,2 Z', '#8A5A3A', OL, 3.5); // tail
    s += E(0, 0, 26, 22, '#B47A4E', OL, 4) + E(-6, 6, 15, 12, '#F2DDBF');
    s += `<g transform="rotate(${n(-20 + wing)},6,-4)">` + P('M-2,-8 Q16,-16 26,-2 Q12,6 -2,-8 Z', '#8A5A3A', OL, 3.5) + `</g>`;
    s += E(-18, -14, 14, 13, '#B47A4E', OL, 4) + E(-22, -16, 3.2, 3.2, OL) + E(-23, -17, 1.1, 1.1, '#fff');
    s += P('M-31,-13 L-40,-10 L-31,-7 Z', '#F6C744', OL, 2.5);
    if (pose !== 'fly') s += P('M-6,20 L-8,30 M4,20 L4,30', 'none', OL, 3);
    return s + `</g>`;
  }

  function windowView(t, o) {
    let s = R(92, 172, 326, 366, 'url(#skyG)', 0, null);
    s += `<g clip-path="url(#winClip)">`;
    const cx = (t * 6) % 420;
    s += E(150 + cx, 236, 52, 20, '#fff', null, 0, 'opacity=".9"') + E(120 + cx, 230, 30, 16, '#fff', null, 0, 'opacity=".9"') + E(-160 + cx, 300, 60, 18, '#fff', null, 0, 'opacity=".85"');
    s += E(380, 560, 170, 120, '#6DB56A') + E(300, 600, 160, 110, '#5DA45C') + E(140, 610, 130, 90, '#79C276') + E(420, 470, 90, 90, '#5DA45C');
    s += P('M418,418 Q300,404 220,420', 'none', '#6B4428', 12);
    s += P('M418,418 Q300,404 220,420', 'none', '#8A5A3A', 7);
    if (o.bird) s += bird(o.bird.x, o.bird.y, t, o.bird.pose, o.bird.flip);
    if (o.rain) {
      for (let i = 0; i < 46; i++) {
        const x = 92 + hash(i) * 326, y = 172 + ((hash(i + 50) * 366 + t * 900) % 400);
        s += `<line x1="${n(x)}" y1="${n(y)}" x2="${n(x - 6)}" y2="${n(y + 22)}" stroke="#7FB9D8" stroke-width="2.5" opacity=".8"/>`;
      }
    }
    s += `</g>`;
    // frame + mullions
    s += R(84, 164, 342, 382, 'none', 6, OL, 6) + R(84, 164, 342, 382, 'none', 6, '#FFFDF7', 2);
    s += R(248, 168, 14, 374, '#FFFDF7', 0, OL, 4) + R(88, 348, 334, 14, '#FFFDF7', 0, OL, 4);
    s += R(74, 536, 362, 20, '#FFFDF7', 6, OL, 5);
    // curtains
    s += P('M40,150 Q62,260 46,560 L112,560 Q100,380 116,150 Z', '#F3C969', OL, 5) + P('M60,170 Q76,300 64,540', 'none', '#D9A93E', 4);
    s += P('M470,150 Q448,260 464,560 L398,560 Q410,380 394,150 Z', '#F3C969', OL, 5) + P('M450,170 Q434,300 446,540', 'none', '#D9A93E', 4);
    s += R(30, 138, 450, 18, '#C9874A', 8, OL, 5);
    return s;
  }

  // chalk text on the board. lines: [{text, x, y, size, reveal(0..1)}], scramble 0..1
  function chalkText(lines, t, scramble = 0, wobble = 0) {
    let s = '';
    lines.forEach((ln, li) => {
      const chars = [...ln.text];
      const shown = Math.floor(chars.length * clamp(ln.reveal == null ? 1 : ln.reveal, 0, 1));
      if (!shown) return;
      const size = ln.size || 46;
      const cw = size * .52; // approx advance, Fredoka-ish
      let x = ln.x;
      for (let i = 0; i < shown; i++) {
        const ch = chars[i];
        const k = li * 100 + i;
        const sc = scramble * (hash(k) > .35 ? 1 : .25);
        const dx = sc * (hash(k + 7) - .5) * 26 + wobble * Math.sin(t * 3 + k) * 4;
        const dy = sc * (hash(k + 13) - .5) * 30 + wobble * Math.cos(t * 2.6 + k * 1.3) * 5;
        const rot = sc * (hash(k + 21) - .5) * 70;
        const mirror = sc > .45 && 'bdpqnu3'.includes(ch) && hash(k + 3) > .3;
        const blurOp = .92 - sc * .3;
        const w = ch === ' ' ? cw * .6 : (/[mw]/.test(ch) ? cw * 1.35 : /[il.,!]/.test(ch) ? cw * .55 : cw);
        if (ch !== ' ') s += `<text x="0" y="0" transform="translate(${n(x + w / 2 + dx)},${n(ln.y + dy)}) rotate(${n(rot)}) scale(${mirror ? -1 : 1},1)" font-family="Fredoka" font-size="${size}" font-weight="500" fill="#F4F1E6" text-anchor="middle" opacity="${n(blurOp * 100) / 100}">${ch === '<' ? '&lt;' : ch}</text>`;
        x += w;
      }
    });
    return s;
  }

  function board(o, t) {
    let s = R(568, 210, 784, 384, 'rgba(60,40,20,.18)', 12, null) + R(560, 200, 800, 400, '#8A5A3A', 12, OL, 5);
    s += R(580, 220, 760, 360, '#2F5D50', 4, OL, 4);
    s += `<g clip-path="url(#boardClip)">` + E(760, 300, 160, 50, '#fff', null, 0, 'opacity=".05"') + E(1150, 470, 200, 60, '#fff', null, 0, 'opacity=".05"') + E(900, 540, 260, 30, '#fff', null, 0, 'opacity=".04"');
    s += T(606, 262, 'Matematika · Kelas 2', 26, '#F4F1E6', 500, 'start', 'opacity=".55"');
    if (o.boardLines) s += chalkText(o.boardLines, t, o.scramble || 0, o.wobble || 0);
    s += `</g>`;
    s += R(566, 596, 788, 18, '#7A4E31', 6, OL, 4) + R(640, 586, 40, 12, '#fff', 4, OL, 2.5) + R(700, 588, 30, 10, '#F6C744', 4, OL, 2.5) + R(1220, 580, 70, 18, '#5B6C7D', 5, OL, 3);
    return s;
  }

  function projectorScreen(o, t) {
    const k = clamp(o.screen || 0, 0, 1);
    if (k <= 0) return '';
    let s = R(548, 184, 824, 22, '#E7E3D8', 10, OL, 5);
    const h = 392 * k;
    s += R(566, 204, 788, h, '#FBFBF8', 4, OL, 4);
    if (k > .02) s += R(566, 204 + h - 10, 788, 12, '#DAD6CB', 4, OL, 3);
    if (o.screenSvg && k > .98) s += `<g>${o.screenSvg}</g>`;
    return s;
  }

  function teacherDesk(o, t) {
    let s = R(1352, 652, 440, 26, '#B07A44', 8, OL, 5) + R(1372, 676, 400, 150, '#9C6A39', 6, OL, 5);
    s += R(1396, 696, 168, 108, '#8C5D31', 6, null) + R(1584, 696, 166, 108, '#8C5D31', 6, null);
    // books + cup + plant
    s += R(1390, 618, 120, 18, '#2F6FB5', 4, OL, 4) + R(1396, 600, 108, 18, '#D6343C', 4, OL, 4) + R(1402, 584, 96, 16, '#F6C744', 4, OL, 4);
    s += R(1700, 592, 40, 60, '#E9E2D3', 8, OL, 4) + P('M1708,592 L1702,560 M1720,592 L1724,552 M1732,592 L1740,566', 'none', OL, 4);
    s += `<rect x="1704" y="548" width="6" height="40" fill="#F6C744" transform="rotate(-10,1707,568)"/>`;
    if (o.laptop) {
      s += P('M1540,652 L1660,652 L1672,640 L1528,640 Z', '#7D8790', OL, 4) + P('M1548,640 L1556,566 L1650,566 L1658,640 Z', '#5D6770', OL, 4) + P('M1560,632 L1566,574 L1642,574 L1648,632 Z', o.laptopGlow ? '#BFE7DA' : '#2B333A', null);
    }
    if (o.projector) {
      s += R(1430, 624, 82, 30, '#E9ECEE', 8, OL, 4) + E(1444, 639, 11, 11, '#2B333A', OL, 3) + E(1444, 639, 5, 5, '#BFE7FF');
      if (o.beam) s += P('M1440,632 L1352,206 L566,206 L566,580 Z', 'url(#beamP)', null, 0, `opacity="${n(o.beam)}"`);
    }
    return s;
  }

  function bunting() {
    let s = P('M470,30 Q960,92 1450,30', 'none', OL, 3);
    const cols = ['#D6343C', '#F6C744', '#2E8C80', '#FBFAF6'];
    for (let i = 0; i < 15; i++) {
      const u = (i + .5) / 15, x = 470 + 980 * u, y = 30 + 62 * 4 * u * (1 - u) * .5 + 0;
      s += P(`M${n(x - 22)},${n(y)} L${n(x + 22)},${n(y + 2)} L${n(x)},${n(y + 42)} Z`, cols[i % 4], OL, 3.5);
    }
    return s;
  }

  function poster() {
    let s = R(1446, 186, 248, 250, '#FFF6DD', 10, OL, 5);
    s += T(1570, 236, 'ANGKA', 34, '#D6343C', 700);
    [['1', 1500, '#2F6FB5'], ['2', 1570, '#2E8C80'], ['3', 1640, '#D6343C']].forEach(([d, x, c], i) => {
      s += T(x, 330, d, 74, c, 700);
      for (let k = 0; k <= i; k++) s += E(x - i * 11 + k * 22, 380, 8, 8, c, OL, 3);
    });
    return s + R(1446, 186, 248, 250, 'none', 10, OL, 5);
  }

  function lamp(t, flicker = 0) {
    const f = flicker ? .78 + .22 * Math.sin(t * 2 * Math.PI * 1.6) : 1; // slow, gentle pulse: no strobing
    let s = R(740, 22, 440, 30, '#E7E3D8', 10, OL, 5) + R(756, 28, 408, 16, '#FFFFF4', 8, null);
    s += E(960, 60, 360, 60, 'url(#glowG)', null, 0, `opacity="${n(.55 * f * 100) / 100}"`);
    return s;
  }

  // full classroom front wall + floor, in world coordinates (1920x1080)
  function classroom(o = {}) {
    const t = o.t || 0;
    // the room extends past the 1920x1080 frame so camera pans never reveal an edge
    let s = R(-900, -500, 3720, 1290, 'url(#wallG)', 0, null);
    s += R(-900, -500, 3720, 518, '#F1E4CB', 0, null) + R(-900, 0, 3720, 18, '#E2CDA8', 0, null) + R(-900, 18, 3720, 4, 'rgba(80,50,20,.12)', 0, null);
    s += R(-900, 646, 3720, 140, '#8DBFAF', 0, null) + R(-900, 634, 3720, 14, '#6E9F90', 0, OL, 0);
    for (let x = -840; x < 2760; x += 170) s += R(x, 662, 130, 106, 'none', 6, '#7AAE9F', 4);
    s += R(-900, 780, 3720, 900, 'url(#floorG)', 0, null) + R(-900, 776, 3720, 12, '#6E9F90', 0, null);
    [806, 836, 874, 922, 984, 1060, 1150, 1260, 1390].forEach((y, i) => { s += `<line x1="-900" y1="${y}" x2="2820" y2="${y}" stroke="#BF9A6C" stroke-width="${2 + i}"/>`; });
    // bookshelf (left of the window) and door (right of the teacher's desk)
    s += R(-560, 250, 420, 520, '#A8743F', 10, OL, 5);
    for (let r = 0; r < 4; r++) {
      s += R(-540, 280 + r * 120, 380, 10, '#8C5D31', 2, null);
      for (let b = 0; b < 7; b++) s += R(-530 + b * 52, 200 + r * 120 + 10 + (b % 3) * 6, 40, 78 - (b % 3) * 6, ['#D6343C', '#2F6FB5', '#F6C744', '#2E8C80', '#F49A8E'][(b + r) % 5], 4, OL, 3);
    }
    s += R(1990, 230, 300, 560, '#B98552', 10, OL, 5) + R(2020, 262, 240, 220, '#A06F40', 8, null) + R(2020, 512, 240, 240, '#A06F40', 8, null) + E(2250, 520, 14, 14, '#F6C744', OL, 4);
    s += windowView(t, o);
    // light beams from the window
    s += P('M420,170 L1100,780 L760,1080 L120,1080 L84,540 Z', 'url(#beamG)', null, 0, 'opacity=".55"');
    s += bunting() + lamp(t, o.flicker) + clock(960, 112, t);
    s += board(o, t) + projectorScreen(o, t);
    s += poster();
    s += fan(1796, 196, t, o.fanSpin == null ? 1 : o.fanSpin, o.fanOsc == null ? 1 : o.fanOsc);
    if (!o.noDesk) s += teacherDesk(o, t);
    return s;
  }

  // a front-view student desk (for a seated kid seen from the front): top edge at y
  function deskFront(x, y, w = 360, o = {}) {
    let s = R(x - w / 2 - 6, y, w + 12, 26, '#C38B52', 10, OL, 5);
    s += R(x - w / 2 + 6, y + 24, w - 12, 140, '#A8743F', 6, OL, 5) + R(x - w / 2 + 26, y + 44, w - 52, 100, '#956533', 6, null);
    if (o.book) s += P(`M${x - 90},${y + 4} L${x + 90},${y + 4} L${x + 80},${y - 10} L${x - 80},${y - 10} Z`, '#FFFFFF', OL, 4);
    if (o.keychain) {
      // Tara's rabbit keychain hanging from the desk hook
      const kx = x + w / 2 - 40, ky = y + 30;
      s += P(`M${kx},${ky} L${kx},${ky + 26}`, 'none', '#C9C4B8', 3) + E(kx, ky + 46, 18, 20, '#F6F5EF', OL, 3.5) +
        E(kx - 8, ky + 22, 5, 13, '#F6F5EF', OL, 3) + E(kx + 8, ky + 22, 5, 13, '#F6F5EF', OL, 3) + E(kx - 6, ky + 44, 2.2, 2.2, OL) + E(kx + 6, ky + 44, 2.2, 2.2, OL) + E(kx, ky + 50, 2.5, 2, '#F07F72');
    }
    return s;
  }

  // POV foreground: the viewer's own desk edge (screen coords, bottom of frame)
  function povDesk(o = {}) {
    const t = o.t || 0;
    let s = P('M-40,1000 L1960,1000 L1960,1700 L-40,1700 Z', '#C38B52', OL, 6) + R(-40, 1012, 2000, 10, '#D9A36A', 0, null);
    // notebook + pencil
    s += P('M640,1030 L1060,1030 L1090,1100 L610,1100 Z', '#FFFFFF', OL, 5) + P('M850,1030 L850,1100', 'none', '#D9D9D9', 4);
    for (let i = 0; i < 3; i++) s += `<line x1="${660 + i * 2}" y1="${1050 + i * 16}" x2="${830}" y2="${1050 + i * 16}" stroke="#9EC5E8" stroke-width="3"/>`;
    if (o.pencil !== false) {
      const p = o.pencil || { x: 1180, y: 1040, rot: -8 };
      s += `<g transform="translate(${n(p.x)},${n(p.y)}) rotate(${n(p.rot)})">` + R(-90, -9, 160, 18, '#F6C744', 4, OL, 3.5) + P('M70,-9 L96,0 L70,9 Z', '#F2D3A6', OL, 3) + P('M90,-2 L96,0 L90,2 Z', OL, null) + R(-106, -9, 18, 18, '#E98A9A', 4, OL, 3) + `</g>`;
    }
    return s;
  }

  // blurred back-of-classroom backdrop for portraits. theme: accent colour
  function portraitBg(theme = '#F3C969', t = 0) {
    let s = R(0, 0, 1920, 1080, '#EFDDBF', 0, null);
    s += `<g filter="url(#b12)">`;
    s += R(150, 160, 520, 360, '#C99A63', 14, null);
    [[190, 200, '#F6C744'], [330, 230, '#9ED8F2'], [470, 196, '#F49A8E'], [220, 360, '#A9D3C0'], [400, 380, '#FBFAF6'], [540, 340, '#F6C744']].forEach(([x, y, c]) => s += R(x, y, 110, 90, c, 6, null));
    s += R(1240, 120, 520, 520, '#FFF7E3', 10, null) + R(1260, 140, 480, 480, '#CFEAF5', 6, null);
    s += R(1180, 640, 640, 300, '#A8743F', 8, null);
    for (let i = 0; i < 9; i++) s += R(1210 + i * 66, 560, 48, 80, ['#D6343C', '#2F6FB5', '#2E8C80', '#F6C744'][i % 4], 4, null);
    s += R(0, 720, 1920, 360, '#D7B58A', 0, null);
    s += `</g>`;
    s += E(1500, 380, 420, 420, theme, null, 0, 'opacity=".22"');
    for (let i = 0; i < 9; i++) s += E(200 + hash(i) * 1600, 120 + hash(i + 9) * 520, 40 + hash(i + 3) * 60, 40 + hash(i + 3) * 60, '#FFF7E0', null, 0, `opacity="${n((.10 + hash(i + 5) * .14) * 100) / 100}" filter="url(#b6)"`);
    return s;
  }

  // ---------------- UI pieces ----------------
  function nameTag(x, y, name, cond, desc, k = 1, col = '#C0503A') {
    if (k <= 0) return '';
    const sl = (1 - k) * -60;
    const nw0 = tw(name, 52, 700), cw0 = tw(cond, 36, 600);
    const w = Math.max(30 + nw0 + 24 + cw0 + 34 + 30, desc ? 30 + tw(desc, 30, 500) + 36 : 0);
    let s = `<g transform="translate(${n(x + sl)},${n(y)})" opacity="${n(clamp(k * 1.4, 0, 1) * 100) / 100}">`;
    s += R(6, 10, w, desc ? 128 : 92, 'rgba(46,36,32,.25)', 26, null) + R(0, 0, w, desc ? 128 : 92, '#FFFFFF', 26, OL, 6);
    s += T(30, 62, name, 52, '#16302A', 700, 'start');
    const nw = 30 + nw0 + 22;
    s += R(nw, 22, cw0 + 34, 50, col, 14, null) + T(nw + 17, 58, cond, 36, '#FFFFFF', 600, 'start');
    if (desc) s += T(30, 108, desc, 30, '#3D4A45', 500, 'start');
    return s + `</g>`;
  }

  // speech/thought bubble with a tail pointing to (tx,ty)
  function bubble(x, y, w, h, html, o = {}) {
    const k = o.k == null ? 1 : o.k;
    if (k <= 0) return '';
    const sc = k < 1 ? .6 + .4 * (1 - Math.pow(1 - k, 3)) + Math.sin(k * Math.PI) * .08 : 1;
    const cx = x + w / 2, cy = y + h / 2;
    let s = `<g transform="translate(${n(cx)},${n(cy)}) scale(${n(sc * 1000) / 1000}) translate(${n(-cx)},${n(-cy)})" opacity="${n(clamp(k * 2, 0, 1) * 100) / 100}">`;
    if (o.thought) {
      s += E(o.tx, o.ty, 10, 10, '#fff', OL, 4) + E((o.tx + cx) / 2, (o.ty + y + h) / 2, 16, 16, '#fff', OL, 4);
    } else if (o.tx != null) {
      const bx = clamp(o.tx, x + 50, x + w - 50);
      const by = o.ty < y ? y : y + h;
      s += P(`M${n(bx - 26)},${n(by)} L${n(o.tx)},${n(o.ty)} L${n(bx + 26)},${n(by)} Z`, '#FFFFFF', OL, 6);
    }
    s += R(x + 6, y + 10, w, h, 'rgba(46,36,32,.2)', h > 120 ? 48 : h / 2, null);
    s += R(x, y, w, h, o.fill || '#FFFFFF', h > 120 ? 48 : h / 2, OL, 6);
    if (o.tx != null && !o.thought) { const bx = clamp(o.tx, x + 50, x + w - 50); const by = o.ty < y ? y : y + h; s += P(`M${n(bx - 20)},${n(by)} L${n(bx + 20)},${n(by)}`, 'none', o.fill || '#FFFFFF', 8); }
    s += html;
    return s + `</g>`;
  }

  // ---------------- the SuaraPapan board (projected) ----------------
  // Draws inside the projector screen rect (566,204)-(1354,596). o: caption, capK (0..1 words shown), bgK, rabbits[], count, eq, answers, chosen, benar
  function suaraBoard(o, t) {
    const X = 566, Y = 204, W = 788, H = 392;
    let s = `<clipPath id="sbClip"><rect x="${X}" y="${Y}" width="${W}" height="${H}" rx="4"/></clipPath><g clip-path="url(#sbClip)">`;
    s += R(X, Y, W, H, '#16302A', 0, null);
    const bgK = clamp(o.bgK || 0, 0, 1);
    if (bgK > 0) s += `<image href="assets/flower-garden.jpg" x="${X}" y="${Y + 56}" width="${W}" height="${H - 56}" preserveAspectRatio="xMidYMid slice" opacity="${n(bgK * 100) / 100}"/>`;
    // caption bar
    s += R(X, Y, W, 56, '#16302A', 0, null);
    if (o.caption) {
      const words = o.caption.split(' ');
      const shown = Math.ceil(words.length * clamp(o.capK == null ? 1 : o.capK, 0, 1));
      s += T(X + W / 2, Y + 39, words.slice(0, shown).join(' '), 30, '#F3F1EA', 600);
    }
    if (o.pin) { const pk = clamp(o.pin, 0, 1); s += `<g opacity="${n(pk * 100) / 100}">` + R(X + W - 142, Y + 12, 126, 32, '#E9B949', 10, null) + P(`M${X + W - 128},${Y + 34} l6,-14 6,6 -12,8 Z`, '#16302A', null) + T(X + W - 72, Y + 35, 'Disematkan', 18, '#16302A', 700) + `</g>`; }
    if (o.status) s += E(X + 22, Y + 28, 7, 7, '#E5533D') + T(X + 36, Y + 35, o.status, 18, '#C9D6CF', 600, 'start');
    // rabbits
    (o.rabbits || []).forEach(r => {
      if (r.k <= 0) return;
      const hop = r.hop || 0;
      const sc = (r.s || 1) * (r.k < 1 ? .4 + .6 * r.k : 1);
      s += E(r.x, r.y + 4, 46 * (r.s || 1), 10 * (r.s || 1), 'rgba(0,0,0,.22)', null, 0, `opacity="${n(clamp(r.k, 0, 1) * 100) / 100}"`);
      s += `<image href="assets/kelinci.webp" x="${n(r.x - 62 * sc)}" y="${n(r.y - 100 * sc - hop)}" width="${n(125 * sc)}" height="${n(100 * sc)}" opacity="${n(clamp(r.k, 0, 1) * 100) / 100}" ${r.flip ? `transform="translate(${n(2 * r.x)},0) scale(-1,1)"` : ''}/>`;
    });
    // count badge
    if (o.count != null && o.countK > 0) {
      const k = o.countK, sc = .6 + .4 * Math.min(1, k) + Math.sin(Math.min(1, k) * Math.PI) * .15;
      s += `<g transform="translate(${X + W - 70},${Y + 112}) scale(${n(sc * 100) / 100})">` + E(0, 0, 40, 40, '#E9B949', OL, 5) + T(0, 17, o.count, 46, '#16302A', 700) + `</g>`;
    }
    // equation card
    if (o.eq && o.eqK > 0) {
      const k = clamp(o.eqK, 0, 1);
      s += `<g opacity="${n(k * 100) / 100}" transform="translate(0,${n((1 - k) * 20)})">` + R(X + W / 2 - 150, Y + 76, 300, 84, 'rgba(22,48,42,.92)', 18, '#E9B949', 5) + T(X + W / 2, Y + 136, o.eq, 56, '#F3F1EA', 700) + `</g>`;
    }
    // answers
    if (o.answers && o.ansK > 0) {
      const k = clamp(o.ansK, 0, 1);
      o.answers.forEach((a, i) => {
        const x = X + W / 2 + (i - 1) * 120, y = Y + H - 70;
        const chosen = o.chosen === a;
        const col = chosen ? (o.benar > 0 ? '#2F7D5B' : '#E9B949') : '#F3F1EA';
        const kk = clamp(k * 3 - i * .6, 0, 1);
        s += `<g transform="translate(${x},${y}) scale(${n((.5 + .5 * kk) * 100) / 100})" opacity="${n(kk * 100) / 100}">` + R(-46, -40, 92, 80, col, 18, OL, 5) + T(0, 20, a, 54, chosen && o.benar > 0 ? '#fff' : '#16302A', 700) + `</g>`;
      });
    }
    if (o.benar > 0) {
      const k = clamp(o.benar, 0, 1), sc = .5 + .5 * k + Math.sin(k * Math.PI) * .2;
      s += `<g transform="translate(${X + W / 2},${Y + 248}) scale(${n(sc * 100) / 100})" opacity="${n(Math.min(1, k * 2) * 100) / 100}">` + R(-150, -50, 300, 92, '#2F7D5B', 24, OL, 5) + T(0, 20, 'Benar!', 58, '#FFFFFF', 700) + `</g>`;
      for (let i = 0; i < 26; i++) { // confetti
        const a = hash(i) * Math.PI * 2, d = 60 + 320 * k * (0.5 + hash(i + 4) * .5);
        const cx = X + W / 2 + Math.cos(a) * d, cy = Y + 230 + Math.sin(a) * d * .6 + 160 * k * k;
        s += `<rect x="${n(cx)}" y="${n(cy)}" width="12" height="7" rx="2" fill="${['#E9B949', '#F07F72', '#7CC4A8', '#9ED8F2'][i % 4]}" transform="rotate(${n(hash(i + 8) * 360 + k * 300)},${n(cx)},${n(cy)})" opacity="${n(clamp(1.6 - k, 0, 1) * 100) / 100}"/>`;
      }
    }
    s += `</g>`;
    return s;
  }

  // onomatopoeia sticker for Tara's overload
  function sfxWord(x, y, txt, size, col, rot, k, t, shake = 0) {
    if (k <= 0) return '';
    const sc = (.5 + .5 * clamp(k, 0, 1)) * (1 + .06 * Math.sin(t * 13 + x));
    const jx = shake * Math.sin(t * 41 + y) * 6, jy = shake * Math.cos(t * 37 + x) * 6;
    return `<g transform="translate(${n(x + jx)},${n(y + jy)}) rotate(${rot}) scale(${n(sc * 100) / 100})" opacity="${n(clamp(k * 2, 0, 1) * 100) / 100}">` +
      `<text x="0" y="0" font-family="Fredoka" font-size="${size}" font-weight="700" text-anchor="middle" fill="${col}" stroke="${OL}" stroke-width="${size / 7}" paint-order="stroke" stroke-linejoin="round">${txt}</text></g>`;
  }

  window.WORLD = { teacherDesk, tw, DEFS, classroom, deskFront, povDesk, portraitBg, nameTag, bubble, suaraBoard, sfxWord, chalkText, bird, fan, clock, noise, hash, R, P, E, T, clamp, n, OL };
})();
