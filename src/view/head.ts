/*
 * The head around the vocal tract, for a side view: skin (neck, chin, lips, nose, brow, crown), the
 * skull and eye, the cervical vertebrae, the nasal cavity and its turbinates, the hard palate's
 * nasal face, the jaw bone's two edges, the hyoid, the thyroid cartilage, the trachea and its rings,
 * and the vocal folds, in body cm with the glottis at the origin (x forward, y up). Built from one
 * frame's drawing (ChimeraGeometry.drawing()), so the jaw, lips and larynx move with the voice.
 *
 * Ported from CHIMERA by Jameson Hodge (MIT, https://github.com/jamesondh/chimera-vocal-synth,
 * src/ui/render/profile.ts, buildProfile and its helpers). Changes: points are [x, y] pairs, the
 * frame's fields come from bellows' geometry drawing, the larynx height is read back from the
 * glottis, and the brain's outline is left out. See THIRD_PARTY_NOTICES.md. View code: it allocates.
 */

import type { GeometryDrawing } from '../engines/vocal-geometry';

export type Pt = [number, number];

export interface HeadProfile {
  skinLower: Pt[];
  skinUpper: Pt[];
  skull: Pt[];
  eye: Pt[];
  vertebrae: Pt[][];
  nasal: Pt[];
  turbinates: Pt[][];
  palNasal: Pt[];
  jawLower: Pt[];
  jawUpper: Pt[];
  hyoid: Pt[];
  thyroid: Pt[];
  trachea: Pt[][];
  rings: Pt[][];
  folds: Pt[][];
  /** The whole head's extent, body cm, for a view that frames it. */
  view: { x0: number; x1: number; y0: number; y1: number };
}

/** A Catmull-Rom spline through pts, `seg` points a span. */
export function catmullRom(pts: Pt[], seg: number): Pt[] {
  const out: Pt[] = [];
  if (pts.length < 2) return pts.slice();
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    for (let s = 0; s < seg; s++) {
      const t = s / seg;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

function ellipse(c: Pt, rx: number, ry: number, rot = 0, n = 40): Pt[] {
  const cr = Math.cos(-rot);
  const sr = Math.sin(-rot);
  const o: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const an = (i / n) * Math.PI * 2;
    const x = Math.cos(an) * rx;
    const y = Math.sin(an) * ry;
    o.push([c[0] + x * cr - y * sr, c[1] + x * sr + y * cr]);
  }
  return o;
}

function roundRect(p0: Pt, p1: Pt, r: number): Pt[] {
  const x0 = Math.min(p0[0], p1[0]);
  const x1 = Math.max(p0[0], p1[0]);
  const y0 = Math.min(p0[1], p1[1]);
  const y1 = Math.max(p0[1], p1[1]);
  const rr = Math.min(r, (x1 - x0) / 2, (y1 - y0) / 2);
  const o: Pt[] = [];
  const corner = (cx: number, cy: number, a0: number) => {
    for (let i = 0; i <= 6; i++) {
      const an = a0 + (i / 6) * (Math.PI / 2);
      o.push([cx + Math.cos(an) * rr, cy + Math.sin(an) * rr]);
    }
  };
  corner(x1 - rr, y1 - rr, 0);
  corner(x0 + rr, y1 - rr, Math.PI / 2);
  corner(x0 + rr, y0 + rr, Math.PI);
  corner(x1 - rr, y0 + rr, (3 * Math.PI) / 2);
  o.push(o[0]);
  return o;
}

/** x, y pairs to points. */
export function pairs(flat: readonly number[]): Pt[] {
  const o: Pt[] = [];
  for (let i = 0; i + 1 < flat.length; i += 2) o.push([flat[i], flat[i + 1]]);
  return o;
}

/** The head around one frame of the tract. */
export function headProfile(d: GeometryDrawing): HeadProfile {
  const k = d.k;
  const ph = d.pharynxScale;
  // template to body (human.rs:685): the oral region's x compressed, the pharynx's y scaled
  const P = (x: number, y: number): Pt => [(x > 0.5 ? 0.5 + (x - 0.5) * 0.86 : x) * k, (y < 7 ? 7 - (7 - y) * ph : y) * k];
  // the face in true body coordinates (P compresses x, which would flatten the nose)
  const B = (x: number, y: number): Pt => [x * k, (y < 7 ? 7 - (7 - y) * ph : y) * k];
  const [cx, cy] = d.condyle;
  const J = (x: number, y: number): Pt => {
    const [px, py] = P(x, y);
    const dx = px - cx;
    const dy = py - cy;
    return [cx + dx * d.jawCos - dy * d.jawSin, cy + dx * d.jawSin + dy * d.jawCos];
  };
  const lar = d.glottisY - P(0, 0)[1];
  const g: Pt = [0, d.glottisY];
  const wallX = (y: number) => -1.2 - 0.025 * y;
  const upper = pairs(d.upperLip);
  const lower = pairs(d.lowerLip);
  const ulOut = upper.slice(7);
  const llOut = lower.slice(7);
  const neckFront = catmullRom([B(2.3, -4.6), B(2.38, -1.5), B(2.52, 0.4), B(3.0, 1.7), J(5.3, 3.0), J(7.25, 3.35), J(7.95, 4.6), J(7.55, 5.7)], 4);
  const face = catmullRom([ulOut[ulOut.length - 1], B(7.05, 10.6), B(7.75, 10.78), B(8.75, 11.05), B(9.25, 11.65), B(8.95, 12.6), B(8.35, 13.9), B(7.7, 15.0), B(7.95, 16.1), B(7.9, 18.1), B(6.9, 20.5)], 4);
  const cranium = catmullRom([B(6.9, 20.5), B(3.0, 22.9), B(-2.2, 22.7), B(-6.9, 19.6), B(-8.7, 15.4), B(-8.3, 11.9), B(-7.4, 8.9), B(-6.8, 4.8), B(-6.6, 0), B(-6.6, -4.6)], 4);
  const vertebrae: Pt[][] = [];
  for (let i = 0; i < 9; i++) {
    const y0 = -4.4 + i * 1.75;
    if (y0 > 10.5) break;
    const x0 = wallX(y0) - 2.25;
    vertebrae.push(roundRect(P(x0, y0 + 1.4), P(x0 + 1.6, y0), 0.32 * k));
  }
  const palate = pairs(d.palate);
  const jb = pairs(d.jawBone).filter((p) => p[0] > 0.8 * k);
  const hy: Pt = [P(1.6, 0)[0], P(0, 2.9)[1] + 0.6 * lar];
  const rings: Pt[][] = [];
  for (let i = 0; i < 4; i++) {
    const y = g[1] - (0.9 + i * 1.0) * k;
    if (y < -4.4) break;
    rings.push([[g[0] + 0.8 * k, y], [g[0] + 1.05 * k, y - 0.05], [g[0] + 1.05 * k, y - 0.5 * k], [g[0] + 0.82 * k, y - 0.45 * k], [g[0] + 0.8 * k, y]]);
  }
  return {
    skinLower: [...neckFront, ...llOut.slice().reverse()],
    skinUpper: [...ulOut, ...face.slice(1), ...cranium.slice(1)],
    skull: catmullRom([B(7.0, 16.2), B(7.3, 18.5), B(6.0, 20.7), B(3.0, 22.1), B(-2.0, 22.0), B(-6.3, 19.2), B(-7.9, 15.3), B(-7.4, 12.6), B(-4.6, 12.2), B(-2.2, 13.3), B(1.0, 13.7), B(4.1, 14.1), B(6.2, 14.9)], 4),
    eye: ellipse(B(6.5, 15.4), 1.1 * k, 0.95 * k),
    vertebrae,
    nasal: catmullRom([B(0.3, 11.2), B(1.1, 10.25), B(2.7, 10.75), B(4.6, 10.85), B(6.4, 10.65), B(7.6, 10.85), B(8.45, 11.3), B(8.0, 12.2), B(6.7, 13.4), B(4.4, 13.9), B(1.8, 13.6), B(0.2, 12.6)], 4),
    turbinates: ([[3.0, 11.45, 2.1, 0.32], [3.5, 12.45, 1.9, 0.3], [4.0, 13.3, 1.45, 0.22]] as const).map(([x, y, rx, ry]) => ellipse(B(x, y), rx * k, ry * k, -0.04)),
    palNasal: palate.map((p) => [p[0], p[1] + 0.55 * k] as Pt),
    jawLower: jb,
    jawUpper: jb.map((p) => [p[0], p[1] + 0.75 * k] as Pt),
    hyoid: ellipse(hy, 0.5 * k, 0.28 * k, 0.3, 28),
    thyroid: [[g[0] + 0.75 * k, g[1] - 1.6 * k], [g[0] + 1.75 * k, g[1] - 0.6 * k], [g[0] + 1.95 * k, g[1] + 1.2 * k], [g[0] + 1.45 * k, g[1] + 1.9 * k], [g[0] + 1.15 * k, g[1] + 1.1 * k], [g[0] + 1.3 * k, g[1] - 0.4 * k], [g[0] + 0.75 * k, g[1] - 1.6 * k]],
    trachea: [[[g[0] - 0.65 * k, g[1]], [g[0] - 0.75 * k, -4.8]], [[g[0] + 0.75 * k, g[1]], [g[0] + 0.95 * k, -4.8]]],
    rings,
    folds: [
      [[g[0] - 0.62 * k, g[1] + 0.05], [g[0] - 0.1, g[1] + 0.12 * k], [g[0] - 0.62 * k, g[1] + 0.32 * k], [g[0] - 0.62 * k, g[1] + 0.05]],
      [[g[0] + 0.72 * k, g[1] + 0.05], [g[0] + 0.12, g[1] + 0.12 * k], [g[0] + 0.72 * k, g[1] + 0.32 * k], [g[0] + 0.72 * k, g[1] + 0.05]],
    ],
    view: { x0: -7.5 * k, x1: 10.25 * k, y0: -4.55, y1: 19.9 * k },
  };
}
