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

export function buatPendengar({ saatSementara, saatFinal, saatStatus, saatGalat }) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const r = new SR();
  r.lang = 'id-ID';
  r.interimResults = true;
  r.continuous = true;
  let aktif = false;

  r.onresult = (e) => {
    let sementara = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const teks = e.results[i][0].transcript;
      if (e.results[i].isFinal) saatFinal(teks.trim());
      else sementara += teks;
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
