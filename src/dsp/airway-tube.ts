/*
 * A tube of fixed shape in the junction airway (dsp/junction-airway.ts): the
 * trachea, or the nasal cavity behind the velum. Its sections never move,
 * so the runs of sections between a few lumped nodes are pure delays (two
 * ring buffers per segment), and the walls and viscous resistance of the
 * junctions a node stands for are summed onto it. Its node coefficients are
 * computed once per configure(), never per sample.
 *
 * Every section is c / (2 rate) long, half a sample each way, so a segment
 * of m sections (m even) delays m / 2 samples. A node is a junction of the
 * airway's kind: a series flow element (viscous resistance and a
 * Borda-Carnot kinetic loss across its area step) with a yielding wall
 * (mass, resistance and stiffness per unit area) solved implicitly as a
 * Thevenin conductance.
 *
 * The element values are CHIMERA's (Jameson Hodge, MIT,
 * https://github.com/jamesondh/chimera-vocal-synth at 1d3ea49):
 * airway/network.rs:860-930 (viscous resistance at 700 Hz, Borda-Carnot
 * expansion with a 0.1 contraction loss), :960-1010 (walls). The lumping is
 * this airway's, MEASURED in its prototype: 4 trachea and 6 nasal nodes
 * against one junction per section came within 40 to 47 dB SNR, with band
 * levels within 0.1 dB. See THIRD_PARTY_NOTICES.md.
 */

import { AIR_DENSITY, AIR_DYNAMIC_VISCOSITY, SOUND_SPEED, type WallTissue } from './air';

const RHO_C = AIR_DENSITY * SOUND_SPEED;
/** CHIMERA's viscous resistance at 700 Hz (network.rs:866). */
const VISC = Math.sqrt((AIR_DENSITY * AIR_DYNAMIC_VISCOSITY * 2 * Math.PI * 700) / 2);
/** Ring length per segment and direction; segments are far shorter than this at any supported rate. */
export const TUBE_RING = 256;
const MASK = TUBE_RING - 1;

export class AirwayTube {
  /** Node count including both ends. */
  nn = 0;
  /** Segment delays in samples (segment s joins node s and s + 1). */
  readonly D: Int32Array;
  /** Forward (toward node s + 1) and backward rings, TUBE_RING per segment. */
  readonly F: Float64Array;
  readonly B: Float64Array;
  /** Segment impedances and areas. */
  readonly Z: Float64Array;
  readonly area: Float64Array;
  /* Interior node coefficients. */
  private readonly rv: Float64Array;
  private readonly wS: Float64Array;
  private readonly gam: Float64Array;
  private readonly ibq: Float64Array;
  private readonly wV: Float64Array;
  private readonly wY: Float64Array;
  /** Flow through each node, cm^3/s. */
  readonly U: Float64Array;
  private wCm = 0;
  private wK = 0;
  private wIb = 0;
  private T = 0;
  /*
   * Side resonators on interior nodes (a paranasal sinus): a lumped acoustic mass M, resistance R and
   * stiffness K = 1 / C in series, the same equation as a wall with lumped values. Per node: its
   * conductance (0 for none), history coefficient and stiffness, and its flow and displacement.
   */
  private readonly sG: Float64Array;
  private readonly sCm: Float64Array;
  private readonly sK: Float64Array;
  private readonly sQ: Float64Array;
  private readonly sY: Float64Array;
  private readonly sP: Float64Array;

  /** maxNodes: the most nodes any configure() will ask for. */
  constructor(maxNodes: number) {
    const ns = maxNodes - 1;
    this.D = new Int32Array(ns);
    this.F = new Float64Array(ns * TUBE_RING);
    this.B = new Float64Array(ns * TUBE_RING);
    this.Z = new Float64Array(ns);
    this.area = new Float64Array(ns);
    this.rv = new Float64Array(maxNodes);
    this.wS = new Float64Array(maxNodes);
    this.gam = new Float64Array(maxNodes).fill(1);
    this.ibq = new Float64Array(maxNodes);
    this.wV = new Float64Array(maxNodes);
    this.wY = new Float64Array(maxNodes);
    this.U = new Float64Array(maxNodes);
    this.sG = new Float64Array(maxNodes);
    this.sCm = new Float64Array(maxNodes);
    this.sK = new Float64Array(maxNodes);
    this.sQ = new Float64Array(maxNodes);
    this.sY = new Float64Array(maxNodes);
    this.sP = new Float64Array(maxNodes);
  }

  /**
   * Hang a resonator on interior node m, discretized by the trapezoidal rule (junction-airway.ts,
   * branchCoefficients): 1 / D, the history coefficient M / T - R / 2 - K T / 4, and the stiffness K.
   * Call after configure(); configure() removes every resonator. Off the audio path.
   */
  addResonator(m: number, invD: number, cm: number, K: number): void {
    if (!(m >= 1 && m < this.nn - 1) || !(invD > 0)) return;
    this.sG[m] = 0.5 * invD;
    this.sCm[m] = cm * invD;
    this.sK[m] = K * invD;
    this.refresh(m);
  }

  /** A node's coefficients from its wall and resonator. */
  private refresh(m: number): void {
    const z1 = this.Z[m - 1];
    const g = 1 / (1 + z1 * (this.wS[m] * this.wIb + this.sG[m]));
    this.gam[m] = g;
    this.ibq[m] = 1 / (z1 * g + this.Z[m] + this.rv[m]);
  }

  /**
   * Lay the tube out: sections[0 .. count) of area secAreas (cm^2), nodes at
   * the even section indices nodesAt[0 .. nn) (0 and count included), walls
   * of `wall` over a perimeter `perim` times a circle's, viscous resistance
   * times viscF, sections dx cm long at `rate`. Clears every wave and wall.
   */
  configure(secAreas: Float64Array, count: number, nodesAt: Int32Array, nn: number, wall: WallTissue, perim: number, viscF: number, dx: number, rate: number): void {
    this.nn = nn;
    this.T = 1 / rate;
    const ns = nn - 1;
    for (let s = 0; s < ns; s++) {
      const a0 = nodesAt[s];
      const a1 = nodesAt[s + 1];
      this.D[s] = (a1 - a0) >> 1;
      let inv = 0;
      for (let i = a0; i < a1; i++) inv += 1 / secAreas[i];
      this.area[s] = (a1 - a0) / inv;
      this.Z[s] = RHO_C / this.area[s];
    }
    const beta = wall.m * rate + 0.5 * wall.r;
    this.wCm = wall.m * rate - 0.5 * wall.r;
    this.wK = wall.k;
    this.wIb = 1 / beta;
    this.rv.fill(0);
    this.wS.fill(0);
    // each section junction i (between sections i - 1 and i) goes to the nearest interior node
    const hr = perim * 2 * Math.sqrt(Math.PI) * dx * viscF;
    for (let i = 1; i < count; i++) {
      let best = -1;
      let bd = Infinity;
      for (let m = 1; m < nn - 1; m++) {
        const d = nodesAt[m] > i ? nodesAt[m] - i : i - nodesAt[m];
        if (d < bd) {
          bd = d;
          best = m;
        }
      }
      if (best < 0) continue;
      const al = secAreas[i - 1];
      const ar = secAreas[i];
      this.rv[best] += 0.25 * VISC * hr * (Math.pow(al, -1.5) + Math.pow(ar, -1.5));
      this.wS[best] += perim * 2 * Math.sqrt(Math.PI * 0.5 * (al + ar)) * dx;
    }
    this.sG.fill(0);
    this.sCm.fill(0);
    this.sK.fill(0);
    for (let m = 1; m < nn - 1; m++) this.refresh(m);
    this.reset();
  }

  /** Every wave, flow and wall at rest. */
  reset(): void {
    this.F.fill(0);
    this.B.fill(0);
    this.wV.fill(0);
    this.wY.fill(0);
    this.U.fill(0);
    this.sQ.fill(0);
    this.sY.fill(0);
    this.sP.fill(0);
  }

  /**
   * The interior nodes for ring position pos. The end nodes belong to the
   * airway (lungs and glottis, velum and nostrils).
   */
  interior(pos: number): void {
    const F = this.F;
    const B = this.B;
    const D = this.D;
    const Z = this.Z;
    const wCm = this.wCm;
    const wK = this.wK;
    const wIb = this.wIb;
    const T = this.T;
    const nn = this.nn;
    for (let m = 1; m < nn - 1; m++) {
      const segL = (m - 1) * TUBE_RING;
      const segR = m * TUBE_RING;
      const a = F[segL + ((pos - D[m - 1]) & MASK)];
      const b = B[segR + ((pos - D[m]) & MASK)];
      const z1 = Z[m - 1];
      const wv = this.wV[m];
      const wy = this.wY[m];
      const hist = wCm * wv - wK * wy;
      const sg = this.sG[m];
      // the history flow: (p_prev / 2 + cm q_prev - K y_prev) / D, the coefficients held already over D
      const sh = sg > 0 ? sg * this.sP[m] + this.sCm[m] * this.sQ[m] - this.sK[m] * this.sY[m] : 0;
      const ue0 = -this.wS[m] * hist * wIb - sh;
      const gam = this.gam[m];
      const u = (2 * a * gam - 2 * b + z1 * gam * ue0) * this.ibq[m];
      const p = (2 * a - z1 * (u - ue0)) * gam;
      const v = (hist + p) * wIb;
      this.wV[m] = v;
      this.wY[m] = wy + T * v;
      if (sg > 0) {
        const q = sg * p + sh;
        this.sY[m] += 0.5 * T * (q + this.sQ[m]);
        this.sQ[m] = q;
        this.sP[m] = p;
      }
      B[segL + pos] = p - a;
      F[segR + pos] = b + Z[m] * u;
      this.U[m] = u;
    }
  }
}

/** Even node positions 0 .. n with up to `inner` interior nodes, into out; returns the node count. */
export function evenNodes(n: number, inner: number, out: Int32Array): number {
  let c = 0;
  out[c++] = 0;
  for (let m = 1; m <= inner; m++) {
    const v = 2 * Math.round((m * n) / (inner + 1) / 2);
    if (v > out[c - 1] && v < n) out[c++] = v;
  }
  out[c++] = n;
  return c;
}
