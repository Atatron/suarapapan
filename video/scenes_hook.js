// scenes_hook.js: the hook. One teacher sentence, heard from four seats.
(function () {
  const { k, eo, eio, ei, back, kf, cam, n, clamp, lerp } = H;
  const W = WORLD, C = CAST;
  const THEME = { bima: '#9ED8F2', arka: '#F6C744', laras: '#F49A8E', tara: '#A9D3C0' };
  const TAG = {
    bima: ['BIMA', 'tunarungu', 'Suara guru terdengar samar'],
    arka: ['ARKA', 'ADHD', 'Perhatiannya mudah teralih'],
    laras: ['LARAS', 'disleksia', 'Mendengar jelas, tapi tulisan sulit dibaca'],
    tara: ['TARA', 'autisme', 'Sulit memilah suara guru dari suara lain'],
  };
  const TAGCOL = { bima: '#2F6FB5', arka: '#C98A12', laras: '#C0503A', tara: '#2E8C80' };
  window.EXTRA_DEFS = (window.EXTRA_DEFS || '') + `
    <filter id="whip" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="26 0"/></filter>
    <filter id="muff" x="0" y="0" width="100%" height="100%"><feColorMatrix type="saturate" values=".6"/></filter>
    <filter id="desat"><feColorMatrix type="saturate" values=".35"/></filter>
    <filter id="hot"><feColorMatrix type="saturate" values="1.6"/></filter>
    <filter id="dream"><feGaussianBlur stdDeviation="5"/><feColorMatrix type="saturate" values=".6"/></filter>`;

  // teacher in the classroom (world coords). sent: the scene's sentence cue list
  function teacher(lt, sent, o = {}) {
    const sp = H.speaking(sent, lt);
    const talk = sp ? H.amp(sp.line, sp.tl) : 0;
    const part = sp ? sp.line : (lt > (sent[sent.length - 1] || [0, 0])[1] ? 'end' : 'pre');
    let armL = 'open', armR = 'down', tilt = Math.sin(lt * 2.1) * 2.5;
    if (part === 'g_b') { armL = 'chest'; armR = 'open'; }
    if (part === 'g_c' || part === 'end') { armL = 'ask'; armR = 'ask'; tilt = 5; }
    if (o.arms) [armL, armR] = o.arms;
    return C.wulan({ x: o.x || 720, y: 602, s: .88, t: lt, expr: 'talk', mouth: talk > .06 ? 'talk' : 'smile', talk,
      open: C.blink(lt, 3), armL, armR, tilt, look: o.look || [0, .1], turn: o.turn || 0, brows: part === 'g_c' || part === 'end' ? 'up' : 'soft' });
  }

  // foreground classmates (backs) in world coords
  function classmates(lt, who = ['x1', 'x2'], o = {}) {
    const pos = { x1: [430, 1130], x2: [1430, 1140], x3: [930, 1190], x4: [1720, 1150] };
    return who.map((id, i) => {
      const [x, y] = pos[id];
      const sway = Math.sin(lt * 1.3 + i * 2) * 3 + (o.fidget && i === 0 ? Math.sin(lt * 6) * 6 : 0);
      return C.kid(id, { x: x + sway, y, s: 1.28, view: 'back', crop: 'seated', armR: 'desk', armL: 'desk', tilt: Math.sin(lt * .9 + i) * 2 });
    }).join('');
  }

  // a portrait of the kid at their desk (screen coords)
  function portrait(id, lt, o = {}) {
    let s = W.portraitBg(THEME[id], lt);
    const kidO = Object.assign({ x: 960, y: 1010, s: 1.5, crop: 'seated', t: lt, open: C.blink(lt, id.length), armR: 'desk', armL: 'desk' }, o.kid || {});
    s += C.kid(id, kidO);
    s += W.deskFront(960, 935, 820, { book: true, keychain: id === 'tara' });
    return s;
  }

  // the push-into-the-eye transition: portrait (zooming on the eye) with the POV revealed through a growing circle
  function irisInto(portraitSvg, povSvg, lt, a, b) {
    const ex = 900, ey = 635;
    const z = 1 + 2.6 * ei(k(lt, a - .25, b));
    let s = `<g transform="translate(${ex},${ey}) scale(${n(z * 1000) / 1000}) translate(${-ex},${-ey})">${portraitSvg}</g>`;
    const r = 1300 * ei(k(lt, a, b));
    if (r > 1) s += `<clipPath id="irisC"><circle cx="${ex}" cy="${ey}" r="${n(r)}"/></clipPath><g clip-path="url(#irisC)">${povSvg}</g>` +
      `<circle cx="${ex}" cy="${ey}" r="${n(r)}" fill="none" stroke="#2E2420" stroke-width="${n(10 + r * .02)}" opacity="${n((1 - k(lt, a, b)) * 100) / 100}"/>`;
    return s;
  }

  function tagFor(id, lt, t0 = .3) {
    const [nm, cond, desc] = TAG[id];
    return W.nameTag(64, 842, nm, cond, desc, eo(k(lt, t0, t0 + .35)), TAGCOL[id]);
  }

  function reaction(id, lt, t0, o) {
    // close-up reaction after the POV
    const u = eo(k(lt, t0, t0 + .25));
    let s = portrait(id, lt, { kid: Object.assign({ s: 1.5 + .12 * u }, o.kid) });
    if (o.bubble) s += o.bubble(lt - t0);
    return s;
  }

  // =============== BIMA (tunarungu) ===============
  SC.bima = function (lt, sc) {
    const p = sc.p, sent = p.sent, react = p.react;
    const camZ = 1.1 + .03 * Math.sin(lt * .7), camX = 900 + 8 * Math.sin(lt * .5), camY = 470 + 5 * Math.sin(lt * .8);
    const pov = () => {
      let room = W.classroom({ t: lt, fanSpin: .2, fanOsc: .3 });
      room += teacher(lt, sent);
      // the teacher's words reach him as a smudge: rings that fade before they arrive
      const sp = H.speaking(sent, lt);
      if (sp) for (let i = 0; i < 3; i++) {
        const ph = ((lt * 1.2 + i / 3) % 1);
        room += `<circle cx="720" cy="${602 - 248}" r="${n(40 + ph * 260)}" fill="none" stroke="#FFFFFF" stroke-width="${n(9 * (1 - ph))}" opacity="${n((1 - ph) * .5 * 100) / 100}" stroke-dasharray="18 26"/>`;
      }
      room += classmates(lt, ['x1', 'x2']);
      let s = `<g filter="url(#muff)">${cam(room, camX, camY, camZ)}</g>`;
      // speech bubble whose words never come into focus
      if (sp) {
        const txt = TL.text[sp.line];
        const kb = eo(k(sp.tl, 0, .2));
        s += W.bubble(980, 140, 760, 130, `<g filter="url(#b6)" opacity=".55"><text x="1360" y="222" font-family="Fredoka" font-size="52" font-weight="600" fill="#5A4A40" text-anchor="middle">${txt}</text></g>`, { k: kb, tx: 820, ty: 330 });
      }
      s += `<rect width="1920" height="1080" fill="#7FA9C9" opacity=".12"/>`;
      s += W.povDesk({ t: lt });
      return s;
    };
    let s;
    const a0 = sent[0][1];
    if (lt < a0 - .03) {
      // opener over the portrait
      const op = Math.min(eo(k(lt, .02, .22)), 1 - k(lt, a0 - .42, a0 - .25));
      const por = portrait('bima', lt, { kid: { look: [-.5, -.2], expr: 'neutral' } }) +
        `<g opacity="${n(op * 100) / 100}"><rect x="460" y="70" width="1000" height="96" rx="48" fill="rgba(22,30,28,.86)"/>` +
        W.T(960, 134, 'Coba dengarkan dari bangku mereka.', 50, '#FFFFFF', 600) + `</g>`;
      s = irisInto(por, lt > a0 - .35 ? pov() : '', lt, a0 - .33, a0 - .05);
    } else if (lt < react) {
      s = pov();
    } else {
      s = reaction('bima', lt, react, { kid: { expr: 'confused', look: [-.3, -.1], tilt: -6, armL: 'chin' },
        bubble: u => W.bubble(1160, 260, 170, 150, W.T(1245, 370, '?', 110, '#2F6FB5', 700), { k: eo(k(u, .05, .3)), thought: true, tx: 1110, ty: 440 }) });
    }
    return s + tagFor('bima', lt);
  };

  // =============== REWIND (VHS) ===============
  function rewind(prevId) {
    return function (lt, sc) {
      const pv = H.scene(prevId);
      const u = k(lt, 0, sc.dur);
      const tt = pv.dur * Math.pow(1 - u, .55) * .98;
      let s = `<g filter="url(#desat)" transform="translate(${n(Math.sin(lt * 90) * 10)},0)">${SC[prevId](tt, pv)}</g>`;
      for (let y = 0; y < 1080; y += 6) s += `<rect x="0" y="${y}" width="1920" height="2" fill="#000" opacity=".16"/>`;
      const band = (lt * 2900) % 1300 - 110;
      s += `<rect x="0" y="${n(band)}" width="1920" height="70" fill="#FFFFFF" opacity=".22"/>` + `<rect x="0" y="${n(band + 22)}" width="1920" height="8" fill="#FFFFFF" opacity=".5"/>`;
      s += `<g opacity=".95"><path d="M1700,70 L1640,110 L1700,150 Z M1780,70 L1720,110 L1780,150 Z" fill="#FFFFFF" stroke="#2E2420" stroke-width="5"/></g>`;
      return s;
    };
  }
  SC.rw1 = rewind('bima');
  SC.rw2 = rewind('arka');
  SC.rw3 = rewind('laras');

  // =============== ARKA (ADHD) ===============
  SC.arka = function (lt, sc) {
    const p = sc.p, sent = p.sent, react = p.react;
    const camKF = [[.62, [880, 470, 1.1]], [1.55, [880, 470, 1.1]], [2.2, [305, 372, 1.78]], [3.5, [322, 366, 1.84]],
      [3.85, [960, 196, 1.95]], [4.2, [958, 204, 1.9]], [4.55, [890, 560, 1.15]], [5.2, [890, 560, 1.15]], [6.45, [900, 520, 1.1]], [6.82, [880, 470, 1.1]], [8, [880, 470, 1.1]]];
    const [cx, cy, cz] = kf(lt, camKF);
    const moving = Math.max(k(lt, 1.55, 1.75) * (1 - k(lt, 2.05, 2.2)), k(lt, 3.55, 3.7) * (1 - k(lt, 3.75, 3.85)), k(lt, 6.45, 6.55) * (1 - k(lt, 6.72, 6.82)));
    const down = eio(k(lt, 4.25, 4.55)) * (1 - eio(k(lt, 5.15, 5.45)));
    const pov = () => {
      // bird: arrives 1.45, hops 2.3-3.2, flies off 5.6
      let bird = null;
      if (lt > 1.4 && lt < 5.9) {
        const arrive = eo(k(lt, 1.4, 1.85));
        const bx = lerp(520, 330, arrive) + (lt > 2.3 && lt < 3.3 ? (lt - 2.3) * -40 : lt >= 3.3 ? -40 : 0);
        const fly = k(lt, 5.5, 5.9);
        bird = { x: bx - fly * 260, y: lerp(250, 398, arrive) - fly * 200, pose: lt < 1.85 || fly > 0 ? 'fly' : (lt > 2.3 && lt < 3.3 ? 'hop' : 'sit'), flip: false };
      }
      let room = W.classroom({ t: lt, bird, fanSpin: .3, fanOsc: .5 });
      room += teacher(lt, sent, { look: lt > 6.6 ? [.2, .3] : [0, .1] });
      room += classmates(lt, ['x1', 'x2'], { fidget: true });
      let s = `<g ${moving > .3 ? 'filter="url(#whip)"' : ''}>${cam(room, cx, cy + down * 260 / cz, cz)}</g>`;
      // distraction tunnel: the room dims while the mind wanders
      const away = 1 - kf(lt, p.attn);
      s += `<rect width="1920" height="1080" fill="url(#vig)" opacity="${n(away * 1.1 * 100) / 100}"/>`;
      // own desk + rolling pencil (rolls 4.25-4.95, drops)
      const roll = k(lt, 4.25, 4.95), fall = k(lt, 4.95, 5.25);
      const pen = { x: 1180 + roll * 560, y: 1040 + fall * 260, rot: -8 + roll * 540 + fall * 120 };
      s += `<g transform="translate(0,${n(-down * 300)})">${W.povDesk({ t: lt, pencil: lt < 5.3 ? pen : false })}${down > .05 ? `<g transform="translate(0,${n(down * 300)})"></g>` : ''}</g>`;
      // daydream bubble 5.2-6.45
      const dk = Math.min(eo(k(lt, 5.15, 5.45)), 1 - k(lt, 6.25, 6.5));
      if (dk > 0) {
        const bx = 1030, by = 110, bw = 780, bh = 460;
        const ball = Math.abs(Math.sin((lt - 5.15) * 7)) * 120;
        const inner = W.R(bx + 40, by + 40, bw - 80, bh - 80, '#7CC46D', 34, null) +
          `<path d="M${bx + 60},${by + 300} L${bx + bw - 60},${by + 300}" stroke="#fff" stroke-width="6" opacity=".8"/>` +
          W.R(bx + bw - 220, by + 120, 150, 120, 'none', 4, '#FFFFFF', 8) +
          W.E(bx + 300 + (lt - 5.15) * 260, by + 290 - ball, 40, 40, '#FFFFFF', '#2E2420', 5) +
          W.P(`M${bx + 286 + (lt - 5.15) * 260},${by + 270 - ball} l14,-10 l14,10 -5,16 -18,0 Z`, '#2E2420', null) +
          W.T(bx + 230, by + 150, 'GOOL!', 74, '#F6C744', 700, 'middle', `stroke="#2E2420" stroke-width="10" paint-order="stroke" transform="rotate(-8,${bx + 230},${by + 150})"`);
        s += W.bubble(bx, by, bw, bh, inner, { k: dk, thought: true, tx: 860, ty: 760, fill: '#E9F6E4' });
      }
      return s;
    };
    let s;
    if (lt < .64) {
      const por = portrait('arka', lt, { kid: { look: [.6, -.4], expr: 'happy', bob: Math.sin(lt * 9) * 6, tilt: Math.sin(lt * 6) * 4, armR: 'desk', armL: 'desk' } });
      s = irisInto(por, lt > .36 ? pov() : '', lt, .38, .64);
    } else if (lt < react) s = pov();
    else s = reaction('arka', lt, react, { kid: { expr: 'happy', mouth: 'grin', brows: 'worried', look: [.2, -.2], tilt: 6, armL: 'scratch', bob: Math.sin(lt * 5) * 4 },
      bubble: u => W.bubble(1180, 300, 470, 130, W.T(1415, 385, 'Eh… tiga?', 64, '#2E2420', 700), { k: eo(k(u, .05, .3)), tx: 1130, ty: 520 }) });
    return s + tagFor('arka', lt);
  };

  // =============== LARAS (disleksia) ===============
  const BOOK_LINES = ['Di rumput ada 3 kelinci.', 'Lalu 2 kelinci pergi.', 'Ada berapa kelinci sekarang?'];
  function book(lt, scr, wob) {
    const bx = 170, by = 150, bw = 1580, bh = 820;
    let s = W.R(bx + 14, by + 22, bw, bh, 'rgba(46,36,32,.3)', 26, null);
    s += W.R(bx, by, bw / 2, bh, '#FFFDF6', 22, '#2E2420', 6) + W.R(bx + bw / 2, by, bw / 2, bh, '#FFFDF6', 22, '#2E2420', 6);
    s += `<path d="M${bx + bw / 2},${by + 10} L${bx + bw / 2},${by + bh - 10}" stroke="#D8CDB8" stroke-width="10"/>`;
    s += W.T(bx + 70, by + 100, 'Soal 3', 46, '#C0503A', 700, 'start');
    const lines = BOOK_LINES.map((tx, i) => ({ text: tx, x: bx + 70, y: by + 230 + i * 120, size: 56, reveal: 1 }));
    if (scr > .4) s += `<g opacity=".28" transform="translate(9,5)">${W.chalkText(lines.map(l => Object.assign({}, l)), lt + .3, scr * .8, wob).replace(/#F4F1E6/g, '#2E2420')}</g>`;
    s += W.chalkText(lines, lt, scr, wob).replace(/#F4F1E6/g, '#2E2420').replace(/font-weight="500"/g, 'font-weight="600"');
    // right page: picture
    s += `<clipPath id="pg"><rect x="${bx + bw / 2 + 50}" y="${by + 60}" width="${bw / 2 - 100}" height="${bh - 180}" rx="18"/></clipPath>`;
    s += `<g clip-path="url(#pg)"><image href="assets/flower-garden.jpg" x="${bx + bw / 2 + 50}" y="${by + 60}" width="${bw / 2 - 100}" height="${bh - 180}" preserveAspectRatio="xMidYMid slice"/></g>`;
    s += W.R(bx + bw / 2 + 50, by + 60, bw / 2 - 100, bh - 180, 'none', 18, '#2E2420', 5);
    [[1260, 640], [1420, 610], [1580, 650]].forEach(([x, y]) => s += `<image href="assets/kelinci.webp" x="${x - 70}" y="${y - 112}" width="140" height="112"/>`);
    s += W.T(bx + bw * .75, by + bh - 50, '— 24 —', 30, '#9A8E7C', 500);
    return s;
  }
  SC.laras = function (lt, sc) {
    const p = sc.p, sent = p.sent, react = p.react;
    const look = eio(k(lt, 1.35, 2.05)) * (1 - eio(k(lt, 6.4, 6.9)));
    const scr = kf(lt, [[2.3, 0], [3.2, .32], [4.6, .55], [6.3, .85]]);
    const wob = kf(lt, [[2.0, 0], [2.6, .7], [6.3, 1.2]]);
    const pov = () => {
      let room = W.classroom({ t: lt, fanSpin: .3, fanOsc: .4 });
      room += teacher(lt, sent, { look: [0, .2] });
      room += classmates(lt, ['x3']);
      let s = cam(room, 960, 440 + look * 380, 1.22 + .06 * k(lt, 0, 7));
      s += `<g transform="translate(0,${n(-look * 900)})">${W.povDesk({ t: lt })}</g>`;
      if (look > 0) s += `<g transform="translate(0,${n((1 - look) * 1000)}) rotate(${n(-1.5 + Math.sin(lt * 1.3) * .6)},960,560)">${book(lt, scr, wob)}</g>`;
      return s;
    };
    let s;
    if (lt < .64) {
      const por = portrait('laras', lt, { kid: { look: [-.2, -.3], expr: 'happy' } });
      s = irisInto(por, lt > .36 ? pov() : '', lt, .38, .64);
    } else if (lt < react) s = pov();
    else s = reaction('laras', lt, react, { kid: { expr: 'worried', look: [.1, .5], tilt: -5, armR: 'chin', armL: 'desk' },
      bubble: u => W.bubble(1170, 250, 330, 150, W.T(1335, 350, 'b? d? p?', 54, '#C0503A', 700, 'middle', 'transform="rotate(-4,1335,340)"'), { k: eo(k(u, .05, .3)), thought: true, tx: 1110, ty: 450 }) });
    return s + tagFor('laras', lt);
  };

  // =============== TARA (autisme) ===============
  const NOISE = [ // [t0, text, world x, y, size, colour, rot]
    [0.85, 'WUUUNG', 1700, 330, 70, '#4BA3C7', -8], [1.15, 'TIK! TOK!', 960, 210, 60, '#D6343C', 6], [1.5, 'KRIIIT', 330, 820, 72, '#C98A12', -12],
    [1.8, 'TES TES TES', 255, 300, 56, '#2F6FB5', 4], [2.1, 'bisik-bisik…', 1440, 860, 58, '#7A6FB5', 8], [2.4, 'BRUMMM', 330, 470, 74, '#8A5A3A', -6],
    [2.7, 'TAK TAK TAK', 960, 940, 62, '#2E8C80', -4], [3.0, 'NGIIING', 960, 80, 60, '#C0503A', 3],
  ];
  SC.tara = function (lt, sc) {
    const p = sc.p, sent = p.sent, react = p.react;
    const lvl = kf(lt, p.noise);
    const shake = lvl * lvl;
    const jx = Math.sin(lt * 37) * 9 * shake, jy = Math.cos(lt * 31) * 7 * shake;
    const pov = () => {
      let room = W.classroom({ t: lt, fanSpin: 1, fanOsc: 1, rain: lt > 1.7, flicker: lt > 2.9 });
      room += teacher(lt, sent, { look: [0, .1] });
      room += classmates(lt, ['x1', 'x4', 'x2'], { fidget: true });
      // the teacher's bubble is just one more sound among many
      const sp = H.speaking(sent, lt);
      if (sp) room += W.bubble(470, 70, 520, 110, W.T(730, 140, TL.text[sp.line], 40, '#2E2420', 600), { k: eo(k(sp.tl, 0, .2)), tx: 720, ty: 290 });
      NOISE.forEach(([t0, txt, x, y, sz, col, rot], i) => {
        const kk = eo(k(lt, t0, t0 + .3));
        const grow = 1 + lvl * .35;
        room += W.sfxWord(x, y, txt, sz * grow, col, rot, kk, lt, shake);
        if (lvl > .75 && i % 2 === 0) room += W.sfxWord(x + 140, y + 90, txt, sz * .8, col, -rot, k(lt, 3.6 + i * .05, 3.9 + i * .05), lt + 1, shake);
      });
      let s = `<g transform="translate(${n(jx)},${n(jy)})" ${lvl > .6 ? 'filter="url(#hot)"' : ''}>${cam(room, 980, 500, 1.0 + .06 * lvl)}</g>`;
      // pressure ring closing in
      if (lvl > .5) s += `<rect width="1920" height="1080" fill="url(#vig)" opacity="${n((lvl - .5) * 1.6 * 100) / 100}"/>`;
      s += W.povDesk({ t: lt });
      return s;
    };
    let s;
    if (lt < .64) {
      const por = portrait('tara', lt, { kid: { look: [0, -.3], expr: 'neutral' } });
      s = irisInto(por, lt > .36 ? pov() : '', lt, .38, .64);
    } else if (lt < react) s = pov();
    else {
      s = `<g transform="translate(${n(jx * 1.4)},${n(jy * 1.4)})">` + reaction('tara', lt, react, { kid: { expr: 'overwhelmed', armL: 'ears', armR: 'ears', tilt: Math.sin(lt * 20) * 2 } }) + `</g>`;
      NOISE.forEach(([t0, txt, x, y, sz, col, rot], i) => {
        const a = i / NOISE.length * Math.PI * 2 + lt * 1.4;
        const r = 560 - k(lt, react, sc.dur) * 90;
        s += W.sfxWord(960 + Math.cos(a) * r * 1.35, 560 + Math.sin(a) * r * .72, txt, sz * 1.1, col, rot, 1, lt, 1);
      });
    }
    return s + tagFor('tara', lt);
  };

  // =============== silence + quad ===============
  SC.diam = () => `<rect width="1920" height="1080" fill="#000"/>`;

  SC.quad = function (lt, sc) {
    const w = TL.words.n_hook, off = 0.25;
    const tAnak = off + w[H.findWord('n_hook', /^anak/i)][0];
    let s = `<rect width="1920" height="1080" fill="#16302A"/>`;
    const cells = [['bima', 0, 0, { expr: 'confused', tilt: -6, look: [-.3, -.1] }], ['arka', 1, 0, { expr: 'dream', look: [.8, -.7], tilt: 5 }],
      ['laras', 0, 1, { expr: 'worried', look: [.1, .5], armR: 'chin' }], ['tara', 1, 1, { expr: 'overwhelmed', armL: 'ears', armR: 'ears' }]];
    cells.forEach(([id, cx, cy, ex], i) => {
      const t0 = tAnak - .25 + i * .16;
      const u = back(k(lt, t0, t0 + .4));
      const x = 24 + cx * 948, y = 24 + cy * 528, wd = 924, ht = 508;
      if (u <= 0) return;
      s += `<g transform="translate(${x + wd / 2},${y + ht / 2}) scale(${n(u * 1000) / 1000}) translate(${-(x + wd / 2)},${-(y + ht / 2)})">`;
      s += `<clipPath id="q${i}"><rect x="${x}" y="${y}" width="${wd}" height="${ht}" rx="28"/></clipPath><g clip-path="url(#q${i})">`;
      s += W.R(x, y, wd, ht, THEME[id], 0, null) + W.E(x + wd / 2, y + ht * .55, 380, 300, '#FFFFFF', null, 0, 'opacity=".25"');
      s += C.kid(id, Object.assign({ x: x + wd / 2, y: y + ht + 120, s: 1.18, crop: 'seated', t: lt, open: C.blink(lt + i, i + 2), armR: 'desk', armL: 'desk' }, ex));
      s += `</g>` + W.R(x, y, wd, ht, 'none', 28, '#2E2420', 6);
      const [nm, cond] = TAG[id];
      const tw = 20 + W.tw(nm, 40, 700) + 16 + W.tw(cond, 30, 600) + 22;
      const tx = cx ? x + wd - 24 - tw : x + 24;
      s += W.R(tx, y + 22, tw, 64, '#FFFFFF', 18, '#2E2420', 4) + W.T(tx + 20, y + 68, nm, 40, '#16302A', 700, 'start') +
        W.T(tx + 36 + W.tw(nm, 40, 700), y + 66, cond, 30, TAGCOL[id], 600, 'start');
      // what reached them: one icon per panel
      const ix = cx ? x + 150 : x + wd - 150, iy = y + 200;
      s += W.E(ix, iy, 74, 74, '#FFFFFF', '#2E2420', 5);
      if (id === 'bima') s += W.P(`M${ix - 34},${iy - 14} L${ix - 14},${iy - 14} L${ix + 8},${iy - 34} L${ix + 8},${iy + 34} L${ix - 14},${iy + 14} L${ix - 34},${iy + 14} Z`, '#2F6FB5', '#2E2420', 4) +
        W.P(`M${ix + 20},${iy - 16} L${ix + 44},${iy + 16} M${ix + 44},${iy - 16} L${ix + 20},${iy + 16}`, 'none', '#D6343C', 7);
      if (id === 'arka') s += W.bird(ix + 6, iy + 6, lt, 'sit');
      if (id === 'laras') s += W.T(ix - 18, iy + 22, 'b', 62, '#C0503A', 700) + `<text x="0" y="0" transform="translate(${ix + 22},${iy + 22}) scale(-1,1)" font-family="Fredoka" font-size="62" font-weight="700" fill="#2F6FB5" text-anchor="middle">b</text>`;
      if (id === 'tara') s += W.P(`M${ix - 40},${iy} q10,-26 20,0 t20,0 t20,0 t20,0`, 'none', '#2E8C80', 7) + W.P(`M${ix - 30},${iy - 26} q8,-16 16,0 t16,0 t16,0`, 'none', '#C0503A', 5) + W.P(`M${ix - 30},${iy + 28} q8,-16 16,0 t16,0 t16,0`, 'none', '#C98A12', 5);
      s += `</g>`;
    });
    // honest framing: these are illustrations, and every child is different
    const nt = eo(k(lt, tAnak + .6, tAnak + 1.0));
    if (nt > 0) { const txt = 'Ilustrasi pengalaman belajar · setiap anak berbeda'; const w = W.tw(txt, 22, 600) + 32;
      s += `<g opacity="${n(nt * 100) / 100}">` + W.R(1872 - w, 1006, w, 38, 'rgba(22,30,28,.78)', 19, null) + W.T(1872 - 16, 1032, txt, 22, '#FFFFFF', 600, 'end') + `</g>`; }
    // centre badge: one sentence
    const cb = back(k(lt, .2, .55)) * (1 + .025 * Math.sin(lt * 3.2));
    if (cb > 0) s += `<g transform="translate(960,540) scale(${n(cb * 1000) / 1000})">` +
      `<circle r="178" fill="none" stroke="#E9B949" stroke-width="7" stroke-dasharray="20 24" stroke-linecap="round" transform="rotate(${n(lt * 38)})"/>` + W.E(0, 0, 150, 150, '#F3F1EA', '#2E2420', 7) +
      W.T(0, -14, '1', 110, '#16302A', 700) + W.T(0, 52, 'kalimat', 40, '#16302A', 600) + `</g>`;
    return s;
  };
})();
