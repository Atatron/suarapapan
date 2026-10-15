// Membandingkan papan sebelum dan sesudah perubahan terakhir, dan keadaan yang akan
// kembali jika guru menekan Ulangi. Tiap gambar memakai tampilan papan yang sama.
import Adegan from '../scene/Adegan.jsx';
import { ADEGAN_KOSONG, deskripsi } from '../scene/engine.js';
import { ringkasBeda } from '../scene/sejarah.js';

function Kolom({ judul, keadaan, kosongTeks, tanda }) {
  return (
    <figure className={`bs-kolom bs-${tanda}`}>
      <figcaption>{judul}</figcaption>
      <Adegan adegan={keadaan?.adegan ?? ADEGAN_KOSONG} kecil />
      <p className="bs-teks">
        {keadaan ? deskripsi(keadaan.adegan) : kosongTeks}
      </p>
      {keadaan?.label ? <p className="bs-label">“{keadaan.label}”</p> : null}
    </figure>
  );
}

export default function SebelumSesudah({ sejarah, onBatalkan, onUlangi }) {
  const sebelum = sejarah.lalu[sejarah.lalu.length - 1] ?? null;
  const berikut = sejarah.maju[sejarah.maju.length - 1] ?? null;
  const beda = sebelum ? ringkasBeda(sebelum.adegan, sejarah.sekarang.adegan) : [];
  const bedaUlang = berikut ? ringkasBeda(sejarah.sekarang.adegan, berikut.adegan) : [];

  return (
    <section className="kartu sebelum-sesudah" aria-label="Sebelum dan sesudah">
      <h2>Sebelum dan sesudah</h2>
      <div className="bs-baris">
        <Kolom judul="Sebelum" keadaan={sebelum} kosongTeks="Belum ada perubahan." tanda="sebelum" />
        <span className="bs-panah" aria-hidden="true">→</span>
        <Kolom judul="Sekarang di papan" keadaan={sejarah.sekarang} kosongTeks="Papan kosong." tanda="sekarang" />
        {berikut ? (
          <>
            <span className="bs-panah" aria-hidden="true">⇢</span>
            <Kolom judul="Jika diulangi" keadaan={berikut} kosongTeks="" tanda="berikut" />
          </>
        ) : null}
      </div>
      <p className="bs-beda" aria-live="polite">
        {beda.length ? <>Dari sebelum ke sekarang: <b>{beda.join(', ')}</b>.</> : sebelum ? 'Isi papan sama; hanya susunannya berubah.' : 'Belum ada yang bisa dibandingkan.'}
        {bedaUlang.length ? <> Jika diulangi: <b>{bedaUlang.join(', ')}</b>.</> : null}
      </p>
      <div className="baris-tombol">
        <button type="button" className="tombol" onClick={onBatalkan} disabled={!sebelum} title="Ctrl+Z">↶ Batalkan</button>
        <button type="button" className="tombol" onClick={onUlangi} disabled={!berikut} title="Ctrl+Y atau Ctrl+Shift+Z">↷ Ulangi</button>
      </div>
    </section>
  );
}
