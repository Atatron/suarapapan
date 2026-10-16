"""Extract frames from the rendered video and tile them into labelled contact sheets for review.

Usage: python review.py <video> <fps> <out_prefix> [start end]
Each tile is labelled with its timestamp and the scene it belongs to.
"""
import json, subprocess, sys, tempfile
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).parent
FF = r"C:/Users/ATA/AppData/Local/Programs/Python/Python312/Lib/site-packages/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe"


def main():
    vid, fps, out = sys.argv[1], float(sys.argv[2]), sys.argv[3]
    a = float(sys.argv[4]) if len(sys.argv) > 4 else 0.0
    b = float(sys.argv[5]) if len(sys.argv) > 5 else None
    tl = json.loads((ROOT / "build" / "timeline.json").read_text(encoding="utf-8"))
    scene_at = lambda t: next((s["id"] for s in tl["scenes"] if s["start"] <= t < s["start"] + s["dur"]), "end")
    with tempfile.TemporaryDirectory() as td:
        args = [FF, "-v", "error", "-ss", str(a)] + (["-to", str(b)] if b else []) + ["-i", vid, "-vf", f"fps={fps},scale=384:216", f"{td}/f_%04d.png"]
        subprocess.run(args, check=True)
        fs = sorted(Path(td).glob("f_*.png"))
        per, cols = 40, 5
        for sh in range(0, len(fs), per):
            chunk = fs[sh:sh + per]
            rows = (len(chunk) + cols - 1) // cols
            img = Image.new("RGB", (cols * 384, rows * 234), "white")
            d = ImageDraw.Draw(img)
            for i, f in enumerate(chunk):
                t = a + (sh + i + .5) / fps  # the fps filter samples mid-interval
                x, y = (i % cols) * 384, (i // cols) * 234
                img.paste(Image.open(f).convert("RGB"), (x, y + 18))
                d.text((x + 4, y + 3), f"{t:6.2f}s  {scene_at(t)}", fill="black")
            p = f"{out}_{sh // per + 1}.png"
            img.save(p)
            print(p, img.size)


if __name__ == "__main__":
    main()
