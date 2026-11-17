# How the voice works

A map of bellows-voice from a line of text to air leaving the lips, written 2026-11-17. Each stage
gives its file, the mathematics it runs, the sources it rests on, what has been measured and what
is still open. The last part sets out where the voice could go next, grounded in the same physics.
`HANDOFF.md` has the state of the repository, `VOICE-2.md` every measurement since the
articulatory rebuild, `VOICE-NORMS.md` the human norms and `ACCENTS.md` the accent design.

Words used throughout: a *segment* is one phoneme; a *span* is a segment with a start and an end in
seconds; a *gesture* is a target for some articulators over a time window; the *tract* is the tube
from the glottis to the lips; *k* is a body's size scale (1 for the male body).

## 1. The chain at a glance

```
text ──► words ──► segments ──► syllables ──► lexical sets ──► accent ──► allophones
  lyrics/read.ts   english.ts    syllabify.ts   lexical-sets.ts   accents.ts  allophones.ts
                   letter-to-sound.ts
                                                                     │
          speech: lyrics/speech.ts (stress timing, intonation)       │
          song:   the caller's notes                                 ▼
                                             lyrics/sing.ts planSung: timed spans per breath
                                                                     │
                              sing.ts sungEvents: one note per phrase, Param events inside it
                                                                     │  (kernel, sample accurate)
                        engines/vocal.ts: the voice, per block of 32 samples at 48 kHz
                                                                     │
   engines/vocal-planner.ts: segments to gestures (online, 0.3 s lookahead) to targets and speeds
                                                                     │
          dsp/cascade.ts: each of 17 articulators follows its target through 6 first-order lags
                                                                     │
   engines/vocal-geometry.ts: articulators to a midsagittal shape to an area function (every 10.7 ms)
                                                                     │
       engines/vocal-drive.ts: area function onto the airway grid, interpolated per block, -dV/dt
                                                                     │
    dsp/junction-airway.ts: lungs, trachea, glottis, tract, velum, nose, lips: flow and sound
        dsp/glottal.ts | geometric-glottis.ts | fold-oscillator.ts: the vocal folds
                                                                     │
               radiation (flow derivative), the close microphone (flow), DC block, low-pass
```

Everything up to `sungEvents` is main-thread planning with no audio. Everything after it runs in the
AudioWorklet (or offline, the same code) and allocates nothing at steady state.

## 2. Text to sounds

**Reading a word** (`english.ts`, `letter-to-sound.ts`). A word is looked up, in order, in a
homograph table, an injected CMU-format dictionary, a table of function words, and last a set of
ordered context rules `(left, letters, right, phones)` from CHIMERA, a scheme of the kind Elovitz,
Johnson, McHugh and Shore (1976) introduced. No dictionary ships, so for most words the
rules decide. MEASURED (2026-11-13): 77 percent of 469 common lyric words come out exactly as CMUdict
has them.

**Syllables** (`syllabify.ts`). The maximal onset principle with English onset clusters: every
consonant that can begin a syllable goes to the next vowel, so "twinkle" is twɪŋ.kəl.

**Lexical sets** (`lexical-sets.ts`). Each vowel is tagged with its Wells (1982) set: KIT, DRESS,
TRAP, ..., NEAR, SQUARE, NORTH, FORCE, CURE. The tag is what an accent re-voices, so the reader can
speak General American while thirty-one accents say the same word their own way.

**Accent** (`accents.ts`). Data: a realization per set (one vowel, or two for a diphthong with a hold
share), rhoticity, and rules for t, l, th, r and h. Since 2026-11-17 General American also passes
through this step, because it has a rule the reader cannot apply word by word (section 7).

**Allophones** (`allophones.ts`). Phrase-wide rules needing the next sound: the flap for /t d/
between a vowel and an unstressed vowel, dark /l/ in codas, and each accent's variants.

## 3. Time

**Speech** (`speech.ts`). Stress timing: stressed vowels 0.18 s, unstressed 0.09 s (ratio 2, moved
toward 1 for syllable-timed accents), final lengthening 1.5 (Klatt 1976), consonants at their own
durations (`durations.ts`, CHIMERA's inventory). Pitch is a simple autosegmental reading
(Pierrehumbert 1980): declination across the phrase, a pitch accent on each stressed syllable, and a
nuclear tone. When the nuclear tone falls on the last syllable it must move inside that syllable, so
the syllable is sung as two notes, the second a melisma carrying the vowel to the end tone.

**Song** (`sing.ts`, `planSung`). A note's vowel lands on its beat; onset consonants take time from
the note before; a coda finishes before the next onset; consonants squeeze proportionally in fast
passages down to a floor (12 ms each, with a 20 ms vowel), and if even that does not fit, everything
shrinks so the next beat holds. A melisma carries the vowel; the coda of the syllable that started
the chain sounds after the chain's last note.

**Events** (`sing.ts`, `sungEvents`). One kernel note per breath group, with `phoneme` and `bend`
Param events inside it and each upcoming sound announced 0.3 s ahead (`nextIn`, `nextPhoneme`) so the
planner can start its gestures before the sound. Aspirated releases are posted early by
VOT + voicing lag (Lisker and Abramson 1964: p 58, t 70, k 80 ms) so the vowel's voicing lands on the
beat.

## 4. Gestures and articulators

**Gestures** (`vocal-planner.ts`, after CHIMERA's planner). A vowel holds all 17 articulators at
strength 1 with raised-cosine ramps over most of the neighbouring consonants (Ohman 1966
coarticulation). A consonant holds the articulators it dominates at strength 40 and weakly sets the
rest (2.2). Each control step the target of articulator *a* is the strength-weighted mean

```
target_a = (rest_a * 0.05 + sum_g w_g(t) v_ga) / (0.05 + sum_g w_g(t))
```

with *w_g(t)* the gesture's strength times its ramp. Closures outrank other constrictions, then the
more anterior place wins. A consonant's release is a return gesture at its own speed (VocalTractLab
2.4). The glottis has three keys (abduction, closure, cricothyroid stiffness) and, since 2026-11-17,
a fourth: the breath, a factor on lung pressure.

**Articulator motion** (`cascade.ts`). Each articulator follows its target through six identical
first-order lags, H(s) = 1 / (1 + tau s)^6, the target approximation Birkholz fitted to measured
movements (Birkholz, Kroger and Neuschaefer-Rube 2011). With the target held over a step h the
errors evolve exactly:

```
e_k(h) = exp(-r) sum_{j<=k} e_j(0) r^(k-j) / (k-j)!,   r = h / tau
```

so a step is 21 multiply-adds, exact at any step rate and unconditionally stable. The 98 percent time
is 12.03 tau; each articulator keeps CHIMERA's natural frequency (6 to 13 Hz) through that time.

## 5. Shape to sound

**Geometry** (`vocal-geometry.ts`). CHIMERA's midsagittal model, ported to within 6e-14: jaw rotation,
tongue body as an arc, tip, lips, velum, larynx height, and a contact model, giving an area function
(pharynx and oral sections, with each section's smallest sub-section area for jets). Evaluated every
10.7 ms; between keyframes the areas are interpolated per block (MEASURED: 0.05 dB from evaluating
every 2.7 ms).

**The airway** (`junction-airway.ts`). A Kelly-Lochbaum waveguide (Kelly and Lochbaum 1962) at Courant
number 1: every section is c / (2 fs) long, so a wave crosses it in half a sample and the lossless
tube is exact. With power-normalized waves, each junction between impedances Z1 = rho c / A1 and Z2
solves its volume flow U in closed form from

```
k(U) |U| U + (Z1 + Z2 + Rv) U = 2 (p1+ - p2-) + pn
```

where k is the Borda-Carnot kinetic loss of a jet leaving the narrower side, Rv viscous resistance at
700 Hz and pn a turbulence source in series. Because U includes the mean flow, pressure builds behind
a closure, a release bursts, and voicing stops by itself when the pressure across the folds falls.
Even junctions carry a yielding wall (mass, resistance, stiffness per area, Birkholz-Zhang values,
solved implicitly) and the anatomical flow -dV/dt of moving tissue, taken from each profile section's
volume change on the smoothed geometry. The velum is a three-way node into a fixed nasal tube; lips
and nostrils radiate through Flanagan's R || L load.

**Turbulence.** Stevens' law (Stevens 1998, pp. 103-104), placed as Birkholz (2014) places it:

```
p_s = G |v_c|^3 sqrt(A_min)
```

at the narrowest section, faded in over Reynolds number 1000 to 2000, spectrally shaped by a pole at
0.15 v_c / d, and put at a wall, an obstacle (the incisors) or a free jet by the distance from the
separation point to the teeth. Gains are calibrated against human fricative spectra (Jongman, Wayland
and Wong 2000).

**The folds.** Three models on one parameter: CHIMERA's drawn area pulse with jitter, shimmer,
diplophonia and a logistic-map chaos term (the default); the geometric glottis of Titze (1984) as
extended by Birkholz, Drechsel and Stone (2019), whose area integral is closed form; and a
self-oscillating two-mass model (Ishizaka and Flanagan 1972; pressures after Steinecke and Herzel
1995; triangular glottis after Birkholz et al. 2011) under a pitch servo. In every case the folds
supply an area and the airway solves the flow, so source and tract interact.

**Output.** The radiated far field is proportional to the time derivative of the flow leaving the
lips and nose (plus the walls), DC blocked at 25 Hz and low-passed.

## 6. The beatbox (2026-11-17)

Twelve drum sounds (`vocal-beats.ts`), each a short gesture score built by the planner
(`beatScore`), following CHIMERA's design and the airstreams real beatboxers use (Proctor et al. 2013 imaged a beatboxer with real-time MRI and found the
percussion made largely with non-pulmonic airstreams, ejectives among them):

| Airstream | Sounds | How the engine makes it |
|---|---|---|
| glottalic (ejective) | kick B, rimshot K | glottis closure key 1, an oral closure, the larynx articulator rising 1.3 cm and still rising through the release |
| pulmonic | hat t, open hat tss, snare Pf, crash kch, closed hat ch, Psh | a breath gesture of 1.2 to 1.75 times the note's lung pressure, the glottis held open past the sound |
| ingressive | inward snare ^K | the breath at -1.7: negative lung pressure draws air in past a velar [x] |
| velaric (click) | tongue click !, lip pop P! | two closures and the dorsum hollowing the pocket between them |
| voiced | hum m | lips shut, velum down, folds adducted at the step's note |

Between sounds the breath rests at 0 (a beatboxer breathes only into a sound), and the lungs follow
the breath gesture with a 3 ms time constant instead of speech's 25 ms.

**Why the kick needed the tongue up.** With the glottis and lips sealed, the larynx is a piston on a
closed volume V. For a quick stroke ΔV, ΔP is roughly rho c^2 ΔV / V less what the yielding walls
absorb. MEASURED: with the mouth open behind the lips (V large) the kick reached 7 cmH2O while the
velar rimshot, whose cavity ends at the tongue, reached 19. That is the same physics that makes
bilabial ejectives rare across languages. Raising the tongue body short of the palate (tbY 7.7, where
/k/ seals at 8.35) shrinks V: the kick now builds 21 cmH2O. At 7.95 the tongue sealed against the
palate and the "kick" became a late velar burst, which the probe caught as a minimum area of zero at
section 21 instead of 39.

**The close microphone** (`mic` param, `junction-airway.ts`). A beatboxer is heard through a
directional microphone a few centimetres away, and that is a different physical measurement. For a
small source of volume flow U(t), the far-field pressure is p = rho U'(t - r/c) / (4 pi r), but the
particle velocity has a near-field term:

```
u_r = p / (rho c) * (1 + 1 / (j k r))
```

A pressure-gradient microphone answers u_r, so it hears an extra term proportional to the flow itself;
a cardioid (half pressure, half gradient) at distance r hears dU/dt + (c / 2r) U. Below c / (2 pi r),
2.8 kHz at 2 cm, the flow term dominates: the proximity effect, and the puff of a plosive on the
diaphragm. The engine adds `mic * (c / 2r) * U` to its output through a 70 Hz low cut (a real
microphone's, and it keeps slow jaw and tongue displacement from thumping). At mic 0 the output is bit
for bit what it was. MEASURED: mic 1 adds over 10 dB below 300 Hz to the kick and brings every beat 20
to 30 dB up, the kick level with the rimshot.

Gates: `test/engines-physical/beatbox.test.ts` (ejective pressure with lungs idle, inward pressure
below -5 cmH2O, breath-held silence before a sound, the hum's pitch, the mic's low band) and
`test/lyrics/beat.test.ts` (patterns, swing, retriggering).

## 7. What was wrong on 2026-11-17, and the lesson

The owner heard "hot" as "haw", "trade" as "tray", "start" as "stah", "board" as "bou", "roar" as
"row".

1. **Final consonants dropped in speech.** `speechPlan` split a phrase's last syllable into two notes
   for its nuclear tone and put the coda on the second, the melisma. `planSung` reads a melisma
   chain's coda from the syllable that starts it, so every phrase-final coda vanished. Every example
   was a word spoken alone, which is always phrase-final. Fixed by keeping the coda on the first
   copy, as the lyric reader does for sung melismas.
2. **Tense vowels before r.** The rules read "fair" feɪɹ, "board" boʊɹd, "near" niɹ, "poor" puɹ.
   American English neutralizes those pairs before a tautosyllabic r (Wells 1982); CMUdict writes
   fɛɹ, bɔɹd, nɪɹ, pʊɹ. General American now realizes NEAR, SQUARE, FORCE and CURE as ɪ ɛ ɔ ʊ, which
   fixes every word the sets tag, from the dictionary or the rules.

The lesson is about measurement. Both text-layer tests checked note counts and pitch, never the
sounds that reach the engine. The new tests run text through `speechPlan` and `planSung` and compare
the spans. An end-to-end intelligibility gate (section 9) would have caught the first bug the day it
was written.

## 8. Still open, measured

From `VOICE-2.md` and `VOICE-NORMS.md`:

- Letter-to-sound is 77 percent exact on common words, with no dictionary shipped; numbers and letter
  names are not spelled out.
- /θ ʒ h z/ further from human spectra than in the round before; voiced fricatives short of the human
  frication-to-voicing balance.
- /t/ after /s/ bursts 13 to 16 dB over CHIMERA above 2 kHz; voiceless closures carry extra 80 to
  500 Hz energy.
- Self-oscillating folds: onsets up to about 280 cents sharp in the child body for 30 to 40 ms; near
  500 Hz they lock onto F1.
- /ɑ/ keeps CHIMERA's shape on all bodies (every closer fit roughened the voice); /ɝ/'s F3 is not
  solved.
- None of the thirty-one accents has been judged by ear.
- Speech durations are fixed per stress class: vowels do not lengthen before voiced codas, which is
  English's main cue for final voicing ("bead" against "beat", about 1.5 times; Peterson and Lehiste
  1960). With codas now present, that is the next likely "trade" or "tray" confusion.
- Beatbox: the clicks have no measured suction yet (the probe reads the pharynx, not the pocket); the
  lip pop is 10 dB under the snare even with the mic.

## 9. Directions

Each is grounded in published physics or phonetics, says how it would be measured, and roughly what
it costs.

1. **An intelligibility gate.** Render a fixed word list (minimal pairs: bead/beat, trade/tray,
   hot/haw, board/bored, ship/sip) through the real path and score it with an open phoneme
   recognizer (a wav2vec2 phoneme CTC model in ONNX, run in Node in CI). Phone error rate per body
   and accent becomes a number every change must not raise. This is the "measure before changing"
   rule applied to words.
2. **Klatt durations for speech.** Replace the two fixed vowel lengths with DUR = MIN + (INH - MIN) x
   PRCNT (Klatt 1979; Allen, Hunnicutt and Klatt 1987, ch. 9), including the voiced-coda lengthening
   and the shortening of vowels before voiceless ones and in clusters. CHIMERA's own durations.rs
   already implements it for speech; the sung path keeps note-given lengths.
3. **A pronunciation dictionary that fits.** CMUdict as a lazily loaded entry point
   (`bellows-voice/dict`): words as a sorted list with front coding, pronunciations as phone indices
   packed 6 bits each. Estimated at about 1 MB raw for 125k words and a few hundred KB gzipped (to be
   measured); a 20k common-word subset is far smaller. Measured by the same exact-match score now at 77 percent.
4. **Acoustic sensitivity functions for online formant control.** For a tube, the first-order change
   of formant n under a small area perturbation is
   dF_n / F_n = sum_x S_n(x) dA(x) / A(x), with S_n(x) = (KE_n(x) - PE_n(x)) / E_n, the difference of
   kinetic and potential energy of mode n at x (Fant and Pauli 1974; Story 2006 uses it to tune area
   functions). The modes come from the transfer-matrix solution the vowel solver already builds. Chained
   through the geometry's Jacobian, this gives a gradient of formants with respect to the 17
   articulators: accent vowels solved in milliseconds at runtime instead of a build-time Nelder-Mead,
   formant tuning for sopranos that targets F1 directly, and a continuous accent morph.
5. **Tract variables instead of articulator targets.** Articulatory Phonology (Browman and Goldstein
   1992) and Task Dynamics (Saltzman and Munhall 1989) specify a consonant by its constriction (tongue
   tip constriction degree 0 at the alveolar ridge) and let a damped mass-spring system in task space,
   mapped through the pseudo-inverse of the geometry's Jacobian, find the articulators. A /t/ then
   closes whatever vowel surrounds it, which addresses the measured weakness of the fitted map on
   contacts and laterals.
6. **Prosody with Fujisaki's model.** log F0(t) = log Fb + sum phrase commands through a critically
   damped second-order filter + sum accent commands through another (Fujisaki and Hirose 1984). The
   filters are the same closed-form steppers as `critdamp.ts`, so the intonation would move like a
   larynx rather than in steps, and the commands map one to one onto the current accents and tones.
7. **Self-oscillating lips for a lip-roll bass.** The beatbox "lip bass" is a bilabial trill: the
   same Bernoulli-driven valve as the two-mass folds, at the lips (the brass-player lip models of
   Adachi and Sato 1996). The fold oscillator could be reused as a lip oscillator on the last grid
   junction.
8. **The microphone as a model.** Distance, angle and pattern (omni, cardioid, figure eight) from the
   same near-field formula, plus the mouth's directivity (a piston in a sphere, Flanagan 1972): a
   speech voice on a lavalier and a beatboxer on an SM58 become settings, not effects.
9. **Measure the clicks.** Expose the pocket pressure between two closures as a probe and gate the
   click's suction against published velaric values, as the ejective is gated now.
