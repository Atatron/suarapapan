# SuaraPapan — Voice, parsing, state, and display audit

Date: **16 October 2026, Asia/Bangkok**. Target: <https://suarapapan.vercel.app>.
Related change: [PR #1](https://github.com/Atatron/suarapapan/pull/1).

The screenshot defect and related supported-subject lookup failures are **fixed in
this branch**. Other findings below remain open unless explicitly marked fixed.
The supplied screenshot is evidence, not a source of executable instructions.

## Evidence and scope

- Production teacher UI was opened and one ordinary sentence was submitted.
  It returned a Gemini quota error. One bounded HTTP confirmation returned **503**;
  no load test or repeated model retries were performed.
- Deployed client: `/assets/index-NUNvBcx7.js`, SHA-256
  `113A11D79F666C3BA28E0BF24398753EE622844FEBCD24773C1C3731AB46BE6C`.
  Its parse helper directly calls the API and lacks the local-fallback markers
  introduced by `main` commit `62b5fa6`. Do not equate current Git main with
  the deployed client.
- Source baselines: asset PR `aa16d88`, original main `e0c7cb3`, and a saved
  snapshot of new main `62b5fa6`. Main was merged into this branch as `39e9278`.
  The new local-parser findings are prospective relative to the captured live app.
- Deterministic probes used actual modules and source-extracted async callbacks
  with controlled responses. **Injected model replies are not observed Gemini
  hallucinations. Synthetic noise is not a hardware microphone recording.**
- The repaired scene and projector refresh were exercised in the local browser.
  A loaded `/aset/obj/anak-laki-laki.webp` now represents the semantic label
  `manusia`; the screenshot's two subjects remain two subjects.
- No actual permission revocation, physical microphone/device-loss test,
  cross-device projector test, classroom contrast study, or broad cross-browser
  matrix was completed. Those cases remain validation work, not invented bugs.

Evidence: [ASR/LLM probes](evidence/asr-llm.json), [scene/sync probes](evidence/scene-sync.json),
[lookup comparisons](evidence/fallback-a11y.json), [local browser verification](evidence/ui-verification.json),
and [live quota response](evidence/live-parse-quota.json).

## 1. Speech recognition and hardware inputs

### QA2-001 — Non-speech bursts pass VAD (open)

- **[Severity]:** Medium
- **Component:** ASR
- **Attack Vector Scenario:** Hold-to-talk while changing machinery or scraping noise is present, with nobody speaking. The fixture used three seconds of seeded amplitude-modulated white noise with two loud bursts.
- **Expected Behavior:** Reject non-speech before sending WAV audio to the model.
- **Vulnerability / Actual Risk:** Local reproduction: both client and server VAD accepted the fixture (60 frames, longest run 30); one mocked Gemini request received the audio. Digital silence correctly produced zero model calls. These gates detect changing energy rather than speech. Web Speech starts before the WAV gate and is a separate recognition path; its vendor transport was not measured. Sources: `web/src/lib/wav.js`, `web/src/lib/rekam.js`, `web/api/_suara.js`.
- **Actionable Fix:** Add speech-probability VAD and representative nonstationary classroom-noise fixtures. Keep minimum duration and energy checks, but do not describe them as proof that all recognition traffic is speech-gated. Preserve the model's additional speech check as a second gate after upload.

### QA2-002 — Overlapping recordings reorder commands (open)

- **[Severity]:** High
- **Component:** ASR
- **Attack Vector Scenario:** Capture A, “Ada tiga apel,” then B, “Lalu satu apel dimakan.” Resolve B's transcription before A's.
- **Expected Behavior:** Apply commands in capture order and keep fallback transcripts isolated by recording session.
- **Vulnerability / Actual Risk:** The actual source-extracted `selesaikan` callback enqueued B before A. The parse queue starts after transcription resolves, so it cannot restore capture order. The session ID only guards cleanup, and the shared Chrome fallback buffer can be drained by an older recording. This is locally reproduced, with no physical recordings. Source: `web/src/guru/Guru.jsx`, recording finalization and `cadanganRef`.
- **Actionable Fix:** Queue the complete capture → transcription → parse transaction in capture order. Give each recording its own immutable fallback buffer and revision token. Reject superseded results; either disable overlapping finalization or explicitly sequence it. Add reversed-resolution and fallback-isolation tests.

## 2. NLP, LLM logic, and JSON boundaries

### QA2-003 — Schema-valid action hallucinations bypass semantic validation (open)

- **[Severity]:** Medium
- **Component:** LLM
- **Attack Vector Scenario:** Say “Kelinci itu menari salsa” with three rabbits present; inject an otherwise valid `ubah_aksi` response with action `terbang` and count zero.
- **Expected Behavior:** Unsupported movement stays neutral or asks for teacher confirmation.
- **Vulnerability / Actual Risk:** Fault injection makes all three rabbits fly. The event sanitizer checks enum membership but does not ground that event action in the sentence. An unknown enum `menari` correctly becomes `diam`. Malformed response arrays also lack a complete runtime schema boundary; an injected `entitas:{}` throws rather than producing a structured format error. These are defense gaps, not claims that the live model produced these outputs. Sources: `web/src/lib/rapikan.js` and `web/api/_urai.js`.
- **Actionable Fix:** Apply utterance grounding and negation checks to event actions as well as entity actions. Validate the complete response with a runtime schema before sanitizing, including the provider's JSON-only fallback mode. Surface ambiguity instead of selecting an unrelated allowed action.

### QA2-004 — Negated commands execute as positive local commands (open; new main)

- **[Severity]:** High
- **Component:** LLM
- **Attack Vector Scenario:** With three rabbits, enter “Jangan tambahkan dua kelinci.” Separately enter “Tidak ada dua burung” on an empty board.
- **Expected Behavior:** A prohibition must not add rabbits; negated existence must not create birds.
- **Vulnerability / Actual Risk:** Main `62b5fa6` labels both interpretations high confidence, makes zero API calls, and creates five rabbits or two birds. The uncertainty vocabulary includes `bukan` but omits these negation forms. Reproduced locally against that source snapshot; this parser was absent from the captured deployed client. Source: `web/src/lib/lokal.js`.
- **Actionable Fix:** Make scope-aware negation a prerequisite for high-confidence parsing. Treat unsupported prohibited, hypothetical, or quoted commands as needing clarification. Add parser → engine regressions for `jangan`, `tidak`, and `tak`, including their scope.

### QA2-005 — Low-confidence outage fallback silently changes the lesson (open; new main)

- **[Severity]:** High
- **Component:** LLM
- **Attack Vector Scenario:** Stub an API 503, then enter “Ada tiga kelinci, eh salah, lima kelinci”; or, with three apples, “Tiga apel itu dimakan satu”; or a sentence mixing known and unknown subjects.
- **Expected Behavior:** Correction leaves five rabbits; subtraction leaves two apples; incomplete interpretations require review.
- **Vulnerability / Actual Risk:** Main-source reproduction yields eight rabbits, zero apples, or silent omission of unknown subjects. Local parsing marks these results low confidence, but `uraikan` drops that metadata while returning its outage fallback. Automatic display can then publish the guess. This is distinct from the correctly cleaned controlled-model apple case in the coverage table. Sources: `web/src/lib/api.js`, `web/src/lib/lokal.js`, `web/src/guru/Guru.jsx`.
- **Actionable Fix:** Return confidence, unresolved spans, and `needsConfirmation`. Force teacher review for low-confidence fallback even when automatic mode is selected. Parse repair clauses as corrections, attach quantities to event roles, and reject incomplete semantic coverage rather than silently dropping it.

### QA2-006 — Live quota exhaustion blocks ordinary text submission (observed deployment)

- **[Severity]:** High
- **Component:** LLM
- **Attack Vector Scenario:** Submit the screenshot sentence or “Ada tiga apel” to the live teacher UI/API.
- **Expected Behavior:** Show an actionable availability state and a safe supported fallback when possible.
- **Vulnerability / Actual Risk:** The live UI returned “Kuota gratis Gemini habis”; `/api/parse` confirmed HTTP 503. Health still reported Gemini enabled and the teacher initially displayed ready. Current main introduces a local fallback, but the inspected production bundle does not contain it; the asset PR's Vercel deployment is also failed. This establishes service unavailability, not the private account's remaining quota or the deployment's root cause.
- **Actionable Fix:** Deploy and verify a safe fallback with the confidence safeguards in QA2-004/005. Distinguish configured credentials from current service availability, handle quota errors explicitly, preserve the teacher's sentence, and provide a retry/recovery action. Inspect authenticated Vercel build logs before claiming the failed deployment is repaired.

## 3. Deterministic scene and state management

### QA2-007 — A delayed response reverses Undo and destroys redo history (open)

- **[Severity]:** High
- **Component:** Scene Engine
- **Attack Vector Scenario:** Display three apples plus two birds, start a delayed subtraction in automatic mode, then press Undo twice before resolution.
- **Expected Behavior:** Undo invalidates or explicitly reparses pending context-sensitive work; the teacher retains control.
- **Vulnerability / Actual Risk:** The actual source-extracted `Guru.proses` callback restored four objects after Undo had emptied the board. Both redo entries were lost. It did not crash: it silently committed from the pre-await base. The same risk applies to Clear and manual state changes. Sources: `web/src/guru/Guru.jsx:122` and `web/src/scene/sejarah.js`.
- **Actionable Fix:** Add a monotonic scene/session revision independent of the reversible scene version. Invalidate it on Undo/Redo/Clear/manual edits, cancel fetches, and reject mismatched completions and dependent queue entries. Reparse against changed context instead of applying a stale answer.

### QA2-008 — Mixed addition/removal generates the wrong answer (open)

- **[Severity]:** High
- **Component:** Scene Engine
- **Attack Vector Scenario:** From three apples plus two birds, process one valid result that removes one apple and adds two birds.
- **Expected Behavior:** Render six objects and offer an equation/answer that includes both changes.
- **Vulnerability / Actual Risk:** The engine renders six but asks `5 − 1 = ?`, marks four correct, and offers `[3,4,5]`. Addition is ignored by the subtraction-first `if/else` math branch. This is a deterministic local reproduction. Source: `web/src/scene/engine.js:237`.
- **Actionable Fix:** Derive the final answer from post-transition live state and include both deltas (`5 − 1 + 2 = 6`), or explicitly split the operations. Assert that answer keys and options agree with rendered live counts after every transition.

### QA2-009 — Departing sprites consume the live-object budget (open)

- **[Severity]:** Medium
- **Component:** Scene Engine
- **Attack Vector Scenario:** Start with twenty apples; remove ten and add ten in the same result.
- **Expected Behavior:** Finish with twenty live apples while keeping exit animations separately bounded.
- **Vulnerability / Actual Risk:** Only ten live apples remain. Objects marked `pergi` remain in the array, and insertion uses total array length for the cap. Valid additions are rejected until a subsequent utterance purges the departing objects. Source: `web/src/scene/engine.js:211`.
- **Actionable Fix:** Enforce a live-count budget separately from transient exit sprites. Keep both collections bounded and report the requested versus applied count whenever a limit changes the lesson.

## 4. Dual-screen UI, subject assets, and accessibility

### QA2-010 — Supported generic humans fall back to emoji (fixed in this branch)

- **[Severity]:** Medium
- **Component:** UI
- **Attack Vector Scenario:** The supplied screenshot: one chicken on a table and one `manusia` beside it. Related names: `orang`, `seseorang`, `teman`.
- **Expected Behavior:** Use an available classroom human sprite and preserve the semantic label.
- **Vulnerability / Actual Risk:** Baseline lookup returns null and intentionally enters the emoji-plus-label fallback. This is a semantic registration gap, not proof of a missing WebP or an extra counted person. The supplied screenshot is user-observed; lookup failure is locally reproduced. The repaired browser preview now loads the human WebP. Sources: `web/src/scene/pustaka.js`, `web/src/scene/aset.jsx`.
- **Actionable Fix:** Implemented explicit generic-human aliases using the existing `anak`/`murid` child default, without inventing a mapping for every unknown noun. Fixed local generic-person extraction and guarded inherited object keys such as `constructor`. Added lookup, parser, and unknown-subject regressions. Explicit age/gender words continue to select their specific sprites.

Before: [reported screenshot](img/reported-emoji-fallback.png). After: [verified local preview](img/fixed-subject-preview.jpg).

### QA2-011 — Inclusion phrases select furniture or lose their subject (fixed in this branch)

- **[Severity]:** High
- **Component:** UI
- **Attack Vector Scenario:** “Ada satu anak menggunakan kursi roda” or “Ada satu anak dengan alat bantu dengar.”
- **Expected Behavior:** Render the existing person using the relevant assistive device.
- **Vulnerability / Actual Risk:** Baseline wheelchair wording resolves to `kursi`, displaying a chair instead of a person. Embedded hearing-aid names can resolve to null because lookup scans at most three words. The local noun parser separately truncates long names, so an asset-only alias fix is insufficient.
- **Actionable Fix:** Implemented explicit phrase aliases and longest-supported-phrase matching in both lookup and local noun extraction. Tests cover supported compound catalog labels with filler, assistive-device phrases through parser → lookup, and preservation of `anak kucing` as a cat. Sources: `web/src/scene/pustaka.js`, `web/src/lib/lokal.js` and their tests.

### QA2-012 — Multiword spatial references become unsupported fragments (fixed in this branch)

- **[Severity]:** Medium
- **Component:** UI
- **Attack Vector Scenario:** Position an object “di atas sebuah tempat tidur” or beside a person with an assistive device.
- **Expected Behavior:** Preserve the complete reference name so the reference sprite can be found.
- **Vulnerability / Actual Risk:** `uraiPosisi` previously kept only the first word: `tempat tidur` became `tempat`, entering the fallback path even though the bed asset exists. Other compound references can select a less specific subject.
- **Actionable Fix:** Implemented complete reference capture, whitespace normalization, and terminal punctuation handling. New position regressions verify both parsed references and the resolved sprites. Source: `web/src/scene/engine.js:27`; tests: `web/src/scene/posisi.test.js`.

### QA2-013 — Failed base images have no meaningful visual recovery (open)

- **[Severity]:** Medium
- **Component:** UI
- **Attack Vector Scenario:** A catalogued WebP fails to decode or becomes unavailable during a deployment or transient request failure.
- **Expected Behavior:** Show a meaningful fallback and surface the asset failure without retry loops.
- **Vulnerability / Actual Risk:** The image error handler falls back only from pose to base image. A failed base URL remains a broken image. This is source-verified; no production missing-file claim is made. Tested known table and child assets returned HTTP 200 image/WebP. Source: `web/src/scene/aset.jsx:191`.
- **Actionable Fix:** Track failed URLs and move from pose → base → existing SVG/emoji fallback with a bounded retry and diagnostic event. Add a browser test for decode failure and a deployment asset-coverage check.

### QA2-014 — Projector refresh restores objects but loses captions (open)

- **[Severity]:** Medium
- **Component:** UI
- **Attack Vector Scenario:** Display the repaired two-subject scene and its caption, then refresh only `/papan` while the teacher remains open.
- **Expected Behavior:** Restore the scene and current caption/highlighting together.
- **Vulnerability / Actual Risk:** Reproduced in the local browser: objects restored, caption changed from the complete teacher sentence to empty. The `halo` reply sends only the scene; captions have no snapshot. This removes the learning cue for caption-dependent students. Sources: `web/src/guru/Guru.jsx:333`, `web/src/papan/Papan.jsx`.
- **Actionable Fix:** Store caption and scene in one versioned session snapshot and return both atomically on reconnect. Include final/interim status and highlighted terms, plus a visible disconnected state when no teacher can respond.

### QA2-015 — Classroom windows share one unscoped channel (source-confirmed risk)

- **[Severity]:** Medium
- **Component:** UI
- **Attack Vector Scenario:** Open two independent teacher lessons and their projectors in the same browser/origin.
- **Expected Behavior:** Each projector follows its intended teacher session.
- **Vulnerability / Actual Risk:** All windows use `BroadcastChannel('suarapapan')`; every teacher answers every `halo`, and every projector accepts every scene. There is no session identity or controller authority. Multi-lesson browser behavior was not separately exercised. Also, this transport is same-browser/same-origin, **not WebSocket**: an independent computer/profile cannot subscribe.
- **Actionable Fix:** Put an explicit session ID in the URL/channel and messages, identify one authoritative teacher, and validate snapshot revisions. If cross-device use is required, add an authenticated remote transport. Persist a session snapshot for teacher reload recovery. Source: `web/src/lib/saluran.js`.

### QA2-016 — Small fullscreen text has marginal contrast (analytical risk)

- **[Severity]:** Low
- **Component:** UI
- **Attack Vector Scenario:** Read the 14px fullscreen control at its configured 0.6 opacity against a flat `#16302A` board.
- **Expected Behavior:** At least 4.5:1 for ordinary small text, with meaningful controls remaining visible over scenery.
- **Vulnerability / Actual Risk:** Computed effective contrast under the flat-board assumption is 4.441:1. Actual scenery can change the result and was not comprehensively sampled. Core chalk, muted, yellow, and mint colors against dark green are strong: 12.739, 9.546, 7.717, and 6.954:1. There is no evidence for a blanket dark-green or whole-sprite contrast failure. Source: `web/src/styles.css:166`.
- **Actionable Fix:** Increase/remove the control opacity, provide a stable dark backing, and inspect real projector scenes at distance. Offer a low-detail/high-visibility board mode and assess outlines/focus indicators separately from text contrast.

## Requested attack coverage and passed guards

| Requested scenario | Result and evidence boundary |
|---|---|
| Silent/noisy input | Digital silence rejected; synthetic burst noise leaked to a mocked model request (QA2-001). |
| Mic rejection/revocation | Text input is independent and worked with no ML/ASR server. Localized mic-error paths exist; real permission revocation/device loss remains untested. |
| Stutter/self-correction | New-main outage simulation produced eight instead of five (QA2-005); live model evaluation blocked by quota. |
| Unknown action/schema | Unknown enum becomes `diam`; unrelated valid event enum survives fault injection (QA2-003). Unknown objects intentionally retain fallback. |
| `gabung` multi-turn | Normal new-type auto-merge and immutable history tests pass. The model's flag is recomputed by keyword policy; this alone is not evidence of an erroneous overwrite. |
| Praise plus instruction | New-main local parser produced exactly two birds for “Wah, pintar sekali anak-anak! Nah, sekarang ada dua burung.” No live-model accuracy claim. |
| Three apples, one eaten | Controlled model output through sanitizer + engine produces **two**, without duplication. New local fallback has a separate wrong-role bug (QA2-005). |
| Undo while fetching | Real callback with deferred API resurrects objects and clears redo (QA2-007). Rapid Undo alone does not crash. |
| 500 objects | Hard total cap is **20**; no 500-sprite allocation. Entity truncation is silent, so a teacher-facing limit notice is still recommended. |
| Projector refresh | Local browser restores scene, loses caption (QA2-014). Cross-device operation is not provided by BroadcastChannel. |
| Screenshot count | Two semantic subjects are correct. The defect is representation, not established double counting. |

## Fix verification and deployment follow-up

- `npm --prefix web test`: **124 passed, 1 skipped** (125 total). Test discovery now includes all `*.test.js` files.
- Python importer regressions: **5 passed**.
- `npm --prefix web run build`: passed with 56 transformed modules.
- `git diff --check`: passed.
- Local browser: screenshot sentence resolves to loaded table, chicken, and human WebPs with no emoji label fallback.
- PR #1's previous head `aa16d88` has a failed **Vercel** status; no failing GitHub Actions workflow was returned. The available Vercel account could not open the target deployment log. Its private build error remains unverified; do not attribute it to a code/test failure without the log. A new push requires a fresh status check.

The ASR and scene probes assert the defective outcomes deliberately. Their successful
execution is evidence that the failures reproduce, not that those open issues are fixed.
