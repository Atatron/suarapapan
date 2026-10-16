# SUARA PAPAN — "Kelas yang Sunyi" · Production Prompt Pack v2

Frame-accurate generation pack for the 1:58 hackathon video. Supersedes
[Prompt_Video_Kartun_SuaraPapan.md](Prompt_Video_Kartun_SuaraPapan.md) (kept for reference).
Script/VO lines are unchanged from [Naskah_Video_Kartun_SuaraPapan.md](Naskah_Video_Kartun_SuaraPapan.md).

**Specs:** 1920×1080 · 16:9 · 24 fps · 118 s = **2,832 frames** · silent clips, all audio and text in post.

---

## 0. Director's decisions (read before generating)

These resolve conflicts inside the brief. Each one exists because a generator will get it wrong otherwise.

| # | Problem in the brief | Decision |
|---|---|---|
| D1 | "No baked-in text/numbers" vs. board showing `3 − 2 = ?`, buttons `0 1 2`, tags, 82%, 85,2%, timer | Generate **blank** boards, buttons, tags and timer faces. Every glyph is added in CapCut. |
| D2 | Text overlays on a moving board will slide off | Shots with on-board overlays (S3, S8, S9, S13) use a **locked-off camera**. Any push-in happens in post (scale the merged layer), so text and art move together. |
| D3 | Generators flip "right ear" | Front view: hearing aid on **the left side of the image**. Three-quarter view: head turned toward **frame-right** so his right ear faces camera. **Never** horizontal-flip a Raka clip in the edit. |
| D4 | Hearing aid "in every single shot" vs. POV shots | Impossible in POV (S3, S13) and in shots without Raka (S1 wide, S4–S6, S8, S10–S12, S14). Rule applies to every frame where Raka's head is visible. |
| D5 | S2 0.5 s desaturation and S7 colour flood are unreliable from a video model | Generate both in **full colour**; do the grade in post with keyframes (exact frame counts below). Same for the cool grade on S3. |
| D6 | S13 must match S3 exactly | Generate S3's keyframe first. Make S13's keyframe by **image-editing S3's keyframe** (same seed/reference), not from text. |
| D7 | Brief's S10 tags are English (LOCATION/QUANTITY…) | The real app labels are **TEMPAT · JUMLAH · BENDA · AKSI**, and the VO says "jumlah, benda, aksi, dan tempatnya". Use the Indonesian labels — judges score Teknis on what the product really does. |
| D8 | S11 "three action buttons" | Matches the real `/guru` preview panel: **Tampilkan** (primary) · alternative reading · **Buang**. Use those labels in post. |

**Facts to confirm before export** (never ship a number you can't source):
- S4 **82%** = 100 − 18% at PISA Level 2 (OECD, PISA 2022). ✅ consistent.
- S5 **85,2%** = 100 − 14.8% with GPK. The source we verified is **KND via Medcom, 23 Jan 2026** — v1 overlay said "Dapodik, Des 2023". Fix the on-screen source line.
- S12 **5 minutes** setup and **±Rp275 ribu**: not in the verified-stats list. Keep only if the team actually timed/priced it; otherwise drop the timer graphic and price.

---

## 1. Master timeline

Generators give ~5–10 s per clip, so long shots are split. **Gen clip** = what you generate (add 1 s handle at each end, trim in edit).

| Shot | Timecode | Frames (start–end) | Len | Gen clips | Colour state | Camera |
|---|---|---|---|---|---|---|
| S1 | 0:00–0:05 | 0–119 | 120 | S1 | Full warm | Slow push-in |
| S2 | 0:05–0:10 | 120–239 | 120 | S2 | Warm → grey-blue at f132–143 (post) | Whip-pan in, then still |
| S3 | 0:10–0:15 | 240–359 | 120 | S3 | Grey-blue (post) | **Locked** POV |
| S4 | 0:15–0:27 | 360–647 | 288 | S4a (4 s) · S4b (8 s) | Grey-blue → soft neutral | Drift out / slow pull-back |
| S5 | 0:27–0:40 | 648–959 | 312 | S5a (7 s) · S5b (6 s) | Muted neutral | Static wide, then slow push |
| S6 | 0:40–0:46 | 960–1103 | 144 | S6 | Neutral → warm | Static medium |
| S7 | 0:46–0:56 | 1104–1343 | 240 | S7a (6 s) · S7b (4 s) | Board warm; Raka grey → full at f1248–1259 (post) | Locked board / static CU |
| S8 | 0:56–1:06 | 1344–1583 | 240 | S8 | Full warm | **Locked** |
| S9 | 1:06–1:14 | 1584–1775 | 192 | S9 | Full warm | **Locked** |
| S10 | 1:14–1:26 | 1776–2063 | 288 | S10a (6 s) · S10b (6 s) | Cream graphic | Static |
| S11 | 1:26–1:36 | 2064–2303 | 240 | S11 | Full warm | OTS, gentle pull-back |
| S12 | 1:36–1:45 | 2304–2519 | 216 | S12 | Full warm | Locked top-down |
| S13 | 1:45–1:53 | 2520–2711 | 192 | S13 | Full warm, peak | **Locked** POV (same as S3) |
| S14 | 1:53–1:58 | 2712–2831 | 120 | S14 | Green + yellow glow → black f2808–2831 | Static |

Check: 120+120+120+288+312+144+240+240+192+288+240+216+192+120 = **2,832 frames = 118 s** ✅

---

## 2. Workflow (order matters)

1. **Style lock** (§3) at the top of every prompt, every session.
2. **Reference sheets** (§4). Pick the best of each, keep them as the image reference for everything after.
3. **Keyframes first**: generate each shot's *start frame* as a still with the image tool (with reference sheets attached). Fix hearing aid side, outfit and faces on the still — it's 10× cheaper than fixing video.
4. **Image-to-video**: feed the approved start frame + the shot's *motion prompt*. Use the end-frame slot when the tool has one (Kling, Runway, Veo first/last-frame).
5. **Post** (§6): grade, text, VO, music, low-pass.

---

## 3. Style lock (paste at the top of every prompt)

```
STYLE LOCK — identical in every image and clip.
Flat 2D children's picture-book animation. Soft rounded shapes, thick clean even-weight dark
outlines, gentle paper-cut texture with subtle paper grain, soft non-intrusive contact shadows,
warm afternoon light. Smooth limited-frame motion, slow steady 2D camera. No 3D, no gloss,
no depth-of-field realism.
Palette: deep chalkboard green #16302A, warm yellow #E8B931, cream #F3F1EA, sage green #A8CBB7,
brick-red accents.
Setting: Indonesian public elementary school (SD) classroom — wooden desks, deep green
chalkboard, cream walls, window with tropical palm trees, stylised map of Indonesia on the wall
(shapes only, no labels).
Faces: stylised picture-book faces, simple dot-and-curve features, never realistic.
NO text, letters, numbers or symbols anywhere in the image — boards, posters, screens, buttons,
clocks and books are blank.
Mood: gentle, hopeful, warm, empathetic. Never scary or chaotic.
16:9, 1920x1080.
```

**Character block** (append after the style lock in any shot where they appear):

```
RAKA: 7-year-old Indonesian boy, short messy black hair, big round expressive eyes, warm brown
skin. White short-sleeved school shirt, red shorts, yellow backpack. A small light-blue
behind-the-ear hearing aid on his RIGHT ear — when he faces the viewer it is on the LEFT side of
the image. Only one hearing aid. Never on the other ear.

BU SARI: Indonesian female teacher in her 30s. Olive-green hijab, cream blouse with a subtle
small flower print, long brown skirt, warm caring expression.
[from S6 on add:] small black clip-on microphone on her blouse collar.

CLASSMATES: 4–5 Indonesian children in white shirts and red shorts/skirts. One girl with two
braids, one boy with round glasses.

RABBIT: simple white cartoon rabbit, upright ears with soft grey inner ears, round body,
dot eyes, no clothing.
```

---

## 4. Reference sheets (generate once, reuse everywhere)

**4a — Raka turnaround**
```
[STYLE LOCK] [RAKA]
Character turnaround sheet on plain cream #F3F1EA. Five full-body views in a row, evenly
spaced, same scale: front, three-quarter facing frame-right, right profile (showing his right
ear and the light-blue hearing aid), back, three-quarter facing frame-left. Below: four head
close-ups — happy, confused, wonder (eyes wide), proud grin — each turned so the hearing aid on
his right ear is visible. No text, no labels.
```

**4b — Bu Sari turnaround**
```
[STYLE LOCK] [BU SARI]
Character turnaround sheet on plain cream. Front, three-quarter, profile, back, full body,
same scale. Below: four expressions — speaking clearly, tired but kind, deep breath with eyes
closed, gentle smile with thumbs-up. One extra close-up of her collar with a small black
clip-on microphone. No text.
```

**4c — Classmates + rabbit**
```
[STYLE LOCK] [CLASSMATES] [RABBIT]
Lineup sheet on plain cream: five classmates standing side by side (girl with two braids,
boy with round glasses, three others varied in hair and height), same scale as a 7-year-old.
Bottom row: the white rabbit in four poses — sitting, mid-hop, landed with bounce, ears
twitching. No text.
```

**4d — Classroom set (empty)**
```
[STYLE LOCK]
Empty classroom establishing plate, eye level from the middle of the room. Deep green
chalkboard centred on the front wall, teacher's wooden desk with a closed laptop and small
projector, rows of wooden desks, window on the right wall with palm trees, Indonesian map
shapes on the left wall, warm afternoon light from the window. No people, no text.
```

---

## 5. Shot prompts

Each shot: **KEYFRAME** = still for the start frame · **MOTION** = image-to-video prompt ·
**END** = end-frame still when the tool supports it · **POST** = what is added in the edit.
Every prompt begins with `[STYLE LOCK]` plus the character blocks of who is visible.

### ACT 1 — HOOK

#### S1 · 0:00–0:05 · f0–119 · Wide, slow push-in
- **KEYFRAME:** `Wide shot of the bright classroom from the back third of the room. Bu Sari stands at the deep green chalkboard on the left third, one arm pointing at the board, mouth open mid-sentence. Five classmates at wooden desks face her, leaning forward excitedly. Raka sits in the back row, small in frame, seen from behind-left. Sunlight streams through the window, palm trees outside. Full warm colours. Blank chalkboard.`
- **MOTION:** `Slow steady push-in toward Bu Sari over the whole clip. Children bounce gently in their seats, two raise their hands halfway with joy. Bu Sari gestures at the board while talking. Calm, cheerful, limited-frame motion. No camera shake.`
- **POST:** music in — cheerful ukulele from f0. Teacher line: "Anak-anak, di rumput ada tiga kelinci!" (clear, unfiltered).

#### S2 · 0:05–0:10 · f120–239 · Whip-pan → Raka close-up
- **KEYFRAME:** `Close-up of Raka at his desk, head and shoulders, turned three-quarters toward frame-right so his right ear faces the camera. Light-blue hearing aid clearly visible on that ear. Bright happy smile. Full warm colours, classroom softly behind him.`
- **END:** same framing, `his smile gone, eyebrows slightly raised, eyes looking toward the front of the room, gently confused, mouth small and closed.`
- **MOTION:** `Start with a fast horizontal whip-pan with motion smear (first 8 frames) landing on Raka's close-up. Then hold still: his smile slowly fades into quiet confusion, he blinks twice, glances toward the front. Hearing aid stays visible and on the same ear the whole time.`
- **POST (exact):**
  - Whip-pan can be done in edit instead (blur transition from S1, f120–127).
  - **Desaturate f132→143 (12 frames = 0.5 s)**: saturation 100→15, temperature −25, tint toward blue, slight lift of blacks to grey-blue. Hold this grade through S3.
  - **Music hard-cut to silence at f132.**
  - Teacher line replays low-pass (see §6). Text: "Tapi Raka mendengarnya seperti ini." from ~f150, lower third, cream on soft dark box.

#### S3 · 0:10–0:15 · f240–359 · Back-row POV · LOCKED (anchor frame for S13)
- **KEYFRAME:** `First-person point of view from the back row, eye height of a seated 7-year-old. Bottom of frame: Raka's two small warm-brown hands resting flat on a wooden desk, white shirt cuffs visible. Middle: backs of classmates' heads in two rows. Far front: Bu Sari beside the deep green chalkboard, soft and slightly out of focus. Chalkboard blank except for faint chalk smudges. Symmetrical, centred composition, window on the right.`
- **MOTION:** `Locked-off camera, no movement. One by one, four classmates raise their hands high (one every half second, girl with braids first). Bu Sari stays soft and blurred. Near the end, Raka's two hands slowly slide back toward the bottom edge of the frame.`
- **POST:** cool grey-blue grade (continued from S2). Chalk-style overlay `3 − 2 = ?` on the board (static — camera is locked). Optional extra blur on Bu Sari. Teacher voice low-pass. VO (whispered): "Semua sudah tahu jawabannya. Aku… belum tahu soalnya."
- ⚠️ Save this keyframe as `S3_anchor.png` — S13 is built from it.

### ACT 2 — PROBLEM

#### S4a · 0:15–0:19 · f360–455 · Out the window, over the roof
- **KEYFRAME:** `Classroom window from inside, palm trees and blue sky beyond, soft muted colours.`
- **MOTION:** `Camera drifts smoothly forward through the open window and rises over the school's red clay-tile roof, sky opening up above. Slow, dreamy, constant speed.`
- **POST:** grade eases from grey-blue toward soft neutral across the clip.

#### S4b · 0:19–0:27 · f456–647 · Map of Indonesia
- **KEYFRAME:** `Cute flat cartoon map of the Indonesian archipelago, islands in sage green #A8CBB7 with thick soft outlines, on a deep green sea #16302A. Paper-cut layered look, small wave doodles. No labels, no text, no borders. Leave the upper-left third calm and empty.`
- **MOTION:** `Very slow pull-back. Tiny warm-yellow dots light up one by one across all the islands, like small lamps switching on, gently pulsing. Calm, steady.`
- **POST:** big **82%** in the empty upper-left + source line "OECD, PISA 2022". VO S4.

#### S5a · 0:27–0:34 · f648–815 · Bu Sari juggling
- **KEYFRAME:** `Wide shot from the back of a crowded classroom: Bu Sari alone at the front facing about 30 children (rows of small heads). She holds a chalk in one hand and a stack of blank worksheets in the other. Muted neutral colours. Wall clock above the board with a blank face.`
- **MOTION:** `Bu Sari moves quickly but gently between tasks: draws a simple rabbit outline on the board, turns to hand out worksheets, a child tugs her sleeve, another waves a hand eagerly. Clock hands spin fast. Lively but orderly motion, nothing chaotic, no flashing.`

#### S5b · 0:34–0:40 · f816–959 · The tired hold
- **KEYFRAME:** `Medium shot of Bu Sari at the front, chalk in hand, shoulders slightly lowered, tired but kind smile, looking at the class. Wall clock with blank face behind her.`
- **MOTION:** `Clock hands slow down from spinning to normal ticking. Very slow push-in on Bu Sari. She exhales softly and holds her tired, kind expression for the last 2 seconds.`
- **POST:** **85,2%** overlay + corrected source line. VO S5. Ticking SFX that slows with the clock.

### ACT 3 — SOLUTION

#### S6 · 0:40–0:46 · f960–1103 · The new idea
- **KEYFRAME:** `Medium shot of Bu Sari beside her desk, eyes closed, taking a deep breath. On the desk: a closed laptop connected by a cable to a small projector. She holds a small black clip-on microphone in her fingers.`
- **MOTION:** `She opens her eyes and smiles gently, clips the microphone onto her blouse collar, opens the laptop. A small round cartoon light bulb pops up above her head with a soft bounce and glows warm yellow. Warm light gradually fills the scene.`
- **POST:** SUARA PAPAN logo space (upper right or centre after the bulb pops). Ukulele returns, warmer arrangement, from ~f1000. VO S6.

#### S7a · 0:46–0:52 · f1104–1247 · Rabbits appear on the board · LOCKED
- **KEYFRAME:** `Front view of the projected board filling most of the frame: deep green #16302A background, strip of bright green grass along the bottom. Bu Sari stands at the left edge, speaking, mic on collar. Upper area of the board empty.`
- **MOTION:** `Locked camera. Three white cartoon rabbits hop in from the left one at a time, about 1.5 seconds apart, each landing on the grass with a small squash-and-bounce and settling side by side. Bu Sari talks calmly with an open hand toward the board.`
- **POST:** caption typewriter in the empty upper area: "di rumput ada tiga kelinci". Teacher line clear.

#### S7b · 0:52–0:56 · f1248–1343 · Colour floods back into Raka
- **KEYFRAME:** `Close-up of Raka, three-quarters toward frame-right, hearing aid on his right ear visible. Eyes wide with wonder, mouth slightly open, warm yellow light reflected on his cheeks from the board.`
- **MOTION:** `Hold on his face. His eyes widen a little more, a slow smile begins, his eyes move left to right as if reading. Very subtle.`
- **POST (exact):** start the clip in the S2 grey-blue grade, **ramp to full colour f1248→1259 (12 frames)** with a soft radial wipe from his eyes outward. VO S7.

#### S8 · 0:56–1:06 · f1344–1583 · Two rabbits leave · LOCKED
- **KEYFRAME:** identical to the end state of S7a (three rabbits on the grass), no Bu Sari, board filling the frame.
- **MOTION:** `Locked camera. Two rabbits turn and hop away to the right, out of frame, one after the other. The last rabbit stays in the centre, looks after them, ears twitching. Then a calm 3-second hold on the single rabbit.`
- **POST:** caption "lalu dua kelinci pergi"; then `3 − 2 = ?` builds above the remaining rabbit (pop-in per symbol). VO S8.

#### S9 · 1:06–1:14 · f1584–1775 · Raka answers first · LOCKED
- **KEYFRAME:** `Medium-wide side view: Raka stands at the projected board, facing frame-right toward it, so his right ear and light-blue hearing aid face the camera. The board shows the single rabbit on the grass and three large blank rounded buttons in a row (cream with yellow rims). Classmates seated in the background, Bu Sari at the edge.`
- **MOTION:** `Locked camera. Raka steps up confidently and taps the middle button with one finger. The middle button glows warm yellow and small stars and soft confetti burst from it (gentle, no flashing). Classmates cheer with arms up; Bu Sari gives a proud thumbs-up.`
- **POST:** numerals **0 · 1 · 2** on the buttons (middle = 1), "Benar!" on tap. SFX: ding at the tap frame + soft cheer. VO S9.

#### S10a · 1:14–1:20 · f1776–1919 · Sound → text
- **KEYFRAME:** `Clean cream #F3F1EA background. A friendly round robot-brain mascot (soft sage-green dome, small round eyes, smiling) in the centre holds a magnifying glass. Empty space on left and right.`
- **MOTION:** `Soft colourful abstract sound waves flow in from the left edge and, as they reach the robot, turn into neat blank rounded cards lined up in a row. Slow, clean, left-to-right.`

#### S10b · 1:20–1:26 · f1920–2063 · Tags → scene
- **KEYFRAME:** `Same cream background and robot. Four blank rounded tags in a row, each a different colour (sage green, warm yellow, brick red, soft blue). Small icons only: a tuft of grass, three dots, a rabbit, a hopping arc.`
- **MOTION:** `The robot moves its magnifying glass over each tag in turn and it glows. Then the tags slide right and morph into a small deep-green board with grass and three white rabbits.`
- **POST:** tag labels **TEMPAT · JUMLAH · BENDA · AKSI** (D7), plus optional word cards "di rumput · tiga · kelinci · melompat". VO S10.

#### S11 · 1:26–1:36 · f2064–2303 · Teacher stays in control
- **KEYFRAME:** `Over-the-shoulder shot behind Bu Sari's right shoulder (hijab and mic visible), looking at her laptop screen: a preview window showing the small green board with one rabbit, and three blank rounded buttons beneath it — the left one larger and warm yellow. Behind the laptop, out of focus, the big projected board is plain deep green.`
- **MOTION:** `Her finger taps the large yellow button. The scene from the preview appears on the big board behind her. Gentle slow pull-back to a medium-wide shot.`
- **POST:** button labels **Tampilkan** · (alternative reading) · **Buang** (D8). VO S11.

### ACT 4 — IMPACT & CLOSE

#### S12 · 1:36–1:45 · f2304–2519 · Kit flat-lay · LOCKED top-down
- **KEYFRAME:** `Top-down flat-lay of a wooden teacher's desk: an open laptop and a small projector on the left half, generous empty space on the right half.`
- **MOTION:** `Locked overhead camera. Small green check marks pop above the laptop, then the projector. A small black clip-on microphone slides in from the right, then a presentation clicker. [Only if verified:] a blank round timer badge pops in last. Tidy, evenly spaced.`
- **POST:** labels and the "5 menit" / price only if verified (see §0). VO S12.

#### S13 · 1:45–1:53 · f2520–2711 · CALLBACK · LOCKED POV
- **KEYFRAME (image-edit of `S3_anchor.png`, not a new generation):** `Keep the exact composition, camera, desk, classmates' positions and window. Change: full warm afternoon colours; the chalkboard now shows the deep green board with a strip of bright green grass and one white rabbit; Raka's right hand in the bottom foreground is raised high, the first and only hand up; two classmates are turning around toward the camera, smiling.`
- **MOTION:** `Locked camera, same as before. Raka's hand stays high and waves slightly. Other classmates raise their hands after him, one by one. Bu Sari smiles toward the back row. Warm light.`
- **POST:** **no grey grade** — this is the warmest frame of the film. Teacher voice still low-pass (same settings as S2). Music crescendo peaks here. VO S13. A slight post push-in on the merged layer is allowed.

#### S14 · 1:53–1:58 · f2712–2831 · End card
- **KEYFRAME:** `Plain deep green #16302A background with soft chalk texture. Strip of bright grass along the bottom edge. Centre two-thirds completely empty.`
- **MOTION:** `One white rabbit hops in from the left along the bottom edge, stops at the lower right third and sits. A soft warm-yellow glow blooms behind it. Static camera.`
- **POST:** closing text in centre ("Setiap siswa berhak memahami pelajaran." · suarapapan.vercel.app/guru · Hackathon Dies Natalis FMIPA UGM 2026). **Fade to black f2808→2831 (1 s)**; music tail out by f2831.

---

## 6. Post-production map

**Grade states**
| State | Shots | Settings (CapCut / Resolve) |
|---|---|---|
| Warm (base) | S1, S6–S14 | As generated; +5 warmth if a clip comes out cool |
| Grey-blue | S2 (from f143), S3, S4a start, S7b start | Saturation 15, temp −25, blue tint, lift blacks slightly |
| Neutral | S4b–S5b | Saturation 70, temp 0 |

**Low-pass for the teacher's voice (S2, S3, S13 — identical settings so the callback matches)**
- Low-pass ~500 Hz, 12–24 dB/oct · volume −6 dB · small room reverb ("underwater").
- Add a quiet low hum (~80–120 Hz sine, −30 dB) under S2–S3 only.
- CapCut: Audio → Voice effects → *Low-pass*/"Underwater"; or Audacity Low-Pass Filter then re-import.

**Music**
| Frame | Cue |
|---|---|
| f0 | Ukulele cheerful in |
| f132 | **Hard stop** (silence + muffled voice only) |
| ~f1000 (S6) | Ukulele returns, warmer |
| f2520–2711 (S13) | Crescendo, warmest |
| f2808–2831 | Fade out with picture |

**Text overlays** — Indonesian, same font throughout (rounded sans, cream on #16302A or dark-green on cream), no flashing animations:
S2 subtitle · S3 `3 − 2 = ?` · S4 82% + source · S5 85,2% + source · S6 logo · S7 caption · S8 caption + `3 − 2 = ?` · S9 `0 1 2` + "Benar!" · S10 TEMPAT/JUMLAH/BENDA/AKSI · S11 Tampilkan/Buang · S12 kit labels · S14 closing card. Full VO subtitles throughout.

---

## 7. Negative prompt (paste into every generation that has a negative field)

```
text, letters, numbers, words, captions, watermark, logo, signature, misspelled writing,
photorealistic, realistic face, 3D render, CGI, glossy, plastic, specular highlights,
depth-of-field realism, hearing aid on left ear, two hearing aids, missing hearing aid,
mirrored character, extra fingers, extra limbs, fused hands, deformed hands, distorted face,
changed outfit colours, blue shorts, different hijab colour, adult proportions on children,
camera shake, fast zoom, 3D camera rotation, strobing, flashing lights, glitch, chaotic
background motion, dark horror mood, harsh shadows, wheelchair, sad tragic tropes
```

---

## 8. QC checklist per clip (reject and regenerate if any fail)

- [ ] Hearing aid present, **on Raka's right ear** (image-left when he faces camera), one only.
- [ ] Uniform: white shirt, red shorts, yellow backpack where visible. Bu Sari: olive hijab, cream flower blouse, brown skirt, mic from S6.
- [ ] No glyphs anywhere in the frame (zoom in on boards, clocks, screens).
- [ ] Hands: count fingers on every visible hand in the middle and last frame.
- [ ] Locked shots (S3, S7a, S8, S9, S12, S13, S14) have zero camera drift — check by overlaying first and last frame at 50%.
- [ ] S13 vs S3: same horizon line, desk edge and window position when stacked.
- [ ] Clip length ≥ timeline length + 1 s handle.
