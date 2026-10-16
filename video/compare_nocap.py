"""Prove that the caption-free render equals the approved video except where narrator captions were.

Decodes both videos at 480x270 grey, frame by frame, and checks
  * rows above the caption zone (y < 928): no visible difference in any frame
  * caption zone (y >= 944): differs exactly in the frames where the approved video showed a narrator caption
Usage: python compare_nocap.py <approved.mp4> <nocap.mp4>
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).parent
FF = r"C:/Users/ATA/AppData/Local/Programs/Python/Python312/Lib/site-packages/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe"
W, H = 480, 270
TOP = int(928 / 4)       # rows above the caption pill
CAP0 = int(944 / 4)      # rows holding the caption pill (y 958..1036)


def open_pipe(path):
    return subprocess.Popen([FF, "-v", "error", "-i", path, "-vf", f"scale={W}:{H},format=gray", "-f", "rawvideo", "-"],
                            stdout=subprocess.PIPE)


def main():
    a_path, b_path = sys.argv[1], sys.argv[2]
    tl = json.loads((ROOT / "build" / "timeline.json").read_text(encoding="utf-8"))
    fps = tl["fps"]
    caps = [(c["t"] - 0.05, c["t"] + c["dur"] + 0.25) for c in tl["cues"] if c["caption"]]
    pa, pb = open_pipe(a_path), open_pipe(b_path)
    n = 0
    top_max, top_mean = [], []
    cap_diff = []
    while True:
        ra, rb = pa.stdout.read(W * H), pb.stdout.read(W * H)
        if len(ra) < W * H or len(rb) < W * H:
            break
        fa = np.frombuffer(ra, np.uint8).reshape(H, W).astype(np.int16)
        fb = np.frombuffer(rb, np.uint8).reshape(H, W).astype(np.int16)
        d = np.abs(fa - fb)
        top_max.append(int(d[:TOP].max()))
        top_mean.append(float(d[:TOP].mean()))
        cap_diff.append(float(d[CAP0:].mean()))
        n += 1
    pa.terminate(); pb.terminate()
    t = np.arange(n) / fps
    want = np.zeros(n, bool)
    for a, b in caps:
        want |= (t >= a + 0.12) & (t <= b - 0.12)          # clearly inside a caption's life (skip fade edges)
    none = np.ones(n, bool)
    for a, b in caps:
        none &= ~((t >= a - 0.1) & (t <= b + 0.1))         # clearly outside every caption
    cd = np.array(cap_diff)
    print(f"frames compared: {n}")
    print(f"above caption zone: max pixel diff {max(top_max)}, worst frame mean {max(top_mean):.3f}")
    print(f"caption zone, frames WITH a caption in the approved video: {int(want.sum())}, mean diff min {cd[want].min():.2f} / median {np.median(cd[want]):.2f}")
    print(f"caption zone, frames WITHOUT any caption: {int(none.sum())}, mean diff max {cd[none].max():.3f}")
    miss = [round(float(t[i]), 2) for i in np.flatnonzero(want & (cd < 0.5))]
    extra = [round(float(t[i]), 2) for i in np.flatnonzero(none & (cd >= 0.5))]
    print("frames where a caption should differ but did not:", miss[:12], f"({len(miss)})")
    print("frames that differ with no caption in the approved video:", extra[:12], f"({len(extra)})")


if __name__ == "__main__":
    main()
