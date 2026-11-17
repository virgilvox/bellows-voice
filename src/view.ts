/*
 * The voice's mouth, for a UI: a model of the vocal tract that follows a sung or spoken plan and
 * gives its shape to draw. Main-thread code that carries the geometry (about 40 KB), so it is its
 * own entry, 'bellows-voice/view', and a page that does not draw the mouth does not load it.
 */

export { TractModel, phonemeTargets, ARTICULATOR_NAMES, type TractShape, type MouthSettings } from './view/tract';
export { mouthHandles, settingsForHandle, handlePoint, type MouthHandle } from './view/handles';
export { headProfile, catmullRom, pairs, type HeadProfile, type Pt } from './view/head';
export { geometryDrawing, type GeometryDrawing } from './view/drawing';
