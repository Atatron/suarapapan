"""Shared shipped-asset vocabulary and fail-closed grounding (stdlib only)."""
import copy
import json
import re
import unicodedata
from pathlib import Path

JALUR = Path(__file__).resolve().parents[1] / 'web/src/scene/katalog.json'
ASET = json.loads(JALUR.read_text(encoding='utf-8'))


def normal(teks):
    s = unicodedata.normalize('NFKD', str(teks or '')).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+', '-', s).strip('-')


INDEKS = {}
KONFLIK = []
for kind in ('obj', 'tempat', 'latar'):
    items = [a for a in ASET if a['kind'] == kind]
    index = {a['id']: a for a in items}
    candidates = {}
    for a in items:
        for alias in a['aliases']:
            candidates.setdefault(alias, {})[a['id']] = a
    for alias, values in candidates.items():
        if alias in index:
            continue
        if len(values) == 1:
            index[alias] = next(iter(values.values()))
        else:
            KONFLIK.append({'kind': kind, 'phrase': alias, 'ids': list(values)})
    INDEKS[kind] = index


def id_aset(teks, kind='obj'):
    key = normal(teks)
    a = INDEKS[kind].get(key)
    if not a:
        ulang = re.fullmatch(r'([a-z0-9]+)-\1', key)
        a = INDEKS[kind].get(ulang[1]) if ulang else None
    return a['id'] if a else None


def temukan(teks, kind='obj'):
    words = list(re.finditer(r'[^\W_]+', str(teks), re.UNICODE))
    index = INDEKS[kind]
    maximum = max(len(a.split('-')) for a in index)
    result, i = [], 0
    while i < len(words):
        found = False
        for n in range(min(maximum, len(words) - i), 0, -1):
            phrase = str(teks)[words[i].start():words[i+n-1].end()]
            if n > 1 and re.search(r"[^\w\s'’-]", phrase):
                continue
            key = normal(phrase)
            item = index.get(key) or (index.get(re.sub(r'nya$', '', key)) if n == 1 else None)
            if item:
                result.append({**item, 'start': words[i].start(), 'end': words[i+n-1].end()})
                i += n
                found = True
                break
        if not found:
            i += 1
    return result


def teks_katalog(kind):
    return '\n'.join(f"{a['id']}: {' | '.join(x.replace('-', ' ') for x in a['aliases'] if x != a['id'])}"
                     for a in ASET if a['kind'] == kind)


def landaskan(hasil, kalimat, konteks=''):
    """Use the same validated boundary as the local server (lazy to avoid cycles)."""
    from validasi import amankan
    return amankan(hasil, kalimat, konteks)
