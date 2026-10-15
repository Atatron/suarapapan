// Pengenalan suara lewat Web Speech API (mode online). Mode offline dengan
// faster-whisper menyusul di Hari 3 dengan antarmuka yang sama.

const PESAN_GALAT = {
  'not-allowed': 'Izin mikrofon ditolak. Klik ikon gembok di address bar, izinkan mikrofon, lalu muat ulang halaman.',
  'service-not-allowed': 'Browser tidak mengizinkan pengenalan suara. Gunakan Google Chrome.',
  'audio-capture': 'Mikrofon tidak ditemukan. Periksa apakah mikrofon atau earphone sudah tersambung.',
  network: 'Pengenalan suara online butuh internet. Untuk sementara, ketik kalimat di kolom bawah.',
  'language-not-supported': 'Browser ini belum mendukung Bahasa Indonesia untuk pengenalan suara. Gunakan Google Chrome.',
};

export function suaraDidukung() {
  return typeof window !== 'undefined' && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

/**
 * Dari beberapa kemungkinan hasil pengenalan, pilih yang paling banyak memuat
 * kata yang memang bisa diucapkan guru (nama benda, bilangan, kata kerja).
 * Urutan asli tetap dihormati: kandidat pertama punya sedikit keunggulan.
 */
export function pilihAlternatif(alternatif, kosakata) {
  let terbaik = alternatif[0]?.transcript ?? '';
  let skorTerbaik = -Infinity;
  alternatif.forEach((a, i) => {
    const kata = String(a.transcript || '').toLowerCase().match(/[a-z0-9]+(?:-[a-z0-9]+)*/g) || [];
    const cocok = kata.filter((k) => kosakata.has(k) || /^\d+$/.test(k)).length;
    const skor = cocok + (a.confidence || 0) * 0.5 - i * 0.05;
    if (skor > skorTerbaik) { skorTerbaik = skor; terbaik = a.transcript; }
  });
  return terbaik;
}

export function buatPendengar({ saatSementara, saatFinal, saatStatus, saatGalat, kosakata = null }) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const r = new SR();
  r.lang = 'id-ID';
  r.interimResults = true;
  r.continuous = true;
  r.maxAlternatives = 5;
  // Chrome terbaru bisa diberi petunjuk kata (contextual biasing); browser lain mengabaikannya.
  if (kosakata && 'phrases' in r && typeof window.SpeechRecognitionPhrase === 'function') {
    try {
      r.phrases = [...kosakata].slice(0, 400).map((k) => new window.SpeechRecognitionPhrase(k.replace(/-/g, ' '), 3.0));
    } catch { /* tidak didukung */ }
  }
  let aktif = false;

  r.onresult = (e) => {
    let sementara = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const hasil = e.results[i];
      if (hasil.isFinal) {
        const kandidat = Array.from({ length: hasil.length }, (_, j) => hasil[j]);
        saatFinal((kosakata ? pilihAlternatif(kandidat, kosakata) : hasil[0].transcript).trim());
      } else {
        sementara += hasil[0].transcript;
      }
    }
    saatSementara(sementara.trim());
  };
  r.onerror = (e) => {
    if (e.error === 'no-speech' || e.error === 'aborted') return; // jeda biasa, bukan masalah
    aktif = false;
    saatGalat(PESAN_GALAT[e.error] || `Pengenalan suara berhenti (${e.error}).`);
  };
  // Chrome menghentikan pengenalan setelah hening beberapa detik; selama guru
  // masih menahan tombol, kita nyalakan lagi.
  r.onend = () => {
    if (aktif) {
      try { r.start(); } catch { /* sudah berjalan */ }
    } else {
      saatStatus(false);
    }
  };

  return {
    mulai() {
      if (aktif) return;
      aktif = true;
      try { r.start(); } catch { /* sudah berjalan */ }
      saatStatus(true);
    },
    berhenti() {
      aktif = false;
      r.stop();
    },
  };
}
