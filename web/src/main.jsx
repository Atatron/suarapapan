import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Guru from './guru/Guru.jsx';
import Papan from './papan/Papan.jsx';
import './styles.css';

function Beranda() {
  return (
    <main className="beranda">
      <h1>SuaraPapan</h1>
      <p>Guru bicara, papan bercerita.</p>
      <img className="beranda-gambar" src="/aset/ruang-kelas.webp" alt="Ruang kelas inklusif: siswa membaca, bermain balok, dan belajar dengan tablet dan headphone." />
      <div className="baris-tombol">
        <a className="tombol tombol-utama" href="/guru">Buka panel guru</a>
        <a className="tombol" href="/papan">Buka papan (proyektor)</a>
      </div>
    </main>
  );
}

const jalur = window.location.pathname.replace(/\/+$/, '');
const Halaman = jalur === '/guru' ? Guru : jalur === '/papan' ? Papan : Beranda;
document.body.dataset.halaman = Halaman === Papan ? 'papan' : 'guru';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Halaman />
  </StrictMode>,
);
