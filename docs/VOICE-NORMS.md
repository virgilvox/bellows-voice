# The voice against human norms (2026-11-15)

What a voice sounds like as a person, apart from the words and the accent, comes mostly from three
things: the length of the vocal tract (which sets the formants), where the folds sit in pitch, and
how steady and clean the source is. This document sets each one against published human data,
measures the voice against it, and records what changed. `test/engines-physical/voice-norms.test.ts`
gates the results.

## Sources

- **Speaking pitch.** Mean conversational F0 in Australian English: men 115 Hz (SD 21), women 199 Hz
  (SD 28), Leung et al. 2022, as given in the [Sydney Voice Lab normative reference sheet](https://www.sydney.edu.au/content/dam/corporate/documents/faculty-of-medicine-and-health/research/research-centres/sydney-voice-lab/acoustic-analysis-normative-data-reference-sheet-20250416_v4.0-sydney-voice-lab.pdf.coredownload.pdf).
  Typical speaking ranges (Baken 1987, relayed in an [auditory list post](https://auditory.org/mhonarc/2000/msg00400.html)):
  men 85 to 155 Hz, women 165 to 255 Hz, a child of ten 208 to 259 Hz. A study of 300 Jordanian
  Arabic speakers found the same order (men 137, women 231, children 278 Hz), higher overall
  ([record](https://bvbvf1.bib-bvb.de/vufind/PrimoRecord/cdi_proquest_miscellaneous_85715961)).
- **Formants.** Hillenbrand, Getty, Clark and Wheeler (1995), *JASA* 97, 3099 to 3111: 45 men, 48 women
  and 46 children, h-V-d words, steady-state F1 and F2 (the [phonTools h95 data](https://search.r-project.org/CRAN/refmans/phonTools/html/h95.html)).
- **Perturbation.** MDVP normal means: local jitter about 0.63 percent, local shimmer about 2.0
  percent ([PMC9445921, table 2](https://pmc.ncbi.nlm.nih.gov/articles/PMC9445921/table/tbl2)); the
  MDVP screening thresholds are 1.04 and 3.81 percent. Different programs read different values, MDVP
  higher than Praat ([ASHA Perspectives 2019](https://pubs.asha.org/doi/10.1044/2019_PERS-SIG19-2018-0006)),
  so these are a band, not a target. Shimmer rises with age ([JCAA](https://jcaa.caa-aca.ca/index.php/jcaa/article/download/2198/1945);
  a 360-speaker norming study, [CAJMS](https://mongoliajol.info/index.php/CAJMS/article/view/2969/3093)).
- **Vibrato.** Typical classical vibrato: 4 to 7 Hz, extent about a semitone either side
  ([PMC9510150](https://pmc.ncbi.nlm.nih.gov/articles/PMC9510150)). Pop singers use little
  ([a study of female opera and pop singers](https://digilib.phil.muni.cz/sites/default/files/pdf/144819.pdf)).
- **Breathiness.** Women's voices are on average breathier than men's: a longer open phase and more
  aspiration noise (Klatt and Klatt 1990; Hanson 1997).

## Measured: the source (MEASURED)

A held /ɑ/, vibrato and drift off, 3 s, cycles found at upward zero crossings of the low-passed
fundamental, local jitter and shimmer as MDVP defines them, HNR from the autocorrelation at one period.
Each body at its norm speaking pitch.

| Body, F0 | Folds | roughness 0.1 (old default) | roughness 0.02 (new default) | roughness 0 |
|---|---|---|---|---|
| male, 115 Hz | pulse | jitter 1.34%, shimmer 4.83%, HNR 18.5 dB | 0.78%, 3.00%, 21.5 dB | 0.64%, 2.74%, 22.3 dB |
| female, 199 Hz | pulse | 1.21%, 4.56%, 21.8 dB | 0.71%, 2.83%, 25.8 dB | 0.58%, 2.42%, 27.0 dB |
| child, 240 Hz | pulse | 1.21%, 3.81%, 22.8 dB | 0.71%, 2.18%, 27.3 dB | 0.58%, 1.83%, 28.8 dB |
| male, 115 Hz | geometric | 1.00%, 10.06% | 0.88%, 6.75% | 0.87%, 5.79% |
| male, 115 Hz | self-oscillating | 0.36%, 2.80% | 0.20%, 2.73% | 0.17%, 2.66% |

The old default, CHIMERA's roughness 0.1, put every body past both screening limits on the default
folds, and that is what made the default voice read as old. **The default is now 0.02**, which lands
every body near the healthy means. The geometric folds carry more shimmer than any human norm at any
roughness: a property of that model, worth knowing before choosing it. The self-oscillating folds are
steadier than a human voice in jitter.

## Measured: the tract (MEASURED)

The ten General American monophthongs sustained at 100 Hz (LPC reads the tract there; at 200 Hz and
above it locks onto harmonics, which first gave a female /i/ an "F2" of 866 Hz), median F1 and F2 over
the steady part, against Hillenbrand's means for the matching group.

| Body | F1 RMS error | F1 mean error | F2 RMS error | F2 mean error |
|---|---|---|---|---|
| male, against men | 5.3% | -3.6% | 4.6% | +1.3% |
| female, against women | 5.8% | -5.0% | 5.8% | +1.5% |
| child, against children | 4.4% | -2.6% | 4.9% | +0.3% |

The three bodies' tract lengths are right: formants scale between them as the human groups do. F1 ran
a few percent low on every body, most on the female (-5 percent), and the largest single misses were
/ɑ/ and /ɔ/ (F1 7 to 10 percent low, F2 6 to 14 percent high), the open back vowels.

### Calibrated (MEASURED)

`scripts/gen-calibrated-vowels.mjs` re-solves /ɑ ɔ æ ʌ ɛ/ per body against the matching group's means
with the vowel solver and closes the loop through the engine at 100 Hz. A new row is kept only where it
measures closer than CHIMERA's **and** its local shimmer at the body's speaking pitch rises by no more
than half a point. That second rule matters: the first run, on formants alone, gave a male /ɑ/ within
3.9 percent that read 5.9 percent shimmer (CHIMERA's: 3.35) and put a /t/ closure's noise over its own
test. Every fit that lifted F1 by opening the jaw further made the voice rougher, so the open /ɑ/
stays CHIMERA's on all three bodies, and so does /æ/ on the female and child.

| Vowel | male | female | child |
|---|---|---|---|
| ɑ | kept CHIMERA's (7.4%; fits 3.9 to 4.8% read 4.7 to 5.6% shimmer against 3.35) | kept (8.5%; fits read 3.3 to 3.8% against 2.70) | kept (5.4%; fits read 2.7 to 2.9% against 2.20) |
| ɔ | 7.0% to 0.8%, shimmer 4.42 to 3.43% | 11.6% to 0.8%, 3.34 to 2.18% | 7.5% to 2.3%, 3.03 to 2.43% |
| æ | 6.2% to 1.6%, 3.56 to 2.30% | kept (4.4%; fits read 4.3 to 5.4% against 2.90) | kept (2.1%) |
| ʌ | 4.8% to 0.8%, 4.13 to 4.43% | 5.1% to 0.7%, 2.79 to 2.51% | 1.7% to 1.0%, 1.82 to 1.87% |
| ɛ | 1.6% to 1.1%, 2.84 to 3.11% | 4.4% to 1.9%, 4.20 to 2.66% | 2.2% to 0.3%, 1.35 to 1.68% |

(Each entry: the RMS of the F1 and F2 errors before and after, and local shimmer before and after.)

All ten vowels afterwards, against Hillenbrand:

| Body | F1 RMS error | F2 RMS error |
|---|---|---|
| male | 5.3% to 4.6% | 4.6% to 2.3% |
| female | 5.8% to 4.6% | 5.8% to 3.2% |
| child | 4.4% to 4.4% | 4.9% to 3.6% |

The norms test gates 6 percent. Still open: /ɑ/ on every body, whose F1 sits 1 to 10 percent low
because the shapes that raise it read rough (the cause is worth finding: the geometry or the airway at a
wide jaw), and /ɝ/, whose F3 the solver does not move.

## What changed (bellows-voice 0.3.0)

- **/ɔ æ ʌ ɛ/ re-solved per body** against Hillenbrand where it helped without roughening the voice, the tables above.
- **roughness defaults to 0.02**, from the table above. Every render that relied on the default
  changes; a voice that wants the old texture sets `roughness: 0.1`.
- **speak() defaults to the body's norm**: 115 Hz for the male body, 199 Hz for the female, 240 Hz for
  the child (inside Baken's 208 to 259), interpolated between, where it was 110 Hz for every voice.
- **Starter voices** (`VOICE_PRESETS`, `singer(b, 'soprano')`): narrators at the conversational means,
  the six classical voice types with their ranges and classical vibrato (5.2 to 5.8 Hz, 0.45 to 0.55
  semitones), pop voices with little vibrato and more breath, a child, a rough rock voice, and an
  elder with the raised shimmer and pitch wander the age studies report. The test checks every
  preset's speaking pitch against Baken's range for its group.
