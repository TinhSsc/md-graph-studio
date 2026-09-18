import { describe, expect, it } from 'vitest';
import { CANVAS_INTERACTION_CONFIG, getCanvasInteractionConfigScript } from '../src/webview/canvasInteractionConfig';

function createInteractionContext() {
  const script = getCanvasInteractionConfigScript();
  const fn = new Function(`
    ${script}
    return {
      INTERACTION_CONFIG,
      isInsideOverlay,
      isInteractiveControl,
      isActiveTextEditor,
      isConnectionPort,
      isResizeHandle,
      isEdgeHandle,
      resolvePointerIntent
    };
  `);
  return fn();
}

describe('CANVAS_INTERACTION_CONFIG', () => {
  it('defines explicit interaction thresholds and selectors', () => {
    expect(CANVAS_INTERACTION_CONFIG.thresholds.dragDistance).toBe(4);
    expect(CANVAS_INTERACTION_CONFIG.selectors.interactiveControls).toContain('.task-checkbox');
    expect(CANVAS_INTERACTION_CONFIG.selectors.interactiveControls).toContain('.task-delete-btn');
    expect(CANVAS_INTERACTION_CONFIG.selectors.interactiveControls).toContain('.list-delete-btn');
    expect(CANVAS_INTERACTION_CONFIG.selectors.interactiveControls).toContain('.node-link');
    expect(CANVAS_INTERACTION_CONFIG.selectors.ports).toContain('.port');
    expect(CANVAS_INTERACTION_CONFIG.selectors.resizers).toContain('.resizer');
    expect(CANVAS_INTERACTION_CONFIG.buttons.primary).toBe(0);
    expect(CANVAS_INTERACTION_CONFIG.buttons.auxiliary).toBe(1);
  });

  it('produces valid javascript runtime functions', () => {
    const ctx = createInteractionContext();
    expect(typeof ctx.resolvePointerIntent).toBe('function');
    expect(typeof ctx.isInteractiveControl).toBe('function');
    expect(typeof ctx.isActiveTextEditor).toBe('function');
    expect(ctx.INTERACTION_CONFIG.thresholds.dragDistance).toBe(4);
  });
});
