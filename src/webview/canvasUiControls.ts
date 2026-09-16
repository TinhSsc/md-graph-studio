export function getCanvasUiControlsScript(): string {
  return `
    function createToolbarSelect(id, title, values, selectedValue) {
      const select = document.createElement('select');
      select.id = id; select.className = 'toolbar-select'; select.title = title;
      select.innerHTML = values.map(value => '<option' + (value === selectedValue ? ' selected' : '') + '>' + value + '</option>').join('');
      return select;
    }
    const addNodeButton = document.querySelector('#add');
    const nodeShapeSelect = createToolbarSelect('node-shape', 'Shape for new nodes', ['rounded-rectangle', 'rectangle', 'circle', 'ellipse', 'diamond', 'triangle'], 'rounded-rectangle');
    const nodeColorSelect = createToolbarSelect('node-color', 'Color for new nodes', Object.keys(colors), 'blue');
    nodeColorSelect.classList.add('color-select');
    addNodeButton.after(nodeShapeSelect, nodeColorSelect);
    const sidebarLeft = document.querySelector('#sidebar-left');
    document.querySelector('#toggle-sidebar-left').onclick = () => sidebarLeft.classList.add('collapsed');
    document.querySelector('#expand-sidebar-left').onclick = () => sidebarLeft.classList.remove('collapsed');
    const toolbarTop = document.querySelector('#toolbar-top');
    document.querySelector('#toggle-toolbar-top').onclick = () => toolbarTop.classList.add('collapsed');
    document.querySelector('#expand-toolbar-top').onclick = () => toolbarTop.classList.remove('collapsed');
    document.querySelector('#toggle-editor-right').onclick = () => editorRight.classList.add('collapsed');
    addNodeButton.onclick = () => {
      const r = canvas.getBoundingClientRect();
      const center = screenToWorld(r.left + r.width / 2, r.top + r.height / 2);
      vscode.postMessage({ type: 'addNode', x: center.x - 70, y: center.y - 30, shape: nodeShapeSelect.value, color: nodeColorSelect.value });
    };
    document.querySelector('#fit').onclick = () => fitToView();
    zoomVal.onclick = () => { pan.zoom = 1; view(); scheduleSaveViewport(); };
    document.querySelector('#plus').onclick = () => { const r = canvas.getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1.18); };
    document.querySelector('#minus').onclick = () => { const r = canvas.getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, 0.82); };
    canvas.ondblclick = e => {
      if (e.target !== canvas && e.target !== world && e.target !== document.querySelector('#svg')) return;
      const p = screenToWorld(e.clientX, e.clientY);
      vscode.postMessage({ type: 'addNode', x: p.x - 70, y: p.y - 30, shape: nodeShapeSelect.value, color: nodeColorSelect.value });
    };
    searchBox.oninput = () => {
      const query = searchBox.value.trim().toLowerCase();
      document.querySelectorAll('.node.selected').forEach(el => el.classList.remove('selected'));
      if (!query) return;
      selectedNodeIds.clear();
      graph.nodes.filter(n => n.title.toLowerCase().includes(query) || n.content.toLowerCase().includes(query)).forEach(n => selectedNodeIds.add(n.id));
      highlightSelection();
    };
    searchBox.onkeydown = e => {
      if (e.key !== 'Enter') return;
      const query = searchBox.value.trim().toLowerCase();
      const match = graph.nodes.find(n => n.title.toLowerCase().includes(query) || n.content.toLowerCase().includes(query));
      if (!match) return;
      const r = canvas.getBoundingClientRect(); const nodeEl = document.querySelector('#node-' + CSS.escape(match.id));
      pan.x = (r.width / 2) - (match.x + (nodeEl ? nodeEl.offsetWidth : 140) / 2) * pan.zoom;
      pan.y = (r.height / 2) - (match.y + (nodeEl ? nodeEl.offsetHeight : 50) / 2) * pan.zoom;
      view(); selectedNodeIds.clear(); selectedNodeIds.add(match.id); highlightSelection(); inspectNode(match.id); editorRight.classList.remove('collapsed');
    };
    document.querySelector('#btn-shortcuts').onclick = () => shortcutsModal.classList.toggle('visible');
    document.querySelector('#btn-close-shortcuts').onclick = () => shortcutsModal.classList.remove('visible');
  `;
}
