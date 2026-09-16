/**
 * Canvas interaction handlers: pan, zoom, marquee, context menu, shortcuts.
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

    function fitToView(padding = 70) {
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
      scheduleSaveViewport();
    }

    function showContextMenu(clientX, clientY) {
      const clickedEl = document.elementFromPoint(clientX, clientY);
      const clickedNode = clickedEl?.closest('.node');
      const clickedEdge = clickedEl?.closest('.edge');
      const wp = screenToWorld(clientX, clientY);

      let html = '';
      if (clickedNode) {
        const nodeId = clickedNode.id.replace('node-', '');
        const node = findNode(nodeId);
        html = '<div class="menu-item" id="ctx-edit-node">Edit Node</div>' +
          '<label class="menu-field"><span>Shape</span><select id="ctx-node-shape">' +
          ['rounded-rectangle', 'rectangle', 'circle', 'ellipse', 'diamond', 'triangle'].map(value => '<option' + (value === node?.shape ? ' selected' : '') + '>' + value + '</option>').join('') +
          '</select></label>' +
          '<label class="menu-field"><span>Color</span><select id="ctx-node-color">' +
          Object.keys(colors).map(value => '<option' + (value === node?.color ? ' selected' : '') + '>' + value + '</option>').join('') +
          '</select></label>' +
          '<div class="menu-item" id="ctx-del-node">Delete Node</div>' +
          '<div class="menu-divider"></div>';
      } else if (clickedEdge && clickedEdge.id.startsWith('edge-')) {
        const edgeId = clickedEdge.id.replace('edge-', '');
        const edge = findEdge(edgeId);
        html = '<label class="menu-field menu-field-column"><span>Label</span><input id="ctx-edge-label" value="' + esc(edge?.label || '') + '"></label>' +
          '<label class="menu-field"><span>Arrow</span><select id="ctx-edge-arrow">' +
          ['forward', 'backward', 'both', 'none'].map(value => '<option' + (value === edge?.arrow ? ' selected' : '') + '>' + value + '</option>').join('') + '</select></label>' +
          '<label class="menu-field"><span>Line</span><select id="ctx-edge-line">' +
          ['solid', 'dashed', 'dotted'].map(value => '<option' + (value === edge?.line ? ' selected' : '') + '>' + value + '</option>').join('') + '</select></label>' +
          '<div class="menu-item" id="ctx-del-edge">Delete Edge</div>' +
          '<div class="menu-divider"></div>';
      }

      html += '<div class="menu-item" id="ctx-add-node">Add Node Here</div>' +
        '<div class="menu-item" id="ctx-fit">Fit to Screen (F)</div>' +
        '<div class="menu-item" id="ctx-reset-zoom">Reset Zoom 100%</div>';

      contextMenu.innerHTML = html;
      contextMenu.style.display = 'block';
      const menuRect = contextMenu.getBoundingClientRect();
      contextMenu.style.left = Math.max(6, Math.min(window.innerWidth - menuRect.width - 6, clientX)) + 'px';
      contextMenu.style.top = Math.max(6, Math.min(window.innerHeight - menuRect.height - 6, clientY)) + 'px';

      const addBtn = document.querySelector('#ctx-add-node');
      if (addBtn) addBtn.onclick = () => { closeContextMenu(); vscode.postMessage({ type: 'addNode', x: wp.x, y: wp.y, shape: nodeShapeSelect.value, color: nodeColorSelect.value }); };
      const fitBtn = document.querySelector('#ctx-fit');
      if (fitBtn) fitBtn.onclick = () => { closeContextMenu(); fitToView(); };
      const rstBtn = document.querySelector('#ctx-reset-zoom');
      if (rstBtn) rstBtn.onclick = () => { closeContextMenu(); pan.zoom = 1; view(); scheduleSaveViewport(); };

      if (clickedNode) {
        const nodeId = clickedNode.id.replace('node-', '');
        const node = findNode(nodeId);
        const styleIds = [nodeId];
        const applyContextStyle = () => {
          const shape = document.querySelector('#ctx-node-shape').value;
          const color = document.querySelector('#ctx-node-color').value;
          graph.nodes.filter(item => styleIds.includes(item.id)).forEach(item => { item.shape = shape; item.color = color; });
          vscode.postMessage({ type: 'applyNodeStyle', ids: styleIds, shape, color });
          closeContextMenu();
          render();
        };
        document.querySelector('#ctx-edit-node').onclick = () => {
          closeContextMenu();
          selectedNodeIds.clear();
          selectedNodeIds.add(nodeId);
          highlightSelection();
          if (node) startInlineNodeEdit(node, clickedNode);
        };
        document.querySelector('#ctx-node-shape').onchange = applyContextStyle;
        document.querySelector('#ctx-node-color').onchange = applyContextStyle;
        document.querySelector('#ctx-del-node').onclick = () => { closeContextMenu(); vscode.postMessage({ type: 'deleteNode', id: nodeId }); };
      }
      if (clickedEdge && clickedEdge.id.startsWith('edge-')) {
        const edgeId = clickedEdge.id.replace('edge-', '');
        const edge = findEdge(edgeId);
        const updateEdgeFromContext = () => {
          if (!edge) return;
          edge.label = document.querySelector('#ctx-edge-label').value.trim();
          edge.arrow = document.querySelector('#ctx-edge-arrow').value;
          edge.line = document.querySelector('#ctx-edge-line').value;
          vscode.postMessage({ type: 'updateEdge', id: edge.id, label: edge.label, arrow: edge.arrow, line: edge.line });
          render();
        };
        document.querySelector('#ctx-edge-label').onchange = updateEdgeFromContext;
        document.querySelector('#ctx-edge-label').onkeydown = event => {
          if (event.key !== 'Enter') return;
          event.preventDefault();
          updateEdgeFromContext();
          closeContextMenu();
        };
        document.querySelector('#ctx-edge-arrow').onchange = updateEdgeFromContext;
        document.querySelector('#ctx-edge-line').onchange = updateEdgeFromContext;
        document.querySelector('#ctx-del-edge').onclick = () => { closeContextMenu(); vscode.postMessage({ type: 'deleteEdge', id: edgeId }); };
      }
    }

    function closeContextMenu() {
      contextMenu.style.display = 'none';
    }

    function setupKeyShortcuts() {
      window.onkeydown = e => {
        const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
        if (e.code === 'Space' && !isInput) spaceDown = true;
        if (isInput) return;

        if (e.key === 'Delete' || e.key === 'Backspace') {
          if (selectedNodeIds.size > 0) {
            selectedNodeIds.forEach(id => vscode.postMessage({ type: 'deleteNode', id }));
            selectedNodeIds.clear();
            render();
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
          vscode.postMessage({ type: 'addNode', x: center.x - 70, y: center.y - 30, shape: nodeShapeSelect.value, color: nodeColorSelect.value });
        } else if (e.key === '?' || e.key === 'F1') {
          shortcutsModal.classList.toggle('visible');
        } else if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) {
          e.preventDefault();
          searchBox.focus();
          searchBox.select();
        }
      };

      window.onkeyup = e => {
        if (e.code === 'Space') spaceDown = false;
      };
    }
  `;
}
