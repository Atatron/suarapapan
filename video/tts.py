"""Generate every VO line with edge-tts -> trimmed 48 kHz mono WAV + word timings.

Writes build/vo/<id>.wav and build/vo.json: {id: {dur, words: [[start, end, word], ...]}}
Word times are relative to the trimmed WAV (leading silence removed).
"""
import asyncio, json, subprocess, sys
from pathlib import Path
import numpy as np
import edge_tts
from scipy.io import wavfile

ROOT = Path(__file__).parent
FF = r"C:/Users/ATA/AppData/Local/Programs/Python/Python312/Lib/site-packages/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe"
VOICES = {"G": "id-ID-GadisNeural", "A": "id-ID-ArdiNeural"}
OUT = ROOT / "build" / "vo"
OUT.mkdir(parents=True, exist_ok=True)
SR = 48000


async def gen(line):
    mp3 = OUT / f"{line['id']}.mp3"
    raw = OUT / f"{line['id']}_raw.wav"
    words = []
    com = edge_tts.Communicate(line.get("tts", line["text"]), VOICES[line["voice"]], rate=line["rate"], boundary="WordBoundary")
    with open(mp3, "wb") as f:
        async for ch in com.stream():
            if ch["type"] == "audio":
                f.write(ch["data"])
            elif ch["type"] == "WordBoundary":
                s = ch["offset"] / 1e7
                words.append([s, s + ch["duration"] / 1e7, ch["text"]])
    subprocess.run([FF, "-y", "-loglevel", "error", "-i", str(mp3), "-ar", str(SR), "-ac", "1", str(raw)], check=True)
    sr, x = wavfile.read(raw)
    x = x.astype(np.float32) / 32768
    loud = np.flatnonzero(np.abs(x) > 0.004)
    a, b = max(0, loud[0] - int(0.02 * SR)), min(len(x), loud[-1] + int(0.06 * SR))
    lead = a / SR
    y = x[a:b]
    wavfile.write(OUT / f"{line['id']}.wav", SR, (y * 32767).astype(np.int16))
    words = [[round(s - lead, 3), round(e - lead, 3), w] for s, e, w in words]
    if not words:
        raise SystemExit(f"no word boundaries for {line['id']}")
    return {"dur": round(len(y) / SR, 3), "words": words}


async def main():
    lines = json.loads((ROOT / "naskah.json").read_text(encoding="utf-8"))["lines"]
    only = set(sys.argv[1:])
    p = ROOT / "build" / "vo.json"
    data = json.loads(p.read_text(encoding="utf-8")) if p.exists() else {}
    for ln in lines:
        if only and ln["id"] not in only:
            continue
        data[ln["id"]] = await gen(ln)
        d = data[ln["id"]]
        print(f"{ln['id']:12s} {d['dur']:6.2f}s  words={len(d['words'])}  last={d['words'][-1]}")
    p.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    print("total VO", round(sum(v["dur"] for v in data.values()), 2))

asyncio.run(main())
