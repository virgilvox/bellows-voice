/*
 * The vocal tract as a picture: what the voice's mouth is doing, for a UI to draw. It runs the same
 * geometry the engine runs (ChimeraGeometry) on the same per-phoneme articulator targets
 * (vocal-tables.gen.ts), with the velum lowered for a nasal as the planner lowers it, moving each
 * articulator toward its target critically damped at the engine's own speeds (VOCAL_ARTICULATOR_HZ), so a consonant's targets overlay the vowel's posture
 * the way the engine's do: what a consonant does not set stays where the vowel put it.
 *
 * It does not listen to the audio thread; it follows the plan. Given the spans a sung or spoken
 * line returns, call target() with the phoneme at each moment and step() with the time passed.
 * Main-thread code: it allocates on construction and in shape(), never per sample.
 */

import { ChimeraGeometry, GEOMETRY_BODIES, geometryDrawing, type GeometryDrawing } from '../engines/vocal-geometry';
import { settingOffsets, type SettingValues } from '../engines/vocal-settings';
import { predictFormants } from '../engines/vowel-solver';
import {
  VOCAL_ARTICULATOR_HZ,
  VOCAL_ARTICULATOR_MAX,
  VOCAL_ARTICULATOR_MIN,
  VOCAL_ARTICULATOR_NAMES,
  VOCAL_BODIES,
  VOCAL_NEUTRAL,
  VOCAL_TABLE_PHONEMES,
} from '../engines/vocal-tables.gen';
import { BEAT_PREFIX } from '../engines/vocal-beats';
import { VOCAL_ACOUSTICS, vocalPhonemeIndex } from '../engines/vocal-phonemes';
import { ART } from '../engines/vocal-articulators';

/* The velum's target for a nasal: the gesture the planner keys (vocal-planner.ts, M_NASAL). */
const NASAL_VELUM = 0.45;

/*
 * A beat drawn as the planner makes it (vocal-planner.ts, beatScore): the consonant it is built on,
 * held, with the articulators the beat moves past it. An ejective shows its larynx rising, a click
 * its hollowed dorsum, the hum its lowered velum. '.' is the beatboxer's ready posture.
 */
const BEAT_VIEW: Readonly<Record<string, { base: string; set?: Partial<Record<keyof typeof ART, number>> }>> = {
  '.': { base: 'ə', set: { jaw: 0.4, lipAp: 0.25, lipProt: 0.1 } },
  B: { base: 'p', set: { jaw: 0.3, tbY: 7.7, larynx: 1.55 } },
  t: { base: 't', set: { jaw: 0.3 } },
  tss: { base: 's' },
  Pf: { base: 'f' },
  K: { base: 'k', set: { jaw: 0.35, larynx: 1.55 } },
  '^K': { base: 'k', set: { jaw: 0.35, tbY: 7.4 } },
  '!': { base: 't', set: { dorsum: 1 } },
  'P!': { base: 'p', set: { jaw: 1.6, dorsum: 1 } },
  kch: { base: 'ʃ' },
  m: { base: 'm' },
  ch: { base: 'ʃ', set: { jaw: 0.3 } },
  Psh: { base: 'ʃ' },
};

/** The articulators, in the order postures use. */
export const ARTICULATOR_NAMES = VOCAL_ARTICULATOR_NAMES;

/** A drawable midsagittal view of the tract, centimetres, glottis to lips. */
export interface TractShape {
  /** The lower wall (the tongue, the floor of the mouth, the lower lip), as x, y pairs. */
  lower: Float32Array;
  /** The upper wall (the back of the pharynx, the palate, the upper lip), as x, y pairs. */
  upper: Float32Array;
  /** Cross-sectional area at each point, cm^2. */
  area: Float32Array;
  /** Opening into the nose, cm^2 (0 for an oral sound, larger for m, n, ŋ). */
  velumPort: number;
  /** Area between the lips, cm^2. */
  lipArea: number;
  /** The tongue tip. */
  tipX: number;
  tipY: number;
  /** Each point's region: 1 the pharynx, 2 the mouth, 3 the lips. */
  region: Uint8Array;
  /** Index of the first mouth point, where the pharynx turns into the mouth below the velum (-1 if none). */
  split: number;
  /** Index of the narrowest point past the glottis, where the air is fastest (a closure if its area is near 0). */
  constriction: number;
  /** The anatomy around the air: tongue, lips, teeth, jaw, soft palate, epiglottis (vocal-geometry.ts, drawing()). */
  drawing: GeometryDrawing;
}

/** The parts of the mouth a person can grab and move. */
export type MouthHandle = 'tongue' | 'tip' | 'jaw' | 'lips' | 'velum' | 'larynx';

/** Settings and anatomy for the model: SettingValues plus size and pharynx (engines/vocal-settings.ts). */
export interface MouthSettings extends SettingValues {
  size?: number;
  pharynx?: number;
}

/**
 * The articulator targets of one phoneme for a body (0 male, 1 female, 2 child), 17 values, NaN
 * where the phoneme sets none. Undefined for a symbol the voice does not have.
 */
export function phonemeTargets(body: number, ipa: string): Float64Array | undefined {
  const idx = vocalPhonemeIndex(ipa);
  if (idx < 0) return undefined;
  const b = VOCAL_BODIES[Math.max(0, Math.min(VOCAL_BODIES.length - 1, Math.round(body)))];
  if (VOCAL_TABLE_PHONEMES[idx] === undefined) return undefined;
  const vowel = b.vowelTargets[idx];
  return Float64Array.from(vowel.some((v) => v === v) ? vowel : b.consonantTargets[idx]);
}

export class TractModel {
  /** The current posture, 17 articulators. */
  readonly posture = Float64Array.from(VOCAL_NEUTRAL);
  private readonly velocity = new Float64Array(VOCAL_NEUTRAL.length);
  private readonly goal = Float64Array.from(VOCAL_NEUTRAL);
  /** The vowel posture a consonant overlays. */
  private readonly vowelGoal = Float64Array.from(VOCAL_NEUTRAL);
  private geometry: ChimeraGeometry;
  private bodyIndex = 0;
  /** The phoneme the model is moving toward. */
  current = '_';

  /** The settings' articulator offsets, laid over every target. */
  private readonly offsets = new Float64Array(VOCAL_NEUTRAL.length);
  private settingValues: MouthSettings = {};
  /** Articulators the current consonant sets itself (its own targets win over a setting). */
  private readonly own = new Uint8Array(VOCAL_NEUTRAL.length);

  constructor(body = 0) {
    this.bodyIndex = clampBody(body);
    this.geometry = new ChimeraGeometry(GEOMETRY_BODIES[this.bodyIndex]);
  }

  /**
   * Voice settings and anatomy, as the engine's params of the same names take them (jawSet,
   * lipRound, larynxSet, nasal, twang, ..., size, pharynx): the mouth then shows what the voice does.
   */
  setSettings(values: MouthSettings): void {
    this.settingValues = { ...values };
    settingOffsets(values, this.offsets);
    this.layBody();
    if (this.current !== '_') this.target(this.current);
    else this.applyOffsets();
  }

  /** The settings last given. */
  get settings(): MouthSettings {
    return { ...this.settingValues };
  }

  private layBody(): void {
    const base = GEOMETRY_BODIES[this.bodyIndex];
    const size = clampNum(this.settingValues.size, 0.8, 1.25, 1);
    const ph = clampNum(this.settingValues.pharynx, 0.8, 1.25, 1);
    this.geometry.setBody(base.scale * size, base.pharynx * ph, base.tongueRadius, base.lipWidth);
  }

  private applyOffsets(): void {
    for (let k = 0; k < this.goal.length; k++) if (!this.own[k]) this.goal[k] += this.offsets[k];
    clampPosture(this.goal);
  }

  /**
   * Hold an exact posture: the given articulators (by name, ARTICULATOR_NAMES) at these values, the
   * rest where they are. `snap` jumps there; otherwise step() moves there at the engine's speeds.
   */
  pose(values: Partial<Record<string, number>>, snap = true): void {
    for (const [name, v] of Object.entries(values)) {
      const k = (VOCAL_ARTICULATOR_NAMES as readonly string[]).indexOf(name);
      if (k < 0 || typeof v !== 'number' || !Number.isFinite(v)) continue;
      this.goal[k] = Math.max(VOCAL_ARTICULATOR_MIN[k], Math.min(VOCAL_ARTICULATOR_MAX[k], v));
      if (snap) {
        this.posture[k] = this.goal[k];
        this.velocity[k] = 0;
      }
    }
    this.current = 'pose';
  }

  /** The current posture by articulator name. */
  postureByName(): Record<string, number> {
    const o: Record<string, number> = {};
    VOCAL_ARTICULATOR_NAMES.forEach((n, k) => (o[n] = this.posture[k]));
    return o;
  }

  /**
   * Move a handle to body point (x, y), cm: the tongue body and tip map straight back to their
   * articulators; the jaw, lips, soft palate and larynx are found by a short search for the value
   * that puts the handle there. Snaps the posture.
   */
  drag(handle: MouthHandle, x: number, y: number): void {
    const g = this.geometry;
    const k = g.k;
    const ph = this.settingValues.pharynx !== undefined ? GEOMETRY_BODIES[this.bodyIndex].pharynx * clampNum(this.settingValues.pharynx, 0.8, 1.25, 1) : GEOMETRY_BODIES[this.bodyIndex].pharynx;
    const invX = (bx: number) => {
      const t = bx / k;
      return t > 0.5 ? 0.5 + (t - 0.5) / 0.86 : t;
    };
    const invY = (by: number) => {
      const t = by / k;
      return t < 7 ? 7 - (7 - t) / ph : t;
    };
    if (handle === 'tongue') return this.pose({ tbX: invX(x), tbY: invY(y) });
    if (handle === 'tip') return this.pose({ ttX: invX(x), ttY: invY(y) });
    const name = handle === 'jaw' ? 'jaw' : handle === 'lips' ? 'lipAp' : handle === 'velum' ? 'velum' : 'larynx';
    const kk = (VOCAL_ARTICULATOR_NAMES as readonly string[]).indexOf(name);
    const lo = VOCAL_ARTICULATOR_MIN[kk];
    const hi = VOCAL_ARTICULATOR_MAX[kk];
    const where = (v: number): number => {
      this.posture[kk] = v;
      const p = handlePoint(this.shapeNow(), handle);
      return Math.hypot(p[0] - x, p[1] - y);
    };
    // golden-section search on the handle's distance to the pointer
    let a = lo;
    let b = hi;
    const r = (Math.sqrt(5) - 1) / 2;
    let c = b - r * (b - a);
    let d = a + r * (b - a);
    let fc = where(c);
    let fd = where(d);
    for (let i = 0; i < 28; i++) {
      if (fc < fd) {
        b = d;
        d = c;
        fd = fc;
        c = b - r * (b - a);
        fc = where(c);
      } else {
        a = c;
        c = d;
        fc = fd;
        d = a + r * (b - a);
        fd = where(d);
      }
    }
    const best = (a + b) / 2;
    if (handle === 'lips') {
      // the lips' protrusion follows the pointer forward and back
      const pr = (VOCAL_ARTICULATOR_NAMES as readonly string[]).indexOf('lipProt');
      const p0 = handlePoint(this.shapeNow(), 'lips');
      this.pose({ lipAp: best, lipProt: this.posture[pr] + (x - p0[0]) / (0.95 + 1e-9) });
      return;
    }
    this.pose({ [name]: best });
  }

  /**
   * The settings that put a handle at body point (x, y), cm, holding sound `ipa`: the handles are the
   * settings (tongue: tongueFront and tongueHigh; jaw: jawSet; lips: lipRound forward and lipOpen up
   * and down; velum: nasal; larynx: larynxSet), so a dragged mouth is one the voice can play. A
   * coordinate-wise golden-section search on the handle's distance to the point. Leaves the model
   * showing the result.
   */
  settingsForHandle(handle: MouthHandle, x: number, y: number, ipa: string): MouthSettings {
    const PARAMS: Record<MouthHandle, string[]> = {
      tongue: ['tongueFront', 'tongueHigh'],
      tip: ['tongueFront', 'tongueHigh'],
      jaw: ['jawSet'],
      lips: ['lipRound', 'lipOpen'],
      velum: ['nasal'],
      larynx: ['larynxSet'],
    };
    const names = PARAMS[handle];
    const cur: MouthSettings = { ...this.settingValues };
    const range = (n: string): [number, number] => (n === 'nasal' ? [0, 1] : [-1, 1]);
    const cost = (): number => {
      this.setSettings(cur);
      this.target(ipa);
      this.settle();
      const p = handlePoint(this.shapeNow(), handle);
      return Math.hypot(p[0] - x, p[1] - y);
    };
    const r = (Math.sqrt(5) - 1) / 2;
    for (let round = 0; round < (names.length > 1 ? 3 : 1); round++) {
      for (const n of names) {
        let [a, b] = range(n);
        const at = (v: number) => {
          (cur as Record<string, number>)[n] = v;
          return cost();
        };
        let c = b - r * (b - a);
        let d = a + r * (b - a);
        let fc = at(c);
        let fd = at(d);
        for (let i = 0; i < 18; i++) {
          if (fc < fd) {
            b = d;
            d = c;
            fd = fc;
            c = b - r * (b - a);
            fc = at(c);
          } else {
            a = c;
            c = d;
            fc = fd;
            d = a + r * (b - a);
            fd = at(d);
          }
        }
        (cur as Record<string, number>)[n] = Math.round(((a + b) / 2) * 100) / 100;
      }
    }
    this.setSettings(cur);
    this.target(ipa);
    this.settle();
    return cur;
  }

  /** The first three resonances of the current shape, Hz (the vowel solver's tube, walls corrected). */
  formants(): [number, number, number] {
    return predictFormants(this.geometry, this.posture);
  }

  /** Where each handle is now, body cm. */
  handles(): Record<MouthHandle, [number, number]> {
    const s = this.shapeNow();
    return {
      tongue: handlePoint(s, 'tongue'),
      tip: handlePoint(s, 'tip'),
      jaw: handlePoint(s, 'jaw'),
      lips: handlePoint(s, 'lips'),
      velum: handlePoint(s, 'velum'),
      larynx: handlePoint(s, 'larynx'),
    };
  }

  private shapeNow(): GeometryDrawing & { tipX: number; tipY: number } {
    const g = this.geometry;
    g.evaluate(this.posture);
    return Object.assign(geometryDrawing(g), { tipX: g.tipX, tipY: g.tipY });
  }

  /** Change body (0 male, 1 female, 2 child, rounded). */
  setBody(body: number): void {
    const b = clampBody(body);
    if (b === this.bodyIndex) return;
    this.bodyIndex = b;
    this.geometry = new ChimeraGeometry(GEOMETRY_BODIES[b]);
    this.layBody();
    if (this.current !== '_') this.target(this.current);
  }

  /**
   * Move toward a phoneme: a vowel sets the whole posture, a consonant its own articulators over the
   * vowel's, silence ('_') the rest position. False for a symbol the voice does not have.
   */
  target(ipa: string): boolean {
    if (ipa.startsWith(BEAT_PREFIX)) return this.targetBeat(ipa);
    if (ipa === '_' || ipa === '') {
      this.goal.set(VOCAL_NEUTRAL);
      this.vowelGoal.set(VOCAL_NEUTRAL);
      this.own.fill(0);
      this.applyOffsets();
      this.current = '_';
      return true;
    }
    const row = phonemeTargets(this.bodyIndex, ipa);
    if (!row) return false;
    const idx = vocalPhonemeIndex(ipa);
    const isVowel = VOCAL_BODIES[this.bodyIndex].vowelTargets[idx].some((v) => v === v);
    for (let k = 0; k < row.length; k++) {
      const v = row[k];
      if (isVowel) {
        this.vowelGoal[k] = v === v ? v : VOCAL_NEUTRAL[k];
        this.goal[k] = this.vowelGoal[k];
        this.own[k] = 0;
      } else {
        this.goal[k] = v === v ? v : this.vowelGoal[k];
        this.own[k] = v === v ? 1 : 0;
      }
    }
    // the velum is not in the target tables: the planner lowers it for a nasal, as here
    this.goal[ART.velum] = VOCAL_ACOUSTICS[idx]?.cls === 'nasal' ? NASAL_VELUM : this.vowelGoal[ART.velum];
    this.applyOffsets();
    this.current = ipa;
    return true;
  }

  /** A beat token ("beat:B", "beat:Pf>"): its base consonant with the articulators it moves past it. */
  private targetBeat(token: string): boolean {
    let id = token.slice(BEAT_PREFIX.length);
    if (id.length > 1 && id.endsWith('>')) id = id.slice(0, -1);
    const view = BEAT_VIEW[id];
    if (!view) return false;
    if (!this.target(view.base)) return false;
    for (const [name, v] of Object.entries(view.set ?? {})) this.goal[ART[name as keyof typeof ART]] = v as number;
    if (id === 'm') this.goal[ART.velum] = 0.9;
    this.current = token;
    return true;
  }

  /** Advance the articulators by dt seconds, critically damped at their own speeds. */
  step(dt: number): void {
    if (!(dt > 0)) return;
    const n = Math.min(200, Math.ceil(dt / 0.002));
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < this.posture.length; k++) {
        const w = 2 * Math.PI * VOCAL_ARTICULATOR_HZ[k];
        const acc = w * w * (this.goal[k] - this.posture[k]) - 2 * w * this.velocity[k];
        this.velocity[k] += acc * h;
        this.posture[k] += this.velocity[k] * h;
        if (this.posture[k] < VOCAL_ARTICULATOR_MIN[k]) this.posture[k] = VOCAL_ARTICULATOR_MIN[k];
        if (this.posture[k] > VOCAL_ARTICULATOR_MAX[k]) this.posture[k] = VOCAL_ARTICULATOR_MAX[k];
      }
    }
  }

  /** Jump straight to the target. */
  settle(): void {
    this.posture.set(this.goal);
    this.velocity.fill(0);
  }

  /** The tract the current posture makes. */
  shape(): TractShape {
    const g = this.geometry;
    g.evaluate(this.posture);
    const n = g.gN;
    const lower = new Float32Array(2 * n);
    const upper = new Float32Array(2 * n);
    const area = new Float32Array(n);
    const region = Uint8Array.from(g.gRegion.subarray(0, n));
    for (let i = 0; i < n; i++) {
      lower[2 * i] = g.gInX[i];
      lower[2 * i + 1] = g.gInY[i];
      upper[2 * i] = g.gOutX[i];
      upper[2 * i + 1] = g.gOutY[i];
      area[i] = g.gArea[i];
    }
    return {
      lower,
      upper,
      area,
      velumPort: g.velumPort,
      lipArea: g.lipArea,
      tipX: g.tipX,
      tipY: g.tipY,
      region,
      split: g.splitIndex,
      constriction: narrowest(area),
      drawing: geometryDrawing(g),
    };
  }
}

function clampNum(v: number | undefined, lo: number, hi: number, dflt: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : dflt;
}

function clampPosture(p: Float64Array): void {
  for (let k = 0; k < p.length; k++) p[k] = Math.max(VOCAL_ARTICULATOR_MIN[k], Math.min(VOCAL_ARTICULATOR_MAX[k], p[k]));
}

/** Where a handle sits on a drawing, body cm. */
function handlePoint(d: GeometryDrawing & { tipX: number; tipY: number }, h: MouthHandle): [number, number] {
  if (h === 'tongue') return [d.tongueCenter[0], d.tongueCenter[1]];
  if (h === 'tip') return [d.tipX, d.tipY];
  if (h === 'jaw') return [d.lowerTeeth[4], d.lowerTeeth[5]];
  if (h === 'velum') return [d.velum[10], d.velum[11]];
  if (h === 'larynx') return [0.5 * (d.inner[0] + d.outer[0]), d.glottisY];
  // the lips: between the front-most points of the two
  const front = (pts: number[]): [number, number] => {
    let bi = 0;
    for (let i = 2; i < pts.length; i += 2) if (pts[i] > pts[bi]) bi = i;
    return [pts[bi], pts[bi + 1]];
  };
  const u = front(d.upperLip);
  const l = front(d.lowerLip);
  return [0.5 * (u[0] + l[0]) + 0.15 * d.k, 0.5 * (u[1] + l[1])];
}

/** The narrowest point past the first few (the glottis end is narrow by anatomy, not by a constriction). */
function narrowest(area: Float32Array): number {
  let best = -1;
  let min = Infinity;
  for (let i = Math.min(4, area.length - 1); i < area.length; i++) {
    if (area[i] < min) {
      min = area[i];
      best = i;
    }
  }
  return best;
}

function clampBody(body: number): number {
  return Math.max(0, Math.min(GEOMETRY_BODIES.length - 1, Math.round(Number.isFinite(body) ? body : 0)));
}
