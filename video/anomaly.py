"""Frame-level anomaly scan of the rendered video.

Decodes every frame at 192x108 grey and reports:
  * single-frame flashes: frame i differs a lot from both neighbours while i-1 and i+1 match each other
  * hard jumps that do not coincide with a planned cut (scene start or a known in-scene cut)
Usage: python anomaly.py <video>
"""
import json, subprocess, sys
from pathlib import Path
import numpy as np

ROOT = Path(__file__).parent
FF = r"C:/Users/ATA/AppData/Local/Programs/Python/Python312/Lib/site-packages/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe"
W, H = 192, 108


def main():
    vid = sys.argv[1]
    raw = subprocess.run([FF, "-v", "error", "-i", vid, "-vf", f"scale={W}:{H},format=gray", "-f", "rawvideo", "-"], capture_output=True, check=True).stdout
    fr = np.frombuffer(raw, np.uint8).reshape(-1, H, W).astype(np.float32)
    n = len(fr)
    d = np.abs(np.diff(fr, axis=0)).mean(axis=(1, 2))           # d[i] = |f[i+1]-f[i]|
    d2 = np.abs(fr[2:] - fr[:-2]).mean(axis=(1, 2))              # d2[i] = |f[i+2]-f[i]|
    tl = json.loads((ROOT / "build" / "timeline.json").read_text(encoding="utf-8"))
    fps = tl["fps"]
    cuts = [s["start"] for s in tl["scenes"]]
    # known in-scene cuts: POV reaction shots, iris end, demo1 card switches
    for s in tl["scenes"]:
        p = s.get("p", {})
        if "react" in p: cuts.append(s["start"] + p["react"])
        if s["id"] in ("bima", "arka", "laras", "tara") and p.get("sent"): cuts.append(s["start"] + p["sent"][0][1] - .03)
        if s["id"] == "demo1":
            w = tl["words"]["n_empat"]; em = p["em"]
            for word in ("Bima", "Laras", "Tara", "Saat"):
                t0 = next(a for a, b, x in w if x == word)
                cuts.append(s["start"] + em + t0 - .18 - (.1 if word == "Bima" else 0))
    cuts = np.array(sorted(cuts))
    print(f"{n} frames, median frame diff {np.median(d):.2f}, 99th pct {np.percentile(d, 99):.2f}")
    flashes = [i + 1 for i in range(len(d2)) if d[i] > 12 and d[i + 1] > 12 and d2[i] < .35 * min(d[i], d[i + 1])]
    print("single-frame flashes:", [(f, round(f / fps, 2)) for f in flashes] or "none")
    jumps = [i + 1 for i in range(len(d)) if d[i] > 14]
    unplanned = [(j, round(j / fps, 2), round(float(d[j - 1]), 1)) for j in jumps if np.min(np.abs(cuts - j / fps)) > 2.5 / fps]
    print(f"hard jumps: {len(jumps)}, not at a planned cut: {len(unplanned)}")
    for j, t, v in unplanned: print(f"   frame {j} t={t}s diff={v}")


if __name__ == "__main__":
    main()
