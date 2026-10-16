// Epoch ini tidak ikut Undo/Redo: jawaban lama tidak boleh mengubah papan baru.
export function buatAntrean({ maks = 5 } = {}) {
  let epoch = 0;
  let ekor = Promise.resolve();
  const berjalan = new Set();
  return {
    get jumlah() { return berjalan.size; },
    tambahkan(tugas) {
      if (berjalan.size >= maks) return Promise.reject(new Error('Masih ada kalimat yang diproses. Tunggu atau batalkan proses.'));
      const controller = new AbortController();
      const saatMasuk = epoch;
      const tiket = { signal: controller.signal, berlaku: () => saatMasuk === epoch && !controller.signal.aborted };
      berjalan.add(controller);
      const hasil = ekor.then(async () => {
        if (!tiket.berlaku()) return undefined;
        return tugas(tiket);
      }).finally(() => berjalan.delete(controller));
      ekor = hasil.catch(() => {});
      return hasil;
    },
    batalkan() {
      epoch += 1;
      for (const controller of berjalan) controller.abort();
      berjalan.clear();
      // Permintaan yang mengabaikan AbortSignal tetap dijaga oleh tiket.berlaku().
      ekor = Promise.resolve();
    },
  };
}
