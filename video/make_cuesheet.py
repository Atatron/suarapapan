"""Build cuesheet.html (voice-over script with exact timings) from the approved timeline + naskah.json.

Every number printed here comes from build/timeline.json, the same file the approved video was rendered from.
"""
import html
import json
import math
from pathlib import Path

ROOT = Path(__file__).parent
TL = json.loads((ROOT / "build" / "timeline.json").read_text(encoding="utf-8"))
NS = {l["id"]: l for l in json.loads((ROOT / "naskah.json").read_text(encoding="utf-8"))["lines"]}
SCN = {s["id"]: s for s in TL["scenes"]}
TOTAL = TL["total"]

LABEL = {
    "bima": "Hook 1 · Bima (tunarungu)", "arka": "Hook 2 · Arka (ADHD)", "laras": "Hook 3 · Laras (disleksia)",
    "tara": "Hook 4 · Tara (autisme)", "quad": "Rangkuman 4 anak", "pdbk": "Data 1 · 166.242 siswa SLB",
    "gpk": "Data 2 · 85,2% sekolah tanpa GPK", "pisa": "Data 3 · PISA 2022", "timpang": "Data 4 · kesenjangan wilayah",
    "akar": "Akar masalah", "solusi": "Solusi · logo", "demo1": "Demo 1 · kalimat pertama",
    "demo2": "Demo 2 · soal dan jawaban", "sampai": "Penutup demo", "teknis": "Cara kerja", "akhir": "Penutup",
}
FXNOTE = {
    "bima": "Di video suaranya dibuat teredam. Rekam jernih saja.",
    "arka": "Di video suaranya timbul-tenggelam (fokusnya teralih). Rekam jernih saja.",
    "laras": "Suara jernih (kesulitannya di huruf, bukan di suara).",
    "tara": "Di video tertutup kebisingan kelas. Hanya 2 bagian pertama terdengar, lalu hening.",
}
WHO = {"G": "Bu Wulan", "A": "Narator"}


def dec(x, nd=1):
    return f"{x:.{nd}f}".replace(".", ",")


def tfmt(t):
    m = int(t // 60)
    return f"{m}:{t - 60 * m:04.1f}".replace(".", ",")


cues = sorted(TL["cues"], key=lambda c: c["t"])
for c in cues:
    s = SCN[c["scene"]]
    limit = s["start"] + s["dur"] - 0.12
    later = [d["t"] for d in cues if d["scene"] == c["scene"] and d["t"] > c["t"] + 1e-6]
    if later:
        limit = min(limit, min(later) - 0.06)
    c["maxdur"] = limit - c["t"]

order, uniq = [], {}
for c in cues:
    if c["line"] not in uniq:
        order.append(c["line"])
        uniq[c["line"]] = {"first": c["t"], "n": 0, "dur": c["dur"], "max": 99.0}
    u = uniq[c["line"]]
    u["n"] += 1
    u["max"] = min(u["max"], c["maxdur"])
assert len(order) == 16, order
for k, u in uniq.items():
    assert u["max"] >= u["dur"] - 0.02, f"{k}: the AI voice itself would not fit its window ({u['max']:.2f} < {u['dur']:.2f})"

esc = html.escape
rows1 = []
for i, k in enumerate(order, 1):
    u, l = uniq[k], NS[k]
    where = tfmt(u["first"]) if u["n"] == 1 else f"{u['n']}× · pertama {tfmt(u['first'])}"
    cls = "t" if l["voice"] == "G" else "n"
    rows1.append(
        f'<tr class="{cls}"><td class="c">{i}</td><td class="id">{esc(k)}</td><td class="nw">{esc(WHO[l["voice"]])}</td>'
        f'<td class="tx">{esc(l["text"])}</td><td class="c">{dec(u["dur"])} d</td>'
        f'<td class="c mx">{dec(math.floor(u["max"] * 10) / 10)} d</td><td class="c">{esc(where)}</td></tr>'
    )

rows2, last_scene = [], None
for c in cues:
    sid = c["scene"]
    first = sid != last_scene
    last_scene = sid
    note = FXNOTE.get(sid, "") if first and sid in FXNOTE else ""
    rows2.append(
        f'<tr class="{"first" if first else ""}"><td class="c">{tfmt(c["t"])}</td><td class="id">{esc(c["line"])}</td>'
        f'<td>{esc(LABEL[sid]) if first else ""}</td><td class="nt">{esc(note)}</td></tr>'
    )

pron = [
    ("SLB", "es-el-be"), ("SD", "es-de"), ("AI", "ei-ai (di layar tertulis AI)"), ("LLM", "el-el-em"),
    ("IndoBERT", "indo-bert"), ("166 ribu", "seratus enam puluh enam ribu"),
]
rows3 = "".join(f"<tr><td class='id'>{esc(a)}</td><td>{esc(b)}</td></tr>" for a, b in pron)

page = f"""<!doctype html>
<html lang="id"><head><meta charset="utf-8"><title>Naskah Voice Over · SuaraPapan v2</title>
<style>
@font-face {{ font-family: 'Fredoka'; src: url('assets/Fredoka.ttf') format('truetype'); font-weight: 300 700; }}
* {{ box-sizing: border-box; }}
body {{ font-family: 'Fredoka', sans-serif; color: #16302A; font-size: 9pt; margin: 0; line-height: 1.3; }}
.band {{ background: #16302A; color: #F3F1EA; border-radius: 10px; padding: 10px 16px; display: flex; flex-wrap: wrap; gap: 4px 18px; align-items: baseline; }}
.band b {{ color: #E9B949; font-size: 17pt; letter-spacing: .5px; }}
.band span {{ font-size: 9.5pt; }}
h2 {{ font-size: 11.5pt; margin: 10px 0 4px; }}
ol {{ margin: 3px 0 0 18px; padding: 0; }}
ol li {{ margin: 1px 0; }}
table {{ width: 100%; border-collapse: collapse; margin-top: 3px; }}
tr {{ page-break-inside: avoid; }}
th {{ background: #16302A; color: #F3F1EA; font-weight: 600; text-align: left; padding: 4px 6px; font-size: 8.4pt; }}
td {{ border-bottom: 1px solid #DDD8CB; padding: 3px 6px; vertical-align: top; }}
tr.t td {{ background: #FFF7E0; }}
.c {{ text-align: center; white-space: nowrap; }}
.nw {{ white-space: nowrap; }}
.id {{ font-family: Consolas, 'Courier New', monospace; font-weight: 700; white-space: nowrap; }}
.mx {{ font-weight: 700; color: #B03A2A; }}
.tx {{ font-size: 9.4pt; font-weight: 500; }}
.nt {{ color: #5E6B66; font-size: 8.6pt; }}
tr.first td {{ border-top: 2px solid #16302A; }}
.legend {{ color: #5E6B66; font-size: 8.6pt; margin-top: 4px; }}
.box {{ border: 2px solid #E9B949; background: #FFFBEF; border-radius: 8px; padding: 8px 12px; margin-top: 10px; }}
.pb {{ page-break-before: always; }}
.two {{ display: flex; gap: 16px; }}
.two > div {{ flex: 1; }}
</style></head><body>

<div class="band"><b>SUARA PAPAN · Naskah Voice Over</b><span>Video v2 · {tfmt(TOTAL)} · 16 baris untuk direkam</span></div>

<h2>Cara pakai</h2>
<ol>
<li>Tonton dulu <b>SuaraPapan_v2_REFERENSI_suara_AI_720p.mp4</b> (versi dengan suara AI) supaya tahu tempo dan nadanya.</li>
<li>Rekam <b>setiap baris sebagai file sendiri</b>, namai sesuai kolom <b>File</b> (contoh: <span class="id">n_s1.wav</span>). Format .wav, .m4a, atau .mp3 boleh.</li>
<li>Tempat tenang, mic sekitar 15 cm dari mulut, tanpa musik di latar. Baca persis seperti tertulis. Bu Wulan (guru): hangat dan jelas. Narator: tenang dan jelas.</li>
<li>Usahakan tidak lebih panjang dari kolom <b>Maks.</b> Kalau lebih, suara menabrak kalimat berikutnya atau pergantian adegan.</li>
<li>Kalau satu baris tidak muat, jangan dipaksa cepat sampai tidak jelas. Beri tahu, visualnya bisa disesuaikan (batas lomba 2:00).</li>
</ol>

<h2>16 baris yang direkam</h2>
<table>
<tr><th class="c">No</th><th>File</th><th>Suara</th><th>Kalimat</th><th class="c">Durasi AI</th><th class="c">Maks.</th><th class="c">Muncul</th></tr>
{''.join(rows1)}
</table>
<div class="legend">Baris berlatar kuning = Bu Wulan (guru). <b>Durasi AI</b> = panjang suara AI di video yang sudah disetujui. <b>Maks.</b> = batas aman sebelum menabrak yang berikutnya. d = detik.</div>

<div class="pb"></div>
<h2>Letak setiap rekaman di video</h2>
<div class="box" style="margin-top:2px"><b>Hook (0:00 sampai 0:30):</b> Bu Wulan mengucapkan kalimat yang sama (g_a, g_b, g_c) di empat sudut pandang anak. Rekam <b>sekali, dengan suara jernih</b>. Efek teredam, terputus, atau tertutup kebisingan ditambahkan saat mixing.</div>
<table>
<tr><th class="c">Waktu</th><th>File</th><th>Bagian video</th><th>Catatan</th></tr>
{''.join(rows2)}
</table>
<div class="legend">Waktu = saat suara AI mulai di video (menit:detik,persepuluh). Bagian hook memakai file yang sama berulang kali.</div>

<div class="two">
<div>
<h2>Cara membaca</h2>
<table><tr><th>Tertulis</th><th>Dibaca</th></tr>{rows3}</table>
</div>
<div>
<h2>Sumber angka</h2>
<div class="legend" style="font-size:9pt;margin-top:4px">
166.242: Kemendikdasmen, Statistik SLB 2025/2026 (via GoodStats) · 85,2% sekolah tanpa GPK: Dapodik Des 2023 (via BBGTK Sumut, 27 Jan 2026) ·
82% dan 75% belum mencapai standar: OECD, PISA 2022 · 70% vs di bawah 40%: Asesmen Nasional 2024 · 6 dari 10 ruang kelas SD rusak: BPS, Statistik Pendidikan 2025 (TA 2024/2025) ·
IndoBERT 38/40, 7,9 ms vs LLM 760 ms: uji internal tim, 13 Okt 2026.
Rincian lengkap: Sumber_Angka_Video_v2.md.
</div>
</div>
</div>

</body></html>
"""
out = ROOT / "cuesheet.html"
out.write_text(page, encoding="utf-8")
print("wrote", out)
for k in order:
    u = uniq[k]
    print(f"{k:9s} first {tfmt(u['first']):>7s}  n={u['n']}  ai={u['dur']:.2f}s  max={u['max']:.2f}s  slack={u['max'] - u['dur']:+.2f}s")
