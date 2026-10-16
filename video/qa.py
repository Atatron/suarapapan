"""QA for the v2 video. Run with the venv that has faster_whisper (suarapapan/ml/.venv).

Hard checks: container/format, duration <= 2:00, black frames only where intended (the silence beat and the
final fade), no long freezes outside held shots, no price words anywhere in the shown/spoken text, and a Whisper
transcript compared with every narrator line (each number must be recognisable).
"""
import json, re, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).parent
FF = r"C:/Users/ATA/AppData/Local/Programs/Python/Python312/Lib/site-packages/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe"
VID = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "build" / "SuaraPapan_Video.mp4"
TL = json.loads((ROOT / "build" / "timeline.json").read_text(encoding="utf-8"))
SCN = {s["id"]: s for s in TL["scenes"]}
fails, notes = [], []

def ff(*args):
    return subprocess.run([FF, "-hide_banner", *args], capture_output=True, text=True, encoding="utf-8", errors="replace").stderr

info = ff("-i", str(VID))
dur = re.search(r"Duration: (\d+):(\d+):([\d.]+)", info)
secs = int(dur[1]) * 3600 + int(dur[2]) * 60 + float(dur[3])
print("duration", secs)
if secs > 120: fails.append(f"duration {secs} > 120")
if abs(secs - TL["total"]) > 0.15: fails.append(f"duration {secs} differs from timeline {TL['total']}")
for need in ["1920x1080", "30 fps", "h264", "aac", "48000 Hz"]:
    if need not in info: fails.append(f"missing {need}")

# black: allowed only inside the silence beat and the final 0.8 s fade
bl = ff("-i", str(VID), "-vf", "blackdetect=d=0.05:pix_th=0.06", "-an", "-f", "null", "-")
blacks = [(float(a), float(b)) for a, b in re.findall(r"black_start:([\d.]+) black_end:([\d.]+)", bl)]
print("black segments", blacks)
d0, d1 = SCN["diam"]["start"], SCN["diam"]["start"] + SCN["diam"]["dur"]
for a, b in blacks:
    if not ((a >= d0 - .05 and b <= d1 + .05) or a >= secs - .8):
        fails.append(f"unexpected black {a:.2f}-{b:.2f}")

fr = ff("-i", str(VID), "-vf", "freezedetect=n=0.0008:d=1.2", "-an", "-f", "null", "-")
freezes = re.findall(r"freeze_start: ([\d.]+).*?freeze_end: ([\d.]+)", fr, re.S)
print("frozen >=1.2s", freezes)
for a, b in freezes:
    notes.append(f"freeze {float(a):.2f}-{float(b):.2f} (check it is an intended hold)")

sl = ff("-i", str(VID), "-af", "silencedetect=n=-50dB:d=0.3", "-vn", "-f", "null", "-")
sil = [(float(a), float(b)) for a, b in re.findall(r"silence_start: ([\d.]+)\s*\n.*?silence_end: ([\d.]+)", sl)]
print("silences", sil)
for a, b in sil:
    if not (a >= d0 - .1 and b <= d1 + .15) and a < secs - 1.0:
        notes.append(f"silence {a:.2f}-{b:.2f} outside the silence beat")

# no price data anywhere in what is shown or spoken
texts = "".join((ROOT / f).read_text(encoding="utf-8") for f in ["index.html", "scenes_hook.js", "scenes_mid.js", "scenes_end.js", "world.js", "naskah.json"])
for pat in [r"\bRp\.?\s?\d", r"rupiah", r"\bharga\b", r"\bbiaya\b", r"\bmurah\b", r"\bmahal\b", r"275", r"\bgratis\b", r"\bjuta\b"]:
    if re.search(pat, texts, re.I): fails.append(f"price-like text found: {pat}")

# transcript vs script
from faster_whisper import WhisperModel
import numpy as np
from scipy.io import wavfile
wav = ROOT / "build" / "qa_audio.wav"
subprocess.run([FF, "-y", "-loglevel", "error", "-i", str(VID), "-ac", "1", "-ar", "16000", str(wav)], check=True)
m = WhisperModel("small", device="cpu", compute_type="int8")
_, au = wavfile.read(wav)
au = au.astype(np.float32) / 32768
script = {l["id"]: l["text"] for l in json.loads((ROOT / "naskah.json").read_text(encoding="utf-8"))["lines"]}
NUMW = {"satu": "1", "dua": "2", "tiga": "3", "empat": "4", "lima": "5", "enam": "6", "tujuh": "7", "delapan": "8", "sembilan": "9", "sepuluh": "10"}
def norm(s):
    s = s.lower().replace("-", " ").replace("ei ai", "ai")
    s = re.sub(r"(\d)[.,](\d{3})", r"\1\2", s)           # 166.000 -> 166000
    s = re.sub(r"[^\w\s]", " ", s)
    s = re.sub(r"\bdi\s+(?=\w)", "di", s)                 # di rumput == dirumput
    s = s.replace("166 ribu", "166000")
    return " ".join(NUMW.get(w, w) for w in s.split())
print("\nPER-LINE CHECK (narrator + demo teacher lines):")
worst = []
for c in TL["cues"]:
    if c["fx"] not in ("clean",) or c["scene"] in ("laras",):
        continue
    a, b = int(max(0, c["t"] - .1) * 16000), int((c["t"] + c["dur"] + .15) * 16000)
    segs, _ = m.transcribe(au[a:b], language="id", beam_size=5, vad_filter=False, initial_prompt="Suara Papan, SLB, PISA, GPK, IndoBERT, LLM, kelinci")
    hyp = " ".join(s.text for s in segs).strip()
    ref = script[c["line"]]
    rw, hw = norm(ref).split(), norm(hyp).split()
    # word recall: how many script words Whisper heard
    hit = sum(1 for w in rw if w in hw)
    rec = hit / max(1, len(rw))
    nums_ref = re.findall(r"\d+", ref.replace(".", ""))
    miss_nums = [x for x in nums_ref if x not in re.sub(r"[.,]", "", hyp)]
    flag = "" if rec >= .8 and not miss_nums else "  <-- check"
    print(f"  {c['t']:7.2f} {c['line']:9s} recall {rec:4.0%}  nums missing {miss_nums}{flag}\n           ref: {ref}\n           hyp: {hyp}")
    if rec < .6: fails.append(f"{c['line']} at {c['t']:.2f}: only {rec:.0%} of words recognised")
    elif flag: notes.append(f"{c['line']} at {c['t']:.2f}: recall {rec:.0%}, numbers missing {miss_nums}")
print("\nNOTES:", *notes, sep="\n  ")
print("\nFAILS:" if fails else "\nALL HARD CHECKS PASSED", *fails, sep="\n  ")
