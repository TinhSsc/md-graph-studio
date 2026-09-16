export function getCanvasRenderingScript(): string {
  return `
    function updateEdgesForNodes(nodeIdSet) {
      for (const e of graph.edges) {
        if (!nodeIdSet.has(e.source) && !nodeIdSet.has(e.target)) continue;
        const geom = calculateEdgeGeometry(e);
        if (!geom) continue;
        const pathEl = document.querySelector('#edge-' + CSS.escape(e.id));
        if (pathEl) pathEl.setAttribute('d', geom.d);
        const labelEl = document.querySelector('#label-' + CSS.escape(e.id));
        if (labelEl) { labelEl.setAttribute('x', geom.mx); labelEl.setAttribute('y', geom.my); }
        const sourceHandle = document.querySelector('#endpoint-source-' + CSS.escape(e.id));
        const targetHandle = document.querySelector('#endpoint-target-' + CSS.escape(e.id));
        if (sourceHandle) { sourceHandle.setAttribute('cx', geom.p1.x); sourceHandle.setAttribute('cy', geom.p1.y); }
        if (targetHandle) { targetHandle.setAttribute('cx', geom.p2.x); targetHandle.setAttribute('cy', geom.p2.y); }
      }
      const selectedEdge = selectedEdgeId ? findEdge(selectedEdgeId) : null;
      const selectedGeometry = selectedEdge ? calculateEdgeGeometry(selectedEdge) : null;
      if (selectedEdge && selectedGeometry) refreshEdgeHandles(selectedEdge, selectedGeometry);
    }

    function renderEdge(e) {
      const geom = calculateEdgeGeometry(e);
      if (!geom) return;
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.id = 'edge-' + e.id;
      p.setAttribute('d', geom.d);
      p.setAttribute('class', 'edge ' + (e.line || 'solid') + (selectedEdgeId === e.id ? ' selected' : ''));
      if (e.arrow === 'forward' || e.arrow === 'both') p.setAttribute('marker-end', 'url(#arrow)');
      if (e.arrow === 'backward' || e.arrow === 'both') p.setAttribute('marker-start', 'url(#arrow-start)');
      p.onclick = x => { x.stopPropagation(); selectedNodeIds.clear(); selectedEdgeId = e.id; render(); editorRight.classList.remove('collapsed'); };
      edgesGroup.append(p);
      if (e.label) {
        const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        t.id = 'label-' + e.id; t.textContent = e.label;
        t.setAttribute('x', geom.mx); t.setAttribute('y', geom.my);
        t.setAttribute('text-anchor', 'middle'); t.setAttribute('dominant-baseline', 'middle'); t.setAttribute('class', 'label');
        t.onclick = x => { x.stopPropagation(); selectedNodeIds.clear(); selectedEdgeId = e.id; render(); editorRight.classList.remove('collapsed'); };
        edgesGroup.append(t);
      }
      renderEndpointHandle(e, 'source', geom.p1);
      renderEndpointHandle(e, 'target', geom.p2);
      renderEdgeSegmentHandles(e, geom.route);
    }

    function getNodeMinimumHeight(element) {
      const header = element.querySelector('.node-header');
      const content = element.querySelector('.node-content');
      const headerHeight = header ? header.offsetHeight : 36;
      const contentHeight = content ? content.scrollHeight : 0;
      return Math.max(38, Math.ceil(headerHeight + contentHeight + 2));
    }

    function renderNode(n) {
      const el = document.createElement('article');
      el.id = 'node-' + n.id;
      el.className = 'node ' + (n.shape || 'rounded-rectangle') + (n.ghost ? ' ghost' : '') + (selectedNodeIds.has(n.id) ? ' selected' : '');
      el.style.left = n.x + 'px'; el.style.top = n.y + 'px';
      if (n.resized || (n.width && n.width !== 240)) el.style.width = n.width + 'px';
      if (n.resized || (n.height && n.height !== 160)) el.style.height = n.height + 'px';
      el.style.setProperty('--node-color', colors[n.color] || n.color || '#7d8790');
      const renderedContent = renderMarkdownToHtml(n.content || '', n.id);
      el.innerHTML = '<div class="node-header"><div class="node-color-dot"></div><div class="node-title">' + esc(n.title) + '</div></div>' + (renderedContent ? '<div class="node-content">' + renderedContent + '</div>' : '') + ['top', 'right', 'bottom', 'left'].map(p => '<div class="port ' + p + '" data-port="' + p + '" title="Drag to connect"></div>').join('') + '<div class="resizer" title="Drag to resize"></div>';
      el.onpointerdown = e => {
        if (e.target.closest('.port') || e.target.closest('.resizer') || e.target.closest('.task-checkbox') || e.target.closest('.node-link') || e.button !== 0) return;
        e.stopPropagation();
        if (e.shiftKey) { if (selectedNodeIds.has(n.id)) selectedNodeIds.delete(n.id); else selectedNodeIds.add(n.id); }
        else if (!selectedNodeIds.has(n.id)) { selectedNodeIds.clear(); selectedNodeIds.add(n.id); }
        selectedEdgeId = null; highlightSelection();
        if (selectedNodeIds.size === 1) inspectNode(n.id); else inspectMulti();
        const p = screenToWorld(e.clientX, e.clientY);
        const items = [];
        selectedNodeIds.forEach(id => { const item = findNode(id); const itemEl = document.querySelector('#node-' + CSS.escape(id)); if (item) items.push({ id, node: item, el: itemEl, origX: item.x, origY: item.y }); });
        dragGroup = { startX: p.x, startY: p.y, items, moved: false }; isNodeDragging = true;
      };
      el.onclick = e => {
        const checkbox = e.target.closest('.task-checkbox');
        if (checkbox) {
          e.stopPropagation();
          const taskIdx = parseInt(checkbox.dataset.taskIndex, 10);
          vscode.postMessage({ type: 'toggleTask', id: n.id, task: taskIdx });
          return;
        }
        const link = e.target.closest('.node-link');
        if (link) {
          e.stopPropagation();
          e.preventDefault();
          const href = link.dataset.href || link.getAttribute('href');
          if (href) vscode.postMessage({ type: 'openLink', href });
          return;
        }
      };
      el.ondblclick = e => {
        if (e.target.closest('.task-checkbox') || e.target.closest('.node-link')) return;
        e.stopPropagation();
        selectedNodeIds.clear();
        selectedNodeIds.add(n.id);
        selectedEdgeId = null;
        highlightSelection();
        startInlineNodeEdit(n, el, e.target);
      };
      el.querySelector('.resizer').onpointerdown = re => { re.stopPropagation(); re.preventDefault(); resizing = { id: n.id, el, startX: re.clientX, startY: re.clientY, origW: el.offsetWidth, origH: el.offsetHeight }; };
      el.querySelectorAll('.port').forEach(port => {
        port.onpointerdown = pe => {
          pe.stopPropagation(); pe.preventDefault(); document.body.classList.add('connecting');
          const portRect = port.getBoundingClientRect();
          const start = screenToWorld(portRect.left + portRect.width / 2, portRect.top + portRect.height / 2);
          const pType = port.dataset.port;
          const sx = start.x;
          const sy = start.y;
          const sourceEndpoint = pType === 'top' ? { kind: 'node', nodeId: n.id, xRatio: 0.5, yRatio: 0 } : pType === 'right' ? { kind: 'node', nodeId: n.id, xRatio: 1, yRatio: 0.5 } : pType === 'bottom' ? { kind: 'node', nodeId: n.id, xRatio: 0.5, yRatio: 1 } : { kind: 'node', nodeId: n.id, xRatio: 0, yRatio: 0.5 };
          connecting = { sourceNodeId: n.id, sourceEndpoint, sourceDirection: pType, startX: sx, startY: sy, currentPointerPosition: start, currentRoute: [start] }; tempWire.style.display = 'block'; tempWire.setAttribute('d', 'M ' + sx + ' ' + sy);
        };
      });
      el.querySelectorAll('.node-img').forEach(img => {
        img.onload = () => {
          const minH = getNodeMinimumHeight(el);
          if (n.height < minH) {
            n.height = minH;
            el.style.height = minH + 'px';
            updateEdgesForNodes(new Set([n.id]));
          }
        };
      });
      nodes.append(el);
      const minimumHeight = getNodeMinimumHeight(el);
      if (n.height < minimumHeight) {
        n.height = minimumHeight;
        el.style.height = minimumHeight + 'px';
      }
    }

    function render() {
      document.body.classList.toggle('editing-edge', Boolean(selectedEdgeId));
      nodes.innerHTML = ''; edgesGroup.innerHTML = ''; edgeHandlesGroup.innerHTML = '';
      graph.nodes.forEach(renderNode); graph.edges.forEach(renderEdge); renderOutline(); view();
      if (selectedNodeIds.size === 1) inspectNode(Array.from(selectedNodeIds)[0]); else if (selectedNodeIds.size > 1) inspectMulti(); else if (selectedEdgeId) inspectEdge(selectedEdgeId); else inspectEmpty();
    }
  `;
}
