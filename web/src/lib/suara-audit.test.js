import test from 'node:test';
import assert from 'node:assert/strict';
import { buatPendengar } from './suara.js';

test('a disposed speech session cannot deliver late finals into the next capture', (t) => {
  const lama = globalThis.window;
  let recognizer;
  class Recognition {
    constructor() { recognizer = this; }
    start() {}
    stop() {}
    abort() { this.aborted = true; }
  }
  globalThis.window = { SpeechRecognition: Recognition };
  t.after(() => { if (lama === undefined) delete globalThis.window; else globalThis.window = lama; });
  const finals = [];
  const listener = buatPendengar({ saatFinal: (s) => finals.push(s), saatSementara() {}, saatStatus() {}, saatGalat() {} });
  listener.mulai();
  const pending = recognizer.onresult;
  listener.berhenti();
  listener.buang();
  pending({ resultIndex: 0, results: [Object.assign([{ transcript: 'tiga apel', confidence: 1 }], { isFinal: true })] });
  assert.deepEqual(finals, []);
  assert.equal(recognizer.aborted, true);
  assert.equal(recognizer.onresult, null);
});

test('speech permission failure allows safe repeated stop and disposal', (t) => {
  const lama = globalThis.window;
  class Recognition { start() {} stop() { throw new Error('inactive'); } abort() { throw new Error('inactive'); } }
  globalThis.window = { SpeechRecognition: Recognition };
  t.after(() => { if (lama === undefined) delete globalThis.window; else globalThis.window = lama; });
  const listener = buatPendengar({ saatFinal() {}, saatSementara() {}, saatStatus() {}, saatGalat() {} });
  assert.doesNotThrow(() => { listener.berhenti(); listener.berhenti(); listener.buang(); listener.buang(); });
});
