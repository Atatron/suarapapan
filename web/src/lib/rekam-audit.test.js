import { test } from 'node:test';
import assert from 'node:assert/strict';
import { speech, burstNoise } from './fixtures/audio.js';

let urutan = 0;
async function pasang(t, { pcm = Float32Array.from({ length: speech.length * 2 }, (_, i) => speech[Math.floor(i / 2)]), tolakIzin = false, tolakDekode = false, gagalMulai = false } = {}) {
  const semula = new Map(['navigator', 'window', 'MediaRecorder', 'OfflineAudioContext'].map((k) => [k, Object.getOwnPropertyDescriptor(globalThis, k)]));
  class Trek extends EventTarget {
    readyState = 'live';
    label = 'Mikrofon uji';
  }
  const trek = new Trek();
  let mintaIzin = 0;
  let dekode = 0;
  let tutupAudio = 0;
  const rekaman = [];
  class Perekam {
    static isTypeSupported() { return true; }
    state = 'inactive';
    mimeType = 'audio/webm';
    constructor() { rekaman.push(this); }
    start() {
      if (gagalMulai) throw Object.assign(new Error('Recorder gagal dimulai'), { name: 'NotReadableError' });
      this.state = 'recording';
    }
    stop() {
      assert.equal(this.state, 'recording', 'stop recorder hanya dipanggil sekali');
      this.state = 'inactive';
      queueMicrotask(() => {
        this.ondataavailable?.({ data: new Blob(['audio-uji']) });
        this.onstop?.();
      });
    }
  }
  class Audio {
    async decodeAudioData() {
      dekode++;
      if (tolakDekode) throw new Error('Audio tidak dapat didekode.');
      return { duration: pcm.length / 16000 };
    }
    async close() { tutupAudio++; }
  }
  class Offline {
    destination = {};
    createBufferSource() { return { connect() {}, start() {} }; }
    async startRendering() { return { getChannelData: () => pcm }; }
  }
  const navigatorUji = { mediaDevices: { getUserMedia: async () => {
    mintaIzin++;
    if (tolakIzin) throw Object.assign(new Error('Permission denied'), { name: 'NotAllowedError' });
    return { getAudioTracks: () => [trek] };
  } } };
  for (const [k, value] of Object.entries({ navigator: navigatorUji, window: { MediaRecorder: Perekam, AudioContext: Audio }, MediaRecorder: Perekam, OfflineAudioContext: Offline })) {
    Object.defineProperty(globalThis, k, { value, configurable: true, writable: true });
  }
  t.after(() => {
    for (const r of rekaman) if (r.state === 'recording') r.stop();
    for (const [k, d] of semula) { if (d) Object.defineProperty(globalThis, k, d); else delete globalThis[k]; }
  });
  const lib = await import(`./rekam.js?audit=${++urutan}`);
  return { lib, trek, rekaman, statistik: () => ({ mintaIzin, dekode, tutupAudio }) };
}

test('mikrofon: izin ditolak memberi pesan yang jelas sebelum recorder dibuat', async (t) => {
  const uji = await pasang(t, { tolakIzin: true });
  await assert.rejects(uji.lib.mulaiRekam(), (e) => {
    assert.match(uji.lib.pesanMik(e), /Izin mikrofon ditolak/);
    return true;
  });
  assert.equal(uji.rekaman.length, 0);
});

test('QA2-002: berhenti idempoten, callback sekali dan WAV ucapan diklasifikasikan lokal', async (t) => {
  const uji = await pasang(t);
  let berhenti = 0;
  const kontrol = await uji.lib.mulaiRekam({ saatBerhenti: () => berhenti++ });
  const pertama = kontrol.berhenti();
  assert.equal(kontrol.berhenti(), pertama, 'finalisasi berbagi satu promise');
  const hasil = await pertama;
  assert.equal(hasil.mime, 'audio/wav');
  assert.equal(hasil.ucapan, true);
  assert.equal(berhenti, 1);
  assert.deepEqual(uji.statistik(), { mintaIzin: 1, dekode: 1, tutupAudio: 1 });
});

test('QA2-001: rekaman derau ditandai bukan ucapan sebelum unggahan', async (t) => {
  const uji = await pasang(t, { pcm: burstNoise() });
  const hasil = await (await uji.lib.mulaiRekam()).berhenti();
  assert.equal(hasil.ucapan, false);
});

test('mikrofon: pencabutan izin atau perangkat terputus membatalkan hasil dan memberi pesan', async (t) => {
  const uji = await pasang(t);
  const galat = [];
  let berhenti = 0;
  const kontrol = await uji.lib.mulaiRekam({ saatGalat: (e) => galat.push(e), saatBerhenti: () => berhenti++ });
  uji.trek.readyState = 'ended';
  uji.trek.dispatchEvent(new Event('ended'));
  await assert.rejects(kontrol.berhenti(), { name: 'MicrophoneDisconnectedError' });
  assert.equal(galat.length, 1);
  assert.match(uji.lib.pesanMik(galat[0]), /terputus atau izinnya dicabut/);
  assert.equal(berhenti, 1);
  assert.equal(uji.statistik().dekode, 0, 'audio parsial tidak dipakai');
  uji.trek.readyState = 'live'; // perangkat tersambung kembali pada izin berikutnya
  const berikut = await uji.lib.mulaiRekam();
  assert.equal(uji.statistik().mintaIzin, 2, 'aliran lama yang mati tidak dipakai ulang');
  await berikut.berhenti();
});

test('mikrofon: galat MediaRecorder ditolak dan tidak tersembunyi sebagai rekaman kosong', async (t) => {
  const uji = await pasang(t);
  let notifikasi = 0;
  const kontrol = await uji.lib.mulaiRekam({ saatGalat: () => notifikasi++ });
  uji.rekaman[0].onerror({ error: Object.assign(new Error('Perangkat sibuk'), { name: 'NotReadableError' }) });
  await assert.rejects(kontrol.berhenti(), /Perangkat sibuk/);
  assert.equal(notifikasi, 1);
  assert.equal(uji.statistik().dekode, 0);
});

test('mikrofon: galat decode diteruskan dan AudioContext selalu ditutup', async (t) => {
  const uji = await pasang(t, { tolakDekode: true });
  const kontrol = await uji.lib.mulaiRekam();
  await assert.rejects(kontrol.berhenti(), /tidak dapat didekode/);
  assert.equal(uji.statistik().tutupAudio, 1);
});

test('mikrofon: batas 30 detik mengakhiri UI dan recorder secara otomatis', async (t) => {
  const uji = await pasang(t);
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let berhenti = 0;
  const kontrol = await uji.lib.mulaiRekam({ saatBerhenti: () => berhenti++ });
  t.mock.timers.tick(30000);
  await Promise.resolve();
  assert.equal(uji.rekaman[0].state, 'inactive');
  assert.equal(berhenti, 1);
  await kontrol.berhenti();
  assert.equal(berhenti, 1);
});
