// Offline speech fixture only; never imported by the application.
import { readFileSync } from 'node:fs';
import { pcmKeWav } from '../wav.js';

const raw = readFileSync(new URL('./speech-8khz.raw', import.meta.url));
export const speech = Float32Array.from({ length: raw.length / 2 }, (_, i) => raw.readInt16LE(i * 2) / 32768);
export const speechWav = Buffer.from(pcmKeWav(speech, 8000)).toString('base64');

export function burstNoise(seed = 123456789, gain = 0.08) {
  return Float32Array.from({ length: 48000 }, (_, i) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const t = i / 16000;
    return (seed / 4294967296 * 2 - 1)
      * ((t > 0.3 && t < 0.9) || (t > 1.6 && t < 2.2) ? gain : 0.001);
  });
}
