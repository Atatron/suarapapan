// Render every frame of index.html via headless Edge -> H.264, in parallel chunks, then mux with build/mix.wav.
// node render.mjs [workers=4]
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { serve, openPage } from './snap.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const FF = 'C:/Users/ATA/AppData/Local/Programs/Python/Python312/Lib/site-packages/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe';
const TL = JSON.parse(fs.readFileSync(path.join(ROOT, 'build/timeline.json'), 'utf8'));
const FPS = TL.fps, NF = Number(process.env.NF || Math.round(TL.total * FPS));
const WORKERS = Number(process.argv[2] || 4);
const OUT = path.join(ROOT, 'build', process.env.PARTS || 'parts');
fs.mkdirSync(OUT, { recursive: true });
// Variants for the voice-over package (all default to the approved video):
//   NOCAP=1   hide the burned-in narrator captions (the page reads ?nocap)
//   SILENT=1  no audio stream at all
//   FINAL=<file name inside build/>
const PAGE = process.env.NOCAP ? 'index.html?nocap=1' : 'index.html';
const FINAL = process.env.FINAL || 'SuaraPapan_Video.mp4';

function run(args) {
  return new Promise((res, rej) => { const p = spawn(FF, args, { stdio: ['ignore', 'inherit', 'inherit'] }); p.on('exit', c => c ? rej(new Error('ffmpeg ' + c)) : res()); });
}

const withTimeout = (p, ms, what) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(`timeout: ${what}`)), ms))]);

async function chunk(srv, k, a, b) {
  let ctx = await openPage(srv, PAGE);
  const file = path.join(OUT, `part${k}.mp4`);
  const ff = spawn(FF, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', '-r', String(FPS), file], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => ff.on('exit', c => c ? rej(new Error('ffmpeg ' + c)) : res()));
  const pageErrs = [];
  for (let f = a; f < b; f++) {
    let png, tries = 0;
    // Headless Edge occasionally hangs on captureScreenshot: relaunch and redo the same frame (renderAt is deterministic).
    while (!png) {
      try {
        await withTimeout(ctx.page.evaluate(t => window.renderAt(t), f / FPS), 20000, 'renderAt');
        png = await withTimeout(ctx.page.screenshot({ type: 'png', optimizeForSpeed: true }), 20000, 'screenshot');
      } catch (e) {
        if (++tries > 4) throw e;
        console.log(`worker ${k}: frame ${f} ${e.message} -> relaunch (try ${tries})`);
        pageErrs.push(...ctx.errs);
        ctx.browser.process()?.kill();
        ctx = await openPage(srv, PAGE);
      }
    }
    if (!ff.stdin.write(png)) await new Promise(r => ff.stdin.once('drain', r));
    if ((f - a) % 150 === 0) console.log(`worker ${k}: frame ${f}/${b}`);
  }
  ff.stdin.end();
  await done;
  pageErrs.push(...ctx.errs);
  await ctx.browser.close();
  if (pageErrs.filter(e => !e.includes('404')).length) throw new Error(`page errors in worker ${k}:\n` + pageErrs.join('\n'));
  return file;
}

const t0 = Date.now();
const srv = await serve();
const per = Math.ceil(NF / WORKERS);
const files = await Promise.all(Array.from({ length: WORKERS }, (_, k) => chunk(srv, k, k * per, Math.min(NF, (k + 1) * per))));
srv.close();
fs.writeFileSync(path.join(OUT, 'list.txt'), files.map(f => `file '${f.replace(/\\/g, '/')}'`).join('\n'));
const final = path.join(ROOT, 'build', FINAL);
const list = path.join(OUT, 'list.txt');
await run(process.env.SILENT
  ? ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c:v', 'copy', '-an', '-movflags', '+faststart', final]
  : ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-i', path.join(ROOT, 'build', 'mix.wav'),
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-shortest', '-movflags', '+faststart', final]);
console.log(`done: ${final} (${NF} frames) in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
