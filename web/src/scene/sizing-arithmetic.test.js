import test from 'node:test';
import assert from 'node:assert/strict';
import { ukuranKarakter, profilJenis, tataObjek } from './tata.js';
import { pilihLatar, LATAR } from './latar.js';
import { PERMUKAAN } from './permukaan.js';
import { uraiLokal } from '../lib/lokal.js';
import { uraikan } from '../lib/api.js';
import { uraiOperasi } from '../lib/aritmetika.js';
import { ADEGAN_KOSONG, terapkan, yangAda, konteks } from './engine.js';

test('people, animals, small props, furniture and vehicles have distinct size profiles', () => {
  for (const [noun, profile] of [['bayi','bayi'],['anak-laki-laki','anak'],['guru','dewasa'],['semut','hewan-kecil'],['gajah','hewan'],['mobil','kendaraan'],['mobil-mainan','benda-kecil'],['meja','perabot']]) assert.equal(profilJenis(noun), profile, noun);
  const size = (noun) => ukuranKarakter(noun,.92,1).isi;
  assert.ok(size('bayi') < size('anak-laki-laki') && size('anak-laki-laki') < size('guru'));
  assert.ok(size('apel') < size('anak-laki-laki') * .6);
  assert.ok(size('mobil-mainan') < size('mobil') * .6);
  assert.ok(size('semut') < size('kelinci') && size('kelinci') < size('gajah'));
});

test('every background has explicit placement surfaces and humans never inherit a classroom table', () => {
  assert.deepEqual(Object.keys(PERMUKAAN).sort(), Object.keys(LATAR).sort());
  const objects = ['anak-laki-laki','guru','buku','pensil'].map((jenis,i) => ({id:String(i),jenis,aksi:'diam'}));
  const bg = pilihLatar({latar:'kelas',objek:objects});
  const layout = tataObjek(objects,bg);
  for (const i of [0,1]) {
    assert.ok(layout[i].px <= .78 && layout[i].px >= .16, `human floor x: ${layout[i].px}`);
    assert.ok(layout[i].py >= .73 && layout[i].py <= .94);
  }
  for (const i of [2,3]) {
    assert.ok(layout[i].px >= .84, `prop table x: ${layout[i].px}`);
    assert.ok(layout[i].py >= .51 && layout[i].py <= .53, `prop table y: ${layout[i].py}`);
  }
  assert.equal(bg.id,'classroom');
});

test('explicit place survives changes of subject, while mixed actions use separate surfaces', () => {
  for (const noun of ['anak-laki-laki','kelinci','apel']) assert.equal(pilihLatar({latar:'kelas',objek:[{jenis:noun}]}).id,'classroom');
  assert.equal(pilihLatar({latar:'park',objek:[{jenis:'anak'}]}).id,'flower-garden');
  const objects = [{id:'a',jenis:'burung',aksi:'diam'},{id:'b',jenis:'burung',aksi:'terbang'}];
  const bg = pilihLatar({latar:'taman',objek:objects});
  assert.ok(bg.perObjek.a.y[1] > bg.perObjek.b.y[1]);
});

test('the exact screenshot phrases work without a number and a place change preserves counts', () => {
  const r = uraiLokal('anak di kelas');
  assert.equal(r.yakin,'tinggi');
  const first = terapkan(ADEGAN_KOSONG,r.hasil).adegan;
  assert.equal(yangAda(first).length,1);
  assert.equal(pilihLatar(first).id,'classroom');
  const second = terapkan(first,uraiLokal('anak di taman',konteks(first)).hasil).adegan;
  assert.equal(yangAda(second).length,1);
  assert.equal(pilihLatar(second).id,'flower-garden');
  const third = terapkan(second,uraiLokal('Ganti latar ke kelas',konteks(second)).hasil).adegan;
  assert.equal(yangAda(third).length,1);
  assert.equal(pilihLatar(third).id,'classroom');
});

test('all four operators and word/symbol spellings compute through the scene engine', () => {
  for (const [text, expected] of [['3 + 2',5],['lima dikurangi dua',3],['tiga kali dua apel',6],['dua belas apel dibagi tiga kelompok',4],['7 ÷ 2','3 sisa 1'],['3 x 2',6],['3 dikalikan dengan 2',6],['0 × 5',0],['5 - 5',0]]) {
    const parsed = uraiLokal(text);
    assert.equal(parsed?.needsConfirmation,false,text);
    const result = terapkan(ADEGAN_KOSONG,parsed.hasil);
    assert.equal(result.adegan.soal.jawaban,expected,text);
    if (text.includes('apel')) assert.equal(yangAda(result.adegan).length,6 * (text.startsWith('dua') ? 2 : 1));
  }
  assert.equal(uraiOperasi('Satu pizza dibagi empat'),null,'fraction is not object sharing');
});

test('division by zero, negative results and image overflow fail closed without provider calls', async () => {
  for (const text of ['5 ÷ 0','dua kurang tiga','6 kali 6 apel']) {
    const result = await uraikan(text,'kosong');
    assert.equal(result.needsConfirmation,true,text);
    assert.equal(result.notice.code,'UNSUPPORTED_ARITHMETIC');
    assert.equal(terapkan(ADEGAN_KOSONG,result.hasil).berubah,false);
    assert.equal(result.availability,null);
  }
});

test('sequential operators apply to their own clauses and show the entire equation', () => {
  const r = uraiLokal('Ada lima apel, lalu dua apel dimakan dan tiga apel datang');
  assert.equal(r.needsConfirmation,false);
  const final = terapkan(ADEGAN_KOSONG,r.hasil).adegan;
  assert.equal(yangAda(final).length,6);
  assert.equal(final.soal.teks,'5 − 2 + 3 = ?');
  assert.equal(final.soal.jawaban,6);
  const start = terapkan(ADEGAN_KOSONG,{entitas:[{jenis:'apel',jumlah:5}]}).adegan;
  const change = uraiLokal('Dua apel pergi, lalu satu apel datang',konteks(start));
  assert.equal(yangAda(terapkan(start,change.hasil).adegan).length,4);
});

test('1092 arithmetic combinations preserve computed answers and reject invalid domains', () => {
  for (let a=0;a<=20;a++) for (let b=0;b<=12;b++) for (const op of ['+','−','×','÷']) {
    const text = `${a} ${op} ${b}`;
    const parsed = uraiLokal(text);
    if (op==='÷' && !b || op==='−' && a<b) { assert.equal(parsed.needsConfirmation,true,text); continue; }
    const result = terapkan(ADEGAN_KOSONG,parsed.hasil).adegan;
    const expected = op==='+' ? a+b : op==='−' ? a-b : op==='×' ? a*b : a%b ? `${Math.floor(a/b)} sisa ${a%b}` : a/b;
    assert.equal(result.soal.jawaban,expected,text);
    assert.ok(result.soal.opsi.includes(expected),text);
  }
});
