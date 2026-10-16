// scenes_mid.js: the problem in numbers (one idea per beat), the root cause, and the solution reveal.
(function () {
  const { k, eo, eio, ei, back, kf, cam, n, clamp, lerp } = H;
  const W = WORLD, C = CAST;
  const G = '#16302A', CREAM = '#F3F1EA', RED = '#C0503A', GOLD = '#E9B949', SAGE = '#A9C9BA', GREY = '#CFCAC0', INK = '#2E2420';
  window.EXTRA_DEFS = (window.EXTRA_DEFS || '') + `
    <pattern id="dots" width="34" height="34" patternUnits="userSpaceOnUse"><circle cx="17" cy="17" r="2.3" fill="#E1DCCD"/></pattern>`;

  // word time (scene-local) helper for a narration cue that starts at `off`
  const wt = (line, off, re, nth = 0) => off + TL.words[line][H.findWord(line, re, nth)][0];

  function paper() { return W.R(0, 0, 1920, 1080, CREAM, 0, null) + W.R(0, 0, 1920, 1080, 'url(#dots)', 0, null); }
  function kicker(txt, lt, col = RED, x = 90, y = 70) {
    const u = eo(k(lt, .05, .35));
    const w = W.tw(txt, 30, 700) + 2 * txt.length + 44;
    return `<g opacity="${n(u * 100) / 100}" transform="translate(${n((1 - u) * -30)},0)">` + W.R(x, y, w, 52, col, 14, null) + W.T(x + 20, y + 37, txt, 30, '#FFFFFF', 700, 'start', 'letter-spacing="2"') + `</g>`;
  }
  function source(txt, lt, y = 905) {
    return `<g opacity="${n(eo(k(lt, .3, .7)) * 100) / 100}">` + W.T(90, y, txt, 23, '#7A7468', 500, 'start') + `</g>`;
  }
  function hero(x, y, txt, size, col, u, anchor = 'start') {
    if (u <= 0) return '';
    const sc = .55 + .45 * back(u);
    return `<g transform="translate(${x},${y}) scale(${n(sc * 1000) / 1000})" opacity="${n(clamp(u * 3, 0, 1) * 100) / 100}">` + W.T(0, 0, txt, size, col, 700, anchor) + `</g>`;
  }
  function label(x, y, lines, size, col, u, w = 600) {
    if (u <= 0) return '';
    return `<g opacity="${n(eo(u) * 100) / 100}" transform="translate(0,${n((1 - eo(u)) * 16)})">` + lines.map((l, i) => W.T(x, y + i * size * 1.22, l, size, col, w, 'start')).join('') + `</g>`;
  }
  // tiny generic pupil icon (for pictograms)
  function pupil(x, y, s, col) {
    return `<g transform="translate(${n(x)},${n(y)}) scale(${s})">` + W.E(0, -58, 26, 26, col, INK, 4) + W.P('M-34,0 Q-34,-28 0,-28 Q34,-28 34,0 L34,14 L-34,14 Z', col, INK, 4) + `</g>`;
  }
  function school(x, y, s, col, roof) {
    return `<g transform="translate(${n(x)},${n(y)}) scale(${s})">` + W.R(-20, -18, 40, 30, col, 3, INK, 3) + W.P('M-26,-16 L0,-36 L26,-16 Z', roof, INK, 3) + W.R(-6, -2, 12, 14, '#FFFFFF', 2, null, 0, 'opacity=".75"') + `</g>`;
  }
  function bookIcon(x, y, s, col) {
    return `<g transform="translate(${n(x)},${n(y)}) scale(${s})">` + W.P('M-50,-36 Q-25,-46 0,-34 Q25,-46 50,-36 L50,30 Q25,20 0,32 Q-25,20 -50,30 Z', col, INK, 5) + W.P('M0,-34 L0,32', 'none', INK, 4) +
      W.P('M-38,-18 Q-22,-24 -10,-18 M-38,-4 Q-22,-10 -10,-4 M10,-18 Q24,-24 38,-18 M10,-4 Q24,-10 38,-4', 'none', 'rgba(46,36,32,.45)', 3) + `</g>`;
  }
  function room(x, y, s, state) { // classroom icon: state 0 ok, 1 damaged, 2 heavily damaged
    const wall = state === 2 ? '#F2B5A8' : state === 1 ? '#F8D9A8' : '#FFFFFF';
    let g = W.R(-42, -40, 84, 70, wall, 6, INK, 4) + W.P('M-50,-38 L0,-66 L50,-38 Z', state ? '#B0A595' : '#D6343C', INK, 4) + W.R(-26, -24, 22, 18, '#9ED8F2', 3, INK, 3) + W.R(8, -6, 20, 36, '#A8743F', 3, INK, 3);
    if (state) g += W.P('M-8,-38 L-2,-22 L-14,-10 L-4,6', 'none', INK, 3.5) + W.P('M26,-36 L20,-24 L30,-14', 'none', INK, 3);
    if (state === 2) g += W.P('M-40,30 L-30,18 L-18,30 M18,30 L28,20 L40,30', '#B0A595', INK, 3);
    return `<g transform="translate(${n(x)},${n(y)}) scale(${s})">${g}</g>`;
  }

  // =============== 166.242 PDBK in SLB ===============
  SC.pdbk = function (lt, sc) {
    const off = sc.p && sc.p.off || .35;
    let s = paper() + kicker('DATA · SLB 2025/2026', lt);
    const tNum = wt('n_s1', .35, /^166/);
    s += hero(90, 400, '166.242', 210, G, k(lt, tNum - .15, tNum + .35));
    s += label(96, 490, ['peserta didik berkebutuhan', 'khusus di SLB'], 50, G, k(lt, tNum + .3, tNum + .8));
    const bars = [['Tunagrahita', 84453, SAGE], ['Tunarungu', 25597, '#2F6FB5'], ['Autis', 23251, '#2E8C80'], ['Tunadaksa', 6091, SAGE], ['Tunanetra', 4229, SAGE], ['Lainnya', 22621, SAGE]];
    const x0 = 1170, y0 = 210, bw = 600;
    bars.forEach(([nm, v, col], i) => {
      const y = y0 + i * 92;
      const u = eio(k(lt, .45 + i * .16, 1.05 + i * .16));
      s += W.T(x0 - 22, y + 34, nm, 32, i === 1 || i === 2 ? G : '#5E6B66', i === 1 || i === 2 ? 700 : 500, 'end');
      s += W.R(x0, y + 4, bw, 44, '#E8E3D6', 10, null) + W.R(x0, y + 4, Math.max(.01, bw * v / 84453 * u), 44, col, 10, null);
      if (u > .95) s += W.T(x0 + bw * v / 84453 + 14, y + 37, v.toLocaleString('id-ID'), 30, '#3D4A45', 600, 'start');
    });
    // the two kids whose groups appear in this data
    const kk = eo(k(lt, 1.3, 1.7));
    if (kk > 0) {
      // small portraits in a column left of the labels (clipped to a circle)
      const head = (id, y) => `<clipPath id="hc${id}"><circle cx="${x0 - 252}" cy="${y}" r="38"/></clipPath>` + W.E(x0 - 252, y, 40, 40, id === 'bima' ? '#9ED8F2' : '#A9D3C0', INK, 4) +
        `<g clip-path="url(#hc${id})"><g transform="translate(${x0 - 252},${y + 92}) scale(.33)">${C.kid(id, { crop: 'bust', expr: 'happy', open: C.blink(lt, 5) })}</g></g>` + W.E(x0 - 252, y, 40, 40, 'none', INK, 4);
      s += `<g opacity="${n(kk * 100) / 100}">${head('bima', y0 + 92 + 26)}${head('tara', y0 + 184 + 26)}</g>`;
    }
    s += label(1170 - 260, 790, ['ADHD dan disleksia tidak tercakup dalam data ini.'], 26, '#7A7468', k(lt, 1.6, 2.0), 500);
    s += source('Sumber: Kemendikdasmen, Statistik SLB 2025/2026 (data per 30 Nov 2025), via GoodStats.', lt);
    return s;
  };

  // =============== 85,2% schools without a GPK ===============
  SC.gpk = function (lt, sc) {
    let s = paper() + kicker('GURU PEMBIMBING KHUSUS (GPK)', lt);
    const t85 = wt('n_s2', .35, /^85/), t100 = wt('n_s2', .35, /^100/), tBelum = wt('n_s2', .35, /^belum/);
    s += hero(90, 400, '85,2%', 230, RED, k(lt, t85 - .2, t85 + .3));
    s += label(96, 490, ['sekolah dengan siswa berkebutuhan', 'khusus belum punya GPK'], 48, G, k(lt, t85 + .3, t85 + .8));
    s += label(96, 640, ['34.208 dari 40.164 sekolah.', 'Hanya 5.956 yang punya GPK.'], 32, '#5E6B66', k(lt, tBelum - .2, tBelum + .3), 500);
    // 100 schools, 15 with a GPK (85,2% rounded to 85 of 100)
    const gx = 1150, gy = 200, step = 66;
    for (let i = 0; i < 100; i++) {
      const r = Math.floor(i / 10), c = i % 10;
      const appear = back(k(lt, .5 + (r + c) * .035, .8 + (r + c) * .035));
      if (appear <= 0) continue;
      const has = [3, 8, 14, 21, 27, 35, 42, 48, 56, 61, 67, 74, 83, 89, 95].includes(i);
      const grey = !has && lt > t100 + .25 + (i % 10) * .05;
      s += school(gx + c * step, gy + r * step, .9 * appear, has ? '#7CC4A8' : grey ? '#E4DFD4' : '#FFFFFF', has ? '#2F7D5B' : grey ? GREY : '#D6343C');
    }
    const lg = eo(k(lt, t100 + .5, t100 + .9));
    s += `<g opacity="${n(lg * 100) / 100}">` + school(1160, 852, .8, '#7CC4A8', '#2F7D5B') + W.T(1190, 862, 'ada GPK', 28, G, 600, 'start') +
      school(1380, 852, .8, '#E4DFD4', GREY) + W.T(1410, 862, 'belum ada GPK', 28, G, 600, 'start') + W.T(1150, 905, '15 dari 100, dibulatkan dari 14,8%', 22, '#7A7468', 500, 'start') + `</g>`;
    s += source('Sumber: Kemendikbudristek/Dapodik (Des 2023), dikutip BBGTK Sumatera Utara, 27 Jan 2026.', lt);
    return s;
  };

  // =============== PISA 2022: 82% math, 75% reading ===============
  SC.pisa = function (lt, sc) {
    let s = paper() + kicker('PISA 2022 · SISWA USIA 15 TAHUN', lt);
    const t8 = wt('n_s3', .35, /^Delapan/), t3 = wt('n_s3', .35, /^tiga/);
    // "Bukan hanya mereka": the four kids, then the crowd around them
    const crowdK = eio(k(lt, .9, 1.9));
    const introOut = 1 - eio(k(lt, t8 - .5, t8 - .1));
    if (introOut > 0) {
      let g = '';
      for (let i = 0; i < 42; i++) {
        const a = W.hash(i) * Math.PI * 2, d = 330 + W.hash(i + 3) * 520;
        const x = 960 + Math.cos(a) * d * 1.3, y = 560 + Math.sin(a) * d * .55;
        g += `<g opacity="${n(crowdK * 100) / 100}">${pupil(x, y + (1 - crowdK) * 40, .9, ['#F49A8E', '#9ED8F2', '#F6C744', '#A9D3C0'][i % 4])}</g>`;
      }
      ['bima', 'arka', 'laras', 'tara'].forEach((id, i) => g += `<g transform="translate(${n(660 + i * 200)},${n(700)}) scale(${n((.52 - .14 * crowdK) * 100) / 100})">${C.kid(id, { crop: 'bust', expr: 'happy', open: C.blink(lt, i + 3) })}</g>`);
      s += `<g opacity="${n(introOut * 100) / 100}">${g}</g>`;
    }
    // left card: maths
    const a1 = k(lt, t8 - .2, t8 + .3);
    if (a1 > 0) {
      s += `<g opacity="${n(eo(a1) * 100) / 100}">` + W.R(70, 160, 860, 700, '#FFFFFF', 34, INK, 5) + W.T(120, 240, 'Matematika', 44, G, 700, 'start') + `</g>`;
      s += hero(120, 450, '82%', 200, RED, a1);
      s += label(126, 530, ['belum mencapai Level 2', '(kemampuan dasar)'], 40, G, k(lt, t8 + .3, t8 + .7));
      for (let i = 0; i < 10; i++) {
        const grey = i < 8 && lt > t8 + .25 + i * .07;
        s += pupil(150 + i * 80, 760, .9 * eo(k(lt, t8 + i * .05, t8 + .3 + i * .05)), grey ? GREY : '#2E8C80');
      }
      const ob = eio(k(lt, t8 + 1.2, t8 + 1.9));
      s += `<g opacity="${n(ob * 100) / 100}">` + W.T(560, 400, 'Indonesia', 26, '#5E6B66', 600, 'start') + W.R(560, 412, 300 * 366 / 472 * ob, 30, RED, 8, null) + W.T(570 + 300 * 366 / 472 * ob, 436, '366', 28, RED, 700, 'start') +
        W.T(560, 300, 'Rata-rata OECD', 26, '#5E6B66', 600, 'start') + W.R(560, 312, 300 * ob, 30, SAGE, 8, null) + W.T(570 + 300 * ob, 336, '472', 28, G, 700, 'start') + `</g>`;
    }
    // right card: reading
    const a2 = k(lt, t3 - .25, t3 + .25);
    if (a2 > 0) {
      s += `<g opacity="${n(eo(a2) * 100) / 100}" transform="translate(${n((1 - eo(a2)) * 60)},0)">` + W.R(990, 160, 860, 700, '#FFFFFF', 34, INK, 5) + W.T(1040, 240, 'Membaca', 44, G, 700, 'start') + `</g>`;
      s += hero(1040, 450, '75%', 200, RED, a2);
      s += label(1046, 530, ['di bawah standar', 'membaca PISA'], 40, G, k(lt, t3 + .3, t3 + .7));
      for (let i = 0; i < 4; i++) s += bookIcon(1150 + i * 180, 760, 1.05 * eo(k(lt, t3 + i * .06, t3 + .3 + i * .06)), i < 3 && lt > t3 + .3 + i * .1 ? GREY : GOLD);
    }
    s += source('Sumber: OECD, PISA 2022 Results, Country Note Indonesia (2023). 82% = 100% − 18% siswa di Level 2 ke atas.', lt);
    return s;
  };

  // =============== regional gap (AN 2024) + damaged SD classrooms ===============
  SC.timpang = function (lt, sc) {
    let s = paper() + kicker('KESENJANGAN', lt);
    const t70 = wt('n_s4', .35, /^70/), t40 = wt('n_s4', .35, /^40/), t6 = wt('n_s4', .35, /^enam/);
    // left: AN 2024
    s += W.R(70, 160, 860, 700, '#FFFFFF', 34, INK, 5);
    s += label(120, 232, ['Siswa SMP/MTs yang mencapai standar', 'minimum literasi & numerasi'], 36, G, k(lt, .3, .8));
    const b1 = eio(k(lt, t70 - .25, t70 + .4)), b2 = eio(k(lt, t40 - .3, t40 + .35));
    const base = 760, top = 380, hmax = base - top;
    s += `<line x1="140" y1="${base}" x2="860" y2="${base}" stroke="${INK}" stroke-width="4"/>`;
    if (b1 > 0) s += W.R(220, base - hmax * .7 * b1, 220, hmax * .7 * b1, '#2F7D5B', 14, INK, 4) + (b1 > .9 ? W.T(330, base - hmax * .7 - 22, '70%', 74, '#2F7D5B', 700) : '') + W.T(330, base + 44, 'Sebagian wilayah', 30, G, 600);
    if (b2 > 0) s += W.R(560, base - hmax * .38 * b2, 220, hmax * .38 * b2, RED, 14, INK, 4) + (b2 > .9 ? W.T(670, base - hmax * .4 - 26, '< 40%', 70, RED, 700) : '') + W.T(670, base + 44, 'Wilayah lain', 30, G, 600) +
      `<line x1="530" y1="${n(base - hmax * .4)}" x2="810" y2="${n(base - hmax * .4)}" stroke="${RED}" stroke-width="4" stroke-dasharray="12 10" opacity="${n(b2 * 100) / 100}"/>`;
    // right: 6 of 10 SD classrooms damaged
    const a2 = k(lt, t6 - .45, t6 + .1);
    if (a2 > 0) {
      s += `<g opacity="${n(eo(a2) * 100) / 100}" transform="translate(${n((1 - eo(a2)) * 60)},0)">` + W.R(990, 160, 860, 700, '#FFFFFF', 34, INK, 5) + `</g>`;
      s += hero(1040, 400, '6 dari 10', 150, RED, k(lt, t6 - .2, t6 + .3));
      s += label(1046, 470, ['ruang kelas SD dalam kondisi rusak'], 38, G, k(lt, t6 + .3, t6 + .7));
      const states = [1, 0, 1, 2, 0, 1, 1, 0, 1, 0]; // 6 damaged, 1 of them heavily (60,3% / 10,81%)
      states.forEach((st, i) => {
        const x = 1110 + (i % 5) * 160, y = 620 + Math.floor(i / 5) * 150;
        const show = eo(k(lt, t6 + i * .05, t6 + .3 + i * .05));
        const dmg = lt > t6 + .5 + i * .06 ? st : 0;
        s += room(x, y, 1.05 * show, dmg);
      });
      s += label(1046, 840, ['rusak ringan 27% · sedang 22% · berat 11%'], 26, '#5E6B66', k(lt, t6 + 1.0, t6 + 1.4), 500);
    }
    s += source('Sumber: Asesmen Nasional 2024 (disampaikan Mendikdasmen); BPS, Statistik Pendidikan 2025 / Kemendikdasmen, TA 2024/2025.', lt);
    return s;
  };

  // =============== root cause: one channel ===============
  const KIDROW = [['bima', 1010], ['arka', 1250], ['laras', 1490], ['tara', 1730]];
  function barrierIcon(id, x, y, u, lt) {
    if (u <= 0) return '';
    let g = W.E(0, 0, 44, 44, '#FFFFFF', INK, 4);
    if (id === 'bima') g += W.P('M-20,-8 L-8,-8 L5,-20 L5,20 L-8,8 L-20,8 Z', '#2F6FB5', INK, 3) + W.P('M12,-10 L26,10 M26,-10 L12,10', 'none', '#D6343C', 5);
    if (id === 'arka') g += W.bird(2, 4, lt, 'sit');
    if (id === 'laras') g += W.T(-11, 15, 'b', 40, '#C0503A', 700) + `<text transform="translate(13,15) scale(-1,1)" font-family="Fredoka" font-size="40" font-weight="700" fill="#2F6FB5" text-anchor="middle">b</text>`;
    if (id === 'tara') g += W.P('M-24,0 q6,-16 12,0 t12,0 t12,0 t12,0', 'none', '#2E8C80', 5) + W.P('M-18,-16 q5,-10 10,0 t10,0 t10,0', 'none', '#C0503A', 4) + W.P('M-18,17 q5,-10 10,0 t10,0 t10,0', 'none', '#C98A12', 4);
    return `<g transform="translate(${n(x)},${n(y)}) scale(${n(back(u) * 100) / 100})">${g}</g>`;
  }
  SC.akar = function (lt, sc) {
    const off = .35;
    let s = paper();
    const tPel = wt('n_akar', off, /^Pelajaran/), tSatu = wt('n_akar', off, /^satu/), tSuara = wt('n_akar', off, /^suara/);
    s += W.E(960, 1010, 980, 90, 'rgba(46,36,32,.08)');
    // teacher speaking on the left
    s += C.wulan({ x: 380, y: 560, s: .82, t: lt, expr: 'talk', mouth: 'smile', talk: 0, open: C.blink(lt, 3), armL: lt > tPel ? 'open' : 'hold', armR: 'down', tilt: 3 });
    // kids on the right, behind one long desk, happy: the problem is not them
    KIDROW.forEach(([id, x], i) => {
      s += C.kid(id, { x, y: 900, s: .78, crop: 'seated', t: lt, expr: lt < tPel + .6 ? 'happy' : 'neutral', open: C.blink(lt, i + 2), look: [-.6, -.1], armR: 'desk', armL: 'desk' });
    });
    s += W.R(880, 840, 990, 30, '#C38B52', 12, INK, 5) + W.R(900, 868, 950, 120, '#A8743F', 8, INK, 5);
    // sparkle over each kid while "bukan pada anak-anaknya"
    KIDROW.forEach(([id, x], i) => {
      const u = k(lt, .9 + i * .12, 1.3 + i * .12) * (1 - k(lt, tPel - .2, tPel + .2));
      if (u > 0) s += W.P(`M${x + 70},${n(560 - u * 30)} l8,18 18,8 -18,8 -8,18 -8,-18 -18,-8 18,-8 Z`, GOLD, INK, 3, `opacity="${n(Math.sin(u * Math.PI) * 100) / 100}"`);
    });
    // the single sound ribbon from her mouth, fanning out to the four kids and breaking at each barrier
    const rib = eio(k(lt, tPel - .1, tSatu + .3));
    if (rib > 0) {
      const mx = 380 + 0, my = 560 - 300 * .82 + 46;
      const wave = (x0, y0, x1, y1, u, ph) => {
        let d = `M${x0},${y0}`;
        const N = 40;
        for (let i = 1; i <= N * u; i++) { const t = i / N; const x = lerp(x0, x1, t), y = lerp(y0, y1, t) + Math.sin(t * 22 + lt * 6 + ph) * 12 * Math.sin(t * Math.PI); d += ` L${n(x)},${n(y)}`; }
        return d;
      };
      s += `<path d="${wave(mx + 60, my, 760, 420, Math.min(1, rib * 1.6), 0)}" fill="none" stroke="${GOLD}" stroke-width="16" stroke-linecap="round" opacity=".95"/>`;
      KIDROW.forEach(([id, x], i) => {
        const u = clamp(rib * 1.6 - .6 - i * .1, 0, 1);
        if (u > 0) s += `<path d="${wave(760, 420, x - 40, 470, u, i)}" fill="none" stroke="${GOLD}" stroke-width="7" stroke-linecap="round" stroke-dasharray="${id === 'bima' ? '6 14' : 'none'}" opacity=".9"/>`;
        s += barrierIcon(id, x - 40, 470, k(lt, tSatu + i * .12, tSatu + .35 + i * .12), lt);
      });
    }
    const lab = eo(k(lt, tSuara - .25, tSuara + .2));
    if (lab > 0) s += `<g opacity="${n(lab * 100) / 100}">` + W.R(560, 170, 520, 92, G, 46, null) + W.T(820, 232, '1 jalur: suara guru', 50, '#FFFFFF', 700) + `</g>`;
    return s;
  };

  // slow camera drift on the data beats so no shot ever sits frozen while the narration runs
  ['pdbk', 'gpk', 'pisa', 'timpang', 'akar'].forEach(id => {
    const f = SC[id];
    SC[id] = (lt, sc) => {
      const z = 1 + .035 * clamp(lt / sc.dur, 0, 1);
      return `<g transform="translate(960,540) scale(${Math.round(z * 10000) / 10000}) translate(-960,-540)">${f(lt, sc)}</g>`;
    };
  });

  // =============== solution reveal ===============
  SC.solusi = function (lt, sc) {
    const off = .6;
    const tSP = wt('n_solusi', off, /^Suara/), tGuru = wt('n_solusi', off, /^guru/), tPapan2 = wt('n_solusi', off, /^papan/, 0);
    let s = W.R(0, 0, 1920, 1080, G, 0, null);
    for (let i = 0; i < 18; i++) s += W.E(W.hash(i) * 1920, W.hash(i + 7) * 1080, 3 + W.hash(i + 2) * 4, 3 + W.hash(i + 2) * 4, GOLD, null, 0, `opacity="${n((.25 + .25 * Math.sin(lt * 3 + i)) * 100) / 100}"`);
    // board frame draws in
    const f = eio(k(lt, .1, .9));
    const bw = 1100 * f, bh = 560 * f;
    if (f > 0) s += W.R(960 - bw / 2 - 26, 470 - bh / 2 - 26, bw + 52, bh + 52, '#8A5A3A', 30, INK, 6) + W.R(960 - bw / 2, 470 - bh / 2, bw, bh, '#2F5D50', 14, INK, 5);
    // logo
    const lg = k(lt, tSP - .15, tSP + .35);
    if (lg > 0) {
      const sc2 = .5 + .5 * back(lg);
      s += `<g transform="translate(960,${n(430)}) scale(${n(sc2 * 1000) / 1000})" opacity="${n(clamp(lg * 3, 0, 1) * 100) / 100}">` +
        W.T(0, 0, 'SUARA PAPAN', 150, GOLD, 700, 'middle', `stroke="${INK}" stroke-width="14" paint-order="stroke" stroke-linejoin="round"`) + `</g>`;
    }
    // tagline types in with the narration
    const tag = 'Guru bicara, papan bercerita.';
    const tk = k(lt, tGuru - .1, tPapan2 + .9);
    if (tk > 0) s += W.T(960, 560, tag.slice(0, Math.ceil(tag.length * tk)), 62, '#F3F1EA', 600);
    // little cast at the bottom edge of the board, cheering softly
    const ck = eo(k(lt, tSP + .3, tSP + .8));
    if (ck > 0) [['bima', 120], ['arka', 290], ['laras', 1630], ['tara', 1800]].forEach(([id, x], i) => {
      s += `<g opacity="${n(ck * 100) / 100}">${C.kid(id, { x, y: 1060 - ck * 50, s: .52, crop: 'seated', t: lt, expr: 'joy', armR: i % 2 ? 'cheer' : 'desk', armL: i % 2 ? 'desk' : 'cheer', open: C.blink(lt, i + 1) })}</g>`;
    });
    return s;
  };
})();
