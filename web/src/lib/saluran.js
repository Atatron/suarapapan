// Penghubung /guru dan /papan. Keduanya berjalan di browser yang sama, jadi
// BroadcastChannel cukup: tanpa server, tanpa internet.
const saluran = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('suarapapan') : null;

export function kirim(pesan) {
  saluran?.postMessage(pesan);
}

export function dengar(fn) {
  if (!saluran) return () => {};
  const h = (e) => fn(e.data);
  saluran.addEventListener('message', h);
  return () => saluran.removeEventListener('message', h);
}
