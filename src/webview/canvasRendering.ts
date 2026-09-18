import { getNodeIconsScript, icons } from './canvasIcons';

export function getCanvasRenderingScript(): string {
  return `
    ${getNodeIconsScript()}
    var mgsChevronDown = '${icons.chevronDown}';
    var mgsChevronRight = '${icons.chevronRight}';

    function countHiddenContentLines(content) {
      if (!content || typeof content !== 'string') return 0;
      return content.split(String.fromCharCode(10)).filter(line => line.trim().length > 0).length;
    }

    function updateEdgesForNodes(nodeIdSet) {
      for (const e of graph.edges) {
        if (!nodeIdSet.has(e.source) && !nodeIdSet.has(e.target)) continue;
        const geom = calculateEdgeGeometry(e);
        if (!geom) continue;
        const pathEl = document.querySelector('#edge-' + CSS.escape(e.id));
        if (pathEl) pathEl.setAttribute('d', geom.d);
        const hitEl = document.querySelector('#edge-hit-' + CSS.escape(e.id));
        if (hitEl) hitEl.setAttribute('d', geom.d);
        const labelGroup = document.querySelector('#label-group-' + CSS.escape(e.id));
        if (labelGroup) {
          labelGroup.setAttribute('transform', 'translate(' + geom.mx + ',' + geom.my + ')');
        }
        const sourceHandle = document.querySelector('#endpoint-source-' + CSS.escape(e.id));
        const targetHandle = document.querySelector('#endpoint-target-' + CSS.escape(e.id));
        if (sourceHandle) { sourceHandle.setAttribute('cx', geom.p1.x); sourceHandle.setAttribute('cy', geom.p1.y); }
        if (targetHandle) { targetHandle.setAttribute('cx', geom.p2.x); targetHandle.setAttribute('cy', geom.p2.y); }
      }
      const selectedEdge = selectedEdgeId ? findEdge(selectedEdgeId) : null;
      const selectedGeometry = selectedEdge ? calculateEdgeGeometry(selectedEdge) : null;
      if (selectedEdge && selectedGeometry) refreshEdgeHandles(selectedEdge, selectedGeometry);
    }

    function selectEdgeLocally(edge) {
      selectedNodeIds.clear();
      selectedEdgeId = edge.id;
      highlightSelection();
      document.querySelectorAll('.edge-label-group.selected').forEach(el => el.classList.remove('selected'));
      const labelGroup = document.querySelector('#label-group-' + CSS.escape(edge.id));
      if (labelGroup) labelGroup.classList.add('selected');
      const geometry = calculateEdgeGeometry(edge);
      if (geometry) refreshEdgeHandles(edge, geometry);
      inspectEdge(edge.id);
      editorRight.classList.remove('collapsed');
    }

    // Single click selects the edge without re-rendering the canvas so the
    // follow-up dblclick still reaches the same DOM element.
    function wireEdgeEvents(target, edge, geom) {
      target.onclick = x => {
        x.stopPropagation();
        selectEdgeLocally(edge);
      };
      target.ondblclick = x => {
        x.stopPropagation();
        selectEdgeLocally(edge);
        startInlineEdgeLabelEdit(edge, calculateEdgeGeometry(edge) || geom);
      };
    }

    function renderEdge(e) {
      const geom = calculateEdgeGeometry(e);
      if (!geom) return;
      const hitPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      hitPath.id = 'edge-hit-' + e.id;
      hitPath.setAttribute('d', geom.d);
      hitPath.setAttribute('class', 'edge-hit');
      wireEdgeEvents(hitPath, e, geom);
      edgesGroup.append(hitPath);

      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.id = 'edge-' + e.id;
      p.setAttribute('d', geom.d);
      p.setAttribute('class', 'edge ' + (e.line || 'solid') + (selectedEdgeId === e.id ? ' selected' : ''));
      if (e.arrow === 'forward' || e.arrow === 'both') p.setAttribute('marker-end', 'url(#arrow)');
      if (e.arrow === 'backward' || e.arrow === 'both') p.setAttribute('marker-start', 'url(#arrow-start)');
      wireEdgeEvents(p, e, geom);
      edgesGroup.append(p);

      if (e.label) {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.id = 'label-group-' + e.id;
        g.setAttribute('class', 'edge-label-group' + (selectedEdgeId === e.id ? ' selected' : ''));
        g.setAttribute('transform', 'translate(' + geom.mx + ',' + geom.my + ')');

        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('class', 'edge-label-bg');
        rect.setAttribute('rx', '5');
        rect.setAttribute('ry', '5');

        const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        t.id = 'label-' + e.id;
        t.textContent = e.label;
        t.setAttribute('class', 'label edge-label-text');
        t.setAttribute('text-anchor', 'middle');
        t.setAttribute('dominant-baseline', 'central');

        const charWidth = 7.2;
        const boxWidth = Math.max(38, Math.round(e.label.length * charWidth + 18));
        const boxHeight = 22;
        rect.setAttribute('x', String(-boxWidth / 2));
        rect.setAttribute('y', String(-boxHeight / 2));
        rect.setAttribute('width', String(boxWidth));
        rect.setAttribute('height', String(boxHeight));

        g.append(rect);
        g.append(t);

        g.onclick = x => {
          x.stopPropagation();
          selectEdgeLocally(e);
        };
        g.ondblclick = x => {
          x.stopPropagation();
          startInlineEdgeLabelEdit(e, geom);
        };
        edgesGroup.append(g);
      }
      renderEndpointHandle(e, 'source', geom.p1);
      renderEndpointHandle(e, 'target', geom.p2);
      renderEdgeSegmentHandles(e, geom.route);
    }

    function getNodeMinimumHeight(element) {
      const header = element.querySelector('.node-header');
      const content = element.querySelector('.node-content');
      const hint = element.querySelector('.node-collapsed-hint');
      const headerHeight = header ? header.offsetHeight : 36;
      const hintHeight = hint ? hint.offsetHeight : 0;
      if (!content) return Math.max(38, Math.ceil(headerHeight + hintHeight + 2));
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
      el.className = 'node ' + (n.shape || 'rounded-rectangle') + (n.ghost ? ' ghost' : '') + (n.locked ? ' locked' : '') + (n.collapsed ? ' collapsed' : '') + (selectedNodeIds.has(n.id) ? ' selected' : '') + (manuallySized ? ' user-sized' : '');
      el.style.left = n.x + 'px'; el.style.top = n.y + 'px';
      if (typeof n.layer === 'number') el.style.zIndex = String(n.layer);
      if (typeof n.width === 'number' && n.width > 0) el.style.width = n.width + 'px';
      if (typeof n.height === 'number' && n.height > 0) el.style.height = n.height + 'px';
      el.style.setProperty('--node-color', colors[n.color] || n.color || '#7d8790');
      const renderedContent = n.collapsed ? '' : renderMarkdownToHtml(n.content || '', n.id);
      const iconName = n.icon && mgsNodeIcons[n.icon] ? n.icon : 'file-text';
      const nodeIconHtml = '<span class="node-icon" title="Icon: ' + esc(iconName) + '">' + (mgsNodeIcons[iconName] || '') + '</span>';
      const collapseToggleHtml = '<button class="node-collapse-toggle" data-collapse-toggle="' + esc(n.id) + '" title="Collapse/expand node" aria-label="Toggle node body">' + (n.collapsed ? mgsChevronRight : mgsChevronDown) + '</button>';
      const collapsedHint = n.collapsed ? '<div class="node-collapsed-hint">' + countHiddenContentLines(n.content) + ' lines hidden — click ⌄ to expand</div>' : '';
      el.innerHTML = '<div class="node-header">' + nodeIconHtml + '<div class="node-color-dot"></div><div class="node-title">' + esc(n.title) + '</div>' + collapseToggleHtml + '</div>' + (renderedContent ? '<div class="node-content">' + renderedContent + '</div>' : collapsedHint) + ['top', 'right', 'bottom', 'left'].map(p => '<div class="port ' + p + '" data-port="' + p + '" title="Drag to connect"></div>').join('') + '<div class="resizer" title="Drag to resize"></div>';
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
        const listDeleteBtn = e.target.closest('.list-delete-btn');
        if (listDeleteBtn) {
          e.stopPropagation();
          e.preventDefault();
          const listIndex = parseInt(listDeleteBtn.dataset.listIndex, 10);
          vscode.postMessage({ type: 'updateMarkdownBlock', id: n.id, blockKind: 'listItem', blockIndex: listIndex, text: '' });
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
        const collapseToggle = e.target.closest('.node-collapse-toggle');
        if (collapseToggle) {
          e.stopPropagation();
          e.preventDefault();
          const nodeId = collapseToggle.dataset.collapseToggle;
          if (nodeId) {
            const node = findNode(nodeId);
            const collapsed = node ? !node.collapsed : true;
            vscode.postMessage({ type: 'toggleNodeCollapsed', id: nodeId, collapsed: collapsed });
            if (node) {
              node.collapsed = collapsed;
              render();
            }
          }
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
        resizing = { id: n.id, el, startX: re.clientX, startY: re.clientY, origW: el.offsetWidth, origH: el.offsetHeight, pointerId: re.pointerId };
        try { if (re.target && re.target.setPointerCapture) re.target.setPointerCapture(re.pointerId); } catch {}
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
      const targetHeight = n.collapsed ? minimumHeight : (manuallySized ? Math.max(n.height || 160, minimumHeight) : Math.min(380, Math.max(n.height || 160, minimumHeight)));
      if (n.height !== targetHeight) {
        n.height = targetHeight;
        el.style.height = targetHeight + 'px';
      }
    }

    function render() {
      document.body.classList.toggle('editing-edge', Boolean(selectedEdgeId));
      nodes.innerHTML = ''; edgesGroup.innerHTML = ''; edgeHandlesGroup.innerHTML = '';
      graph.nodes.forEach(renderNode); graph.edges.forEach(renderEdge); view();
      if (selectedNodeIds.size === 1) inspectNode(Array.from(selectedNodeIds)[0]); else if (selectedNodeIds.size > 1) inspectMulti(); else if (selectedEdgeId) inspectEdge(selectedEdgeId); else inspectEmpty();
    }
  `;
}
