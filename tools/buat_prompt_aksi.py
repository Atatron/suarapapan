"""Membuat paket prompt sprite AKSI (pose gerak) untuk 84 karakter hidup SuaraPapan.

Keluaran (di ../suarapapan-aset/prompt-aksi):
  prompts/aksi-XX-<kategori>-<n>.txt   satu prompt per sheet (3 karakter x 4 pose)
  aksi-manifest.json                   (jenis, aksi) -> sheet + sel + zona + latar
  SEMUA-PROMPT.md                      semua prompt dalam satu file, untuk disalin

Tata letak sheet sama dengan paket sprite asli (1536x1536, 4 kolom x 3 baris),
jadi tools/bangun_aset.py bisa memotongnya dengan cara yang sama. Bedanya:
SATU BARIS = SATU KARAKTER, kolom 1 selalu pose diam, kolom 2-4 aksi alaminya.

Pose memakai nama aksi aplikasi (diam/lari/lompat/terbang/berenang/jatuh) bila
cocok. Pose alami lain (jalan, makan, tidur, ...) diberi nama sendiri dan
"aksi_app" menunjuk aksi aplikasi terdekat, atau null jika tidak ada.

Jalankan: python -I tools/buat_prompt_aksi.py
"""
import json
import sys
from pathlib import Path

KELUAR = Path(__file__).resolve().parents[2] / 'suarapapan-aset' / 'prompt-aksi'

# Pose: slug -> (aksi_app, zona). zona memberi tahu engine di bagian latar mana
# sprite boleh berdiri: ground (tanah/lantai), water (permukaan/di dalam air), air (udara).
POSE = {
    'diam':      ('diam', 'ground'),
    'jalan':     ('lari', 'ground'),   # aplikasi belum punya "jalan"; lari terdekat
    'lari':      ('lari', 'ground'),
    'lompat':    ('lompat', 'ground'),
    'terbang':   ('terbang', 'air'),
    'berenang':  ('berenang', 'water'),
    'menyelam':  ('berenang', 'water'),
    'jatuh':     ('jatuh', 'air'),
    'merayap':   ('lari', 'ground'),
    'makan':     (None, 'ground'),
    'tidur':     (None, 'ground'),
    'senang':    (None, 'ground'),
    'melambai':  (None, 'ground'),
    'khusus':    (None, 'ground'),     # aksi khas karakter (mengaum, menyembur, ...)
}

# Latar pengganti bila aksi menuntut tempat lain dari latar bawaan benda.
LATAR_AKSI = {'terbang': 'open-sky', 'berenang': 'river', 'menyelam': 'deep-ocean'}

# Karakter: (jenis, english dari manifest asli, [(pose, deskripsi pose dlm bhs Inggris), x4])
# Deskripsi pose ditulis sealami mungkin untuk hewan/orang itu. Pose pertama selalu diam.
D = 'standing calmly at rest, same pose as the reference sprite'
KATEGORI = [
  (1, 'hewan-ternak', [
    ('ayam', 'chicken', [('diam', D), ('lari', 'running fast, legs mid-stride, wings slightly out'),
        ('terbang', 'short flapping flight, both wings raised, feet tucked'), ('makan', 'head down pecking at the ground')]),
    ('bebek', 'duck', [('diam', D), ('berenang', 'floating and paddling, body level as on water, feet paddling below'),
        ('terbang', 'flying with wings fully spread, neck stretched forward'), ('jalan', 'waddling walk, one foot lifted')]),
    ('sapi', 'cow', [('diam', D), ('jalan', 'walking slowly, one front leg lifted'),
        ('lari', 'trotting run, legs extended'), ('makan', 'head lowered grazing')]),
    ('kambing', 'goat', [('diam', D), ('lompat', 'leaping high with all four legs tucked'),
        ('lari', 'running, legs mid-stride'), ('makan', 'head lowered, chewing a small leaf')]),
    ('domba', 'sheep', [('diam', D), ('lari', 'running, legs mid-stride'),
        ('lompat', 'springing jump, all four feet off the ground'), ('makan', 'head lowered grazing')]),
    ('kuda', 'horse', [('diam', D), ('lari', 'galloping, mane and tail flowing back'),
        ('lompat', 'jumping with front legs tucked, body arched'), ('makan', 'head lowered grazing')]),
    ('babi', 'pig', [('diam', D), ('lari', 'trotting run, ears flapping'),
        ('makan', 'snout down sniffing and eating'), ('tidur', 'lying down asleep, eyes closed')]),
    ('kerbau', 'water buffalo with curved horns', [('diam', D), ('jalan', 'walking slowly, one front leg lifted'),
        ('berenang', 'swimming with head and back raised as if above water, legs paddling'), ('makan', 'head lowered grazing')]),
    ('angsa', 'goose with long neck', [('diam', D), ('berenang', 'gliding as on water, neck upright, feet paddling below'),
        ('terbang', 'flying with huge spread wings, long neck stretched forward'), ('jalan', 'waddling walk, one foot lifted')]),
    ('anjing', 'dog', [('diam', D), ('lari', 'running happily, ears flapping, tongue out'),
        ('lompat', 'jumping up playfully, front paws raised'), ('berenang', 'dog-paddling, head up, front paws paddling')]),
    ('kucing', 'cat', [('diam', D), ('lari', 'running, body stretched long'),
        ('lompat', 'pouncing leap, front paws reaching forward'), ('tidur', 'curled up asleep, eyes closed')]),
    ('kelinci', 'rabbit', [('diam', D), ('lompat', 'hopping high, hind legs stretched back'),
        ('lari', 'running fast, ears back'), ('makan', 'sitting up nibbling a small carrot held in paws')]),
  ]),
  (2, 'hewan-hutan', [
    ('harimau', 'tiger', [('diam', D), ('lari', 'running fast, body stretched, all legs extended'),
        ('lompat', 'pouncing leap through the air, front paws forward'), ('berenang', 'swimming with only head and shoulders raised, paws paddling')]),
    ('singa', 'lion with mane', [('diam', D), ('lari', 'running fast, mane flowing back'),
        ('lompat', 'leaping through the air, front paws forward'), ('khusus', 'roaring friendly, mouth open, head raised (not scary)')]),
    ('gajah', 'elephant', [('diam', D), ('jalan', 'walking, one front leg lifted, trunk swinging'),
        ('berenang', 'swimming with trunk raised up like a snorkel'), ('khusus', 'spraying a small fountain of water from the raised trunk')]),
    ('monyet', 'monkey', [('diam', D), ('lompat', 'jumping with arms and legs spread wide'),
        ('lari', 'running on all fours, tail up'), ('makan', 'sitting and eating one banana')]),
    ('gorila', 'gorilla', [('diam', D), ('jalan', 'knuckle-walking on all fours'),
        ('lari', 'running on all fours'), ('khusus', 'standing upright gently beating its chest, friendly face')]),
    ('jerapah', 'giraffe', [('diam', D), ('jalan', 'walking, one front leg lifted'),
        ('lari', 'galloping, neck stretched forward'), ('makan', 'long neck stretched up, nibbling one small leafy twig')]),
    ('zebra', 'zebra', [('diam', D), ('lari', 'galloping, mane flowing back'),
        ('lompat', 'leaping, legs tucked'), ('makan', 'head lowered grazing')]),
    ('beruang', 'bear', [('diam', D), ('jalan', 'walking on all fours'),
        ('lari', 'running on all fours'), ('berenang', 'swimming with head raised, paws paddling')]),
    ('ular', 'snake', [('diam', 'coiled up calmly, head raised'), ('merayap', 'slithering forward in a long S-curve'),
        ('berenang', 'swimming in a wavy S-curve, head raised'), ('khusus', 'head raised high, small forked tongue out, friendly')]),
    ('buaya', 'crocodile', [('diam', D), ('berenang', 'swimming, body flat, tail curving, only eyes and back raised'),
        ('jalan', 'walking low on four short legs'), ('khusus', 'mouth wide open showing rounded friendly teeth')]),
    ('badak', 'rhinoceros', [('diam', D), ('jalan', 'walking, one front leg lifted'),
        ('lari', 'charging run, legs extended'), ('makan', 'head lowered grazing')]),
    ('kuda nil', 'hippopotamus', [('diam', D), ('berenang', 'swimming with only head and back raised as from water'),
        ('jalan', 'walking, one front leg lifted'), ('khusus', 'big friendly yawn, mouth wide open')]),
  ]),
  (3, 'hewan-laut', [
    ('ikan', 'fish', [('diam', 'hovering calmly, fins relaxed'), ('berenang', 'swimming forward, tail curved, fins swept'),
        ('lompat', 'leaping in an arc as if out of water, body curved'), ('makan', 'mouth open nibbling one tiny food pellet')]),
    ('lumba-lumba', 'dolphin', [('diam', 'hovering calmly'), ('berenang', 'swimming forward, tail fluke mid-stroke'),
        ('lompat', 'leaping high in an arc, body curved'), ('menyelam', 'diving downward, head pointing down')]),
    ('paus', 'whale', [('diam', 'hovering calmly'), ('berenang', 'swimming forward, tail fluke raised'),
        ('khusus', 'spouting a small water fountain from its blowhole'), ('menyelam', 'diving downward, tail fluke up')]),
    ('hiu', 'shark', [('diam', 'hovering calmly, mouth closed, friendly'), ('berenang', 'swimming forward, tail curved'),
        ('menyelam', 'diving downward'), ('khusus', 'turning in a curve, friendly smile, mouth closed')]),
    ('gurita', 'octopus with eight arms', [('diam', 'resting, arms curled around'), ('berenang', 'jetting forward, arms trailing behind'),
        ('merayap', 'crawling, arms spread on the sides'), ('khusus', 'releasing a small dark ink puff behind it')]),
    ('kepiting', 'crab', [('diam', D), ('jalan', 'walking sideways, legs mid-step'),
        ('lari', 'scuttling fast sideways, legs blurred apart'), ('khusus', 'both claws raised high, happy')]),
    ('udang', 'shrimp', [('diam', 'hovering calmly'), ('berenang', 'swimming forward, legs paddling'),
        ('lompat', 'flicking backward, tail curled'), ('makan', 'holding one tiny food crumb')]),
    ('penyu', 'sea turtle with flippers', [('diam', 'hovering calmly'), ('berenang', 'swimming, front flippers stroking'),
        ('menyelam', 'diving downward, flippers back'), ('merayap', 'crawling slowly, flippers pushing')]),
    ('ubur-ubur', 'jellyfish', [('diam', 'drifting calmly, bell relaxed'), ('berenang', 'bell contracted, tentacles trailing, rising up'),
        ('menyelam', 'drifting downward, tentacles above'), ('senang', 'bell wide, tentacles waving playfully')]),
    ('bintang laut', 'starfish', [('diam', D), ('merayap', 'crawling, two arms bent forward'),
        ('senang', 'two arms raised like waving, happy face'), ('tidur', 'resting flat, eyes closed')]),
    ('kuda laut', 'seahorse', [('diam', 'hovering upright, tail curled'), ('berenang', 'swimming upright, dorsal fin fluttering, leaning forward'),
        ('khusus', 'tail curled around nothing, bobbing'), ('senang', 'happy, head tilted up')]),
    ('cumi-cumi', 'squid with elongated body', [('diam', 'hovering calmly'), ('berenang', 'jetting forward, arms trailing'),
        ('khusus', 'releasing a small dark ink puff behind it'), ('menyelam', 'diving downward')]),
  ]),
  (4, 'burung', [
    ('burung', 'small songbird', [('diam', 'perched upright, wings folded'), ('terbang', 'flying, wings raised high'),
        ('lompat', 'hopping, both feet off the ground'), ('makan', 'head down pecking')]),
    ('elang', 'eagle', [('diam', 'perched upright, wings folded'), ('terbang', 'soaring with wings fully spread wide'),
        ('jatuh', 'diving steeply downward, wings tucked back'), ('khusus', 'landing with wings raised and talons forward')]),
    ('burung hantu', 'owl', [('diam', 'perched upright, big open eyes'), ('terbang', 'flying, wings spread wide'),
        ('tidur', 'perched asleep, eyes closed'), ('khusus', 'head turned to look behind, curious')]),
    ('merpati', 'pigeon', [('diam', D), ('terbang', 'flying, wings raised'),
        ('jalan', 'walking, head bobbing forward'), ('makan', 'head down pecking')]),
    ('merak', 'peacock with displayed tail', [('diam', 'standing with tail folded down behind'), ('khusus', 'fully displaying the fanned tail'),
        ('jalan', 'walking with tail folded'), ('terbang', 'short flight, wings spread, long tail trailing')]),
    ('kakatua', 'cockatoo with crest', [('diam', 'perched upright, crest down'), ('terbang', 'flying, wings spread'),
        ('senang', 'crest raised, wings half open, dancing'), ('makan', 'holding one seed in its foot, nibbling')]),
    ('penguin', 'penguin', [('diam', D), ('jalan', 'waddling, flippers out'),
        ('berenang', 'swimming underwater, body stretched, flippers back'), ('khusus', 'belly-sliding forward on its tummy')]),
    ('flamingo', 'flamingo', [('diam', 'standing on one leg'), ('jalan', 'walking, one long leg lifted'),
        ('terbang', 'flying, wings spread, legs stretched behind'), ('makan', 'head down upside-down feeding')]),
    ('pelikan', 'pelican', [('diam', D), ('terbang', 'flying, huge wings spread'),
        ('berenang', 'floating as on water, body level'), ('makan', 'pouch holding one small fish')]),
    ('anak-bebek', 'small yellow duckling', [('diam', D), ('berenang', 'floating and paddling, body level'),
        ('jalan', 'waddling, one foot lifted'), ('lari', 'running, tiny wings out')]),
    ('burung unta', 'ostrich', [('diam', D), ('lari', 'running fast, long legs mid-stride, wings out'),
        ('jalan', 'walking, one leg lifted'), ('makan', 'neck bent down pecking')]),
    ('camar', 'seagull', [('diam', D), ('terbang', 'gliding, wings spread wide'),
        ('berenang', 'floating as on water, body level'), ('makan', 'holding one small fish in its beak')]),
  ]),
  (5, 'serangga', [
    ('kupu-kupu', 'butterfly', [('diam', 'resting, wings closed upright'), ('terbang', 'flying, wings fully open'),
        ('makan', 'perched sipping with a curled proboscis'), ('senang', 'wings half open, fluttering playfully')]),
    ('lebah', 'bee', [('diam', 'resting, wings folded'), ('terbang', 'flying, wings raised'),
        ('makan', 'holding one small yellow pollen ball'), ('senang', 'flying in a happy loop pose, smiling')]),
    ('semut', 'ant', [('diam', D), ('jalan', 'walking, legs mid-step'),
        ('lari', 'running fast'), ('khusus', 'carrying one bread crumb bigger than itself overhead')]),
    ('kumbang', 'beetle', [('diam', D), ('jalan', 'walking, legs mid-step'),
        ('terbang', 'flying, shell open, wings out'), ('khusus', 'rolled on its back, legs waving, smiling')]),
    ('kepik', 'red ladybug with black dots', [('diam', D), ('jalan', 'walking, legs mid-step'),
        ('terbang', 'flying, red shell open, wings out'), ('senang', 'smiling, two front legs raised')]),
    ('belalang', 'grasshopper', [('diam', D), ('lompat', 'jumping high, long hind legs stretched'),
        ('terbang', 'flying, wings spread'), ('makan', 'nibbling one small leaf')]),
    ('capung', 'dragonfly', [('diam', 'resting, wings flat'), ('terbang', 'flying, four wings spread'),
        ('khusus', 'hovering upright, wings raised'), ('senang', 'flying, happy face')]),
    ('laba-laba', 'spider with eight legs', [('diam', D), ('jalan', 'walking, legs mid-step'),
        ('khusus', 'hanging from one thin silk thread above it'), ('senang', 'waving two front legs, friendly')]),
    ('siput', 'snail', [('diam', D), ('merayap', 'crawling, body stretched long, eye stalks forward'),
        ('khusus', 'hiding inside its shell, only the shell visible'), ('senang', 'eye stalks up, smiling')]),
    ('cacing', 'earthworm', [('diam', 'lying in a gentle curve'), ('merayap', 'crawling in an arched inchworm curve'),
        ('senang', 'raising its front end up, smiling'), ('tidur', 'curled in a spiral asleep')]),
    ('katak', 'frog', [('diam', 'sitting'), ('lompat', 'jumping, legs fully stretched'),
        ('berenang', 'swimming, legs kicking back'), ('makan', 'long tongue catching one small fly')]),
    ('kura-kura', 'land tortoise with short legs', [('diam', D), ('jalan', 'walking slowly, one leg lifted'),
        ('berenang', 'swimming, legs paddling'), ('khusus', 'hiding head and legs inside its shell')]),
  ]),
  (6, 'orang-1', [
    ('anak laki-laki', 'boy', [('diam', D), ('lari', 'running, arms swinging'),
        ('lompat', 'jumping with both arms up, happy'), ('berenang', 'swimming freestyle, one arm forward')]),
    ('anak perempuan', 'girl', [('diam', D), ('lari', 'running, arms swinging'),
        ('lompat', 'jumping with both arms up, happy'), ('berenang', 'swimming freestyle, one arm forward')]),
    ('bayi', 'baby', [('diam', 'sitting up'), ('merayap', 'crawling on hands and knees'),
        ('tidur', 'lying asleep, eyes closed'), ('senang', 'sitting and laughing, arms up')]),
    ('ibu', 'adult mother', [('diam', D), ('jalan', 'walking'),
        ('lari', 'jogging'), ('melambai', 'waving one hand, smiling')]),
    ('ayah', 'adult father', [('diam', D), ('jalan', 'walking'),
        ('lari', 'jogging'), ('melambai', 'waving one hand, smiling')]),
    ('nenek', 'elderly grandmother', [('diam', D), ('jalan', 'walking slowly'),
        ('melambai', 'waving one hand, smiling'), ('khusus', 'sitting on nothing as if on a low stool, knitting')]),
    ('kakek', 'elderly grandfather', [('diam', D), ('jalan', 'walking slowly'),
        ('melambai', 'waving one hand, smiling'), ('khusus', 'reading a blank newspaper')]),
    ('guru', 'teacher holding a blank book', [('diam', D), ('jalan', 'walking holding the book'),
        ('khusus', 'pointing forward with one hand, explaining'), ('melambai', 'waving one hand, smiling')]),
    ('siswa berhijab', 'female school student wearing hijab and school uniform', [('diam', D), ('lari', 'running, arms swinging'),
        ('lompat', 'jumping with both arms up, happy'), ('khusus', 'raising one hand to answer a question')]),
    ('dokter', 'doctor with stethoscope', [('diam', D), ('jalan', 'walking'),
        ('khusus', 'holding the stethoscope forward as if listening'), ('melambai', 'waving one hand, smiling')]),
    ('polisi', 'police officer', [('diam', D), ('jalan', 'walking'),
        ('khusus', 'one arm raised in a stop-traffic gesture'), ('lari', 'running')]),
    ('petani', 'farmer with straw hat', [('diam', D), ('jalan', 'walking'),
        ('khusus', 'bent forward planting one rice seedling'), ('melambai', 'waving the straw hat')]),
  ]),
  (7, 'orang-2', [
    ('nelayan', 'fisherman holding a fishing rod', [('diam', D), ('khusus', 'casting the fishing rod forward'),
        ('makan', 'holding up one caught fish proudly'), ('jalan', 'walking with the rod on the shoulder')]),
    ('koki', 'chef with chef hat', [('diam', D), ('khusus', 'stirring a small pot held in one hand'),
        ('jalan', 'walking carrying one covered plate'), ('melambai', 'waving one hand, smiling')]),
    ('pak pos', 'postal worker carrying a mailbag', [('diam', D), ('jalan', 'walking'),
        ('khusus', 'handing over one blank envelope'), ('lari', 'running')]),
    ('pemadam kebakaran', 'firefighter wearing helmet', [('diam', D), ('lari', 'running'),
        ('khusus', 'holding a hose spraying a short stream of water'), ('melambai', 'waving one hand, smiling')]),
    ('pilot', 'pilot wearing pilot uniform', [('diam', D), ('jalan', 'walking'),
        ('khusus', 'saluting, smiling'), ('melambai', 'waving one hand, smiling')]),
    ('sopir', 'driver wearing driver uniform', [('diam', D), ('jalan', 'walking'),
        ('khusus', 'holding a steering wheel in both hands as if driving'), ('melambai', 'waving one hand, smiling')]),
    ('penjual', 'vendor holding a small basket of goods', [('diam', D), ('jalan', 'walking carrying the basket'),
        ('khusus', 'offering one item forward from the basket'), ('melambai', 'waving one hand, smiling')]),
    # Anak dengan disabilitas: aksi yang wajar dan bermartabat, tanpa pose jatuh/kasihan.
    ('anak kursi roda', 'child using a wheelchair, child and wheelchair together as one sprite', [('diam', D),
        ('lari', 'pushing the wheels to roll forward quickly, happy'),
        ('melambai', 'waving one hand, smiling'), ('khusus', 'throwing one ball upward, joyful')]),
    ('anak dengan alat bantu dengar', 'child wearing a clearly visible behind-the-ear hearing aid', [('diam', D),
        ('lari', 'running, arms swinging'), ('lompat', 'jumping with both arms up, happy'),
        ('khusus', 'signing a friendly hello with one raised open hand near the forehead')]),
    ('anak tunanetra dengan tongkat', 'blind child holding a white mobility cane', [('diam', D),
        ('jalan', 'walking confidently, sweeping the white cane forward'),
        ('melambai', 'waving one hand, smiling'), ('senang', 'laughing happily, cane held')]),
    ('anak bermain bola', 'child playing with one soccer ball', [('diam', 'standing with one foot on the ball'),
        ('khusus', 'kicking the ball forward'), ('lari', 'running dribbling the ball'), ('lompat', 'jumping to head the ball')]),
    ('anak membaca', 'child reading one open blank book', [('diam', D),
        ('khusus', 'sitting cross-legged reading the open book'), ('melambai', 'raising one hand, book held in the other'),
        ('lari', 'running holding the closed book')]),
  ]),
]

KUNCI_GAYA = """STYLE LOCK — match the attached reference sheet EXACTLY: same character designs, same colours,
same proportions, same dark outline weight, same polished friendly 2D game illustration style, simple rounded
shapes, flat cheerful colours, even lighting. No 3D, no photo realism, no texture, no gradients.
Each row is ONE character drawn four times; all four must be clearly the SAME individual, same size.
All moving poses FACE RIGHT (the app mirrors them for left)."""

KUNCI_TATA = """LAYOUT LOCK: one square 1:1 image, 1536 x 1536 px, FOUR COLUMNS x THREE ROWS = twelve sprites.
Opaque PURE WHITE background #FFFFFF. Sprite centres at normalized x = 0.125, 0.375, 0.625, 0.875 and
y = 1/6, 1/2, 5/6. Each sprite fits within 18% of canvas width and 23% of canvas height around its centre,
with wide uniform white gaps. No visible grid. One complete isolated sprite per cell, no overlap.
Keep body size equal across the four poses of a row (a running tiger is as big as the standing tiger)."""

LARANGAN = """NO ground, floor, water surface, sky, grass, shadows, dust clouds, splashes or scenery — the app adds the
background. NO motion-blur copies, afterimages, ghost duplicates or speed lines (children count these sprites;
every cell must show exactly ONE individual). No text, letters, numerals, labels, logos, borders or frames.
Only the small props named in a pose may appear, and they touch the character.
Mandatory negative prompt: shadows, ground, water, grass, scenery, motion lines, duplicates, afterimage,
extra animals, text, borders, frames, overlapping, cut off, inconsistent character, different colours, 3D, photo."""


def kunci(jenis):
    """Kunci sama dengan pustaka.json: spasi jadi tanda hubung (kuda nil -> kuda-nil)."""
    return jenis.replace(' ', '-')


def main():
    KELUAR.mkdir(parents=True, exist_ok=True)
    (KELUAR / 'prompts').mkdir(exist_ok=True)
    manifest = {'versi': 1, 'tata_letak': {'ukuran': 1536, 'kolom': 4, 'baris': 3,
                'catatan': 'baris = karakter, kolom 1 = diam'}, 'pose': {k: {'aksi_app': a, 'zona': z} for k, (a, z) in POSE.items()},
                'latar_aksi': LATAR_AKSI, 'sheet': [], 'karakter': {}}
    semua = ['# Prompt sprite aksi SuaraPapan\n',
             'Lampirkan sheet referensi yang disebut di tiap prompt (dari sprite-sheets-16.zip/final) saat generate.\n']
    for nomor, kat, daftar in KATEGORI:
        assert len(daftar) == 12, kat
        for bagian in range(4):
            tiga = daftar[bagian * 3:bagian * 3 + 3]
            nama = f'aksi-{nomor:02d}-{kat}-{bagian + 1}'
            baris = []
            for r, (jenis, eng, pose) in enumerate(tiga, 1):
                assert len(pose) == 4 and pose[0][0] in ('diam',), jenis
                for c, (slug, des) in enumerate(pose, 1):
                    assert slug in POSE, slug
                    baris.append(f'ROW {r}, COLUMN {c}: the {eng} — {des}.')
                    aksi_app, zona = POSE[slug]
                    manifest['karakter'].setdefault(kunci(jenis), {'kategori': kat, 'pose': {}})['pose'][slug] = {
                        'sheet': nama, 'baris': r, 'kolom': c, 'aksi_app': aksi_app, 'zona': zona,
                        'latar': LATAR_AKSI.get(slug)}
            teks = '\n'.join([
                f'Use case: 2D educational game asset — ACTION POSE sheet "{nama}".',
                f'Reference image to attach: final/{nomor:02d}-{kat}.png (the original sprite sheet). '
                f'Characters in this sheet: ' + ', '.join(e for _, e, _ in tiga) + '.',
                KUNCI_GAYA, KUNCI_TATA,
                'Draw these twelve sprites in this EXACT order, left to right, then top to bottom:',
                *baris, LARANGAN])
            (KELUAR / 'prompts' / f'{nama}.txt').write_text(teks + '\n', encoding='utf-8')
            manifest['sheet'].append({'nama': nama, 'referensi': f'final/{nomor:02d}-{kat}.png',
                                      'karakter': [kunci(j) for j, _, _ in tiga]})
            semua += [f'\n## {nama}\n', '```text', teks, '```']
    (KELUAR / 'aksi-manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=1), encoding='utf-8')
    (KELUAR / 'SEMUA-PROMPT.md').write_text('\n'.join(semua) + '\n', encoding='utf-8')
    jumlah_pose = sum(len(k['pose']) for k in manifest['karakter'].values())
    print(f"{len(manifest['sheet'])} sheet, {len(manifest['karakter'])} karakter, {jumlah_pose} pose -> {KELUAR}")


if __name__ == '__main__':
    sys.exit(main())
