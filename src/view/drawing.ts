/*
 * The anatomy around the air, for a side view: the whole tongue (root, arc, blade, underside, floor of
 * the mouth), each lip with its outer face, the upper and lower incisors, the jaw bone, the soft palate,
 * the epiglottis, the hard palate and the pharynx wall, from the geometry's last evaluate(). CHIMERA's
 * drawing parts (Jameson Hodge, MIT, crates/chimera/src/anatomy/human.rs:1228-1262), which the engine's
 * port leaves out: they are a view's, and this builds them on demand from the points the geometry keeps.
 * View code: it allocates. See THIRD_PARTY_NOTICES.md.
 */

import type { ChimeraGeometry } from '../engines/vocal-geometry';

/** The drawing's parts: x, y pairs in body cm, glottis at the origin, x forward and y up. */
export interface GeometryDrawing {
  /** The body's scale (1 the male body). */
  k: number;
  tongue: number[];
  upperLip: number[];
  lowerLip: number[];
  jawBone: number[];
  upperTeeth: number[];
  lowerTeeth: number[];
  velum: number[];
  epiglottis: number[];
  palate: number[];
  pharynxWall: number[];
  outer: number[];
  inner: number[];
  glottisY: number;
  tongueCenter: [number, number];
  tongueRadius: number;
  /** The jaw's rotation about the condyle, for drawing jaw-carried points. */
  jawCos: number;
  jawSin: number;
  condyle: [number, number];
  pharynxScale: number;
}

/** The drawing parts of the geometry's last evaluate(), x, y pairs in body cm with the glottis at the origin. */
export function geometryDrawing(g: ChimeraGeometry): GeometryDrawing {
  const flat = (...polys: { xs: Float64Array; ys: Float64Array; n: number; from: number }[]): number[] => {
    const out: number[] = [];
    for (const p of polys) for (let i = p.from; i < p.n; i++) out.push(p.xs[i], p.ys[i]);
    return out;
  };
  const poly = (q: { xs: Float64Array; ys: Float64Array; n: number }, from = 0) => ({ xs: q.xs, ys: q.ys, n: q.n, from });
  const k = g.k;
  const floor = { xs: g['floorX'], ys: g['floorY'], n: 3, from: 1 };
  const tongue = flat(poly(g['root']), poly(g['arcPts'], 1), poly(g['blade'], 1), poly(g['under'], 1), floor);
  const bez = (x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, n: number): number[] => {
    const o: number[] = [];
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const u = 1 - t;
      o.push(u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3, u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3);
    }
    return o;
  };
  const jp = (x: number, y: number): [number, number] => {
    g['j'](x, y);
    return [g['r'][0], g['r'][1]];
  };
  const ulE = [g['dUlx'], g['dUly']];
  const llE = [g['dLlx'], g['dLly']];
  const [j81x, j81y] = jp(8.1, 6.3);
  const [j76x, j76y] = jp(7.6, 5.6);
  const upperLip = flat(poly(g['upperLipIn'])).concat(bez(ulE[0], ulE[1], ulE[0] + 0.25 * k, ulE[1] + 0.35 * k, g.pX(8.3), g.pY(9.6), g.pX(7.9), g.pY(10.4), 6));
  const lowerLip = flat(poly(g['lowerLipIn'])).concat(bez(llE[0], llE[1], llE[0] + 0.3 * k, llE[1] - 0.4 * k, j81x, j81y, j76x, j76y, 6));
  const jawBone: number[] = [];
  for (const [x, y] of [[7.25, 6.75], [7.4, 5.4], [6.4, 4.6], [3.5, 4.4], [1.2, 5.2], [-0.6, 7.4], [-1.9, 9.6]]) jawBone.push(...jp(x, y));
  const upperTeeth: number[] = [];
  for (const [x, y] of [[6.15, 9.36], [6.78, 8.7], [7.12, 7.95], [7.38, 8.7], [7.4, 9.3]]) upperTeeth.push(g.pX(x), g.pY(y));
  const lowerTeeth: number[] = [];
  for (let i = 0; i < 4; i++) lowerTeeth.push(g['lowTeethX'][i], g['lowTeethY'][i]);
  lowerTeeth.push(...jp(6.8, 6.0), ...jp(6.4, 6.2), g['lowTeethX'][0], g['lowTeethY'][0]);
  const velum = flat(poly(g['velNasal']));
  for (let i = g['velOral'].n - 1; i >= 0; i--) velum.push(g['velOral'].xs[i], g['velOral'].ys[i]);
  const e = g['dEpi'];
  return {
    k,
    tongue,
    upperLip,
    lowerLip,
    jawBone,
    upperTeeth,
    lowerTeeth,
    velum,
    epiglottis: [e[0], e[1], e[2], e[3], e[4], e[5]],
    palate: flat(poly(g['palate'])),
    pharynxWall: flat(poly(g['pharWall'])),
    outer: flat(poly(g['outer'])),
    inner: flat(poly(g['inner'])),
    glottisY: g['dGlotY'],
    tongueCenter: [g['dBX'], g['dBY']],
    tongueRadius: g['dRR'],
    jawCos: g['cosPhi'],
    jawSin: g['sinPhi'],
    condyle: [g['condX'], g['condY']],
    pharynxScale: g['phScale'],
  };
}
