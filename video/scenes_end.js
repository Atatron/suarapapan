// scenes_end.js: the same sentence through SuaraPapan, how it works, and the close.
(function () {
  const { k, eo, eio, ei, back, kf, cam, n, clamp, lerp } = H;
  const W = WORLD, C = CAST;
  const G = '#16302A', CREAM = '#F3F1EA', GOLD = '#E9B949', INK = '#2E2420', RED = '#C0503A';
  const THEME = { bima: '#9ED8F2', arka: '#F6C744', laras: '#F49A8E', tara: '#A9D3C0' };
  const X = 566, Y = 204, BW = 788, BH = 392; // projector screen rect (world coords)
  const SPOT = [[810, 548], [950, 556], [1090, 548]];

  // words of a teacher line shown so far (scene-local time lt, line starts at off)
  function spoken(line, off, lt) {
    const w = TL.words[line];
    const disp = TL.text[line].replace(/[.?!]$/, '').split(/\s+/);
    let c = 0;
    for (let i = 0; i < w.length; i++) if (lt >= off + w[i][0] - .02) c = i + 1;
    return disp.slice(0, c).join(' ').replace(/,$/, '');
  }
  const wtime = (line, off, re, nth = 0) => off + TL.words[line][H.findWord(line, re, nth)][0];

  function hopIn(i, t0, lt) {
    const u = k(lt, t0, t0 + .5);
    const [xf, yf] = SPOT[i];
    return { x: lerp(X - 90, xf, eo(u)), y: yf, hop: Math.abs(Math.sin(u * Math.PI * 3)) * 46 * (1 - u * .3), k: u > 0 ? 1 : 0, s: 1 };
  }
  function hopOut(i, t0, lt) {
    const u = k(lt, t0, t0 + .8);
    const [xf, yf] = SPOT[i];
    return { x: lerp(xf, X + BW + 120, ei(u) * .6 + u * .4), y: yf, hop: Math.abs(Math.sin(u * Math.PI * 4)) * 44, k: u < 1 ? 1 : 0, s: 1 };
  }

  // board state for the whole demo, as a function of demo time (demo1 local time, demo2 adds its start)
  function board1(lt, p) {
    const a = p.ga;
    const rab = [0, 1, 2].map(i => hopIn(i, a + 1.25 + i * .25 - .1, lt));
    return {
      caption: spoken('g_a', a, lt), status: 'Mendengarkan', bgK: eo(k(lt, wtime('g_a', a, /^rumput/), wtime('g_a', a, /^rumput/) + .5)),
      rabbits: rab, count: '3', countK: k(lt, a + 2.0, a + 2.3),
    };
  }
  function board2(lt, p) {
    const b = p.gb, c = p.gc, tap = p.tap;
    const tOut = b + 1.15;
    const ansT0 = c + TL.env.g_c.length / TL.fps + .05;
    const sl = k(lt, ansT0 - .55, ansT0 - .05); // the one rabbit left hops aside to make room for the answers
    const rab = [{ x: lerp(SPOT[0][0], 668, eo(sl)), y: SPOT[0][1] - 6, k: 1, s: 1, hop: Math.abs(Math.sin(sl * Math.PI * 2)) * 30 }, hopOut(1, tOut, lt), hopOut(2, tOut + .1, lt)];
    let caption = 'Di rumput ada tiga kelinci', status = 'Mendengarkan';
    if (lt >= b - .05) caption = spoken('g_b', b, lt) || caption;
    if (lt >= c - .05) caption = spoken('g_c', c, lt) || spoken('g_b', b, 99);
    const eqT = b + TL.env.g_b.length / TL.fps + .15;
    let eq = '3 − 2', eqK = k(lt, eqT, eqT + .3);
    if (lt > c + .5) eq = '3 − 2 = ?';
    const ben = k(lt, tap + .15, tap + .6);
    if (ben > 0) eq = '3 − 2 = 1';
    const ansT = c + TL.env.g_c.length / TL.fps + .05;
    return {
      caption, status, bgK: 1, rabbits: rab, count: lt > tOut + .85 ? '1' : '3', countK: lt > tOut + .85 ? k(lt, tOut + .85, tOut + 1.1) : 1,
      eq, eqK, answers: ['0', '1', '2'], ansK: k(lt, ansT, ansT + .22), chosen: lt >= tap ? '1' : null, benar: ben,
    };
  }

  // classroom for the demo: screen down, projector on, teacher behind her desk, the four kids from behind
  function demoRoom(lt, st, o = {}) {
    let room = W.classroom({ t: lt, screen: o.screen == null ? 1 : o.screen, screenSvg: W.suaraBoard(st, lt), noDesk: true, fanSpin: .25, fanOsc: .3 });
    const talk = o.talk || 0;
    room += C.wulan({ x: 1480, y: 602, s: .86, t: lt, expr: o.wexpr || 'talk', mouth: talk > .06 ? 'talk' : 'smile', talk, open: C.blink(lt, 3), armL: 'type', armR: o.warmR || 'down', look: [-.6, -.1], turn: -.4 });
    room += W.teacherDesk({ laptop: true, laptopGlow: true, projector: true, beam: o.screen == null || o.screen >= 1 ? .9 : 0 }, lt);
    const kids = [['bima', 470, 1190], ['arka', 820, 1210], ['laras', 1150, 1200], ['tara', 1470, 1195]];
    kids.forEach(([id, x, y], i) => {
      const pose = (o.poses && o.poses[id]) || ['desk', 'desk'];
      room += C.kid(id, { x, y, s: 1.08, view: 'back', crop: 'seated', t: lt + i, armR: pose[0], armL: pose[1], tilt: Math.sin(lt * 1.1 + i) * 2 + (o.tilt && o.tilt[id] || 0), bob: o.bounce ? -Math.abs(Math.sin(lt * 8 + i)) * 14 : 0 });
    });
    return room;
  }

  // a kid at their desk looking up at the board (front view), for the reaction cards
  function kidCard(id, lt, ex) {
    let s = W.portraitBg(THEME[id], lt) + `<rect width="1920" height="1080" fill="#16302A" opacity=".12"/>`;
    s += W.E(960, 300, 700, 380, '#E8F7EF', null, 0, 'opacity=".35" filter="url(#b12)"'); // the board's glow on them
    s += C.kid(id, Object.assign({ x: 960, y: 1010, s: 1.5, crop: 'seated', t: lt, open: C.blink(lt, id.length), armR: 'desk', armL: 'desk', look: [0, -.7], headDy: 0 }, ex));
    s += W.deskFront(960, 935, 820, { book: true, keychain: id === 'tara' });
    return s;
  }
  function chip(x, y, txt, u, col = '#2F7D5B') {
    if (u <= 0) return '';
    const w = W.tw(txt, 40, 700) + 110;
    return `<g transform="translate(${x},${y}) scale(${n((.6 + .4 * back(u)) * 1000) / 1000})" opacity="${n(clamp(u * 2.5, 0, 1) * 100) / 100}">` +
      W.R(-w / 2 + 6, -36 + 8, w, 78, 'rgba(46,36,32,.25)', 39, null) + W.R(-w / 2, -36, w, 78, '#FFFFFF', 39, INK, 6) + W.E(-w / 2 + 44, 3, 24, 24, col) +
      W.P(`M${-w / 2 + 32},4 l9,9 17,-19`, 'none', '#FFFFFF', 6) + W.T(-w / 2 + 80, 18, txt, 40, G, 700, 'start') + `</g>`;
  }
  // the board, enlarged into a panel (screen coords): scale the screen rect into (px,py,pw)
  function boardPanel(st, lt, px, py, pw, hl) {
    const sc = pw / BW;
    let s = W.R(950, 0, 970, 1080, G, 0, null) + W.R(950, 0, 970, 1080, 'url(#dots)', 0, null, 0, 'opacity=".08"');
    s += `<g transform="translate(${px},${py}) scale(${n(sc * 1000) / 1000}) translate(${-X},${-Y})">` + W.R(X - 18, Y - 18, BW + 36, BH + 36, '#2E2420', 24, null) + W.suaraBoard(st, lt);
    if (hl === 'caption') s += W.R(X + 6, Y + 4, BW - 12, 50, 'none', 12, GOLD, 6, `opacity="${n((.6 + .4 * Math.sin(lt * 6)) * 100) / 100}"`);
    if (hl === 'rabbits') SPOT.forEach(([x, y]) => s += W.E(x, y - 46, 74, 70, 'none', GOLD, 6, `opacity="${n((.6 + .4 * Math.sin(lt * 6)) * 100) / 100}"`));
    if (hl === 'pin') s += W.R(X + BW - 148, Y + 6, 138, 44, 'none', 14, GOLD, 5, `opacity="${n((.6 + .4 * Math.sin(lt * 6)) * 100) / 100}"`);
    return s + `</g>`;
  }

  // =============== DEMO 1: "Di rumput ada tiga kelinci." ===============
  SC.demo1 = function (lt, sc) {
    const p = sc.p, a = p.ga, em = p.em;
    const st = board1(lt, p);
    const sp = H.speaking([['g_a', a]], lt);
    const talk = sp ? H.amp(sp.line, sp.tl) : 0;
    const w = TL.words.n_empat;
    const tL = em + w[H.findWord('n_empat', /^Laras/)][0] - .18, tT = em + w[H.findWord('n_empat', /^Tara/)][0] - .18, tA = em + w[H.findWord('n_empat', /^Saat/)][0] - .18;
    if (lt < em - .1) {
      const screen = eio(k(lt, .05, .75));
      const z = lerp(1.0, 1.34, eio(k(lt, 1.2, 3.1))), cy = lerp(540, 430, eio(k(lt, 1.2, 3.1)));
      return cam(demoRoom(lt, st, { screen, talk, tilt: { arka: lt > 2.2 ? 3 : 0 } }), 960, cy, z);
    }
    // four reaction cards: kid (left) + what reached them on the board (right)
    const cards = [['bima', em - .1, tL], ['laras', tL, tT], ['tara', tT, tA], ['arka', tA, sc.dur + 1]];
    const [id, t0] = cards.find(c => lt >= c[1] && lt < c[2]) || cards[3];
    const ll = lt - t0;
    let s;
    if (id === 'bima') {
      s = kidCard('bima', lt, { expr: 'focus', look: [-.6 + 1.2 * ((ll * .9) % 1), -.75], mouth: 'small' });
      s = `<g transform="translate(-430,0)">${s}</g>` + boardPanel(st, lt, 1000, 210, 820, 'caption') + chip(1410, 760, 'Teks langsung tampil', k(ll, .3, .6));
    } else if (id === 'laras') {
      s = kidCard('laras', lt, { expr: 'wow', look: [.1, -.75] , armR: ll > .6 ? 'chin' : 'desk' });
      if (ll > .9) s = kidCard('laras', lt, { expr: 'joy', armR: 'desk', armL: 'desk' });
      s = `<g transform="translate(-430,0)">${s}</g>` + boardPanel(st, lt, 1000, 210, 820, 'rabbits') + chip(1410, 760, 'Gambar, bukan hanya tulisan', k(ll, .3, .6));
    } else if (id === 'tara') {
      s = kidCard('tara', lt, { expr: 'happy', look: [0, -.75], armR: 'desk', armL: 'desk', tilt: 4 });
      s = `<g transform="translate(-430,0)">${s}</g>`;
      // the classroom noise is still there, but it drifts off and fades while she follows the board
      const fade = 1 - eio(k(ll, .25, 1.7));
      [['WUUUNG', 150, 300, -8], ['TIK TOK', 760, 230, 6], ['KRIIIT', 170, 740, -4]].forEach(([tx, x, y, r], i) => {
        if (fade <= 0) return;
        const dx = (x < 460 ? -1 : 1) * 70 * (1 - fade);
        s += `<g opacity="${n(fade * .7 * 100) / 100}">${W.sfxWord(x + dx, y - 30 * (1 - fade), tx, 54 * (.6 + .4 * fade), '#8FA39A', r, 1, lt, 0)}</g>`;
      });
      s += boardPanel(st, lt, 1000, 210, 820, null) + chip(1410, 760, 'Tak perlu memilah suara', k(ll, .3, .6));
    } else {
      // Arka looks away (bird), then back: the board still holds the story
      const back2 = k(ll, .9, 1.25);
      s = kidCard('arka', lt, back2 < 1 ? { expr: 'dream', look: [.9, -.6], tilt: 6, turn: .5 } : { expr: 'joy', look: [0, -.75], armL: 'cheer' });
      if (back2 < 1) s += W.bird(1250, 300, lt, 'hop');
      s = `<g transform="translate(-430,0)">${s}</g>` + boardPanel(Object.assign({}, st, { pin: k(ll, 1.0, 1.3) }), lt, 1000, 210, 820, ll > 1.3 ? 'pin' : null) + chip(1410, 760, 'Ceritanya masih di papan', k(ll, 1.3, 1.6));
    }
    // white slice divider between the two halves
    s += W.P('M930,0 L1010,0 L970,1080 L890,1080 Z', '#FFFFFF', null);
    return s;
  };

  // =============== DEMO 2: "Lalu, dua kelinci pergi." / "Ada berapa?" / "Benar! Satu!" ===============
  SC.demo2 = function (lt, sc) {
    const p = sc.p;
    const st = board2(lt, p);
    const sp = H.speaking([['g_b', p.gb], ['g_c', p.gc], ['g_benar', p.tap + .15]], lt);
    const talk = sp ? H.amp(sp.line, sp.tl) : 0;
    const raise = lt > p.gc + 1.0 && lt < p.tap + .2;
    const cheer = lt > p.tap + .25;
    const poses = {
      bima: raise ? ['desk', lt > p.gc + 1.35 ? 'raise' : 'desk'] : cheer ? ['cheer', 'cheer'] : ['desk', 'desk'],
      arka: raise ? ['raise', 'desk'] : cheer ? ['cheer', 'cheer'] : ['desk', 'desk'],
      laras: raise ? ['desk', lt > p.gc + 1.2 ? 'raise' : 'desk'] : cheer ? ['cheer', 'desk'] : ['desk', 'desk'],
      tara: raise ? [lt > p.gc + 1.5 ? 'raise' : 'desk', 'desk'] : cheer ? ['desk', 'cheer'] : ['desk', 'desk'],
    };
    const z = lerp(1.34, 1.12, eio(k(lt, p.tap + .3, p.tap + 1.3))), cy = lerp(430, 520, eio(k(lt, p.tap + .3, p.tap + 1.3)));
    let s = cam(demoRoom(lt, st, { talk, poses, bounce: cheer, wexpr: cheer ? 'joy' : 'talk' }), 960, cy, z);
    // mouse pointer clicks the answer (projectors use a mouse or clicker)
    const cu = k(lt, p.tap - .4, p.tap - .04);
    if (cu > 0 && lt < p.tap + .7) {
      const [tx, ty] = H.toScreen(X + BW / 2, Y + BH - 62, 960, cy, z);
      const x = lerp(tx + 420, tx + 8, eio(cu)), y = lerp(ty + 300, ty + 6, eio(cu));
      const press = lt > p.tap && lt < p.tap + .12 ? .85 : 1;
      s += `<g transform="translate(${n(x)},${n(y)}) scale(${press * 1.5})">` + W.P('M0,0 L0,46 L12,35 L21,55 L30,51 L21,31 L37,31 Z', '#FFFFFF', INK, 4) + `</g>`;
    }
    return s;
  };

  // =============== payoff: the same sentence reached everyone ===============
  SC.sampai = function (lt, sc) {
    const off = .25, w = TL.words.n_sampai;
    const tS = off + w[H.findWord('n_sampai', /^sampai/)][0];
    let s = `<rect width="1920" height="1080" fill="#16302A"/>`;
    const cells = [['bima', 0, 0], ['arka', 1, 0], ['laras', 0, 1], ['tara', 1, 1]];
    cells.forEach(([id, cx, cy], i) => {
      const x = 24 + cx * 948, y = 24 + cy * 528, wd = 924, ht = 508;
      s += `<clipPath id="s${i}"><rect x="${x}" y="${y}" width="${wd}" height="${ht}" rx="28"/></clipPath><g clip-path="url(#s${i})">`;
      s += W.R(x, y, wd, ht, THEME[id], 0, null) + W.E(x + wd / 2, y + ht * .55, 380, 300, '#FFFFFF', null, 0, 'opacity=".3"');
      s += C.kid(id, { x: x + wd / 2, y: y + ht + 120, s: 1.18, crop: 'seated', t: lt, open: C.blink(lt + i, i + 2), expr: lt > tS - .3 ? 'joy' : 'happy', armR: 'desk', armL: lt > tS && i % 2 ? 'cheer' : 'desk' });
      s += `</g>` + W.R(x, y, wd, ht, 'none', 28, INK, 6);
      const u = back(k(lt, tS + i * .12, tS + .35 + i * .12));
      const ix = cx ? x + 150 : x + wd - 150, iy = y + 200;
      if (u > 0) s += `<g transform="translate(${ix},${iy}) scale(${n(u * 1000) / 1000})">` + W.E(0, 0, 74, 74, '#2F7D5B', INK, 5) + W.P('M-30,2 l20,20 38,-42', 'none', '#FFFFFF', 12) + `</g>`;
    });
    s += `<g transform="translate(960,540) scale(${n((1 + .025 * Math.sin(lt * 3.2)) * 1000) / 1000})">` +
      `<circle r="178" fill="none" stroke="${GOLD}" stroke-width="7" stroke-dasharray="20 24" stroke-linecap="round" transform="rotate(${n(lt * 38)})"/>` +
      W.E(0, 0, 150, 150, CREAM, INK, 7) + W.T(0, -14, '1', 110, G, 700) + W.T(0, 52, 'kalimat', 40, G, 600) + `</g>`;
    return s;
  };

  // =============== how it works ===============
  SC.teknis = function (lt, sc) {
    const off = .3, m = sc.p.m;
    const tw = re => off + TL.words.n_teknis[H.findWord('n_teknis', re)][0];
    const tm = re => m + TL.words.n_model[H.findWord('n_model', re)][0];
    let s = W.R(0, 0, 1920, 1080, G, 0, null);
    s += W.T(90, 108, 'CARA KERJA', 30, GOLD, 700, 'start', 'letter-spacing="3"');
    const cards = [[90, 'Suara guru', 'Web Speech API'], [540, 'Teks', 'transkripsi'], [990, 'AI memahami', 'IndoBERT kami · Gemini'], [1440, 'Adegan', 'aset terkurasi']];
    cards.forEach(([x, title, sub], i) => {
      const u = back(k(lt, .2 + i * .22, .55 + i * .22));
      if (u <= 0) return;
      s += `<g transform="translate(${x + 195},${370}) scale(${n(u * 1000) / 1000}) translate(${-(x + 195)},${-370})">`;
      s += W.R(x, 150, 390, 440, i === 2 ? '#E9B949' : CREAM, 26, INK, 5) + W.T(x + 26, 204, `${i + 1} · ${title}`, 36, G, 700, 'start') + W.T(x + 26, 566, sub, 26, '#4E5D57', 600, 'start');
      if (i === 0) { // mic + live waveform
        s += W.R(x + 160, 250, 70, 120, '#16302A', 35, INK, 5) + W.P(`M${x + 135},340 Q${x + 135},410 ${x + 195},410 Q${x + 255},410 ${x + 255},340`, 'none', INK, 6) + W.P(`M${x + 195},410 L${x + 195},450`, 'none', INK, 6);
        for (let b = 0; b < 15; b++) { const h = 12 + 34 * Math.abs(Math.sin(lt * 7 + b * .9)) * (b % 3 ? .7 : 1); s += W.R(x + 40 + b * 21, 500 - h / 2, 12, h, '#2F7D5B', 6, null); }
      }
      if (i === 1) s += W.R(x + 26, 290, 338, 150, G, 18, null) + W.T(x + 195, 345, '“ada tiga kelinci', 32, CREAM, 600) + W.T(x + 195, 395, 'berlari di rumput”', 32, CREAM, 600);
      if (i === 2) {
        [['JUMLAH', '3', /^jumlah/], ['BENDA', 'kelinci', /^benda/], ['AKSI', 'berlari', /^aksi/], ['TEMPAT', 'rumput', /^tempat/]].forEach(([kk, v, re], j) => {
          const on = k(lt, tw(re) - .1, tw(re) + .15);
          s += W.R(x + 26, 250 + j * 70, 338, 56, on > 0 ? '#FFFFFF' : 'rgba(255,255,255,.45)', 14, INK, 4) + W.T(x + 46, 288 + j * 70, kk, 24, '#7A6A3A', 700, 'start') + W.T(x + 344, 290 + j * 70, v, 32, G, 700, 'end', `opacity="${n((.25 + .75 * on) * 100) / 100}"`);
        });
      }
      if (i === 3) {
        s += `<clipPath id="tk4"><rect x="${x + 26}" y="250" width="338" height="210" rx="14"/></clipPath><g clip-path="url(#tk4)"><image href="assets/flower-garden.jpg" x="${x + 26}" y="250" width="338" height="210" preserveAspectRatio="xMidYMid slice"/>`;
        [0, 1, 2].forEach(j => { const xx = x + 90 + j * 100 + ((lt * 60 + j * 30) % 40); s += `<image href="assets/kelinci.webp" x="${n(xx - 45)}" y="${n(380 - Math.abs(Math.sin(lt * 8 + j)) * 18)}" width="90" height="72"/>`; });
        s += `</g>` + W.R(x + 26, 250, 338, 210, 'none', 14, INK, 4);
        s += W.R(x + 26, 474, 338, 50, '#FFFFFF', 14, INK, 4) + W.T(x + 195, 508, 'Pratinjau guru ✓', 26, G, 700);
      }
      s += `</g>`;
      if (i < 3) s += W.P(`M${x + 400},370 L${x + 440},370 M${x + 426},354 L${x + 442},370 L${x + 426},386`, 'none', GOLD, 8, `opacity="${n(clamp(u, 0, 1) * 100) / 100}"`);
    });
    // own model vs LLM
    const mk = k(lt, tm(/^IndoBERT/) - .2, tm(/^IndoBERT/) + .3);
    if (mk > 0) {
      const bx = 90, by = 640;
      s += `<g opacity="${n(eo(mk) * 100) / 100}">` + W.R(bx, by, 1740, 230, 'rgba(255,255,255,.07)', 26, null);
      const grow = eio(k(lt, tm(/^sama/) - .2, tm(/^akurat/) + .4));
      const BL = 760;
      s += W.T(bx + 40, by + 70, 'IndoBERT kami', 34, CREAM, 700, 'start') + W.R(bx + 380, by + 40, Math.max(6, BL * 7.9 / 760 * grow), 44, GOLD, 10, null) + W.T(bx + 400 + BL * 7.9 / 760 * grow, by + 74, '7,9 ms', 32, GOLD, 700, 'start') +
        W.T(bx + 1300, by + 74, '38/40 benar', 30, CREAM, 600, 'start');
      s += W.T(bx + 40, by + 160, 'LLM Qwen2.5-7B', 34, CREAM, 700, 'start') + W.R(bx + 380, by + 130, BL * grow, 44, '#7E9A90', 10, null) + W.T(bx + 400 + BL * grow, by + 164, '760 ms', 32, '#C9D6CF', 700, 'start') +
        W.T(bx + 1300, by + 164, '38/40 benar', 30, CREAM, 600, 'start') + `</g>`;
      const nb = k(lt, tm(/^96/) - .1, tm(/^96/) + .3);
      if (nb > 0) s += `<g transform="translate(1712,${by + 112}) scale(${n((.5 + .5 * back(nb)) * 1000) / 1000}) rotate(-6)">` + W.E(0, 0, 118, 92, GOLD, INK, 6) + W.T(0, 22, '96×', 74, G, 700) + W.T(0, 66, 'lebih cepat', 22, G, 700) + `</g>`;
    }
    s += `<g opacity="${n(eo(k(lt, tm(/^IndoBERT/), tm(/^IndoBERT/) + .5)) * 100) / 100}">` +
      W.T(90, 912, 'Uji internal 40 kalimat tim (13 Okt 2026), latensi median di laptop RTX 5060. Demo online memakai Gemini; IndoBERT berjalan lokal.', 22, '#9FB3AB', 500, 'start') + `</g>`;
    return s;
  };

  // =============== close ===============
  SC.akhir = function (lt, sc) {
    const off = .45, w = TL.words.n_akhir;
    const tK = off + w[H.findWord('n_akhir', /^Karena/)][0];
    let s = W.R(0, 0, 1920, 1080, G, 0, null);
    for (let i = 0; i < 22; i++) s += W.E(W.hash(i) * 1920, W.hash(i + 7) * 700, 3 + W.hash(i + 2) * 4, 3 + W.hash(i + 2) * 4, GOLD, null, 0, `opacity="${n((.2 + .25 * Math.sin(lt * 3 + i)) * 100) / 100}"`);
    const lg = k(lt, .2, .65);
    s += `<g transform="translate(960,190) scale(${n((.5 + .5 * back(lg)) * 1000) / 1000})" opacity="${n(clamp(lg * 3, 0, 1) * 100) / 100}">` + W.T(0, 0, 'SUARA PAPAN', 132, GOLD, 700, 'middle', `stroke="${INK}" stroke-width="13" paint-order="stroke" stroke-linejoin="round"`) + `</g>`;
    const tg = eo(k(lt, tK - .1, tK + .4));
    s += `<g opacity="${n(tg * 100) / 100}" transform="translate(0,${n((1 - tg) * 14)})">` + W.T(960, 290, 'Setiap siswa berhak memahami pelajaran.', 56, CREAM, 600) + `</g>`;
    const ul = eo(k(lt, tK + .5, tK + .9));
    s += `<g opacity="${n(ul * 100) / 100}">` + W.R(960 - 260, 330, 520, 64, GOLD, 32, null) + W.T(960, 374, 'suarapapan.vercel.app', 36, G, 700) + `</g>`;
    // the whole cast, waving
    const cast = [['arka', 330], ['bima', 600], ['laras', 1320], ['tara', 1590]];
    s += W.E(960, 1012, 900, 34, 'rgba(0,0,0,.25)');
    cast.forEach(([id, x], i) => {
      const u = eo(k(lt, .25 + i * .1, .7 + i * .1));
      s += C.kid(id, { x, y: 835 + (1 - u) * 300, s: .72, t: lt + i, expr: 'joy', armR: 'down', armL: 'wave', open: C.blink(lt, i + 2) });
    });
    const wu = eo(k(lt, .15, .6));
    s += C.wulan({ x: 960, y: 760 + (1 - wu) * 320, s: .7, t: lt, expr: 'happy', armL: 'wave', armR: 'down', open: C.blink(lt, 3) });
    s += `<g opacity="${n(eo(k(lt, tK + .9, tK + 1.3)) * 100) / 100}">` + W.T(960, 1058, 'Tim: Ata · Adi · Amira · Gwen   ·   Hackathon Dies Natalis ke-71 FMIPA UGM 2026', 26, '#C9D6CF', 600) + `</g>`;
    // gentle fade out on the last 0.6 s
    const fo = k(lt, sc.dur - .6, sc.dur);
    if (fo > 0) s += `<rect width="1920" height="1080" fill="#0B1714" opacity="${n(fo * 100) / 100}"/>`;
    return s;
  };
})();
