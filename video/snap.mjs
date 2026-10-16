// Snapshot helper: node snap.mjs <page.html> <out.png> [t1,t2,...]
// With times, calls window.renderAt(t) and writes one PNG per time (out_<t>.png).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ttf': 'font/ttf', '.png': 'image/png' };
export function serve() {
  const srv = http.createServer((req, res) => {
    const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    if (!p.startsWith(ROOT) || !fs.existsSync(p)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' });
    fs.createReadStream(p).pipe(res);
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => r(srv)));
}
export async function openPage(srv, page_) {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: true, args: ['--hide-scrollbars', '--force-device-scale-factor=1', '--disable-gpu-vsync'],
  });
  const page = await browser.newPage();
  const tlp = path.join(ROOT, 'build', 'timeline.json');
  if (fs.existsSync(tlp)) await page.evaluateOnNewDocument(`window.TL = ${fs.readFileSync(tlp, 'utf8')};`);
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(`http://127.0.0.1:${srv.address().port}/${page_}`, { waitUntil: 'networkidle0' });
  await page.evaluate(async () => { await document.fonts.ready; if (window.ready) await window.ready; });
  return { browser, page, errs };
}

if (process.argv[1] && process.argv[1].endsWith('snap.mjs')) {
  const [, , pg, out, times] = process.argv;
  const srv = await serve();
  const { browser, page, errs } = await openPage(srv, pg);
  if (times) {
    for (const t of times.split(',').map(Number)) {
      await page.evaluate(t => window.renderAt(t), t);
      await page.screenshot({ path: out.replace('.png', `_${t.toFixed(2)}.png`) });
    }
  } else await page.screenshot({ path: out });
  if (errs.length) console.log('PAGE ERRORS:\n' + errs.join('\n'));
  await browser.close(); srv.close();
}
