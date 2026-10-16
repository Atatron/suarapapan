"""Audio mix from build/timeline.json -> build/mix.wav (48 kHz stereo).

Everything here is synthesized in code (music + SFX), so the soundtrack has no licensing risk.
VO cues get the per-POV treatment named in the timeline:
  muffled  Bima (tunarungu): low-passed, smeared, quieter
  arka     Arka (ADHD): follows the scene's attention curve (ducked + dulled while he drifts away)
  buried   Tara (autisme): voice stays put while every classroom sound rises to the same loudness
  clean    everything else
"""
import json
from pathlib import Path
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt, fftconvolve

ROOT = Path(__file__).parent
SR = 48000
rng = np.random.default_rng(7)
TL = json.loads((ROOT / "build" / "timeline.json").read_text(encoding="utf-8"))
N = int(TL["total"] * SR) + SR // 2
SCN = {s["id"]: s for s in TL["scenes"]}


def lp(x, f, o=4): return sosfilt(butter(o, f, "low", fs=SR, output="sos"), x)
def hp(x, f, o=4): return sosfilt(butter(o, f, "high", fs=SR, output="sos"), x)
def bp(x, a, b, o=3): return sosfilt(butter(o, [a, b], "band", fs=SR, output="sos"), x)
def t_(d): return np.arange(int(d * SR)) / SR
def env(n, a=.005, r=None):
    e = np.ones(n); na = max(1, int(a * SR)); e[:na] = np.linspace(0, 1, na)
    if r: nr = min(n, int(r * SR)); e[-nr:] *= np.linspace(1, 0, nr)
    return e
def add(buf, x, t, g=1.0):
    i = int(round(t * SR))
    if i >= len(buf): return
    if i < 0: x = x[-i:]; i = 0
    x = x[:len(buf) - i]
    buf[i:i + len(x)] += x * g
def kf(t, keys):
    """piecewise-linear keyframes [[t, v], ...] evaluated on an array of times"""
    ts = np.array([k[0] for k in keys]); vs = np.array([k[1] for k in keys])
    return np.interp(t, ts, vs)
def load_vo(line):
    sr, x = wavfile.read(ROOT / "build" / "vo" / f"{line}.wav")
    return x.astype(np.float64) / 32768


# ---------------- SFX ----------------
def s_whoosh():
    n = int(.4 * SR); x = rng.standard_normal(n)
    f = np.linspace(400, 3000, n); y = np.zeros(n)
    for k in range(0, n, 2400):
        y[k:k + 2400] = bp(x[k:k + 2400], f[k] * .7, f[k] * 1.3, 2)
    return y * np.sin(np.linspace(0, np.pi, n)) ** 2 * .5
def s_iris():
    n = int(.32 * SR); x = rng.standard_normal(n); y = np.zeros(n)
    f = np.linspace(600, 5000, n)
    for k in range(0, n, 1200): y[k:k + 1200] = bp(x[k:k + 1200], f[k] * .8, f[k] * 1.25, 2)
    t = t_(.32); y += np.sin(2 * np.pi * np.cumsum(np.linspace(500, 1400, n)) / SR) * .12
    return y * np.sin(np.linspace(0, np.pi, n)) ** 1.5 * .45
def s_pop():
    t = t_(.13); f = np.linspace(950, 480, len(t))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 28) * .7
def s_rise():
    t = t_(.42); f = np.linspace(320, 980, len(t))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / .42) * .35
def s_ding():
    t = t_(1.4)
    return (np.sin(2 * np.pi * 1318.5 * t) + .5 * np.sin(2 * np.pi * 2637 * t) + .25 * np.sin(2 * np.pi * 3955 * t)) * np.exp(-t * 3.2) * .35 * env(len(t), .002)
def s_bell():  # school chime: ding-dong
    out = np.zeros(int(2.0 * SR))
    for i, f in enumerate([659.3, 523.3]):
        t = t_(1.5); tone = sum(a * np.sin(2 * np.pi * f * m * t) for a, m in [(1, 1), (.42, 2.76), (.2, 5.4), (.1, 8.9)])
        add(out, tone * np.exp(-t * 2.4) * .32 * env(len(t), .003), i * .42)
    return out
def s_sparkle():
    out = np.zeros(int(1.2 * SR))
    for i, f in enumerate([1568, 1760, 2093, 2349, 2637, 3136]):
        t = t_(.5); add(out, np.sin(2 * np.pi * f * t) * np.exp(-t * 9) * .22 * env(len(t), .002), i * .07)
    return out
def s_dream():  # harp-like upward glissando for the daydream
    out = np.zeros(int(1.4 * SR))
    for i, m in enumerate([67, 71, 74, 79, 83, 86, 91]):
        t = t_(.7); f = 440 * 2 ** ((m - 69) / 12)
        add(out, (np.sin(2 * np.pi * f * t) + .3 * np.sin(4 * np.pi * f * t)) * np.exp(-t * 5) * .2 * env(len(t), .002), i * .06)
    return out
def s_boing():
    t = t_(.38); f = 260 + 260 * t / .38 + 60 * np.sin(2 * np.pi * 16 * t)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7) * .55 * env(len(t), .003)
def s_hop_out():
    out = np.zeros(int(1.1 * SR)); b = s_boing()
    for i in range(3): add(out, b, i * .22, .8 - i * .15)
    return out
def s_tap():
    t = t_(.05); return bp(rng.standard_normal(len(t)), 1500, 5000) * np.exp(-t * 120) * 1.4
def s_click():
    t = t_(.06); x = bp(rng.standard_normal(len(t)), 2000, 7000) * np.exp(-t * 160) * 1.2
    t2 = t_(.25); hum = np.sin(2 * np.pi * 180 * t2) * np.exp(-t2 * 9) * .12
    out = np.zeros(int(.3 * SR)); add(out, x, 0); add(out, hum, .02); return out
def s_tock():
    t = t_(.18); return (np.sin(2 * np.pi * 820 * t) * np.exp(-t * 45) + bp(rng.standard_normal(len(t)), 800, 3000) * np.exp(-t * 90) * .4) * .8
def s_tick():
    out = np.zeros(int(3.0 * SR))
    for i in range(6):
        t = t_(.08); f = 2600 if i % 2 else 2000
        add(out, np.sin(2 * np.pi * f * t) * np.exp(-t * 90) * .5, i * .5)
    return out
def s_chirp():
    out = np.zeros(int(1.2 * SR))
    for i, d in enumerate([0, .16, .5, .66]):
        t = t_(.11); f = 3200 + 1800 * np.sin(np.pi * t / .11)
        add(out, np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / .11) * .35, d)
    return out
def s_flutter():
    out = np.zeros(int(.7 * SR))
    for i in range(8):
        t = t_(.04); add(out, bp(rng.standard_normal(len(t)), 400, 2200) * np.sin(np.pi * t / .04) * .5, i * .075)
    return out
def s_roll():
    out = np.zeros(int(.8 * SR))
    for i in range(9):
        t = t_(.03); add(out, bp(rng.standard_normal(len(t)), 2000, 6000) * np.exp(-t * 150) * .6, i * .08 + rng.uniform(0, .02))
    return out
def s_drop():  # pencil hits the floor and bounces
    out = np.zeros(int(.7 * SR))
    for i, (d, g) in enumerate([(0, 1), (.16, .55), (.27, .3), (.34, .15)]):
        t = t_(.07); add(out, (np.sin(2 * np.pi * 1450 * t) * .5 + bp(rng.standard_normal(len(t)), 900, 4500)) * np.exp(-t * 70) * g * .7, d)
    return out
def s_page():
    n = int(.45 * SR); x = bp(rng.standard_normal(n), 1500, 9000)
    return x * np.sin(np.linspace(0, np.pi, n)) ** 2 * (0.6 + .4 * np.sin(np.linspace(0, 18, n))) * .25
def s_wobble():
    t = t_(2.0); f = 330 + 40 * np.sin(2 * np.pi * 2.2 * t)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * .08 * env(len(t), .3, .5)
def s_hum():
    t = t_(6.4)
    return (np.sin(2 * np.pi * 110 * t) + .4 * np.sin(2 * np.pi * 220 * t)) * .1 * env(len(t), .5, .4)
def s_rewind():  # VHS rewind: fast warble + tape hiss
    t = t_(.36); f = 900 + 2600 * (t / .36) ** .7 + 180 * np.sin(2 * np.pi * 38 * t)
    tone = np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)) * .12
    hiss = hp(rng.standard_normal(len(t)), 3000) * .25
    return (lp(tone, 6000) + hiss) * env(len(t), .01, .05)
def s_screen():  # projector screen pulled down: ratchet clicks + fabric friction
    out = np.zeros(int(.8 * SR))
    for i in range(9):
        tt = t_(.025); add(out, bp(rng.standard_normal(len(tt)), 1200, 5000) * np.exp(-tt * 200) * .5, i * .075)
    n = int(.7 * SR); add(out, bp(rng.standard_normal(n), 300, 1600) * np.sin(np.linspace(0, np.pi, n)) * .12, 0)
    return out
def s_crack():
    out = np.zeros(int(.5 * SR))
    for i in range(7):
        t = t_(.02); add(out, bp(rng.standard_normal(len(t)), 700, 5000) * np.exp(-t * 200) * (1 - i * .1), i * .045 + rng.uniform(0, .02))
    return out
def s_cheer():
    out = np.zeros(int(1.6 * SR))
    for i, f in enumerate([523, 659, 784, 1047]):
        t = t_(.45); add(out, np.sin(2 * np.pi * f * t) * np.exp(-t * 6) * .25, i * .08)
    for k in range(10):
        t = t_(.06); add(out, bp(rng.standard_normal(len(t)), 900, 4000) * np.exp(-t * 70) * .7, .1 + k * .12 + rng.uniform(0, .04))
    return out
def s_overload():
    """Tara's classroom: eight sources start at the times their stickers appear (relative to this cue),
    each ramping with the scene's noise curve until all of them are as loud as the teacher."""
    sc = SCN["tara"]; t0 = 0.55
    D = sc["dur"] - t0; t = t_(D)
    lvl = kf(t + t0, sc["p"]["noise"])
    def on(ts):  # gate that opens at a sticker time
        return np.clip((t + t0 - ts) / .25, 0, 1)
    src = np.zeros(len(t))
    fan = lp(np.sign(np.sin(2 * np.pi * 96 * t)) * .5 + rng.standard_normal(len(t)) * .4, 700)
    src += fan * .55 * on(.85)
    tick = np.zeros(len(t))
    for k in np.arange(1.15 - t0, D, .5):
        tt = t_(.06); add(tick, np.sin(2 * np.pi * 2300 * tt) * np.exp(-tt * 80) * 1.4, k)
    src += tick * on(1.15)
    cf = 300 + 90 * np.sin(2 * np.pi * .9 * t)
    creak = np.sign(np.sin(2 * np.pi * np.cumsum(cf) / SR)) * (np.sin(2 * np.pi * 26 * t) > 0)
    src += lp(creak, 2600) * .3 * on(1.5) * (0.5 + .5 * np.sin(2 * np.pi * .6 * t) ** 2)
    rain = np.zeros(len(t))
    for k in np.sort(rng.uniform(1.8 - t0, D, 260)):
        tt = t_(.012); add(rain, bp(rng.standard_normal(len(tt)), 2500, 9000) * np.exp(-tt * 300) * rng.uniform(.4, 1.0), k)
    src += rain * .9 * on(1.8)
    wh = bp(rng.standard_normal(len(t)), 2200, 6500) * (0.5 + .5 * np.sign(np.sin(2 * np.pi * 3.1 * t + 2 * np.sin(2 * np.pi * .7 * t))))
    src += wh * .42 * on(2.1)
    mf = 62 + 10 * np.sin(2 * np.pi * .35 * t)
    motor = lp(np.sign(np.sin(2 * np.pi * np.cumsum(mf) / SR)) * (1 + .5 * np.sin(2 * np.pi * 9 * t)), 900)
    src += motor * .5 * on(2.4)
    taps = np.zeros(len(t))
    for k in np.arange(2.7 - t0, D, .22):
        tt = t_(.04); add(taps, bp(rng.standard_normal(len(tt)), 600, 3000) * np.exp(-tt * 110) * 2.2, k)
    src += taps * on(2.7)
    buzz = np.sin(2 * np.pi * 6200 * t) * .12 + lp(np.sign(np.sin(2 * np.pi * 120 * t)), 2000) * .14
    src += buzz * on(3.0)
    out = src * (.15 + 1.25 * lvl)
    return out * env(len(out), .05, .004)

SFX = {k[2:]: v for k, v in globals().items() if k.startswith("s_")}


# ---------------- MUSIC ----------------
BPM = 100; BEAT = 60 / BPM
def ks_fast(freq, dur, decay=.996):
    n = int(dur * SR); p = max(2, int(round(SR / freq)))
    reps = n // p + 2
    buf = rng.uniform(-1, 1, p); rows = [buf]
    for _ in range(reps):
        nb = decay * .5 * (buf + np.roll(buf, -1)); rows.append(nb); buf = nb
    return np.concatenate(rows)[:n]
NOTE = lambda m: 440 * 2 ** ((m - 69) / 12)
CHORDS = {"C": [60, 64, 67, 72], "G": [55, 62, 67, 71], "Am": [57, 64, 69, 72], "F": [53, 60, 65, 69], "Dm": [50, 57, 62, 65], "Em": [52, 59, 64, 67]}
PLUCK = {}
def pluck(m, d=1.6):
    if m not in PLUCK: PLUCK[m] = ks_fast(NOTE(m), d) * env(int(d * SR), .002, .3)
    return PLUCK[m]
def ukulele(t0, t1, prog=("C", "G", "Am", "F"), gain=1.0):
    out = np.zeros(N); pattern = [0, 1, 1.5, 2.5, 3]
    bar = 4 * BEAT; b = 0; t = t0
    while t < t1:
        ch = CHORDS[prog[b % len(prog)]]
        for k, pos in enumerate(pattern):
            ts = t + pos * BEAT
            if ts >= t1: break
            down = k % 2 == 0
            for j, m in enumerate(ch if down else ch[::-1]): add(out, pluck(m), ts + j * .012, gain * (.22 if down else .15))
        bt = t_(bar * .95); add(out, np.sin(2 * np.pi * NOTE(ch[0] - 24) * bt) * np.exp(-bt * 1.2) * .35 * gain, t)
        b += 1; t += bar
    return out
def glock(t0, notes, gain=.18, step=None):
    out = np.zeros(N); step = step or BEAT / 2
    for k, m in enumerate(notes):
        if m is None: continue
        t = t_(1.0); add(out, (np.sin(2 * np.pi * NOTE(m) * t) + .3 * np.sin(2 * np.pi * NOTE(m) * 4 * t)) * np.exp(-t * 4) * gain * env(len(t), .002), t0 + k * step)
    return out
def pad(t0, t1, prog=("Am", "F", "C", "G"), gain=.08, bars=2):
    out = np.zeros(N); bar = 4 * BEAT; b = 0; t = t0
    while t < t1:
        d = min(bar * bars, t1 - t); tt = t_(d)
        x = np.zeros(len(tt))
        for m in CHORDS[prog[b % len(prog)]][:3]:
            for det in (-.06, .06):
                x += np.sin(2 * np.pi * NOTE(m) * (1 + det / 100) * tt) + .3 * np.sin(2 * np.pi * NOTE(m + 12) * tt)
        add(out, lp(x, 1400) * env(len(tt), .6, .6) * gain, t)
        b += 1; t += bar * bars
    return out
def shaker(t0, t1, gain=.05):
    out = np.zeros(N); t = t0
    while t < t1:
        tt = t_(.05); add(out, hp(rng.standard_normal(len(tt)), 5000) * np.exp(-tt * 60) * gain * (1.4 if int((t - t0) / (BEAT / 2)) % 2 == 0 else .8), t)
        t += BEAT / 2
    return out


def main():
    vo = np.zeros(N)
    for c in TL["cues"]:
        x = load_vo(c["line"])
        fx = c["fx"]
        if fx == "muffled":
            x = lp(x, 340, 4) * 2.4
            x = fftconvolve(x, rng.standard_normal(int(.25 * SR)) * np.exp(-np.arange(int(.25 * SR)) / SR * 16) * .04)[:len(x) + int(.2 * SR)]
            x *= .42
        elif fx == "arka":
            sc = SCN[c["scene"]]
            tt = c["off"] + np.arange(len(x)) / SR
            att = kf(tt, sc["p"]["attn"])
            far = lp(x, 900, 2)
            x = (x * att + far * (1 - att)) * (.26 + .74 * att)
        elif fx == "buried":
            x = x * .85
        add(vo, x, c["t"])

    # level reference: the teacher's voice inside Tara's POV
    ta0, ta1 = int(SCN["tara"]["start"] * SR), int((SCN["tara"]["start"] + SCN["tara"]["dur"]) * SR)
    seg = vo[ta0:ta1]; vo_rms = np.sqrt(np.mean(seg[np.abs(seg) > .01] ** 2))
    sfx = np.zeros(N)
    for s in TL["sfx"]:
        x = SFX[s["name"]]()
        if s["name"] == "overload":
            tail = x[-int(1.5 * SR):]
            x = x * (1.5 * vo_rms / np.sqrt(np.mean(tail ** 2)))  # at full level: as loud as the teacher, not louder
        add(sfx, x, s["t"], s["gain"])

    # ---- music plan ----
    m = np.zeros(N)
    q0 = SCN["quad"]["start"]; st1 = SCN["solusi"]["start"]
    m += pad(q0 + .1, st1 + .2, ("Am", "F", "C", "G"), gain=.07)
    m += glock(q0 + .3, [69, None, 72, None, 76, None, 74, None], .09, step=BEAT)
    u0 = SCN["solusi"]["start"] + .15
    end = TL["total"]
    m += ukulele(u0, end - 2.4, ("C", "G", "Am", "F"), 1.0)
    m += shaker(SCN["demo1"]["start"], end - 2.4, .045)
    m += glock(u0 + .05, [72, 76, 79, 84], .16)
    m += glock(SCN["demo2"]["start"] + TL["scenes"][[s["id"] for s in TL["scenes"]].index("demo2")]["p"]["tap"] + .3, [79, 84, 88], .12)
    for j, mm in enumerate(CHORDS["C"] + [76]):
        add(m, ks_fast(NOTE(mm), 3.0) * env(int(3.0 * SR), .002, 1.0), end - 2.4 + j * .02, .22)
    vabs = lp(np.abs(vo), 6, 2)
    duck = 1 - .6 * np.clip(vabs / .035, 0, 1)
    mg = np.full(N, .55)
    fin = int((end - .7) * SR); mg[fin:] *= np.linspace(1, 0, N - fin)

    # ---- classroom room tone through the POVs (muffled for Bima) ----
    room = lp(rng.standard_normal(N), 900, 2) * .014
    rg = np.zeros(N)
    for sid in ("arka", "laras", "tara"):
        a0, a1 = int(SCN[sid]["start"] * SR), int((SCN[sid]["start"] + SCN[sid]["dur"]) * SR); rg[a0:a1] = 1
    rg = lp(rg, 3, 1)
    rb = np.zeros(N); a0, a1 = int(SCN["bima"]["start"] * SR + .9 * SR), int((SCN["bima"]["start"] + SCN["bima"]["dur"]) * SR); rb[a0:a1] = 1
    room_b = lp(rng.standard_normal(N), 250, 2) * .02 * lp(rb, 3, 1)

    sduck = np.ones(N); q = int(SCN["quad"]["start"] * SR)
    sduck[q:] = (1 - .55 * np.clip(vabs / .035, 0, 1))[q:]
    # everything except the voices. The ducking above was computed from the voices, so this keeps the exact
    # dips the final mix has: a voice-over laid on top lands in the same balance as the approved video.
    rest = sfx * .9 * sduck + m * mg * duck + room * rg + room_b
    mix = vo + rest
    # the "everything stops" beat: hard silence from the end of Tara's POV through the black frame
    d0 = int(SCN["diam"]["start"] * SR); d1 = int((SCN["diam"]["start"] + SCN["diam"]["dur"]) * SR)
    mix[d0:d1] = 0.0
    rest[d0:d1] = 0.0
    n_out = int(end * SR)
    mix, rest = mix[:n_out], rest[:n_out]
    # fixed loudness target over the non-silent parts of the FULL mix (the bed reuses the same gain)
    act = np.abs(lp(mix, 20, 1)) > 1e-4
    rms = np.sqrt(np.mean(mix[act] ** 2))
    gain = 10 ** (-19 / 20) / rms
    peak = float(np.max(np.abs(mix * gain)))
    lim = .84

    def finish(x):
        x = x * gain
        over = np.abs(x) > lim * .8
        return np.where(over, np.sign(x) * (lim * .8 + (lim * .2) * np.tanh((np.abs(x) - lim * .8) / (lim * .2))), x)

    mix, rest = finish(mix), finish(rest)
    wavfile.write(ROOT / "build" / "mix.wav", SR, (np.stack([mix, mix], 1) * 32767).astype(np.int16))
    wavfile.write(ROOT / "build" / "bed.wav", SR, (np.stack([rest, rest], 1) * 32767).astype(np.int16))
    print("mix ok", round(len(mix) / SR, 2), "s, peak before norm", round(float(peak), 3), "| bed.wav written (no voices)")


if __name__ == "__main__":
    main()
