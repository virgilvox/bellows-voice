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
first-order lags, H(s) = 1 / (1 + tau s)^6, the target approximation of Birkholz, Kroger and
Neuschaefer-Rube (2011), who use order 10; order 6 follows VocalTractLab and Birkholz and Hoole (2012)
(corrected in section 10). With the target held over a step h the
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
a cardioid (half pressure, half gradient) at distance r hears dU/dt + (c / 2r) U. Below c / (4 pi r),
1.4 kHz at 2 cm, the flow term dominates (corrected in section 10): the proximity effect, and the puff of a plosive on the
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

## 10. Review and plan (Fable, 2026-11-17)

A review of sections 1 to 9 against the code and the literature, then a plan. Four labels say how a
statement is known. CHECKED: read today in the source named. MEASURED: run today, which is one of
three things: the text layer through `toIPA`; the scratch renders of "hot", "trade", "start" and
"board" made after the two fixes of section 7 (male default voice, one render each; 5 and 10 ms
frames; bands split at 400 Hz and 3 kHz with two-pole filters, so levels are good to a few dB); or
the engine's held /ɑ/ swept in pitch through the norms test's own jitter and shimmer code. DERIVED:
algebra on this page, to be confirmed by a test. RECALLED: from memory of a paper, to be looked up
before it is repeated anywhere. Sources read today: the text of Birkholz et al. (2011) at
vocaltractlab.de, and the PubMed Central copies of Proctor et al. (2013, PMC3574116) and Logan et
al. (1989, PMC3507386).

### 10.1 Corrections to sections 1 to 9

Checked and right as written: the cascade's closed form and its 12.03 tau; the junction's root,
U = 2c / (b + sqrt(b^2 + 4 k |c|)) with c the right-hand side and b the linear coefficient, and its
series branch; Stevens' exponent (U^3 A^-2.5 is v^3 sqrt(A)); Lisker and Abramson's 58, 70 and
80 ms; Peterson and Lehiste's ratio; CMUdict's fɛɹ, bɔɹd, nɪɹ, pʊɹ; the monopole's near-field
velocity and the cardioid sum dU/dt + (c / 2r) U; the sensitivity formula of direction 4; Fujisaki's
form.

1. **Section 4, the cascade's order.** Six lags are credited to Birkholz, Kroger and
   Neuschaefer-Rube (2011). That paper sets N = 10, "in agreement with Ogata and Sonoda", and says
   lower orders make the velocity profile progressively asymmetric (CHECKED in its text). Order 6
   rests on Birkholz and Hoole (2012) and on VocalTractLab, as `cascade.ts` says; I could not check
   those two. Cite Ogata and Sonoda for the cascade, the 2011 paper for N = 10, the 2012 paper for
   6. Which order suits this voice is one measurement: the order is one constant.
2. **Section 4, "exact at any step rate".** Exact for a target held over the step. The planner's
   targets ramp and are sampled every 64 samples, so the cascade sees a staircase: a zero-order hold
   of 1.3 ms against time constants of 4 to 13 ms. Small, but it is a dependence on the control
   rate; the update for a target that moves linearly over the step is also closed form.
3. **Section 5, "the lossless tube is exact".** Exact for fixed areas on the grid. The back duct is
   read through a third-order Lagrange interpolator, which is not all-pass: at a half-sample
   fraction, at 48 kHz, it loses 1.1 dB at 12 kHz and 5.3 dB at 18 kHz on each read (DERIVED from
   its taps -1/16, 9/16, 9/16, -1/16), so the damping of the top resonances moves with the larynx.
   Not a bug; the sentence should say what is exact.
4. **Section 5, what the junction's pressure is.** The law keeps p across a contraction (but for the
   0.1 loss) and takes the Borda-Carnot loss at the expansion. That is the law for total pressure,
   p_static + rho v^2 / 2. Static pressure falls by rho v^2 / 2 inside a constriction and the law
   has no such fall, so the wave variable is total pressure and a section's static pressure is
   p - rho (U / A)^2 / 2 (DERIVED). In a wide cavity the two agree (0.02 cmH2O at 500 cm^3/s through
   3 cm^2), so `pSupra` and the gates of section 6 stand. In a 0.1 cm^2 constriction at 300 cm^3/s
   they differ by 5 cmH2O: the yielding wall there is pushed that much too hard, and anything on
   the grid that the air must suck shut (direction 7) needs the static figure.
5. **Section 5, the keyframe figure.** 0.05 dB is over all frames. The same measurement reads
   0.33 dB over consonants (`vocal-drive.ts`), and consonants are where intelligibility lives.
6. **Section 5, two calibrations.** The wall's K and B sit at the top of the range `air.ts` gives
   for Birkholz and Zhang (2025) and the mass is CHIMERA's 1.5, not their 2.0; I could not check
   that paper. The fricative gains were fitted to one speaker's recordings and to CHIMERA's levels
   (VOICE-2.md); Jongman, Wayland and Wong's spectral means are a check on the result (0.81 to 0.98
   kHz off), not what the gains were calibrated against.
7. **Section 3, two attributions.** `speech.ts` says its figures are its own. Klatt (1976) is a fair
   source for final lengthening as a fact; the factor in his 1979 rules is 1.4 (RECALLED), not 1.5.
   "A pitch accent on each stressed syllable" is this module's rule: Pierrehumbert's model accents
   chosen words. Function words are weak here, so in practice every content word is accented.
8. **Section 6, what Proctor et al. found.** Their Table I has 17 effects: 8 pulmonic egressive, 5
   glottalic egressive, 4 lingual ingressive (CHECKED in the PMC copy). "Largely non-pulmonic"
   should read "about half". All three kicks are bilabial ejectives, which supports the kick here.
   Their Pf-type snare ([pf'], "no meshed") is glottalic egressive, and the hi-hats and cymbals are
   pulmonic; this engine makes Pf pulmonic. No pulmonic ingressive effect is in that table, so the
   inward snare needs another source (later rtMRI and aerodynamic studies of beatboxing describe it,
   RECALLED, not checked).
9. **Section 6, the ejective's formula.** "rho c^2 dV / V less what the walls absorb" has the sizes
   backwards: the walls set the pressure. With wall stiffness k_w per unit area over a surface S,

   ```
   dP = dV / (V / (rho c^2) + S / k_w) = (rho c^2 dV / V) / (1 + (S / V) (rho c^2 / k_w))
   ```

   and S / V follows from the solver's own wall resonance, FW^2 = rho c^2 S / (4 pi^2 m V): FW 220
   Hz and m 1.5 give S / V = 2.05 per cm, so with k_w 1e5 the walls are 29 times more compliant than
   the air (DERIVED). A 4 cm^3 stroke into 50 cm^3 makes about 110 cmH2O in a rigid tract and about
   4 here, 5 with the wall's resistance over a 50 ms stroke; the test measures 7, and 21 with the
   tongue up. In this engine the pressure goes as k_w dV / S: raising the tongue helps by taking
   wall out of the cavity. Speakers brace the walls for ejectives, which is idea E.
10. **Section 6, the microphone.** For dU/dt + (c / 2r) U the terms are equal at c / (4 pi r), 1.4
    kHz at 2 cm. The 2.8 kHz quoted, c / (2 pi r), is the corner of a pure gradient (figure-eight)
    microphone, whose flow term is (c / r) U. The same number is in the comment in
    `junction-airway.ts`. Two further points. The puff of a plosive on a diaphragm is not this term:
    it is a jet carried by the air, quadratic in the flow, arriving after r / v_jet, not r / c (idea
    P). And the term is applied to lips, nostrils and wall flow together, where only the lips are 2
    cm from the capsule.
11. **Section 6, the lungs.** A 3 ms lung time constant and a breath that rests at zero between
    sounds are modelling shortcuts, not physiology: alveolar pressure cannot move in milliseconds,
    and what a beatboxer switches fast is a valve (the glottis or an oral closure) on pressure that
    stays up. The sounds come out similar; the text should say which it is.
12. **Section 7, "fixes every word the sets tag".** Only where the r closes the syllable. MEASURED:
    General American still reads "fairy" feɪ.ɹi, "serious" sɛ.ɹɪ.əs, "hero" hɛ.ɹoʊ; Southern
    British reads "story" stɒ.ɹi and "glory" glɒ.ɹi, because ɔ before r plus a vowel falls to CLOTH
    in `lexical-sets.ts`. Pre-r neutralization applies before any r in the same morpheme.
13. **Section 8, final voicing.** Vowel length is a strong cue before a pause (Raphael 1972) and a
    smaller one inside a phrase, and it trades with closure voicing, closure length, F1 at the
    vowel's end and the release. MEASURED on the four renders, levels re each word's loudest frame:

    | Word | Final closure, band under 400 Hz | Release, total and above 3 kHz |
    |---|---|---|
    | hot /t/ | -33 to -54 dB | -26, -32 dB, 10 to 15 ms long |
    | start /t/ | -36 rising to -29 dB | -31, -44 dB |
    | trade /d/ | falls to -60 dB in 35 ms | -25, -30 dB |
    | board /d/ | -30 to -27 dB for 80 ms | -29, -37 dB |

    The /t/ of "start" carries as much closure voicing as the /d/ of "board", the /d/ of "trade"
    carries none, and no release is ordered by voicing. With vowel lengths fixed, no cue marks
    final voicing consistently, so durations alone will not settle "trade" against "trait". The
    initial /t/ bursts of "trade" and "start" are within 3 dB of the loudest frame of the word;
    the final releases of the same two words are 25 to 31 dB under them.
14. **Section 9, the word list.** MEASURED: the rules read "bead" as bɛd (and "knead" nɛd, "plead"
    plɛd, "steak" stik, "pretty" pɹɛɾi, "beautiful" bjuɾaɪfʌɫ, "tonight" with its stress on "to"),
    so bead against beat fails before any sound is made. "board" and "bored" are homophones, not a
    pair. "hot" and "haw" differ twice in accents that keep LOT and THOUGHT apart.
15. **Section 9, direction 6.** Pitch does not move in steps now: every note change passes through
    the glide (`pitchglide.ts`), a second-order system with overshoot. A different filter is not
    what the intonation lacks.
16. **Section 8, "every closer fit roughened the voice".** MEASURED in idea F: with the shape
    untouched, the male /ɑ/ reads 3.1 to 5.2 percent shimmer as f0 goes from 100 to 132 Hz while
    jitter stays at 0.68. The roughening the fits showed is the same curve, reached by moving F1
    instead of f0. The closer /ɑ/ was turned down by the test pitch, not by its sound.

### 10.2 The nine directions, evaluated

1. **Intelligibility gate: right, the most valuable of the nine, with three changes.** A phone error
   rate from a recognizer trained on natural speech is noisy on a synthetic voice, and one number at
   the end of the chain cannot say which layer broke. Score closed sets with margins instead (idea
   B), which lands on a scale with published human figures; put a gate under it at every layer
   (idea A); and replace the word list with the Modified Rhyme Test's 300 words (House et al. 1965),
   built for this. A base-size wav2vec2 is about 95 million parameters (RECALLED): run it nightly,
   and the lower rungs per commit. Never tune against the recognizer alone: a change counts when
   the listener and the cue gate for the same contrast both move toward the human figure.
2. **Klatt durations: right and cheap, not enough alone.** Port CHIMERA's `durations.rs` table; do
   not retype Klatt's numbers from memory. The large voiced to voiceless ratio is prepausal, and
   correction 13 shows the closure cues are missing too. The sung path needs the cue as well, and
   can have it without touching note lengths (idea E).
3. **A dictionary: right, and it should be first.** It is the only fix for a text error, the rules
   miss 23 percent of common lyric words, and its gate exists. Idea K makes it several times
   smaller than a packed CMUdict.
4. **Sensitivity functions: right, with five amendments.** Lip protrusion and larynx height change
   section lengths, and Fant's length term goes with the sum of the energies, not the difference.
   Computed as the derivative of the characteristic function (idea G) the result is exact with
   radiation and wall losses and gives bandwidths too. Formants must be followed by continuation,
   not sorted, or F2 and F3 swap near /i/ and /ɝ/. The objective's second term needs repair: every
   closer /ɑ/ "roughened the voice", and idea F measures that reading as an artifact of the test
   pitch. Last, the
   solver's free set (jaw, body x and y, root, lip aperture and protrusion; CHECKED) leaves out the
   tip, weighs F3 at half, and a simplex has no reason to find three constrictions at once. A
   gradient does: mode 3 of a closed-open tube has its flow maxima at L/5, 3L/5 and L from the
   glottis, the lower pharynx, the palate and the lips, which is where American r constricts.
5. **Tract variables: the right diagnosis, too large as stated.** Task dynamics replaces the
   planner. Idea H gets the property that matters (a /t/ seals whatever the vowel) from one extra
   number per consonant gesture, and leaves full task dynamics as a later option.
6. **Fujisaki: weaker than it looks.** See correction 15. Its accent commands are positive steps, so
   low accents and falls below the baseline need negative commands that the model was not built
   for, and the mapping from tones is not one to one. Keep its phrase component for declination;
   take the accents from target approximation with sloped targets (idea I).
7. **Self-oscillating lips: right, and one element should serve them all.** Lips, tongue tip and
   uvula are the same valve (idea J). It needs static pressure (correction 4). The present wall
   already resonates at sqrt(k / m) / 2 pi = 41 Hz, near a trill's 25 to 30 Hz (RECALLED).
8. **The microphone as a model: fine as a feature, last for speech.** Fix the corner first
   (correction 10).
9. **Measure the clicks: right, and the result can be predicted (DERIVED).** The pocket's walls are
   the soft wall, where one side is bone and the other the tongue that does the work, so suction
   stops near k_w dV / S: 0.5 cm^3 over 8 cm^2 gives 6 cmH2O. Made rigid, the pocket holds only
   V dP / (rho c^2), 0.07 cm^3 for 2 cm^3 at 50 cmH2O, and the area floor's leak through two seals
   refills that in 15 to 40 ms. Two fixes in that order: stiff walls in the pocket, then a true
   seal. I have no click pressures I trust enough to quote; Ladefoged and Traill's click papers
   are the place to look.

Missing from the nine: a gate at each layer; the physics of final voicing; the pressure a fricative
runs on; a guarantee that a planned closure seals; consonant place solved from an acoustic goal; r
before a vowel; cost as a gate; and anything that answers the owner's remark about CHIMERA's
visualizer (idea M: the mouth drawn here is not the engine's own motion) or makes the voice
easier to correct when it says a word wrong.

### 10.3 New ideas

**A. A ladder of gates, one per layer.** Text: phones and stress equal the dictionary's.
Articulation: every planned constriction forms, measured on the planner, cascade and geometry alone,
with no audio (stops and nasals seal for 20 ms, fricatives hold their area band for 40 ms,
approximants never enter it), over every consonant, four vowel contexts, both syllable positions,
three rates and three bodies. Aerodynamics: pressures and flows in human ranges (ideas D and E).
Cues: voice onset time, vowel length by coda, closure voicing, burst level and shape by place, locus
equations (Sussman, McCaffrey and Matthews 1991: the slope of F2 at onset against F2 at mid vowel,
steepest for labials and flattest for alveolars, a single number for how much a consonant gives way
to its vowel), fricative moments, formant bandwidths against sweep-tone data (Fujimura and Lindqvist
1971). Listener: idea B. A failure names its layer, and the first three rungs run in seconds.

**B. A machine Modified Rhyme Test.** For each of 50 six-word sets, render the word and score all
six pronunciations against the audio with the CTC forward sum:

```
s(w) = log sum_{alignments a of phones(w)} prod_t p_t(a_t)
m    = (s(w_true) - max_{w' != w_true} s(w')) / T
```

The error rate is the share of items with m < 0, and the margin m is a continuous reading per
contrast that moves before the error rate does. Human closed-set errors on this test: natural
speech 0.53 percent, DECtalk Paul 3.25, MITalk-79 7.00, Echo 35.56, final consonants worse than
initial on most systems (Logan, Greene and Pisoni 1989, Table II; CHECKED). All six pronunciations
come from CMUdict, not from the voice's reader, so "bead" said as bɛd loses to "bed". Score natural
recordings and CHIMERA's renders of the same list once: the first places the machine on the human
scale, the second turns "CHIMERA seemed more intelligible" into a number per contrast.

**C. A closure guarantee, in closed form.** The cascade's answer to a target held at h for a time T
is a difference of gamma distributions, with P(N, x) = 1 - exp(-x) sum_{k<N} x^k / k!:

```
y(t) = h (P(N, t / tau) - P(N, (t - T) / tau)),   peak at t* = T / (1 - exp(-T / ((N - 1) tau)))
```

So the planner can compute, before a sound is made, how far an articulator will get and for how
long it stays past its contact, and solve the virtual target's depth h for the hold it wants.
DERIVED for the tongue tip at 13 Hz and a stop's speed of 1.55 (tau 3.8 ms): a 12 ms target with no
lead reaches 51 percent of the way, and with a 30 ms lead 98 percent. The sung floor of 12 ms is
safe only while the lead survives the squeeze, and this formula is the check.

**D. The pressure a fricative runs on.** Glottis and constriction are two orifices in series, so the
lung pressure divides as the inverse squares of their areas. With Stevens' law p_s ~ U^3 A_c^-2.5,

```
p_s ~ A_g^3 A_c^0.5 (A_g^2 + A_c^2)^-1.5,   greatest at A_c = A_g / sqrt(5),
```

where 5/6 of the lung pressure falls across the constriction (DERIVED, taking the two orifices' loss
coefficients as equal). VOICE-2.md's jets, 2810 cm/s for /s/ and 1930 for /z/, are 4.6 and 2.2 cmH2O
as rho v^2 / 2, of the 9 in the lungs: fractions of 0.51 and 0.24, if they still hold. Speakers hold
about 6 to 7 cmH2O in the mouth for voiceless obstruents and 4 to 5 for voiced ones (Arkebauer,
Hixon and Hardy 1967, RECALLED). At 5/6 the /s/ jet would be 3590 cm/s, 6.4 dB more source at the
same area. For a voiced fricative the mean glottal area takes A_g's place: P_oral / P_lung = 1 / (1
+ (A_c / mean A_g)^2), so a target of 0.6 wants A_c = 0.8 mean A_g, a glottis that vibrates while
standing open, and a constriction narrower than the present one. VOICE-2.md found that opening the
glottis from 0.035 to 0.15 cm^2 moved /z/ and not /v/ or /ʒ/; the divider alone does not explain
that, and the pressure in the mouth during each fricative is the reading that says whether its
constriction, its glottis or its source is short. The pulse's amplitude should also fall with
transglottal pressure, as the geometric folds' does (Titze 1989), which VOICE-2.md already names as
part of the fix.

**E. Final voicing from the wall, and one key for wall tension.** In a voiced closure the folds run
until the mouth has filled:

```
t_voiced = (P_lung - P_offset) (V / (rho c^2) + S / k_w) / U_mean
```

DERIVED with the figures of correction 9, P_offset 3 cmH2O and a mean flow of 80 to 100 cm^3/s: 60
to 80 ms at k_w 1e5 and about 25 ms at 3e5, CHIMERA's old stiffness. Voiced stops are made with
slack, expanding walls and voiceless ones with stiffer walls (Westbury 1983; Svirsky et al. 1997;
RECALLED); that ejectives and clicks brace them further is my inference from the pressures they
reach. So wall stiffness becomes a planner key: slack for /b d g/, braced for /p t k/ and for the
beatbox's ejectives and click pockets. One key gives the voice bar its length, cuts the voiceless
closure's low band and raises the kick's pressure. With it go three smaller changes: the glottis
opens or stops at a final voiceless closure; lung pressure and the envelope hold through a phrase's
last release, which now falls where the gate closes; and in song, where the note fixes the syllable,
the vowel to closure boundary moves inside the note (later and a shorter closure before a voiced
coda), so the length cue survives without moving a beat.

**F. The roughness of a closer /ɑ/ is jitter turned into shimmer.** A harmonic at k f0 on the skirt
of a formant F with bandwidth B changes level with pitch:

```
d ln a_k / d ln f0 = -k f0 (k f0 - F) / ((k f0 - F)^2 + B^2 / 4)
|d ln a_k / d ln f0| <= Q = F / B,   reached at k f0 = F +- B / 2
```

so a source's jitter becomes shimmer wherever F1 falls between two harmonics, and almost none where
a harmonic sits on the peak. MEASURED, the shapes untouched, a held /ɑ/ of 3 s at each pitch:

| Body | f0 swept, Hz | Jitter, % | Peak shimmer, % | At the norm pitch |
|---|---|---|---|---|
| male | 100 to 132 | 0.67 to 0.69 | 3.1 at 116 Hz to 5.2 at 110 Hz | 3.8 at 114, 3.1 at 116 |
| female | 185 to 213 | 0.71 to 0.73 | 1.9 at 209 Hz to 3.7 at 185 Hz | about 2.6 at 199 |
| child | 222 to 258 | 0.72 to 0.73 | 2.0 at 246 Hz to 3.6 at 222 Hz | about 2.2 at 240 |

In the female and child the lowest reading is where the fourth harmonic is strongest (836 and 984 to
1000 Hz), which is F1. The male's curve has two dips; shimmer of cycle energy in place of cycle peak
has one, 2.1 percent at 122 Hz, where the sixth harmonic sits on F1 (732 to 744 Hz). Raising F1 by x
percent moves the harmonics against it in the same way as lowering f0 by x percent. VOICE-NORMS.md's
rejected fits raised F1 by a few percent and read 4.7 to 5.6 percent (male), 3.3 to 3.8 (female) and
2.7 to 2.9 (child); the untouched shapes read 4.7 to 5.2, 3.2 to 3.7 and 2.6 to 3.2 at pitches 3 to
7 percent lower. So the rule "shimmer rises by no more than half a point" turned those fits down for
where 115, 199 and 240 Hz fall against F1, not for a rougher source. Gate the mean over a sweep of
one harmonic spacing (f0 from F1 / (k + 1) to F1 / k) and compare like with like. One more
consequence: the male's mean over 106 to 124 Hz is 4.3 percent, over the 3.81 limit that the single
pitch passes, so the male source is a little rougher than VOICE-NORMS.md reports.

**G. Formants and their gradient in one pass.** Let D(w) be the characteristic function of the chain
of section matrices M_1 ... M_N with the radiation load (the function whose zeros the vowel solver
finds). Carrying dD/dw through the same product gives Newton's step, and started from the last
keyframe's roots it converges in two or three steps: about 9000 multiplies per keyframe for four
formants, a few percent of the airway's cost over the same 10.7 ms. Prefix and suffix products
give every section's sensitivity in the same order of work:

```
dw_n / dA_i = -(L_i (dM_i / dA_i) R_i) / (dD / dw)
```

with L_i the row of M_1 ... M_(i-1) that the closed glottis picks and R_i the column M_(i+1) ... M_N
applied to the load, and the same with dM_i / dl_i for lengths. With complex w the real part is the
formant's shift and the imaginary part its bandwidth's. In the lossless closed-open limit this is
Fant and Pauli's (KE - PE) / E. Uses: the solver by Gauss-Newton with the tip free and F3 at full
weight, accents solved at load time, F1 tuning that aims at a frequency instead of a jaw table, and
the display of idea M.

**H. A constriction servo.** The geometry already computes the signed gap g at a consonant's place.
When a consonant gesture is built, evaluate the posture the overlapping vowels will give at its
centre and correct the dominant articulator's target once:

```
q_d <- q_d + (g_goal - g) / (dg / dq_d)
```

with g_goal negative for a stop (the virtual depth of idea C) and the area of idea D for a
fricative. The slope comes free from the trajectory by Broyden's update,
J <- J + (dy - J dq) dq^T / (dq^T dq), with no extra geometry evaluations. Coarticulation resistance
(Recasens' degree of articulatory constraint, RECALLED) then becomes the weak strength, 2.2 now for
every consonant, set per consonant and fitted to the locus slopes of idea A.

**I. Pitch as an articulator.** In the target approximation of Prom-on, Xu and Thipakorn (2009) each
syllable has a pitch target with a height and a slope, approached through a critically damped
third-order system: f0(t) = m t + b + (c1 + c2 t + c3 t^2) exp(-lambda t), the constants set by
continuity. That is `cascade.ts` at N = 3 with a ramp for a target, exact and six multiply-adds a
step. Fujisaki's phrase command, Ap alpha^2 t exp(-alpha t), is the same cascade at N = 2 answering
an impulse, and it carries declination and its reset. What this adds over today's stepped targets
through the glide is slopes (a rise is a target, not two notes), alignment (the peak can sit late
in the stressed syllable) and no melisma trick at a phrase end. A physical gate comes with it: no
movement faster than a larynx can make, 89.6 + 8.7 d ms for a rise of d semitones and
100.4 + 5.8 d for a fall (Xu and Sun 2002, RECALLED). For breaks in long sentences without commas,
the chinks and chunks rule (a break may fall where a function word follows a content word;
Liberman and Church 1992, RECALLED) costs a few lines.

**J. One valve element.** Give chosen junctions a wall whose displacement changes the area:

```
m y'' + r y' + k (y - y_0) = p - rho (U / A)^2 / 2,   A = max(A_floor, w (y - y_contact))
```

The wall state already exists at every even junction; what is new is the static pressure
(correction 4), the feedback to the area and a contact. With the lips' mass and tension it is a lip
roll, with the tip's a trilled r for Russian, Scottish and Spanish settings, with the uvula's a
uvular trill, and with more tension a pitched lip bass (Adachi and Sato 1996 for the lip valve;
McGowan 1992 for the trill's dependence on wall compliance, RECALLED).

**K. Pronunciation as predictive coding.** The rules predict; the dictionary stores only where they
are wrong, as an edit against their output (most are one vowel or one stress). An entry is the
word, front coded, and two or three bytes of edit. Words the rules get right cost nothing, the
store shrinks whenever the rules improve, and it cannot disagree with CMUdict. Before the rules, a
suffix stripper (s, ed, ing, ly, er, est, 's) looks up the stem and applies English allomorphy
(ɪz after sibilants, s after other voiceless sounds, z otherwise; ɪd after t and d, t after other
voiceless sounds, d otherwise), which multiplies each entry's reach. Every word then carries its
source (dictionary, stem, rules, function word, written IPA), so a page can underline the words
the voice guessed, and a user lexicon sits in front of all of it.

**L. A consonant's place from its acoustic goal.** A fricative's main peak is its front cavity's
quarter wave, f = c / (4 (L + dL)) with dL the mouth's end correction. VOICE-2.md has /ʃ/ at L =
3.65 cm and 2.4 kHz against the human 2.5 to 4 kHz, which needs about 2.5 cm. So solve the blade's
place for the front length the peak asks for, one variable through the geometry, instead of keeping
the inherited target. /ʒ/ inherits the repair, and its balance, 34 dB under the human, is read in a
band (2.5 to 11 kHz) that its present peak sits below.

**M. Seeing the physics.** CHIMERA draws the anatomy, the folds, a gesture score, a spectrum and a
vowel map, from its engine's own telemetry. The mouth here is a re-enactment: `src/view/tract.ts`
moves per-phoneme targets through a critically damped tracker (CHECKED), not the planner's gestures
through the six-stage cascade and the contacts, so the picture and the sound can disagree. The first
step is one headless runner of planner, cascade, contacts and geometry, shared by the view and by
the articulation gate of idea A. Then this engine can draw what only it has. A pressure ribbon: the
tract coloured by static pressure, so a closure fills, an ejective's piston and a click's suction
show, and a meter reads cmH2O. The flow and the turbulence sources where they sit, sized by level.
Mode shapes: the standing wave of each formant along the tract with its sensitivity as a band (idea
G), so "narrow here and F2 rises" can be tried by dragging the tongue. A cue inspector: for a typed
word, the phones with their source, the spans, and the measured cues of idea A against their human
bands, which is the gate ladder as a tool for the complaint "it said that word wrong". This needs a
telemetry snapshot from the worklet (areas, section pressures, junction flows, source levels, one
phase-locked cycle of glottal area and flow) written into a preallocated buffer; how it reaches the
page depends on what bellowsjs offers a plugin, which I did not check.

**N. Clear speech as a parameter.** Talkers asked to speak clearly slow down, release final stops,
reduce vowels less and raise the level of obstruents against vowels (Picheny, Durlach and Braida
1986, RECALLED). A `clarity` setting can drive exactly those four through the planner, and the
machine test of idea B proves or refutes that it lowers the error.

**O. Cost as a gate.** The airway's figure is measured; nothing fails when it drifts. Add a test
that times each layer per sample and per block against a budget. Two cheap wins to measure with it:
once its waves have died, a tube with no breath and no moving wall stays silent, so a beat's rests
can skip the sample loop until an input changes; and waves that decay through a long rest inside one
note may reach denormal doubles, which are slow on x86 (to be measured; I found no flush in the
airway). The odd and even junction passes are independent within a pass, so a SIMD kernel in
WebAssembly is the later route to a choir, at the price of a second build.

**P. The pop is a jet.** A plosive's puff reaches a close capsule as moving air: a stagnation
pressure rho (U_lips / A_lips)^2 / 2, delayed by r / v_jet, undiminished inside the jet's core
(four to six openings long) and falling as (core / r)^2 beyond. A 500 cm^3/s burst through
0.3 cm^2 is a 17 m/s jet with 160 Pa of it, several times what the proximity term gives for the
same burst (DERIVED, rough; the core length is RECALLED). It is quadratic in the flow and depends
on the lip opening, so it is a different term from the proximity effect, and a pop filter is a
gain on this term alone.

### 10.4 The plan, in priority order

Items 1 and 2 come before any change to the sound: item 1 because its gate exists, item 2 because
it is the measurement the later items are judged by. Hours are for one person who knows the code.

1. **A pronunciation store that only holds the rules' mistakes** (idea K, correction 12). Mechanism:
   residual entries against the rules, suffix stripping with allomorphy, pre-r sets before a vowel
   by spelling, numbers and letter names spelled out, a source tag per word. Outcome and gate: exact
   match with stress on the 469-word list from 77 to at least 97 percent with the tier that ships in
   the text entry, at least 98 percent of tokens on a held-out text with the lazy tier, sizes
   reported by the build (estimate: 30 to 60 KB before gzip for the 20 000 commonest forms); "bead",
   "pretty", "tonight", "fairy", "serious" and British "story" in the tests. Files:
   `src/lyrics/english.ts`, `letter-to-sound.ts`, `lexical-sets.ts`, `pronounce.ts`, a new
   `src/lyrics/dict` entry and `scripts/gen-dict.mjs`, `THIRD_PARTY_NOTICES.md` for CMUdict's
   notice. Cost 12 to 16 h. Risk low.
2. **The gate ladder** (ideas A and B). Mechanism: a headless runner of the engine's own planner,
   cascade, contacts and geometry for the articulation gate (the view takes it over in item 9);
   pressure probes with the static correction; cue meters; the machine test in a nightly job with
   natural and CHIMERA references. Outcome: every later item has a number to move, and a baseline
   table of margins per contrast for today's voice. Gate: the ladder's own tests fail on seeded
   faults (a coda dropped, a closure 0.02 cm short, a voice bar removed). Files: new
   `test/intelligibility`, test helpers, `scripts/mrt.mjs`, fixtures for the word list and
   references. Cost: articulation 8 h, aerodynamic 4 h, cues 10 h, listener 12 to 16 h. Risk low for
   the first three, medium for the listener (model size, behaviour on synthetic speech).
3. **Final voicing and the last release** (idea E, direction 2, correction 13). Mechanism: Klatt's
   durations in speech from CHIMERA's table; the boundary shift in song; the wall tension key; the
   glottis at a final voiceless closure; breath and envelope held through the last release. Outcome
   and gate, on bead/beat, trade/trait, board/bought and the test's final sets: vowel length ratio
   at least 1.3 before a pause; closure band under 400 Hz within -20 to -35 dB of the vowel for 40
   ms in /b d g/ and under -45 dB after 20 ms in /p t k/; a final /t/ release above 3 kHz at least 6
   dB over /d/'s; fewer final-consonant errors on the machine test with no rise elsewhere. Files:
   `src/lyrics/speech.ts`, `durations.ts`, `sing.ts`, `src/engines/vocal-planner.ts`, `vocal.ts`,
   `src/dsp/junction-airway.ts`, `air.ts`. Cost 14 to 18 h. Risk medium: the comparison renders
   against CHIMERA and the golden renders move.
4. **The closure guarantee** (idea C). Mechanism: the planner evaluates the gamma response when it
   builds a consonant gesture and deepens or lengthens the target until the hold is met; sung
   floors become per class. Outcome and gate: the articulation gate passes at every rate down to
   the floors, in all three bodies; a unit test of the closed form against the stepped cascade to
   1e-9. Files: `src/dsp/cascade.ts` (the response), `vocal-planner.ts`, `src/lyrics/sing.ts`.
   Cost 6 to 8 h. Risk low to medium.
5. **The fricatives' pressure budget and /ʃ/'s place** (ideas D and L). Mechanism: constriction
   areas and glottal openings set jointly from the divider; the pulse's amplitude follows
   transglottal pressure; the blade's place solved for the front cavity. Outcome and gate:
   P_oral / P_lung at least 0.75 in /s ʃ f θ/ and 0.5 to 0.7 in /z ʒ v ð/; /z/'s frication over
   voicing within 6 dB of the human 11.4 in all three bodies on five seeds, with the obstacle gain
   back toward 10; /ʃ/'s peak between 2.5 and 4 kHz; Jongman spectral mean error no worse. Files:
   `vocal-planner.ts`, the phoneme tables and their generator, `src/dsp/glottal.ts`,
   `junction-airway.ts` (gains). Cost 12 to 16 h. Risk medium: the noise gains were fitted around
   the present pressures and must be refitted once.
6. **Formants and gradients in one pass, and /ɑ/ let go** (ideas G and F, direction 4). Mechanism:
   the roughness rule and the norms gate read the mean over a pitch sweep; the Newton tracker and
   prefix-suffix sensitivities; Gauss-Newton in the solver with the tip free. Outcome and gate: /ɑ/
   re-solved under the sweep gate with F1 inside 6 percent in each body; gradients equal finite
   differences to 1e-6; /ɝ/'s F3 within 5 percent of Hillenbrand; tracker cost under 3 percent of
   the airway's. Files: `test/engines-physical/voice-norms.test.ts`,
   `scripts/gen-calibrated-vowels.mjs`, `src/engines/vowel-solver.ts`, a new
   `src/dsp/tube-modes.ts`. Cost 3 h for the sweep gate and /ɑ/, 12 to 16 h for the rest. Risk low
   for the first, medium for the rest.
7. **The constriction servo** (idea H, direction 5). Outcome and gate: the articulation gate's
   worst margin across vowel contexts rises; locus slopes ordered labial, velar, alveolar and
   within 0.15 of the published values; the lateral and contact cases section 9 mentions pass.
   Files: `vocal-planner.ts`, `vocal-geometry.ts` (expose the gap). Cost 10 to 14 h. Risk medium to
   high: it changes every consonant's target.
8. **Prosody** (idea I, direction 6). Outcome and gate: no pitch movement faster than the limit;
   a question's rise and a statement's fall as single targets with no melisma copy; accent peaks
   placed by rule and checked on a small set of read sentences. Files: `src/lyrics/speech.ts`,
   `accents.ts`, `src/dsp/cascade.ts`, `pitchglide.ts`, `src/sing.ts`. Cost 10 to 14 h. Risk medium.
9. **The physics view, and correcting a word** (ideas M, K and N). Outcome: the workbench shows
   pressure, flow, sources, modes and the cue inspector; a word can be underlined as guessed,
   overridden in place and kept in a user lexicon; `clarity` exists and the machine test shows its
   effect. Gate: telemetry adds no allocation and under 1 percent cost; the inspector's numbers
   equal the test helpers'. Files: `src/engines/vocal.ts` (snapshot), `src/view`, `src/singer.ts`,
   and in bellowsjs `apps/workbench/src/components/code`. Cost 20 to 28 h. Risk low.
10. **The beatbox** (ideas E and J, directions 7 and 9). Mechanism: static and pocket pressure
    probes, true seals, braced walls in ejectives and pockets, Pf as an ejective affricate beside
    the pulmonic one, the valve element for the lip roll and the trills. Outcome and gate: click
    suction measured and gated once a source is found; kick pressure up without the tongue trick;
    the lip roll oscillating at 20 to 40 Hz from its own mechanics; the lip pop within 6 dB of the
    snare. Files: `junction-airway.ts`, `vocal-planner.ts`, `vocal-beats.ts`,
    `test/engines-physical/beatbox.test.ts`. Cost 16 to 22 h. Risk medium to high (a new oscillator
    on the grid).
11. **The microphone** (correction 10, idea P, direction 8). Mechanism: the corner corrected in text
    and comment, the flow term on the lips' flow alone, pattern and distance as parameters, the jet
    term. Gate: the pattern's corner measured at c / (4 pi r) for a cardioid and c / (2 pi r) for a
    figure-eight; `mic` 0 still bit for bit. Files: `junction-airway.ts`, `vocal.ts`. Cost 4 to 6 h.
    Risk low.
12. **Cost gates, and the folds' onset** (idea O). Mechanism: per-layer timing tests, the silent
    skip, the denormal check; for the self-oscillating folds, feed the measured subglottal
    pressure forward into the tension, since section 8's sharp onsets come from pressure
    overshoot. Gate: budgets hold in CI; a ten second rest costs no more than silence should;
    onsets within 50 cents in the child body. Files: `junction-airway.ts`, `vocal.ts`,
    `src/dsp/pitch-servo.ts`, tests. Cost 6 to 8 h. Risk low.

## 11. The anatomy round (2026-11-17, later)

What a mouth has that the voice lacked, added one piece at a time, each measured before a gate was
set (`test/engines-physical/anatomy.test.ts`).

### 11.1 Side branches as lumped shunts

A closed side tube of depth L and area A presents, at the junction it opens into, the input impedance
Z(w) = -j Z0 cot(wL/c), Z0 = rho c / A. Its first zero is the quarter-wave resonance w0 = pi c / 2L,
where the branch shorts the main tube and the spectrum has a zero. Near w0, cot(x) = -(x - pi/2) +
O((x - pi/2)^3), so

```
Z(w) ~ j Z0 (w - w0) L / c
```

and a series mass and spring, Z = j(wM - K/w) ~ j 2M (w - w0), matches it in value and slope when
M = Z0 L / (2c) = rho L / (2A) and K = w0^2 M. A Helmholtz resonator is the same element exactly:
M = rho L_neck / A_neck, K = rho c^2 / V. So both cavities become one shunt branch at one junction,
solved as the walls are, with lumped values instead of per-area ones.

**The discretization matters (MEASURED).** The walls use an implicit mass and an explicit spring
(symplectic Euler). For a 40 Hz wall that is harmless; for a 4.2 kHz branch at 22.05 kHz it made the
coupled system grow without bound, though each half was stable alone. The fix is the trapezoidal
rule (the bilinear transform), which maps a positive-real impedance to a passive discrete one at any
rate, so no coupling can make it unstable. With D = M/T + R/2 + KT/4:

```
q_n = p_n / (2D) + [ p_{n-1}/2 + (M/T - R/2 - KT/4) q_{n-1} - K y_{n-1} ] / D
y_n = y_{n-1} + T (q_n + q_{n-1}) / 2
```

a conductance 1/(2D) folded into the junction's Thevenin solve and a history flow. Its frequency
warping is known, so the resonance is pre-warped: w_set = (2/T) tan(w0 T / 2).

**Piriform fossae** (Dang and Honda 1997, JASA 101: MRI volumes 2.1 to 2.9 cm^3, depths 1.6 to 2.0
cm, a spectral minimum at 4 to 5 kHz). The pair as one branch, 2.5 k^3 cm^3 and 1.8 k cm, end-corrected
by 0.61 of each fossa's radius: 4.2 kHz in the male body, at the first even junction above the back
duct. MEASURED: 3 to 7 dB out of 2.5 to 5.75 kHz on /ɑ/, deepest bands at 4.5 and 5.5 kHz.

**They also lower F1, and that is physics.** Below its resonance the branch is a compliance, an added
volume dV at the glottis end, where F1's pressure peaks. First-order perturbation of a resonator
(the energy form behind Fant's sensitivity functions) gives dF/F = -(1/2) dV p^2(x0) / integral of
p^2 A dx: an added volume at a pressure maximum lowers the frequency by about dV / V of the cavity it
joins, here 2.5 / 60, about 4 percent. MEASURED: General American's vowels went from 4.6 to 7.4
percent RMS off Hillenbrand's F1. So the fossae ship as the `piriform` parameter, off by default,
until the vowels are re-solved with the branch in the solver's tube (a shunt admittance 1/Z(w) at
the fossae's junction in `tubeResonances`' transfer matrix, which is exact for the tube and cheap).

**Maxillary sinuses** (Dang and Honda 1996, JASA 100: four Helmholtz resonators model the
sinuses; the maxillary zero lies between 310 and 950 Hz, with large individual differences). The
pair as one resonator of 30 k^3 cm^3 behind a 0.2 k^2 cm^2, 1 k cm ostium: 455 Hz, on the middle
node of the nasal tube. MEASURED on /m/: 2.4 to 7.4 dB out of 400 to 1100 Hz. On by default: it sits
on the nasal path, so oral vowels do not see it.

### 11.2 Breathing in

Speech breathing is a short quick inhalation and a long slow exhalation; an in-breath in a pause is
noise with no pitch, set between short silences, and louder the faster the breath and the wider the
jaw (Trouvain et al. 2020; Werner et al. 2021). `speechPlan` now opens each phrase after the first
with a breath sound (the `in` beat: glottis abducted, lungs below the mouth's pressure, jaw open,
velum part open) and 50 ms of silence, louder inside speech than before it.

**Why the first try was silent (MEASURED).** With the glottis wide (0.9 cm^2) the lungs at -2.9
cmH2O drew 330 cm^3/s, a realistic flow, at 76 dB under the vowel. Stevens' law makes noise grow as
v^3 (about 60 log10 v dB): at a fixed flow U, v = U / A, so the opening, not the flow, sets the
loudness. At 0.18 cm^2 and half the note's lung pressure (about -5.7 cmH2O) the breath reads -33 dB:
quiet, and audible. Both values are INFERRED; the gate holds the level between -45 and -20 dB.

### 11.3 Voicing through a voiced closure

Behind a closure, the folds keep vibrating only while the pressure across them stays above
threshold. The oral pressure rises as

```
dP/dt = (U_glottis - dV_active/dt) / (C_air + C_walls),   C_air = V / (rho c^2)
```

so a voice bar lasts longer if the cavity grows (dV_active, Westbury 1983: speakers lower the larynx
and advance the tongue root during /b d g/) or its walls give (C_walls). Both are in now: voiced stops
carry a cavity-enlargement gesture (larynx down 0.45, root forward 0.35, INFERRED amounts), and a
`cheeks` setting blends the oral walls from the tract's (m 1.5, r 2000, k 1e5) toward Ishizaka et
al.'s relaxed cheek (m 1.5, r 800, k 66 667, as later models reproduce it). MEASURED, late in the
closure, low band against the vowel: /b/ -24 dB, /p/ -62 dB; slack cheeks raise /b/'s by 4 dB.

### 11.4 Voice settings and anatomy

Laver's articulatory settings (1980) as offsets on the planner's targets, one shared table
(`engines/vocal-settings.ts`) for the engine, the mouth view and the helpers. A setting gives way where
a consonant closes:

```
target_a = planner_a + o_a (1 - h_a),   h_a = max over consonant gestures on a of their ramp
```

h_a is the planner's own ramp, so the hand-over is as smooth as the gesture. MEASURED effects at 1
(LPC at 100 Hz): lips rounded on /ɛ/, F1 -9, F2 -4 percent; larynx raised on /ə/, mean of F1 to F3
+4 percent, lowered -5; tongue forward, F2 +14, back -11; jaw open, F1 +9 (once the jaw carries the
tongue and lower lip with it: opened alone, with the tongue body fixed in the head, F1 did not move);
tongue high, F1 -6; throat length 1.2, F1 -4, F3 -13; nasal, F1 466 to 558 Hz. Twang moves the 2 to
4 kHz band only 1.2 dB: the epilarynx narrowing this geometry allows is mild, so the setting is
described as slight.

**Size.** A tube scaled by s has every resonance at 1/s; with walls, F1^2 = F1_tube^2 / s^2 + F_w^2
and the wall term does not scale, so F1 moves a little less. MEASURED at s 1.2: F1 0.824, F2 0.776,
F3 0.819 of the s = 1 values (1/s = 0.833); at 0.85, 1.171, 1.179, 1.171 (1/s = 1.176). The first
try put F2 at 0.756: the airway's grid had room for the male tract only, so a bigger head pushed its
extra length into the uniform back duct and bent the area function. The grid now has room for s 1.25.

**Handles.** Dragging the tongue, tip, jaw, lips, velum or larynx sets the settings that put the
handle under the pointer: a coordinate-wise golden-section search on |handle(settings) - pointer|
through the geometry, about a hundred evaluations a move. So the mouth a person drags is one the
engine plays, with consonants still protected.

### 11.5 The view

The mouth view is now CHIMERA's anatomy: the geometry's drawing parts (`geometryDrawing()`: the
whole tongue, both lips with their outer faces, upper and lower incisors, the jaw bone, the soft
palate, the epiglottis), and `headProfile()` around them (skin, skull, eye, spine, nasal cavity and
turbinates, hyoid, thyroid, trachea, folds), ported from CHIMERA's `profile.ts`. On top: the air
moving at v = U/A, the narrowest place, labels, the handles, and the shape's predicted resonances with
the hVd word they sound like (`nearestVowel`, Bark distance to Hillenbrand's means).

**Where it lives.** One concept a file: the branch physics in `dsp/side-branch.ts`, the settings
table in `engines/vocal-settings.ts`, the beat recipes in `engines/vocal-beat-scores.ts` (written
against a small `BeatWriter` the planner implements, so recipes and machinery are apart), the
glottal control keys with the articulators', and in the view the drawing parts (`view/drawing.ts`),
the head (`view/head.ts`) and the handles (`view/handles.ts`) beside `TractModel`. The site's lab is
split the same way: panels for Shape and Beatbox, the timeline, a mouth composable, and the mouth's
renderer and air apart from its canvas component.

### 11.6 Next, grounded in the same equations

1. **The sublingual cavity.** When the tip rises, the space under it is a side branch off the front
   cavity; Espy-Wilson et al. (2000) model it so for American /r/, and it is what holds /r/'s F3 low
   (Zhang et al. 2005). The geometry already draws its walls (the tongue's underside and the floor of
   the mouth), so its volume is an integral per frame, V = w * area between `under` and `floor`,
   and the trapezoidal shunt takes coefficients that change per block. Gate: /ɝ/'s F3 toward
   Hillenbrand's 1379 to 1719 Hz, the one formant `HANDOFF.md` lists as unsolved, and /ʃ/'s peak.
2. **Re-solve the vowels with the fossae** (11.1), then turn `piriform` on by default.
3. **Twang as the epilarynx resonator.** Sundberg's singer's formant comes from an epilarynx tube
   whose area is under about a sixth of the pharynx's, acting as its own resonator near 3 kHz. Widen
   the epilarynx's range and gate a 2 to 4 kHz gain of at least 6 dB.
4. **Two nostrils.** The nasal cavity as two parallel tubes of unequal area (the nasal cycle) puts a
   pair of nearby zeros in nasal spectra; Dang and Honda also stress left-right asymmetry. Low cost
   in the AirwayTube.
5. **Analytic handle Jacobians.** The geometry is smooth; differentiating it once would replace the
   search with Newton steps, and the same Jacobian chained with the tube's sensitivity functions
   gives d(formants)/d(settings) for a "make it sound more like X" control.
