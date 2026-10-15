"""Memotong sheet pose AKSI menjadi satu file per (benda, pose).

Jalankan (dari folder suarapapan):
  python -I tools/bangun_aksi.py
  python -I tools/bangun_aksi.py --raw <folder sheet> --qa <folder pemeriksaan>

Masukan: ../suarapapan-aset/prompt-aksi/aksi-manifest.json (dari buat_prompt_aksi.py)
dan sheet hasil generate di ../suarapapan-aset/raw/aksi/<nama-sheet>.png
(mis. aksi-02-hewan-hutan-1.png; .jpg/.webp juga boleh). Sheet yang belum ada
dilewati, jadi sheet boleh ditambah satu per satu dan skrip dijalankan ulang.

Keluaran: web/public/aset/aksi/<benda>__<pose>.webp dan web/src/scene/aksi.json.
aksi.json memetakan aksi aplikasi (lari, lompat, terbang, berenang, jatuh) ke
pose yang tersedia; benda tanpa pose tetap memakai gambar biasa + animasi CSS.

Kolom 1 (diam) tidak disimpan, karena gambar biasa sudah ada; kolom itu hanya
dipakai sebagai ukuran acuan: pose lain diskalakan sama dengan pose diam di
barisnya, supaya harimau yang berlari tidak tampak lebih kecil/besar.
"""
import argparse
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))  # -I membuang folder skrip dari sys.path
from bangun_aset import (ISI, KANVAS, KANTONG_LATAR, MAKS_PERBESAR, contact_sheet, pangkas,  # noqa: E402
                         potong_latar, simpan)

AKAR = Path(__file__).resolve().parents[1]
ASET = AKAR.parent / 'suarapapan-aset'
UKURAN = 1536
AKSI_APP = ['lari', 'lompat', 'terbang', 'berenang', 'jatuh']


def cari_sheet(raw: Path, nama: str):
    for ext in ('.png', '.webp', '.jpg', '.jpeg'):
        p = raw / f'{nama}{ext}'
        if p.exists():
            return p
    return None


def potong_sel(rgb, baris, kolom, buang_kantong):
    h, w = rgb.shape[0] // 3, rgb.shape[1] // 4
    sel = rgb[(baris - 1) * h:baris * h, (kolom - 1) * w:kolom * w]
    hasil = pangkas(potong_latar(sel, 253, buang_kantong=buang_kantong))
    if hasil is None:
        return None, 'kosong'
    art, (x0, y0, x1, y1) = hasil
    tepi = x0 == 0 or y0 == 0 or x1 >= sel.shape[1] or y1 >= sel.shape[0]
    return Image.fromarray(art, 'RGBA'), ('menyentuh tepi sel' if tepi else None)


def ke_kanvas(art: Image.Image, skala: float) -> Image.Image:
    """Seperti sprite_ke_kanvas, tetapi dengan skala baris; diperkecil hanya jika tidak muat."""
    w, h = art.size
    s = min(skala, ISI[0] / w, ISI[1] / h)
    art = art.resize((max(1, round(w * s)), max(1, round(h * s))), Image.LANCZOS)
    k = Image.new('RGBA', KANVAS, (0, 0, 0, 0))
    k.alpha_composite(art, ((KANVAS[0] - art.width) // 2, KANVAS[1] - art.height - 6))
    return k


def pilih_pose(pose_ada: dict, pose_manifest: dict) -> dict:
    """aksi aplikasi -> slug pose. Pose bernama sama menang ("lari" atas "jalan")."""
    peta = {}
    for aksi in AKSI_APP:
        if aksi in pose_ada:
            peta[aksi] = aksi
            continue
        for slug in pose_ada:  # urutan kolom di sheet
            if pose_manifest[slug]['aksi_app'] == aksi:
                peta[aksi] = slug
                break
    return peta


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--raw', default=str(ASET / 'raw' / 'aksi'))
    ap.add_argument('--manifest', default=str(ASET / 'prompt-aksi' / 'aksi-manifest.json'))
    ap.add_argument('--out', default=str(AKAR / 'web' / 'public' / 'aset'))
    ap.add_argument('--qa', default=None, help='folder untuk contact sheet pemeriksaan')
    a = ap.parse_args()
    raw, out = Path(a.raw), Path(a.out)
    manifest = json.loads(Path(a.manifest).read_text(encoding='utf-8'))
    pustaka = json.loads((AKAR / 'web' / 'src' / 'scene' / 'pustaka.json').read_text(encoding='utf-8'))['obj']

    hasil, qa, masalah, dilewati = {}, [], [], []
    for sheet in manifest['sheet']:
        jalur = cari_sheet(raw, sheet['nama'])
        if not jalur:
            dilewati.append(sheet['nama'])
            continue
        im = Image.open(jalur).convert('RGB')
        if im.size != (UKURAN, UKURAN):
            if abs(im.width - im.height) > 4:
                masalah.append(f"{sheet['nama']}: bukan persegi ({im.width}x{im.height}), dilewati")
                continue
            im = im.resize((UKURAN, UKURAN), Image.LANCZOS)
        rgb = np.array(im)

        for r, jenis in enumerate(sheet['karakter'], 1):
            if jenis not in pustaka:
                masalah.append(f'{jenis}: tidak ada di pustaka.json')
                continue
            kantong = jenis in KANTONG_LATAR
            pose_manifest = manifest['karakter'][jenis]['pose']
            diam, catatan = potong_sel(rgb, r, 1, kantong)
            if diam is None:
                masalah.append(f'{jenis}/diam: {catatan}')
                continue
            skala = min(ISI[0] / diam.width, ISI[1] / diam.height, MAKS_PERBESAR)
            pose_ada = {}
            for slug, info in pose_manifest.items():
                if info['kolom'] == 1:
                    continue
                art, catatan = potong_sel(rgb, r, info['kolom'], kantong)
                if art is None:
                    masalah.append(f'{jenis}/{slug}: {catatan}')
                    continue
                if catatan:
                    masalah.append(f'{jenis}/{slug}: {catatan}')
                k = ke_kanvas(art, skala)
                simpan(k, out / 'aksi' / f'{jenis}__{slug}.webp')
                pose_ada[slug] = info
                qa.append((f'{jenis} {slug}', k))
            if pose_ada:
                hasil[jenis] = pilih_pose(pose_ada, manifest['pose'])

    tujuan = AKAR / 'web' / 'src' / 'scene' / 'aksi.json'
    tujuan.write_text(json.dumps(dict(sorted(hasil.items())), ensure_ascii=False, indent=1) + '\n', encoding='utf-8')

    if a.qa and qa:
        d = Path(a.qa)
        d.mkdir(parents=True, exist_ok=True)
        for i in range(0, len(qa), 48):
            contact_sheet(qa[i:i + 48], d / f'aksi-{i // 48 + 1}.png')

    print(f'sheet dipakai: {len(manifest["sheet"]) - len(dilewati)}/{len(manifest["sheet"])}, '
          f'benda dengan pose: {len(hasil)}, file pose: {len(qa)}')
    for m in masalah:
        print('MASALAH:', m)
    return 1 if masalah else 0


if __name__ == '__main__':
    sys.exit(main())
