/*
 * The parts of the mouth a person can grab: where each handle sits on a drawing, and the voice
 * settings that put a handle where the pointer is. The handles are the settings (tongue: tongueFront
 * and tongueHigh; jaw: jawSet; lips: lipRound and lipOpen; velum: nasal; larynx: larynxSet), so a
 * dragged mouth is one the engine plays. View code over TractModel's public API.
 */

import type { GeometryDrawing } from './drawing';
import type { MouthSettings, TractModel } from './tract';

/** The parts of the mouth a person can grab and move. */
export type MouthHandle = 'tongue' | 'tip' | 'jaw' | 'lips' | 'velum' | 'larynx';

/** Where a handle sits on a drawing, body cm. */
export function handlePoint(d: GeometryDrawing & { tipX: number; tipY: number }, h: MouthHandle): [number, number] {
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

/** Where each handle is now, body cm. */
export function mouthHandles(model: TractModel): Record<MouthHandle, [number, number]> {
  const s = model.drawingNow();
  return {
    tongue: handlePoint(s, 'tongue'),
    tip: handlePoint(s, 'tip'),
    jaw: handlePoint(s, 'jaw'),
    lips: handlePoint(s, 'lips'),
    velum: handlePoint(s, 'velum'),
    larynx: handlePoint(s, 'larynx'),
  };
}

/**
 * The settings that put a handle at body point (x, y), cm, holding sound `ipa`: the handles are the
 * settings (tongue: tongueFront and tongueHigh; jaw: jawSet; lips: lipRound forward and lipOpen up
 * and down; velum: nasal; larynx: larynxSet), so a dragged mouth is one the voice can play. A
 * coordinate-wise golden-section search on the handle's distance to the point. Leaves the model
 * showing the result.
 */
export function settingsForHandle(model: TractModel, handle: MouthHandle, x: number, y: number, ipa: string): MouthSettings {
  const PARAMS: Record<MouthHandle, string[]> = {
    tongue: ['tongueFront', 'tongueHigh'],
    tip: ['tongueFront', 'tongueHigh'],
    jaw: ['jawSet'],
    lips: ['lipRound', 'lipOpen'],
    velum: ['nasal'],
    larynx: ['larynxSet'],
  };
  const names = PARAMS[handle];
  const cur: MouthSettings = model.settings;
  const range = (n: string): [number, number] => (n === 'nasal' ? [0, 1] : [-1, 1]);
  const cost = (): number => {
    model.setSettings(cur);
    model.target(ipa);
    model.settle();
    const p = handlePoint(model.drawingNow(), handle);
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
  model.setSettings(cur);
  model.target(ipa);
  model.settle();
  return cur;
}
