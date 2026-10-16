"""Runtime boundary for both local providers; catalog is shared with the browser.

This is deliberately conservative. Unsupported scope or incomplete coverage keeps
the board unchanged and asks the teacher to rewrite the sentence.
"""
import copy
import re

from bahasa import AKSI_KE_ENUM, kata_ke_angka, tokenisasi
from aritmetika import urai_operasi, hitung_operasi

from katalog import ASET as KATALOG, INDEKS as DATA_INDEKS, normal, temukan

KOSONG = {'entitas': [], 'peristiwa': [], 'latar': '', 'konsep': 'tidak_ada', 'pertanyaan': '',
          'tanya_benda': '', 'tanya_jenis': 'tidak_ada', 'gabung': False}
AKSI = {'diam', 'lari', 'lompat', 'terbang', 'berenang', 'jatuh'}
TIPE = {'tambah', 'hapus', 'bagi', 'ambil', 'pindah', 'ubah_aksi'}
INDEKS = {kind: {alias: item['id'] for alias, item in index.items()} for kind, index in DATA_INDEKS.items()}


def disebut(teks, kind='obj'):
    return {item['id'] for item in temukan(teks, kind)}


def perlu_tinjau(code, message, spans=None):
    return {**copy.deepcopy(KOSONG), 'needsConfirmation': True,
            'notice': {'code': code, 'message': message, 'unresolvedSpans': spans or []}}


def amankan(raw, kalimat, konteks=''):
    if not isinstance(raw, dict):
        raise ValueError('Format adegan harus berupa objek JSON.')
    for key in ('entitas', 'peristiwa'):
        value = raw.get(key, [])
        if not isinstance(value, list) or len(value) > 200 or any(not isinstance(item, dict) for item in value):
            raise ValueError(f'Format {key} harus berupa array objek, maksimal 200.')
        for item in value:
            for k in ('jumlah', 'bagi'):
                if k in item and type(item[k]) is not int:
                    raise ValueError(f'{k} harus berupa bilangan bulat.')
            for k in ('jenis', 'target', 'tipe', 'aksi', 'aksi_awal', 'posisi', 'emoji', 'emoji_acuan'):
                if k in item and not isinstance(item[k], str):
                    raise ValueError(f'{k} harus berupa teks.')
    for key in ('latar', 'konsep', 'pertanyaan', 'tanya_benda', 'tanya_jenis'):
        if key in raw and not isinstance(raw[key], str):
            raise ValueError(f'{key} harus berupa teks.')
    if 'gabung' in raw and type(raw['gabung']) is not bool:
        raise ValueError('gabung harus berupa boolean.')
    if re.search(r'\b(jangan|tidak|tak|bukan|belum|tanpa|jika|kalau|andaikan|seandainya|misalnya|apabila)\b|["“”‘’]|\x27[^\x27]+\x27', kalimat, re.I):
        return perlu_tinjau('UNSUPPORTED_SCOPE', 'Penyangkalan, kutipan, atau kalimat bersyarat perlu diperjelas.', [kalimat])
    if re.search(r'\b(eh\s+salah|ralat|maksudnya)\b', kalimat, re.I):
        return perlu_tinjau('SELF_CORRECTION', 'Tulis ulang jumlah akhir yang dimaksud.', [kalimat])
    operasi = urai_operasi(kalimat)
    if operasi:
        math = hitung_operasi(operasi)
        if math.get('error'):
            return perlu_tinjau('UNSUPPORTED_ARITHMETIC', math['error'], [kalimat])
        return {**copy.deepcopy(KOSONG), 'operasi': operasi, 'konsep': math['concept']}
    if raw.get('operasi'):
        return perlu_tinjau('UNSUPPORTED_ARITHMETIC', 'Tulis satu operasi lengkap dengan dua bilangan.', [kalimat])
    result = {**copy.deepcopy(KOSONG), **{k: copy.deepcopy(raw[k]) for k in KOSONG if k in raw}}
    uttered = disebut(kalimat)
    if result['entitas']:
        all_spans = temukan(kalimat) + temukan(kalimat,'tempat') + temukan(kalimat,'latar')
        for word in re.finditer(r'\b(merah|biru|hijau|kuning|putih|hitam|coklat|cokelat|ungu|oranye|pink|red|blue|green|yellow|white|black|purple|orange)\b',kalimat,re.I):
            if not any(a['start'] <= word.start() and a['end'] >= word.end() for a in all_spans):
                return perlu_tinjau('ASSET_GROUNDING','Variasi warna tersebut belum tersedia dalam aset.',[word[0]])
    previous = {}
    for part in re.split(r',\s*(?![^()]*\))', konteks):
        m = re.match(r'\s*(.+?)\s*:?\s+\d+', part)
        if m:
            previous[m[1].strip().rstrip(':')] = INDEKS['obj'].get(normal(m[1].strip().rstrip(':')))
    adjustments = []
    words = re.findall(r'\w+(?:-\w+)*', kalimat.lower())
    spoken_actions = {AKSI_KE_ENUM.get(w) for w in words}
    # Explicit changes to an existing set must never become a replacement
    # scene or a confident no-op when the tagger misses PERISTIWA/BENDA.
    add = bool(set(words) & {'tambah', 'tambahkan', 'ditambah', 'menambah', 'menambahkan', 'bertambah'})
    remove = bool(set(words) & {'hapus', 'hapuskan', 'hilangkan', 'kurangi', 'dikurangi', 'dimakan', 'makan', 'diambil', 'ambil', 'pergi', 'hilang', 'habis'})
    existing_targets = uttered & set(previous.values())
    if existing_targets and (add or remove) and not result['pertanyaan']:
        expected = 'hapus' if remove else 'tambah'
        covered = {INDEKS['obj'].get(normal(p.get('target', ''))) for p in result['peristiwa'] if p.get('tipe') == expected}
        if add and remove or not existing_targets <= covered:
            return perlu_tinjau('OPERATION_MISMATCH', 'Tindakan pada benda yang sudah ada belum sesuai kalimat. Periksa perintah.', [kalimat])
    for key, name_key in (('entitas', 'jenis'), ('peristiwa', 'target')):
        for item in result[key]:
            name = item.get(name_key, '')
            identity = INDEKS['obj'].get(normal(name))
            if not identity or identity not in uttered and not (key == 'peristiwa' and identity in previous.values()):
                return perlu_tinjau('ASSET_GROUNDING', 'Benda belum tersedia atau tidak disebut dalam kalimat.', [name])
            item[name_key] = identity
            # A high token score is not evidence for a quantity. Check an
            # explicit noun-adjacent operand before accepting a model count.
            if key == 'entitas' or item.get('tipe') in ('tambah', 'hapus'):
                quantities = []
                for match in temukan(kalimat):
                    if match['id'] != identity:
                        continue
                    before = tokenisasi(kalimat[:match['start']])
                    for width in range(min(5,len(before)),0,-1):
                        value = kata_ke_angka(before[-width:])
                        if value is not None:
                            quantities.append(value)
                            break
                if len(quantities) == 1 and min(20,max(1,quantities[0])) != min(20,max(1,item.get('jumlah',1))):
                    return perlu_tinjau('QUANTITY_MISMATCH', 'Jumlah dari model berbeda dengan bilangan yang disebut. Periksa kalimat.', [name])
            if key == 'peristiwa':
                # Keep the scene's semantic label so aliases edit the existing set.
                matches = [label for label, ident in previous.items() if ident == identity]
                if len(matches) == 1:
                    item[name_key] = matches[0]
                if item.get('tipe') not in TIPE:
                    return perlu_tinjau('UNSUPPORTED_OPERATION', 'Tindakan tidak didukung.', [str(item.get('tipe'))])
            move = key == 'peristiwa' and item['tipe'] in ('pindah', 'ubah_aksi')
            requested = item.get('jumlah', 0 if move else 1)
            maximum = 12 if item.get('tipe') == 'bagi' else 20
            item['jumlah'] = max(0 if move else 1, min(requested, maximum))
            if requested != item['jumlah']:
                adjustments.append(f'{name}: {requested} → {item["jumlah"]}')
            if 'bagi' in item:
                requested_parts = item['bagi']
                item['bagi'] = max(0, min(requested_parts, 12))
                if requested_parts != item['bagi']:
                    adjustments.append(f'{name} dibagi: {requested_parts} → {item["bagi"]}')
            for action_key in ('aksi', 'aksi_awal'):
                if action_key not in item:
                    continue
                action = item[action_key]
                if action == '':
                    continue
                if action not in AKSI or action not in ('', 'diam') and action not in spoken_actions:
                    item[action_key] = '' if action_key == 'aksi_awal' else 'diam'
                    adjustments.append(f'{name}: gerakan {action} tidak disebut atau tidak didukung')
            position = item.get('posisi', '')
            if position:
                m = re.match(r'^(?:di|ke)\s+(atas|bawah|samping|sebelah|depan|belakang|dalam)\s+(.+)$', position)
                reference = INDEKS['obj'].get(normal(m[2])) if m else None
                if not reference or reference not in uttered or not re.search(r'\b(?:di|ke)\s+' + m[1] + r'\b', kalimat, re.I):
                    return perlu_tinjau('ASSET_GROUNDING', 'Letak atau benda acuan belum sesuai kalimat.', [position])
    target = {p['target'] for p in result['peristiwa']}
    result['entitas'] = [e for e in result['entitas'] if not (e['jenis'] in target and e['jenis'] in previous)]
    if result['latar']:
        tempat = INDEKS['tempat'].get(normal(result['latar'])) or INDEKS['latar'].get(normal(result['latar']))
        if not tempat or tempat not in disebut(kalimat, 'tempat') | disebut(kalimat,'latar'):
            return perlu_tinjau('ASSET_GROUNDING', 'Tempat belum tersedia atau tidak disebut.', [result['latar']])
        result['latar'] = tempat
    result['gabung'] = bool(re.search(r'\b(datang|juga|bersama|ikut|menyusul|bergabung|tambahkan|ditambah|menambah|bertambah|tambah|plus)\b', kalimat, re.I))
    if result['konsep'] not in {'membilang', 'penjumlahan', 'pengurangan', 'perkalian', 'pembagian', 'pecahan', 'posisi', 'tidak_ada'}:
        result['konsep'] = 'tidak_ada'
    if adjustments:
        result.update(needsConfirmation=True, notice={'code': 'ADJUSTED_RESULT', 'message': '; '.join(adjustments) + '. Periksa pratinjau.', 'unresolvedSpans': []})
    return result
