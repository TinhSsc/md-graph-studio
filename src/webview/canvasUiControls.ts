import { getCanvasIconPickerScript } from './canvasIconPicker';
import { getShapeIconsScript } from './canvasIcons';

/**
 * Toolbar logic: add-node defaults, shape/icon pickers, fit and panel toggles.
 * Rendered as a webview script fragment: string concatenation only, no backticks inside.
 */
export function getCanvasUiControlsScript(): string {
  return `
    ${getShapeIconsScript()}
    ${getCanvasIconPickerScript()}

    // Defaults for NEW nodes. Plain objects with a .value property so legacy
    // readers (inspector "Apply toolbar style", N shortcut, context menu) keep working.
    var nodeShapeSelect = { value: 'rounded-rectangle' };
    var nodeColorSelect = { value: 'blue' };
    var nodeIconSelect = { value: '' };

    var openDropdownMenu = null;

    function closeDropdownMenus() {
      if (openDropdownMenu) openDropdownMenu.style.display = 'none';
      openDropdownMenu = null;
    }

    function positionDropdownMenu(menu, anchorBtn) {
      menu.style.display = 'flex';
      var rect = anchorBtn.getBoundingClientRect();
      var menuRect = menu.getBoundingClientRect();
      var left = Math.max(6, Math.min(window.innerWidth - menuRect.width - 6, rect.left));
      var top = rect.bottom + 6;
      if (top + menuRect.height > window.innerHeight - 6) top = Math.max(6, rect.top - menuRect.height - 6);
      menu.style.left = left + 'px';
      menu.style.top = top + 'px';
    }

    function toggleDropdownMenu(menu, anchorBtn) {
      var wasOpen = openDropdownMenu === menu;
      closeDropdownMenus();
      if (wasOpen || !menu) return;
      openDropdownMenu = menu;
      positionDropdownMenu(menu, anchorBtn);
    }

    function buildToolbarDropdown(id, anchorId) {
      var menu = document.querySelector('#' + id);
      if (menu) return menu;
      menu = document.createElement('div');
      menu.id = id;
      menu.className = 'toolbar-dropdown';
      menu.setAttribute('role', 'menu');
      menu.dataset.anchorId = anchorId;
      menu.style.display = 'none';
      document.body.appendChild(menu);
      return menu;
    }

    function dropdownItemHtml(extraClass, innerHtml) {
      return '<button type="button" class="dropdown-item' + (extraClass ? ' ' + extraClass : '') + '" role="menuitem">' + innerHtml + '</button>';
    }

    document.addEventListener('pointerdown', event => {
      if (!openDropdownMenu) return;
      const target = event.target;
      if (openDropdownMenu.contains(target)) return;
      const anchor = openDropdownMenu.dataset.anchorId ? document.querySelector('#' + openDropdownMenu.dataset.anchorId) : null;
      if (anchor && anchor.contains(target)) return;
      closeDropdownMenus();
    });

    window.addEventListener('keydown', event => {
      if (event.key === 'Escape' && openDropdownMenu) {
        event.preventDefault();
        event.stopPropagation();
        closeDropdownMenus();
      }
    }, true);

    const addNodeButton = document.querySelector('#add');
    const createTemplateButton = document.querySelector('#btn-create-template');
    if (createTemplateButton) createTemplateButton.onclick = () => vscode.postMessage({ type: 'createTemplate' });
    const toolbarTop = document.querySelector('#toolbar-top');
    document.querySelector('#toggle-toolbar-top').onclick = () => { closeDropdownMenus(); toolbarTop.classList.add('collapsed'); };
    document.querySelector('#expand-toolbar-top').onclick = () => toolbarTop.classList.remove('collapsed');
    document.querySelector('#toggle-editor-right').onclick = () => editorRight.classList.add('collapsed');

    addNodeButton.onclick = () => {
      const r = canvas.getBoundingClientRect();
      const center = screenToWorld(r.left + r.width / 2, r.top + r.height / 2);
      vscode.postMessage({ type: 'addNode', x: center.x - 70, y: center.y - 30, shape: nodeShapeSelect.value, color: nodeColorSelect.value, icon: nodeIconSelect.value });
    };

    // Shape picker: stores the default shape used for newly created nodes.
    const shapePickerBtn = document.querySelector('#shape-picker-btn');
    const shapePickerPreview = document.querySelector('#shape-picker-preview');
    const shapeMenu = buildToolbarDropdown('new-node-shape-menu', 'shape-picker-btn');
    if (typeof mgsShapeIcons !== 'undefined') {
      const availableShapes = ['rounded-rectangle', 'rectangle'];
      shapeMenu.innerHTML = availableShapes
        .map(shape => dropdownItemHtml('', (mgsShapeIcons[shape] || '') + '<span>' + shape + '</span>')).join('');
      shapeMenu.querySelectorAll('.dropdown-item').forEach((item, index) => {
        item.onclick = () => {
          nodeShapeSelect.value = availableShapes[index];
          if (shapePickerPreview) shapePickerPreview.innerHTML = mgsShapeIcons[nodeShapeSelect.value] || '';
          closeDropdownMenus();
        };
      });
      if (shapePickerPreview) shapePickerPreview.innerHTML = mgsShapeIcons[nodeShapeSelect.value] || '';
    }
    if (shapePickerBtn) shapePickerBtn.onclick = () => toggleDropdownMenu(shapeMenu, shapePickerBtn);

    // Icon picker: visually separate from geometric node shapes.
    const iconPickerBtn = document.querySelector('#icon-picker-btn');
    const iconPickerPreview = document.querySelector('#icon-picker-preview');
    const defaultIconPreview = iconPickerPreview ? iconPickerPreview.innerHTML : '';
    const iconMenu = buildToolbarDropdown('new-node-icon-menu', 'icon-picker-btn');
    iconMenu.classList.add('toolbar-icon-menu');
    iconMenu.innerHTML = '<div class="toolbar-icon-grid">' + mgsNodeIconIds
      .map(icon => '<button type="button" class="icon-picker-item" data-icon="' + icon + '" title="' + esc(mgsNodeIconLabels[icon] || icon) + '" aria-label="' + esc(mgsNodeIconLabels[icon] || icon) + '">' + (mgsNodeIcons[icon] || '') + '</button>').join('') +
      '</div><button type="button" class="dropdown-item icon-picker-none" data-icon="">None</button>';
    iconMenu.querySelectorAll('[data-icon]').forEach(item => {
      item.onclick = () => {
        nodeIconSelect.value = item.dataset.icon || '';
        if (iconPickerPreview) iconPickerPreview.innerHTML = nodeIconSelect.value ? (mgsNodeIcons[nodeIconSelect.value] || defaultIconPreview) : defaultIconPreview;
        closeDropdownMenus();
      };
    });
    if (iconPickerBtn) iconPickerBtn.onclick = () => toggleDropdownMenu(iconMenu, iconPickerBtn);

    // Color picker: independent from shape and icon defaults.
    const colorPickerBtn = document.querySelector('#color-picker-btn');
    const colorPickerPreview = document.querySelector('#color-picker-preview');
    const colorMenu = buildToolbarDropdown('new-node-color-menu', 'color-picker-btn');
    colorMenu.innerHTML = Object.keys(colors)
      .map(color => dropdownItemHtml('', '<span class="dropdown-dot" data-color="' + color + '" style="background:' + colors[color] + '"></span><span>' + color + '</span>')).join('');
    colorMenu.querySelectorAll('.dropdown-item').forEach(item => {
      item.onclick = () => {
        const dot = item.querySelector('.dropdown-dot');
        const colorName = dot ? dot.dataset.color : '';
        if (colorName && colors[colorName]) nodeColorSelect.value = colorName;
        if (colorPickerPreview) colorPickerPreview.style.background = colors[nodeColorSelect.value] || '#7d8790';
        closeDropdownMenus();
      };
    });
    if (colorPickerPreview) colorPickerPreview.style.background = colors[nodeColorSelect.value] || '#7d8790';
    if (colorPickerBtn) colorPickerBtn.onclick = () => toggleDropdownMenu(colorMenu, colorPickerBtn);

    const fitToolbarBtn = document.querySelector('#btn-fit');
    if (fitToolbarBtn) fitToolbarBtn.onclick = () => fitToView();
    const exportToolbarBtn = document.querySelector('#btn-export');
    if (exportToolbarBtn) exportToolbarBtn.onclick = () => exportGraphPng();

    document.querySelector('#fit').onclick = () => fitToView();
    zoomVal.onclick = () => { pan.zoom = 1; view(); scheduleSaveViewport(); };
    document.querySelector('#plus').onclick = () => { const r = canvas.getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1.18); };
    document.querySelector('#minus').onclick = () => { const r = canvas.getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, 0.82); };
    document.querySelector('#btn-shortcuts').onclick = () => shortcutsModal.classList.toggle('visible');
    document.querySelector('#btn-close-shortcuts').onclick = () => shortcutsModal.classList.remove('visible');
  `;
}
