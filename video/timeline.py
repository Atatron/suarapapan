"""Single source of truth for timing. Writes build/timeline.json used by index.html (picture) and mix.py (sound).

Scene offsets are computed from the measured VO durations, so re-running tts.py and then this script keeps
picture and sound in sync. Refuses to write if a VO line runs past its scene or the total exceeds LIMIT.
"""
import json
from pathlib import Path
import numpy as np
from scipy.io import wavfile

ROOT = Path(__file__).parent
FPS = 30
LIMIT = 119.5  # competition limit is 2:00; keep a margin

VO = {k: v["dur"] for k, v in json.loads((ROOT / "build" / "vo.json").read_text(encoding="utf-8")).items()}
GAP = 0.14  # pause between the three parts of the teacher's sentence


def sentence(t0, parts=("g_a", "g_b", "g_c")):
    out, t = [], t0
    for p in parts:
        out.append((p, round(t, 3)))
        t += VO[p] + GAP
    return out, round(t - GAP, 3)


def build():
    S = []  # (id, dur, trans, [(line, off, fx, caption)], [(sfx, off, gain)], params)

    # ---------------- HOOK ----------------
    intro = 1.5  # long enough to read the opening line
    seq, end = sentence(intro)
    S.append(("bima", round(end + 0.62, 2), "cut",
              [(l, o, "muffled", False) for l, o in seq],
              [("bell", 0.0, 0.55), ("iris", intro - 0.27, 0.5), ("hum", intro - 0.05, 0.5), ("pop", end + 0.12, 0.5)],
              {"sent": seq, "react": round(end + 0.02, 2)}))
    S.append(("rw1", 0.36, "cut", [], [("rewind", 0.0, 0.75)], {}))

    seq, end = sentence(0.62)
    attn = [[0, 1], [1.55, 1], [2.25, .26], [6.55, .26], [6.85, 1]]
    S.append(("arka", round(end + 0.74, 2), "cut",
              [(l, o, "arka", False) for l, o in seq],
              [("iris", 0.3, 0.5), ("chirp", 1.45, 0.75), ("flutter", 1.9, 0.6), ("chirp", 2.9, 0.55), ("tick", 3.2, 0.55),
               ("roll", 4.25, 0.75), ("drop", 4.95, 0.7), ("dream", 5.25, 0.45), ("whoosh", 6.5, 0.45), ("pop", end + 0.1, 0.5)],
              {"sent": seq, "attn": attn, "react": round(end + 0.02, 2)}))
    S.append(("rw2", 0.36, "cut", [], [("rewind", 0.0, 0.75)], {}))

    seq, end = sentence(0.62)
    S.append(("laras", round(end + 0.6, 2), "cut",
              [(l, o, "clean", False) for l, o in seq],
              [("iris", 0.3, 0.5), ("page", 1.35, 0.6), ("wobble", 2.6, 0.5), ("wobble", 4.7, 0.55), ("pop", end + 0.1, 0.45)],
              {"sent": seq, "react": round(end + 0.02, 2)}))
    S.append(("rw3", 0.36, "cut", [], [("rewind", 0.0, 0.75)], {}))

    seq, _ = sentence(0.62, ("g_a", "g_b"))
    S.append(("tara", 5.35, "cut",
              [(l, o, "buried", False) for l, o in seq],
              [("iris", 0.3, 0.5), ("overload", 0.55, 1.0)],
              {"sent": seq, "react": 4.55, "noise": [[0.55, 0], [1.3, .35], [2.5, .8], [3.8, 1.0], [5.35, 1.0]]}))
    S.append(("diam", 0.5, "cut", [], [], {}))
    S.append(("quad", round(VO["n_hook"] + 0.55, 2), "cut", [("n_hook", 0.25, "clean", True)], [("tock", 0.2, 0.6)], {}))

    # ---------------- STATS ----------------
    lead, tail = 0.35, 0.45
    S.append(("pdbk", round(VO["n_s1"] + lead + tail, 2), "push", [("n_s1", lead, "clean", True)], [("whoosh", 0.0, 0.4), ("rise", 0.9, 0.4)], {}))
    S.append(("gpk", round(VO["n_s2"] + lead + tail, 2), "push", [("n_s2", lead, "clean", True)], [("whoosh", 0.0, 0.4), ("rise", 1.0, 0.4)], {}))
    S.append(("pisa", round(VO["n_s3"] + lead + tail, 2), "push", [("n_s3", lead, "clean", True)], [("whoosh", 0.0, 0.4), ("rise", 1.2, 0.4), ("rise", 5.6, 0.4)], {}))
    S.append(("timpang", round(VO["n_s4"] + lead + tail, 2), "push", [("n_s4", lead, "clean", True)], [("whoosh", 0.0, 0.4), ("rise", 1.6, 0.4), ("rise", 3.4, 0.4), ("crack", 6.6, 0.55)], {}))

    # ---------------- ROOT CAUSE + SOLUTION ----------------
    S.append(("akar", round(VO["n_akar"] + 0.35 + 0.45, 2), "fade", [("n_akar", 0.35, "clean", True)], [], {}))
    S.append(("solusi", round(VO["n_solusi"] + 0.6 + 0.7, 2), "fade", [("n_solusi", 0.6, "clean", True)], [("ding", 0.25, 0.6), ("sparkle", 0.45, 0.7)], {}))

    # ---------------- DEMO ----------------
    a = 0.9
    e_a = a + VO["g_a"]
    em = round(e_a + 0.32, 2)
    S.append(("demo1", round(em + VO["n_empat"] + 0.22, 2), "fade",
              [("g_a", a, "clean", False), ("n_empat", em, "clean", True)],
              [("screen", 0.05, 0.55), ("click", 0.66, 0.6), ("boing", a + 1.25, 0.5), ("boing", a + 1.5, 0.5), ("boing", a + 1.75, 0.5), ("pop", e_a + 0.05, 0.5)],
              {"ga": a, "em": em}))
    b = 0.2
    c = round(b + VO["g_b"] + 0.5, 2)
    tap = round(c + VO["g_c"] + 0.5, 2)
    ben = round(tap + 0.15, 2)
    S.append(("demo2", round(ben + VO["g_benar"] + 0.3, 2), "cut",
              [("g_b", b, "clean", False), ("g_c", c, "clean", False), ("g_benar", ben, "clean", False)],
              [("hop_out", b + 1.15, 0.55), ("pop", b + VO["g_b"] + 0.15, 0.45), ("pop", c + VO["g_c"] + 0.05, 0.35), ("pop", c + VO["g_c"] + 0.15, 0.35), ("pop", c + VO["g_c"] + 0.25, 0.35),
               ("tap", tap, 0.7), ("ding", tap, 0.55), ("sparkle", ben + 0.55, 0.5), ("cheer", ben + 0.55, 0.5)],
              {"gb": b, "gc": c, "tap": tap}))
    S.append(("sampai", round(VO["n_sampai"] + 0.25 + 0.4, 2), "fade", [("n_sampai", 0.25, "clean", True)], [], {}))

    # ---------------- TECH ----------------
    m = round(0.3 + VO["n_teknis"] + 0.25, 2)
    W = json.loads((ROOT / "build" / "vo.json").read_text(encoding="utf-8"))
    wt = lambda line, word: next(a for a, b, w in W[line]["words"] if w.lower().startswith(word))
    chips = [round(0.3 + wt("n_teknis", w), 2) for w in ("jumlah", "benda", "aksi", "tempat")]
    S.append(("teknis", round(m + VO["n_model"] + 0.4, 2), "push", [("n_teknis", 0.3, "clean", True), ("n_model", m, "clean", True)],
              [("whoosh", 0.0, 0.4), ("pop", 0.55, 0.35), ("pop", 0.85, 0.35)] + [("pop", c, 0.4) for c in chips] +
              [("rise", round(m + wt("n_model", "indobert"), 2), 0.45), ("ding", round(m + wt("n_model", "96"), 2), 0.55)],
              {"m": m}))

    # ---------------- END ----------------
    S.append(("akhir", round(VO["n_akhir"] + 0.45 + 1.0, 2), "fade", [("n_akhir", 0.45, "clean", False)], [("sparkle", 0.3, 0.6)], {}))
    return S


def envelope(wav_path):
    sr, x = wavfile.read(wav_path)
    x = x.astype(np.float32) / 32768
    hop = sr // FPS
    nfr = len(x) // hop + 1
    rms = np.array([np.sqrt(np.mean(x[i * hop:(i + 1) * hop] ** 2) + 1e-12) for i in range(nfr)])
    rms = rms / (np.percentile(rms, 95) + 1e-9)
    return [round(float(min(1, v)), 3) for v in rms]


def main():
    vo = json.loads((ROOT / "build" / "vo.json").read_text(encoding="utf-8"))
    t = 0.0
    scenes, cues, sfx = [], [], []
    for sid, dur, trans, vcues, scues, params in build():
        for line, off, fx, cap in vcues:
            endt = off + vo[line]["dur"]
            # Tara's POV is cut off mid-sentence on purpose (hard cut to silence)
            assert endt <= dur - 0.15 or sid in ("tara", "akhir"), f"{line} ends at {endt:.2f} > scene {sid} {dur}"
            cues.append({"line": line, "t": round(t + off, 3), "dur": vo[line]["dur"], "fx": fx, "caption": cap, "scene": sid, "off": off})
        for name, off, gain in scues:
            sfx.append({"name": name, "t": round(t + off, 3), "gain": gain, "scene": sid})
        scenes.append({"id": sid, "start": round(t, 3), "dur": dur, "trans": trans, "p": params})
        t += dur
    total = round(t, 3)
    assert total <= LIMIT, f"total {total} > {LIMIT}"
    words = {k: [[float(a), float(b), w] for a, b, w in v["words"]] for k, v in vo.items()}
    env = {k: envelope(ROOT / "build" / "vo" / f"{k}.wav") for k in vo}
    text = {l["id"]: l["text"] for l in json.loads((ROOT / "naskah.json").read_text(encoding="utf-8"))["lines"]}
    out = {"text": text, "fps": FPS, "total": total, "scenes": scenes, "cues": cues, "sfx": sfx, "words": words, "env": env}
    (ROOT / "build" / "timeline.json").write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")
    for s in scenes:
        print(f"{s['start']:7.2f}  {s['id']:8s} {s['dur']:5.2f}  {s['trans']}")
    print("TOTAL", total, "s =", int(round(total * FPS)), "frames")


if __name__ == "__main__":
    main()
