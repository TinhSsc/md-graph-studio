import { getNodeIconsScript } from './canvasIcons';

/**
 * Icon picker popover for nodes: grid of contract icons + "None", multi-target aware.
 * Rendered as a webview script fragment: string concatenation only, no backticks inside.
 * Top-level bindings use var/function declarations so repeated injection stays safe.
 */
export function getCanvasIconPickerScript(): string {
  return `
    ${getNodeIconsScript()}

    var iconPickerTargetIds = null;
    var iconPickerAnchorEl = null;

    function buildIconPicker() {
      var existing = document.querySelector('#icon-picker');
      if (existing) return existing;
      if (typeof mgsNodeIcons === 'undefined') return null;
      var picker = document.createElement('div');
      picker.id = 'icon-picker';
      picker.setAttribute('role', 'dialog');
      picker.setAttribute('aria-label', 'Node icon picker');
      picker.style.display = 'none';
      var html = '<div class="icon-picker-header">Node Icon</div><div class="icon-picker-grid">';
      for (var i = 0; i < mgsNodeIconIds.length; i++) {
        var iconId = mgsNodeIconIds[i];
        var label = (typeof mgsNodeIconLabels !== 'undefined' && mgsNodeIconLabels[iconId]) || iconId;
        html += '<button type="button" class="icon-picker-item" data-icon="' + iconId + '" title="' + esc(label) + '" aria-label="' + esc(label) + '">' + (mgsNodeIcons[iconId] || '') + '</button>';
      }
      html += '</div><button type="button" class="icon-picker-item icon-picker-none" data-icon="" title="No icon" aria-label="No icon">None</button>';
      picker.innerHTML = html;
      picker.addEventListener('click', event => {
        var button = event.target && event.target.closest ? event.target.closest('button[data-icon]') : null;
        if (!button || !iconPickerTargetIds || iconPickerTargetIds.length === 0) return;
        applyIconPickerSelection(button.getAttribute('data-icon'));
      });
      document.body.appendChild(picker);
      return picker;
    }

    function applyIconPickerSelection(iconId) {
      var targetIds = iconPickerTargetIds || [];
      var icon = iconId || '';
      targetIds.forEach(nodeId => {
        var node = findNode(nodeId);
        if (!node) return;
        if (icon) node.icon = icon; else delete node.icon;
      });
      vscode.postMessage({ type: 'setNodeIcon', ids: targetIds, icon: icon });
      iconPickerTargetIds = null;
      closeIconPicker();
      render();
    }

    function positionIconPicker(picker, anchorEl) {
      var containerRect = document.querySelector('#canvas-container').getBoundingClientRect();
      picker.style.display = 'flex';
      var rect = anchorEl && anchorEl.getBoundingClientRect ? anchorEl.getBoundingClientRect() : null;
      var left = rect ? rect.left : containerRect.left + containerRect.width / 2 - picker.offsetWidth / 2;
      var top = rect ? rect.bottom + 6 : containerRect.top + containerRect.height / 2 - picker.offsetHeight / 2;
      left = Math.max(containerRect.left + 6, Math.min(containerRect.right - picker.offsetWidth - 6, left));
      top = Math.max(containerRect.top + 6, Math.min(containerRect.bottom - picker.offsetHeight - 6, top));
      picker.style.left = left + 'px';
      picker.style.top = top + 'px';
    }

    function openIconPicker(targetIds, anchorEl) {
      var picker = buildIconPicker();
      if (!picker || !targetIds || targetIds.length === 0) return;
      iconPickerTargetIds = targetIds.slice();
      iconPickerAnchorEl = anchorEl || null;
      positionIconPicker(picker, anchorEl);
    }

    function closeIconPicker() {
      var picker = document.querySelector('#icon-picker');
      if (picker) picker.style.display = 'none';
      iconPickerTargetIds = null;
      iconPickerAnchorEl = null;
    }

    window.addEventListener('pointerdown', event => {
      var picker = document.querySelector('#icon-picker');
      if (!picker || picker.style.display === 'none') return;
      var target = event.target;
      if (picker.contains(target)) return;
      if (iconPickerAnchorEl && iconPickerAnchorEl.contains(target)) return;
      closeIconPicker();
    });

    window.addEventListener('keydown', event => {
      var picker = document.querySelector('#icon-picker');
      if (!picker || picker.style.display === 'none') return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        closeIconPicker();
      }
    }, true);
  `;
}
