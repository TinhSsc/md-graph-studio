import type { Viewport } from '../model/graphTypes';
export { createCanvasMeta as makeMeta, updateEdgeState as updateEdgeMeta, updateViewportState as updateViewportMeta } from '../state/CanvasStateReducer';
import { isViewport as validateViewport } from '../state/CanvasStateReducer';

export function isViewport(value: unknown): value is Viewport {
  return validateViewport(value);
}
