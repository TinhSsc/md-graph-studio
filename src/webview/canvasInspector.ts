/**
 * Inspector panel and outline list handlers for md-graph-studio webview.
 */
export function getCanvasInspectorScript(): string {
  return `
    function highlightSelection() {
      document.body.classList.toggle('editing-edge', Boolean(selectedEdgeId));
      document.querySelectorAll('.node.selected').forEach(el => el.classList.remove('selected'));
      document.querySelectorAll('.edge.selected').forEach(el => el.classList.remove('selected'));
      document.querySelectorAll('.outline-item.selected').forEach(el => el.classList.remove('selected'));

      selectedNodeIds.forEach(id => {
        const el = document.querySelector('#node-' + CSS.escape(id));
        if (el) el.classList.add('selected');
      });
      if (selectedEdgeId) {
        const el = document.querySelector('#edge-' + CSS.escape(selectedEdgeId));
        if (el) el.classList.add('selected');
      }
      renderOutlineSelection();
    }

    function renderOutline() {
      outlineList.innerHTML = '';
      graph.nodes.forEach(n => {
        const item = document.createElement('div');
        item.className = 'outline-item' + (selectedNodeIds.has(n.id) ? ' selected' : '');
        item.innerHTML = '<div class="outline-badge" style="background:' + (colors[n.color] || n.color || '#7d8790') + '"></div>' +
          '<span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(n.title) + '</span>';
        item.onclick = () => {
          selectedNodeIds.clear();
          selectedNodeIds.add(n.id);
          selectedEdgeId = null;
          highlightSelection();
          inspectNode(n.id);
          editorRight.classList.remove('collapsed');

          const r = canvas.getBoundingClientRect();
          const nodeEl = document.querySelector('#node-' + CSS.escape(n.id));
          const nw = nodeEl ? nodeEl.offsetWidth : 140;
          const nh = nodeEl ? nodeEl.offsetHeight : 50;
          pan.x = (r.width / 2) - (n.x + nw / 2) * pan.zoom;
          pan.y = (r.height / 2) - (n.y + nh / 2) * pan.zoom;
          view();
          scheduleSaveViewport();
        };
        outlineList.append(item);
      });
    }

    function renderOutlineSelection() {
      const items = outlineList.querySelectorAll('.outline-item');
      graph.nodes.forEach((n, idx) => {
        if (items[idx]) {
          if (selectedNodeIds.has(n.id)) items[idx].classList.add('selected');
          else items[idx].classList.remove('selected');
        }
      });
    }

    function inspectEmpty() {
      editorBody.innerHTML = '<p style="color:var(--muted);text-align:center;margin-top:30px;">Select a node or edge to view properties.</p>';
    }

    function inspectMulti() {
      editorBody.innerHTML = '<h3 style="margin-top:0;font-size:12px;">' + selectedNodeIds.size + ' Nodes Selected</h3>' +
        '<div class="actions"><button class="btn-danger" id="insp-del-multi">Delete All Selected</button></div>';
      const delBtn = document.querySelector('#insp-del-multi');
      if (delBtn) {
        delBtn.onclick = () => {
          selectedNodeIds.forEach(id => vscode.postMessage({ type: 'deleteNode', id }));
          selectedNodeIds.clear();
          render();
        };
      }
    }

    function inspectNode(id, focus) {
      const n = findNode(id);
      if (!n) { inspectEmpty(); return; }
      const cleanLines = (n.content || '').split(String.fromCharCode(10)).filter(function(l) {
        const t = l.trim();
        return t.indexOf('[[') === -1 && t.indexOf('<!--') === -1;
      });
      const cleanContent = cleanLines.join(String.fromCharCode(10)).trim();

      editorBody.innerHTML = '<div class="field"><label>Title</label><input id="inp-title" value="' + esc(n.title) + '"></div>' +
        '<div class="field"><label>Content (Markdown)</label><textarea id="inp-content">' + esc(cleanContent) + '</textarea></div>' +
        '<button id="insp-apply-style" class="btn-secondary">Apply toolbar style</button>' +
        '<div class="actions"><button class="btn-danger" id="insp-del">Delete</button><button class="btn-primary" id="insp-save">Save</button></div>';

      const save = (shape = n.shape, color = n.color) => {
        vscode.postMessage({
          type: 'updateNode',
          id: n.id,
          title: document.querySelector('#inp-title').value.trim(),
          shape,
          color,
          content: document.querySelector('#inp-content').value
        });
      };
      document.querySelector('#insp-save').onclick = () => save();
      document.querySelector('#insp-apply-style').onclick = () => save(nodeShapeSelect.value, nodeColorSelect.value);
      document.querySelector('#inp-content').onkeydown = e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') save(); };
      document.querySelector('#insp-del').onclick = () => {
        vscode.postMessage({ type: 'deleteNode', id: n.id });
        selectedNodeIds.delete(n.id);
        render();
      };
      if (focus) document.querySelector('#inp-content').focus();
    }

    function inspectEdge(id) {
      const e = findEdge(id);
      if (!e) { inspectEmpty(); return; }
      editorBody.innerHTML = '<div class="field"><label>Label</label><input id="inp-label" value="' + esc(e.label || '') + '"></div>' +
        '<div class="field"><label>Arrow</label><select id="inp-arrow">' +
        ['forward', 'backward', 'both', 'none'].map(x => '<option ' + (x === e.arrow ? 'selected' : '') + '>' + x + '</option>').join('') +
        '</select></div>' +
        '<div class="field"><label>Line Style</label><select id="inp-line">' +
        ['solid', 'dashed', 'dotted'].map(x => '<option ' + (x === e.line ? 'selected' : '') + '>' + x + '</option>').join('') +
        '</select></div>' +
        '<div class="actions"><button class="btn-danger" id="insp-del">Delete</button><button class="btn-primary" id="insp-save">Save</button></div>';

      document.querySelector('#insp-save').onclick = () => vscode.postMessage({
        type: 'updateEdge',
        id: e.id,
        label: document.querySelector('#inp-label').value.trim(),
        arrow: document.querySelector('#inp-arrow').value,
        line: document.querySelector('#inp-line').value
      });
      document.querySelector('#insp-del').onclick = () => {
        vscode.postMessage({ type: 'deleteEdge', id: e.id });
        selectedEdgeId = null;
        render();
      };
    }
  `;
}
