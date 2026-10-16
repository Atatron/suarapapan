"""Deterministic explicit arithmetic; model-generated answers are never trusted."""
import re
from katalog import id_aset

WORDS = {'nol': 0, 'satu': 1, 'dua': 2, 'tiga': 3, 'empat': 4, 'lima': 5, 'enam': 6, 'tujuh': 7, 'delapan': 8, 'sembilan': 9, 'sepuluh': 10, 'sebelas': 11}
NUMBER = r'(?:\d+|(?:nol|satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh|sebelas)(?:\s+(?:belas|puluh)(?:\s+(?:satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan))?)?)'
OPS = r'(?:ditambah|ditambahkan|tambah|plus|dikurangi|kurang|minus|dikali|dikalikan|kali|dibagi|bagi|[+−×÷*/-]|x)(?:\s+dengan)?'


def angka(text):
    if text.isdigit():
        return int(text)
    parts = text.split()
    value = WORDS[parts[0]]
    if len(parts) > 1:
        value = value + 10 if parts[1] == 'belas' else value * 10 + (WORDS[parts[2]] if len(parts) > 2 else 0)
    return value


def urai_operasi(text):
    text = re.sub(r'^(?:(?:berapa (?:hasil(?:nya)?(?: dari)?|nilai dari))|hitung(?:lah)?(?: hasil(?: dari)?)?)\s+', '', str(text).lower().strip())
    text = re.sub(r'\s*(?:=\s*\??|sama dengan(?: berapa)?|hasilnya berapa)[.!?]*$', '', text)
    text = text.rstrip('.!?').strip()
    group = re.fullmatch(rf'(?:ada )?({NUMBER}) (?:kelompok|baris) (?:yang )?(?:masing-masing|masing masing|berisi) ({NUMBER}) (.+)', text)
    if group:
        noun = id_aset(group[3])
        return {'operator': 'kali', 'kiri': angka(group[1]), 'kanan': angka(group[2]), 'jenis': noun} if noun else None
    m = re.fullmatch(rf'(?:ada )?({NUMBER})\s*(.*?)\s*({OPS})\s*({NUMBER})(?:\s+(.+))?', text)
    if not m:
        return None
    operator = re.sub(r'\s+dengan$', '', m[3])
    kind = 'tambah' if operator in ['ditambah','ditambahkan','tambah','plus','+'] else 'kurang' if operator in ['dikurangi','kurang','minus','−','-'] else 'kali' if operator in ['dikali','dikalikan','kali','×','*','x'] else 'bagi'
    left = re.sub(r'^(?:buah|ekor|orang)\s+', '', m[2].strip())
    right = re.sub(r'^(?:buah|ekor|orang)\s+', '', (m[5] or '').strip())
    groups = right in ['kelompok','bagian kelompok']
    if kind == 'bagi' and (left or right) and not groups:
        return None
    left_id, right_id = id_aset(left), id_aset(right) if not groups else None
    if left and not left_id or right and not groups and not right_id or left_id and right_id and left_id != right_id:
        return None
    return {'operator': kind, 'kiri': angka(m[1]), 'kanan': angka(m[4]), 'jenis': left_id or right_id or ''}


def hitung_operasi(op):
    if not op or op.get('operator') not in ['tambah','kurang','kali','bagi'] or any(type(op.get(k)) is not int or not 0 <= op[k] <= 100 for k in ['kiri','kanan']):
        return {'error': 'Bilangan harus bulat antara 0 dan 100.'}
    a, b, kind = op['kiri'], op['kanan'], op['operator']
    if kind == 'bagi' and not b:
        return {'error': 'Pembagian dengan nol tidak terdefinisi.'}
    answer = a+b if kind == 'tambah' else a-b if kind == 'kurang' else a*b if kind == 'kali' else a//b
    if answer < 0:
        return {'error': 'Hasil negatif belum didukung pada papan benda.'}
    total = answer if kind in ['tambah','kali'] else a
    if op['jenis'] and total > 20:
        return {'error': 'Operasi memerlukan lebih dari 20 benda.'}
    if op['jenis'] and (a if kind == 'kali' else b if kind == 'bagi' else 0) > 12:
        return {'error': 'Maksimal 12 kelompok dapat ditampilkan dengan jelas.'}
    return {'answer': answer, 'remainder': a % b if kind == 'bagi' else 0, 'total': total,
            'concept': {'tambah':'penjumlahan','kurang':'pengurangan','kali':'perkalian','bagi':'pembagian'}[kind]}
