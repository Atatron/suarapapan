// Print a page from this folder to an A4 PDF with headless Edge.
// node make_pdf.mjs <page.html> <out.pdf>
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import { serve } from './snap.mjs';

const [, , pageName, out] = process.argv;
if (!pageName || !out) throw new Error('usage: node make_pdf.mjs <page.html> <out.pdf>');
const srv = await serve();
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: true,
});
const page = await browser.newPage();
const errs = [];
page.on('pageerror', e => errs.push(String(e)));
await page.goto(`http://127.0.0.1:${srv.address().port}/${pageName}`, { waitUntil: 'networkidle0' });
await page.evaluate(async () => { await document.fonts.ready; });
await page.pdf({ path: path.resolve(out), format: 'A4', printBackground: true, margin: { top: '12mm', bottom: '12mm', left: '12mm', right: '12mm' } });
await browser.close();
srv.close();
if (errs.length) console.log('PAGE ERRORS:\n' + errs.join('\n'));
console.log('wrote', path.resolve(out));
