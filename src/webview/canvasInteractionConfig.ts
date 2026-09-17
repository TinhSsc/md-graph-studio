/**
 * Cấu hình tập trung cho các quy tắc tương tác pointer, drag threshold và phân cấp intent trên canvas.
 */
export const CANVAS_INTERACTION_CONFIG = {
  thresholds: {
    dragDistance: 4,
    panDistance: 2
  },
  selectors: {
    interactiveControls: [
      '.task-checkbox',
      '.task-delete-btn',
      '.list-delete-btn',
      '.node-link',
      'button',
      'input',
      'select',
      'textarea',
      '.menu-item',
      '.menu-field',
      '.edge-label-group',
      '.edge-inline-input'
    ],
    ports: ['.port'],
    resizers: ['.resizer'],
    edgeHandles: ['.edge-segment-handle', '.edge-endpoint-handle', '.edge-segment-knob'],
    activeEditors: ['[contenteditable="true"]', '.node.editing [contenteditable="true"]'],
    nodeContainer: '.node',
    nodeTitle: '.node-title',
    nodeContent: '.node-content',
    canvas: '#canvas',
    world: '#world',
    overlays: ['#shortcuts-modal', '#editor-right', '#context-menu', '#node-popover', '#node-action-bar']
  },
  buttons: {
    primary: 0,
    auxiliary: 1,
    secondary: 2
  }
} as const;

/**
 * Tạo script JavaScript chứa cấu hình và các hàm kiểm tra intent nhúng vào webview client.
 */
export function getCanvasInteractionConfigScript(): string {
  return `
    const INTERACTION_CONFIG = ${JSON.stringify(CANVAS_INTERACTION_CONFIG)};

    function isInsideOverlay(target) {
      if (!target || !(target instanceof Element)) return false;
      return Boolean(target.closest(INTERACTION_CONFIG.selectors.overlays.join(', ')));
    }

    function isInteractiveControl(target) {
      if (!target || !(target instanceof Element)) return false;
      return Boolean(target.closest(INTERACTION_CONFIG.selectors.interactiveControls.join(', ')));
    }

    function isActiveTextEditor(target) {
      if (!target || !(target instanceof Element)) return false;
      return Boolean(target.closest(INTERACTION_CONFIG.selectors.activeEditors.join(', ')));
    }

    function isConnectionPort(target) {
      if (!target || !(target instanceof Element)) return false;
      return Boolean(target.closest(INTERACTION_CONFIG.selectors.ports.join(', ')));
    }

    function isResizeHandle(target) {
      if (!target || !(target instanceof Element)) return false;
      return Boolean(target.closest(INTERACTION_CONFIG.selectors.resizers.join(', ')));
    }

    function isEdgeHandle(target) {
      if (!target || !(target instanceof Element)) return false;
      return Boolean(target.closest(INTERACTION_CONFIG.selectors.edgeHandles.join(', ')));
    }

    function resolvePointerIntent(event, spaceIsDown) {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return 'NONE';
      if (isInsideOverlay(target)) return 'OVERLAY';

      if (event.button === INTERACTION_CONFIG.buttons.auxiliary || (event.button === INTERACTION_CONFIG.buttons.primary && spaceIsDown)) {
        return 'CANVAS_PAN';
      }

      if (event.button !== INTERACTION_CONFIG.buttons.primary) {
        return 'OTHER_BUTTON';
      }

      if (isActiveTextEditor(target)) {
        return 'TEXT_EDITING';
      }

      if (isInteractiveControl(target)) {
        return 'DIRECT_CONTROL';
      }

      if (isConnectionPort(target)) {
        return 'CONNECT_HANDLE';
      }

      if (isResizeHandle(target)) {
        return 'RESIZE_HANDLE';
      }

      if (isEdgeHandle(target)) {
        return 'EDGE_HANDLE';
      }

      const nodeElement = target.closest(INTERACTION_CONFIG.selectors.nodeContainer);
      if (nodeElement) {
        return 'NODE_BODY';
      }

      return 'CANVAS_BACKGROUND';
    }
  `;
}
