/**
 * Xử lý tương tác canvas bao gồm pan, zoom, phím tắt, vùng chọn marquee và menu ngữ cảnh.
 */
export function getCanvasInteractionsScript(): string {
  return `
    function screenToWorld(clientX, clientY) {
      const r = canvas.getBoundingClientRect();
      return {
        x: (clientX - r.left - pan.x) / pan.zoom,
        y: (clientY - r.top - pan.y) / pan.zoom
      };
    }

    function zoomAt(clientX, clientY, factor) {
      const r = canvas.getBoundingClientRect();
      const mouseX = clientX - r.left;
      const mouseY = clientY - r.top;
      const newZoom = Math.max(0.15, Math.min(3.0, pan.zoom * factor));
      if (Math.abs(newZoom - pan.zoom) < 0.001) return;

      pan.x = mouseX - (mouseX - pan.x) * (newZoom / pan.zoom);
      pan.y = mouseY - (mouseY - pan.y) * (newZoom / pan.zoom);
      pan.zoom = newZoom;
      view();
      scheduleSaveViewport();
    }

    function fitToView(padding = 70, save = true) {
      if (!graph.nodes || graph.nodes.length === 0) {
        pan = { x: 40, y: 40, zoom: 1 };
        view();
        return;
      }
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const n of graph.nodes) {
        const nodeEl = document.querySelector('#node-' + CSS.escape(n.id));
        const nw = nodeEl ? nodeEl.offsetWidth : (n.width || 140);
        const nh = nodeEl ? nodeEl.offsetHeight : (n.height || 50);
        minX = Math.min(minX, n.x);
        minY = Math.min(minY, n.y);
        maxX = Math.max(maxX, n.x + nw);
        maxY = Math.max(maxY, n.y + nh);
      }
      const r = canvas.getBoundingClientRect();
      const cw = r.width || window.innerWidth;
      const ch = r.height || window.innerHeight;
      const gw = Math.max(80, maxX - minX);
      const gh = Math.max(80, maxY - minY);

      const availW = Math.max(100, cw - padding * 2);
      const availH = Math.max(100, ch - padding * 2);
      let scale = Math.min(availW / gw, availH / gh);
      scale = Math.max(0.25, Math.min(1.4, scale));

      const cx = minX + gw / 2;
      const cy = minY + gh / 2;
      pan.zoom = scale;
      pan.x = (cw / 2) - (cx * scale);
      pan.y = (ch / 2) - (cy * scale);
      view();
      if (save) scheduleSaveViewport();
    }

    function contextMenuItemHtml(id, label, extraClass) {
      return '<div class="menu-item' + (extraClass ? ' ' + extraClass : '') + '" id="' + id + '">' + label + '</div>';
    }

    function contextMenuFieldHtml(id, labelText, optionsHtml) {
      return '<label class="menu-field"><span>' + labelText + '</span><select id="' + id + '">' + optionsHtml + '</select></label>';
    }

    function shapeOptionsHtml(selected) {
      return ['rounded-rectangle', 'rectangle']
        .map(value => '<option' + (value === selected ? ' selected' : '') + '>' + value + '</option>').join('');
    }

    function colorOptionsHtml(selected) {
      return Object.keys(colors)
        .map(value => '<option' + (value === selected ? ' selected' : '') + '>' + value + '</option>').join('');
    }

    function buildNodeContextMenuHtml(nodeId, node) {
      const isMulti = selectedNodeIds.size > 1 && selectedNodeIds.has(nodeId);
      if (node && node.ghost) {
        return contextMenuItemHtml('ctx-create-node', 'Create node') +
          contextMenuItemHtml('ctx-del-node', 'Delete', 'menu-item-danger');
      }
      let html = '';
      if (isMulti) {
        html = contextMenuFieldHtml('ctx-node-shape', 'Shape', shapeOptionsHtml(node?.shape)) +
          contextMenuFieldHtml('ctx-node-color', 'Color', colorOptionsHtml(node?.color)) +
          contextMenuItemHtml('ctx-change-icon', 'Change Icon...');
        const styleIds = Array.from(selectedNodeIds);
        const anyUnlocked = styleIds.some(id => { const item = findNode(id); return item && !item.locked; });
        html += contextMenuItemHtml('ctx-toggle-lock', anyUnlocked ? 'Lock all' : 'Unlock all');
        const anyExpanded = styleIds.some(id => { const item = findNode(id); return item && !item.collapsed; });
        html += contextMenuItemHtml('ctx-toggle-collapse', anyExpanded ? 'Collapse all' : 'Expand all');
        html += contextMenuItemHtml('ctx-copy-nodes', 'Copy ' + styleIds.length + ' nodes    Ctrl+C');
        html += contextMenuItemHtml('ctx-cut-nodes', 'Cut ' + styleIds.length + ' nodes    Ctrl+X');
        html += contextMenuItemHtml('ctx-del-node', 'Delete ' + styleIds.length + ' nodes', 'menu-item-danger');
      } else {
        html = contextMenuItemHtml('ctx-edit-node', 'Edit Node') +
          contextMenuFieldHtml('ctx-node-shape', 'Shape', shapeOptionsHtml(node?.shape)) +
          contextMenuFieldHtml('ctx-node-color', 'Color', colorOptionsHtml(node?.color)) +
          contextMenuItemHtml('ctx-change-icon', 'Change Icon...') +
          contextMenuItemHtml('ctx-toggle-lock', node && node.locked ? 'Unlock node' : 'Lock node') +
          contextMenuItemHtml('ctx-toggle-collapse', node && node.collapsed ? 'Expand' : 'Collapse') +
          contextMenuItemHtml('ctx-duplicate-node', 'Duplicate node') +
          contextMenuItemHtml('ctx-copy-nodes', 'Copy    Ctrl+C') +
          contextMenuItemHtml('ctx-cut-nodes', 'Cut    Ctrl+X') +
          '<div class="menu-divider"></div>' +
          contextMenuItemHtml('ctx-del-node', 'Delete node', 'menu-item-danger');
      }
      html += '<div class="menu-divider"></div>';
      return html;
    }

    function showContextMenu(clientX, clientY) {
      const clickedEl = document.elementFromPoint(clientX, clientY);
      const clickedNode = clickedEl?.closest('.node');
      const clickedEdge = clickedEl?.closest('.edge, .edge-hit, .edge-label-group');
      const clickedEdgeId = clickedEdge
        ? clickedEdge.id.replace(/^edge-hit-/, '').replace(/^edge-/, '').replace(/^label-group-/, '')
        : '';
      const wp = screenToWorld(clientX, clientY);

      let html = '';
      if (clickedNode) {
        const nodeId = clickedNode.id.replace('node-', '');
        html = buildNodeContextMenuHtml(nodeId, findNode(nodeId));
      } else if (clickedEdgeId) {
        const edge = findEdge(clickedEdgeId);
        html = contextMenuItemHtml('ctx-edit-edge-label', edge?.label ? 'Edit label...' : 'Add label...') +
          '<label class="menu-field"><span>Arrow</span><select id="ctx-edge-arrow">' +
          ['forward', 'backward', 'both', 'none'].map(value => '<option' + (value === edge?.arrow ? ' selected' : '') + '>' + value + '</option>').join('') + '</select></label>' +
          '<label class="menu-field"><span>Line</span><select id="ctx-edge-line">' +
          ['solid', 'dashed', 'dotted'].map(value => '<option' + (value === edge?.line ? ' selected' : '') + '>' + value + '</option>').join('') + '</select></label>' +
          '<div class="menu-item" id="ctx-del-edge">Delete Edge</div>' +
          '<div class="menu-divider"></div>';
      }

      if (!clickedNode && !clickedEdge) {
        html += '<div class="menu-item" id="ctx-add-node">Add Empty Node</div>' +
          '<div class="menu-item" id="ctx-add-checklist-node">Add Checklist Node</div>' +
          '<div class="menu-item" id="ctx-add-code-node">Add Code Node</div>' +
          '<div class="menu-item" id="ctx-add-img-node">Add Image Node</div>' +
          '<div class="menu-divider"></div>';
      }

      html += '<div class="menu-item" id="ctx-paste-nodes">Paste    Ctrl+V</div>' +
        '<div class="menu-item" id="ctx-undo">Undo    Ctrl+Z</div>' +
        '<div class="menu-item" id="ctx-redo">Redo    Ctrl+Y</div>' +
        '<div class="menu-divider"></div>' +
        '<div class="menu-item" id="ctx-fit">Fit to Screen (F)</div>' +
        '<div class="menu-item" id="ctx-reset-zoom">Reset Zoom 100%</div>';

      contextMenu.innerHTML = html;
      contextMenu.style.display = 'block';
      const menuRect = contextMenu.getBoundingClientRect();
      contextMenu.style.left = Math.max(6, Math.min(window.innerWidth - menuRect.width - 6, clientX)) + 'px';
      contextMenu.style.top = Math.max(6, Math.min(window.innerHeight - menuRect.height - 6, clientY)) + 'px';

      const addBtn = document.querySelector('#ctx-add-node');
      if (addBtn) addBtn.onclick = () => { closeContextMenu(); vscode.postMessage({ type: 'addNode', x: wp.x, y: wp.y, shape: nodeShapeSelect.value, color: nodeColorSelect.value, icon: nodeIconSelect.value }); };
      const addChecklistBtn = document.querySelector('#ctx-add-checklist-node');
      if (addChecklistBtn) addChecklistBtn.onclick = () => { closeContextMenu(); vscode.postMessage({ type: 'createRichNode', kind: 'checklist', x: wp.x, y: wp.y }); };
      const addCodeBtn = document.querySelector('#ctx-add-code-node');
      if (addCodeBtn) addCodeBtn.onclick = () => { closeContextMenu(); vscode.postMessage({ type: 'createRichNode', kind: 'code', x: wp.x, y: wp.y }); };
      const addImgBtn = document.querySelector('#ctx-add-img-node');
      if (addImgBtn) addImgBtn.onclick = () => { closeContextMenu(); vscode.postMessage({ type: 'requestPickImage', x: wp.x, y: wp.y }); };

      const fitBtn = document.querySelector('#ctx-fit');
      if (fitBtn) fitBtn.onclick = () => { closeContextMenu(); fitToView(); };
      const rstBtn = document.querySelector('#ctx-reset-zoom');
      if (rstBtn) rstBtn.onclick = () => { closeContextMenu(); pan.zoom = 1; view(); scheduleSaveViewport(); };
      const pasteBtn = document.querySelector('#ctx-paste-nodes');
      if (pasteBtn) pasteBtn.onclick = () => { closeContextMenu(); vscode.postMessage({ type: 'pasteNodes' }); };
      const undoBtn = document.querySelector('#ctx-undo');
      if (undoBtn) undoBtn.onclick = () => { closeContextMenu(); vscode.postMessage({ type: 'undo' }); };
      const redoBtn = document.querySelector('#ctx-redo');
      if (redoBtn) redoBtn.onclick = () => { closeContextMenu(); vscode.postMessage({ type: 'redo' }); };

      if (clickedNode) {
        wireNodeContextMenu(clickedNode);
      }
      if (clickedEdgeId) {
        const edge = findEdge(clickedEdgeId);
        const updateEdgeFromContext = () => {
          if (!edge) return;
          edge.arrow = document.querySelector('#ctx-edge-arrow').value;
          edge.line = document.querySelector('#ctx-edge-line').value;
          vscode.postMessage({ type: 'updateEdge', id: edge.id, label: edge.label, arrow: edge.arrow, line: edge.line });
          render();
        };
        const editLabelBtn = document.querySelector('#ctx-edit-edge-label');
        if (editLabelBtn) editLabelBtn.onclick = () => {
          closeContextMenu();
          if (!edge) return;
          selectEdgeLocally(edge);
          startInlineEdgeLabelEdit(edge, calculateEdgeGeometry(edge));
        };
        document.querySelector('#ctx-edge-arrow').onchange = updateEdgeFromContext;
        document.querySelector('#ctx-edge-line').onchange = updateEdgeFromContext;
        document.querySelector('#ctx-del-edge').onclick = () => { closeContextMenu(); vscode.postMessage({ type: 'deleteEdge', id: clickedEdgeId }); };
      }
    }

    function wireNodeContextMenu(clickedNode) {
      const nodeId = clickedNode.id.replace('node-', '');
      const node = findNode(nodeId);
      const isMulti = selectedNodeIds.size > 1 && selectedNodeIds.has(nodeId);
      const styleIds = isMulti ? Array.from(selectedNodeIds) : [nodeId];

      const applyContextStyle = () => {
        const shapeEl = document.querySelector('#ctx-node-shape');
        const colorEl = document.querySelector('#ctx-node-color');
        if (!shapeEl || !colorEl) return;
        const shape = shapeEl.value;
        const color = colorEl.value;
        graph.nodes.filter(item => styleIds.includes(item.id)).forEach(item => { item.shape = shape; item.color = color; });
        vscode.postMessage({ type: 'applyNodeStyle', ids: styleIds, shape, color });
        closeContextMenu();
        render();
      };
      const shapeSelect = document.querySelector('#ctx-node-shape');
      const colorSelect = document.querySelector('#ctx-node-color');
      if (shapeSelect) shapeSelect.onchange = applyContextStyle;
      if (colorSelect) colorSelect.onchange = applyContextStyle;

      const iconBtn = document.querySelector('#ctx-change-icon');
      if (iconBtn) iconBtn.onclick = () => { closeContextMenu(); openIconPicker(styleIds, clickedNode); };

      const copyBtn = document.querySelector('#ctx-copy-nodes');
      if (copyBtn) copyBtn.onclick = () => { closeContextMenu(); vscode.postMessage({ type: 'copyNodes', ids: styleIds }); };
      const cutBtn = document.querySelector('#ctx-cut-nodes');
      if (cutBtn) cutBtn.onclick = () => {
        closeContextMenu();
        vscode.postMessage({ type: 'cutNodes', ids: styleIds });
        selectedNodeIds.clear();
        inspectEmpty();
      };

      const delBtn = document.querySelector('#ctx-del-node');
      if (delBtn) delBtn.onclick = () => {
        closeContextMenu();
        if (isMulti) vscode.postMessage({ type: 'deleteNodes', ids: styleIds });
        else openPopover('delete', nodeId);
      };

      if (node && node.ghost) {
        const createBtn = document.querySelector('#ctx-create-node');
        if (createBtn) createBtn.onclick = () => {
          closeContextMenu();
          selectedNodeIds.clear();
          selectedNodeIds.add(nodeId);
          highlightSelection();
          vscode.postMessage({ type: 'updateNode', id: nodeId, title: node.title, shape: node.shape, color: node.color, content: '' });
        };
        return;
      }

      const toggleLockBtn = document.querySelector('#ctx-toggle-lock');
      if (toggleLockBtn) toggleLockBtn.onclick = () => {
        closeContextMenu();
        const anyUnlocked = styleIds.some(id => { const item = findNode(id); return item && !item.locked; });
        const locked = anyUnlocked;
        styleIds.forEach(id => {
          const item = findNode(id);
          if (!item) return;
          item.locked = locked;
          vscode.postMessage({ type: 'toggleNodeLocked', id, locked });
        });
        render();
      };

      const toggleCollapseBtn = document.querySelector('#ctx-toggle-collapse');
      if (toggleCollapseBtn) toggleCollapseBtn.onclick = () => {
        closeContextMenu();
        const anyExpanded = styleIds.some(id => { const item = findNode(id); return item && !item.collapsed; });
        const collapsed = anyExpanded;
        styleIds.forEach(id => {
          const item = findNode(id);
          if (!item) return;
          item.collapsed = collapsed;
          vscode.postMessage({ type: 'toggleNodeCollapsed', id, collapsed });
        });
        render();
      };

      const duplicateBtn = document.querySelector('#ctx-duplicate-node');
      if (duplicateBtn) duplicateBtn.onclick = () => { closeContextMenu(); vscode.postMessage({ type: 'duplicateNode', id: nodeId }); };

      const editBtn = document.querySelector('#ctx-edit-node');
      if (editBtn) editBtn.onclick = () => {
        closeContextMenu();
        selectedNodeIds.clear();
        selectedNodeIds.add(nodeId);
        highlightSelection();
        if (node) startInlineNodeEdit(node, clickedNode);
      };
    }

    function closeContextMenu() {
      contextMenu.style.display = 'none';
    }

    function setupKeyShortcuts() {
      window.onkeydown = e => {
        const eventTarget = e.target instanceof HTMLElement ? e.target : null;
        const isInput = Boolean(eventTarget && (
          ['INPUT', 'TEXTAREA', 'SELECT'].includes(eventTarget.tagName) ||
          eventTarget.isContentEditable ||
          eventTarget.closest('[contenteditable="true"]')
        ));
        if (e.code === 'Space' && !isInput) spaceDown = true;
        if (isInput) return;

        const commandKey = e.ctrlKey || e.metaKey;
        const key = e.key.toLowerCase();
        if (commandKey && key === 'c' && selectedNodeIds.size > 0) {
          e.preventDefault();
          vscode.postMessage({ type: 'copyNodes', ids: Array.from(selectedNodeIds) });
          return;
        }
        if (commandKey && key === 'x' && selectedNodeIds.size > 0) {
          e.preventDefault();
          vscode.postMessage({ type: 'cutNodes', ids: Array.from(selectedNodeIds) });
          selectedNodeIds.clear();
          inspectEmpty();
          return;
        }
        if (commandKey && key === 'v') {
          e.preventDefault();
          vscode.postMessage({ type: 'pasteNodes' });
          return;
        }
        if (commandKey && key === 'z') {
          e.preventDefault();
          vscode.postMessage({ type: e.shiftKey ? 'redo' : 'undo' });
          return;
        }
        if (commandKey && key === 'y') {
          e.preventDefault();
          vscode.postMessage({ type: 'redo' });
          return;
        }
        if (commandKey && key === 'f') {
          e.preventDefault();
          vscode.postMessage({ type: 'focusOutline' });
          return;
        }

        if (e.key === 'Delete' || e.key === 'Backspace') {
          if (selectedNodeIds.size === 1) {
            const singleId = Array.from(selectedNodeIds)[0];
            openPopover('delete', singleId);
          } else if (selectedNodeIds.size > 1) {
            vscode.postMessage({ type: 'deleteNodes', ids: Array.from(selectedNodeIds) });
            selectedNodeIds.clear();
            inspectEmpty();
          } else if (selectedEdgeId) {
            vscode.postMessage({ type: 'deleteEdge', id: selectedEdgeId });
            selectedEdgeId = null;
            render();
          }
        } else if (e.key === 'Escape') {
          selectedNodeIds.clear();
          selectedEdgeId = null;
          highlightSelection();
          inspectEmpty();
          closeContextMenu();
          shortcutsModal.classList.remove('visible');
        } else if (e.key === 'f' || e.key === 'F' || ((e.ctrlKey || e.metaKey) && e.key === '0')) {
          e.preventDefault();
          fitToView();
        } else if ((e.ctrlKey || e.metaKey) && e.key === '1') {
          e.preventDefault();
          pan.zoom = 1;
          view();
          scheduleSaveViewport();
        } else if (e.key === 'n' || e.key === 'N' || e.key === 'Insert') {
          const r = canvas.getBoundingClientRect();
          const center = screenToWorld(r.left + r.width / 2, r.top + r.height / 2);
          vscode.postMessage({ type: 'addNode', x: center.x - 70, y: center.y - 30, shape: nodeShapeSelect.value, color: nodeColorSelect.value, icon: nodeIconSelect.value });
        } else if (e.key === '?' || e.key === 'F1') {
          shortcutsModal.classList.toggle('visible');
        }
      };

      window.onkeyup = e => {
        if (e.code === 'Space') spaceDown = false;
      };
    }
  `;
}
