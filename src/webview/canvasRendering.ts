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
      if (!content) return Math.max(38, Math.ceil(headerHeight + 2));
      const previous = {
        flex: content.style.flex,
        height: content.style.height,
        minHeight: content.style.minHeight,
        maxHeight: content.style.maxHeight
      };
      content.style.flex = 'none';
      content.style.height = '0px';
      content.style.minHeight = '0px';
      content.style.maxHeight = 'none';
      const contentHeight = content.scrollHeight;
      content.style.flex = previous.flex;
      content.style.height = previous.height;
      content.style.minHeight = previous.minHeight;
      content.style.maxHeight = previous.maxHeight;
      return Math.max(38, Math.ceil(headerHeight + contentHeight + 2));
    }

    function renderNode(n) {
      const savedNodeMeta = graph.meta?.nodes?.[n.id];
      const manuallySized = Boolean(n.resized || savedNodeMeta?.width !== undefined || savedNodeMeta?.height !== undefined);
      const el = document.createElement('article');
      el.id = 'node-' + n.id;
      el.className = 'node ' + (n.shape || 'rounded-rectangle') + (n.ghost ? ' ghost' : '') + (selectedNodeIds.has(n.id) ? ' selected' : '') + (manuallySized ? ' user-sized' : '');
      el.style.left = n.x + 'px'; el.style.top = n.y + 'px';
      if (typeof n.layer === 'number') el.style.zIndex = String(n.layer);
      if (n.resized || (n.width && n.width !== 240)) el.style.width = n.width + 'px';
      if (n.resized || (n.height && n.height !== 160)) el.style.height = n.height + 'px';
      el.style.setProperty('--node-color', colors[n.color] || n.color || '#7d8790');
      const renderedContent = renderMarkdownToHtml(n.content || '', n.id);
      el.innerHTML = '<div class="node-header"><div class="node-color-dot"></div><div class="node-title">' + esc(n.title) + '</div></div>' + (renderedContent ? '<div class="node-content">' + renderedContent + '</div>' : '') + ['top', 'right', 'bottom', 'left'].map(p => '<div class="port ' + p + '" data-port="' + p + '" title="Drag to connect"></div>').join('') + '<div class="resizer" title="Drag to resize"></div>';
      el.onpointerdown = e => {
        const intent = resolvePointerIntent(e, spaceDown);
        if (intent !== 'NODE_BODY') return;
        closeContextMenu();
        e.stopPropagation();

        const p = screenToWorld(e.clientX, e.clientY);
        nodeDragCandidate = {
          startX: e.clientX,
          startY: e.clientY,
          worldStart: p,
          nodeId: n.id,
          node: n,
          el,
          shiftKey: e.shiftKey,
          alreadySelected: selectedNodeIds.has(n.id),
          moved: false
        };
      };
      el.onclick = e => {
        const checkbox = e.target.closest('.task-checkbox');
        if (checkbox) {
          e.stopPropagation();
          const taskIdx = parseInt(checkbox.dataset.taskIndex, 10);
          vscode.postMessage({ type: 'toggleTask', id: n.id, task: taskIdx });
          return;
        }
        const deleteBtn = e.target.closest('.task-delete-btn');
        if (deleteBtn) {
          e.stopPropagation();
          e.preventDefault();
          const taskIdx = parseInt(deleteBtn.dataset.taskIndex, 10);
          vscode.postMessage({ type: 'deleteTask', id: n.id, taskIndex: taskIdx });
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
        if (isInteractiveControl(e.target)) return;
        e.stopPropagation();
        selectedNodeIds.clear();
        selectedNodeIds.add(n.id);
        selectedEdgeId = null;
        highlightSelection();
        startInlineNodeEdit(n, el, e.target);
      };
      el.querySelector('.resizer').onpointerdown = re => {
        re.stopPropagation();
        re.preventDefault();
        n.resized = true;
        el.classList.add('user-sized');
        resizing = { id: n.id, el, startX: re.clientX, startY: re.clientY, origW: el.offsetWidth, origH: el.offsetHeight };
      };
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
          const targetH = manuallySized ? Math.max(n.height || 160, minH) : Math.min(380, Math.max(n.height || 160, minH));
          if (n.height < targetH) {
            n.height = targetH;
            el.style.height = targetH + 'px';
            updateEdgesForNodes(new Set([n.id]));
          }
        };
      });
      nodes.append(el);
      const minimumHeight = getNodeMinimumHeight(el);
      const targetHeight = manuallySized ? Math.max(n.height || 160, minimumHeight) : Math.min(380, Math.max(n.height || 160, minimumHeight));
      if (n.height !== targetHeight) {
        n.height = targetHeight;
        el.style.height = targetHeight + 'px';
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
