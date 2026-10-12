// Pustaka gambar benda. Semua digambar dengan bentuk sederhana dalam gaya yang
// sama (viewBox 200×160), supaya adegan terasa konsisten bagi siswa autis.
// Benda yang belum punya gambar memakai emoji + label teks.

const KAPUR = '#F3F4EE';
const PAPAN = '#16302A';
const WARNA_BALON = ['#E9B949', '#E07A5F', '#7FC4A8', '#8FB3E8', '#D99BD0'];

const GAMBAR = {
  kelinci: () => (
    <>
      <g fill={KAPUR}>
        <ellipse cx="140" cy="32" rx="9" ry="30" transform="rotate(-15 140 32)" />
        <ellipse cx="160" cy="30" rx="9" ry="30" transform="rotate(12 160 30)" />
        <ellipse cx="95" cy="108" rx="60" ry="40" />
        <circle cx="150" cy="78" r="28" />
        <circle cx="34" cy="98" r="13" />
        <ellipse cx="72" cy="146" rx="22" ry="8" />
        <ellipse cx="128" cy="146" rx="22" ry="8" />
      </g>
      <circle cx="160" cy="72" r="4" fill={PAPAN} />
    </>
  ),
  apel: () => (
    <>
      <path d="M100 48 C70 30 36 50 40 92 C44 132 74 154 100 140 C126 154 156 132 160 92 C164 50 130 30 100 48Z" fill="#E07A5F" />
      <rect x="96" y="22" width="8" height="30" rx="4" fill="#8A5F3C" />
      <ellipse cx="124" cy="30" rx="20" ry="9" transform="rotate(-25 124 30)" fill="#7FC4A8" />
      <ellipse cx="72" cy="80" rx="8" ry="16" fill="#F3B3A3" opacity="0.7" />
    </>
  ),
  balon: (i) => (
    <>
      <ellipse cx="100" cy="62" rx="42" ry="52" fill={WARNA_BALON[i % WARNA_BALON.length]} />
      <path d="M94 112 L106 112 L100 120Z" fill={WARNA_BALON[i % WARNA_BALON.length]} />
      <path d="M100 120 C92 132 108 142 100 158" stroke={KAPUR} strokeWidth="3" fill="none" />
      <ellipse cx="84" cy="44" rx="8" ry="14" fill="#FFFFFF" opacity="0.35" />
    </>
  ),
  ikan: () => (
    <>
      <path d="M150 80 L192 50 L192 110Z" fill="#E9B949" />
      <ellipse cx="100" cy="80" rx="62" ry="38" fill="#F2A65A" />
      <path d="M86 46 Q100 26 118 46Z" fill="#E9B949" />
      <circle cx="62" cy="72" r="7" fill={KAPUR} />
      <circle cx="60" cy="72" r="3.5" fill={PAPAN} />
    </>
  ),
  kucing: () => (
    <>
      <g fill="#E8C9A0">
        <path d="M30 120 C10 100 20 70 36 82" stroke="#E8C9A0" strokeWidth="10" fill="none" strokeLinecap="round" />
        <ellipse cx="88" cy="112" rx="56" ry="36" />
        <circle cx="146" cy="76" r="32" />
        <path d="M120 56 L126 22 L146 48Z" />
        <path d="M172 56 L166 22 L146 48Z" />
        <ellipse cx="64" cy="146" rx="18" ry="8" />
        <ellipse cx="114" cy="146" rx="18" ry="8" />
      </g>
      <circle cx="136" cy="74" r="4" fill={PAPAN} />
      <circle cx="158" cy="74" r="4" fill={PAPAN} />
      <path d="M142 88 L147 92 L152 88" stroke={PAPAN} strokeWidth="3" fill="none" />
    </>
  ),
  burung: () => (
    <>
      <ellipse cx="96" cy="88" rx="52" ry="38" fill="#8FB3E8" />
      <circle cx="146" cy="62" r="26" fill="#8FB3E8" />
      <path d="M170 60 L194 66 L170 72Z" fill="#E9B949" />
      <path d="M60 80 Q96 40 124 84Z" fill="#6E95CF" />
      <path d="M46 92 L14 76 L20 104Z" fill="#6E95CF" />
      <circle cx="152" cy="56" r="4" fill={PAPAN} />
    </>
  ),
  bintang: () => (
    <path d="M100 12 L121 60 L174 64 L134 99 L146 150 L100 123 L54 150 L66 99 L26 64 L79 60Z" fill="#E9B949" />
  ),
  bola: () => (
    <>
      <circle cx="100" cy="82" r="62" fill={KAPUR} />
      <path d="M40 70 Q100 100 160 70" stroke="#E07A5F" strokeWidth="12" fill="none" />
      <path d="M44 104 Q100 130 156 104" stroke="#8FB3E8" strokeWidth="12" fill="none" />
    </>
  ),
  bunga: () => (
    <>
      <rect x="96" y="80" width="8" height="78" fill="#7FC4A8" />
      <ellipse cx="78" cy="122" rx="20" ry="8" transform="rotate(-30 78 122)" fill="#7FC4A8" />
      <g fill="#D99BD0">
        <circle cx="100" cy="34" r="22" /><circle cx="134" cy="58" r="22" /><circle cx="122" cy="96" r="22" />
        <circle cx="78" cy="96" r="22" /><circle cx="66" cy="58" r="22" />
      </g>
      <circle cx="100" cy="66" r="18" fill="#E9B949" />
    </>
  ),
  mobil: () => (
    <>
      <path d="M50 70 L70 36 L134 36 L154 70Z" fill="#8FB3E8" />
      <rect x="20" y="68" width="164" height="50" rx="14" fill="#E07A5F" />
      <rect x="76" y="44" width="22" height="22" fill={KAPUR} opacity="0.8" />
      <rect x="106" y="44" width="22" height="22" fill={KAPUR} opacity="0.8" />
      <circle cx="58" cy="124" r="20" fill="#2B2B2B" /><circle cx="58" cy="124" r="8" fill={KAPUR} />
      <circle cx="148" cy="124" r="20" fill="#2B2B2B" /><circle cx="148" cy="124" r="8" fill={KAPUR} />
    </>
  ),
};

// Sinonim sederhana supaya kata yang mirip tetap mendapat gambar yang sama.
const SINONIM = { kelinci: ['kelinci', 'arnab'], kucing: ['kucing', 'meong'], burung: ['burung', 'burung-burung'], balon: ['balon'], mobil: ['mobil', 'mobil-mobilan'] };
const PETA_SINONIM = Object.fromEntries(Object.entries(SINONIM).flatMap(([k, v]) => v.map((s) => [s, k])));

const EMOJI = {
  anjing: '🐕', ayam: '🐔', bebek: '🦆', sapi: '🐄', kambing: '🐐', gajah: '🐘', monyet: '🐒', katak: '🐸',
  'kura-kura': '🐢', kupu: '🦋', 'kupu-kupu': '🦋', semut: '🐜', lebah: '🐝', siput: '🐌', ular: '🐍', kuda: '🐎',
  pisang: '🍌', jeruk: '🍊', mangga: '🥭', anggur: '🍇', semangka: '🍉', stroberi: '🍓', wortel: '🥕', jagung: '🌽',
  kue: '🍰', roti: '🍞', permen: '🍬', telur: '🥚', pizza: '🍕', es: '🍦', donat: '🍩',
  pensil: '✏️', buku: '📖', tas: '🎒', kursi: '🪑', jam: '⏰', gunting: '✂️', penggaris: '📏',
  rumah: '🏠', sepeda: '🚲', perahu: '⛵', kapal: '🚢', pesawat: '✈️', bus: '🚌', kereta: '🚆',
  matahari: '☀️', bulan: '🌙', awan: '☁️', pohon: '🌳', daun: '🍃', batu: '🪨', payung: '☂️', topi: '🧢', sepatu: '👟',
};

export function adaGambar(jenis) {
  return Boolean(GAMBAR[PETA_SINONIM[jenis] || jenis]);
}

export function Benda({ jenis, indeks = 0 }) {
  const kunci = PETA_SINONIM[jenis] || jenis;
  const gambar = GAMBAR[kunci];
  if (gambar) {
    return (
      <svg viewBox="0 0 200 160" className="benda-svg" role="img" aria-label={jenis}>
        {gambar(indeks)}
      </svg>
    );
  }
  return (
    <div className="benda-cadangan" role="img" aria-label={jenis}>
      <span className="benda-emoji" aria-hidden="true">{EMOJI[kunci] || '●'}</span>
      <span className="benda-label">{jenis}</span>
    </div>
  );
}
