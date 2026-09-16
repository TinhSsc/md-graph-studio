import { getCanvasGeometryScript } from './canvasGeometry';
import { getCanvasEdgeEndpointsScript } from './canvasEdgeEndpoints';
import { getCanvasEdgeRouterScript } from './canvasEdgeRouter';
import { getCanvasEdgeSegmentsScript } from './canvasEdgeSegments';
import { getCanvasInspectorScript } from './canvasInspector';
import { getCanvasNodeEditingScript } from './canvasNodeEditing';
import { getCanvasInteractionsScript } from './canvasInteractions';
import { getCanvasRenderingScript } from './canvasRendering';
import { getCanvasUiControlsScript } from './canvasUiControls';

export function getCanvasScript(data: string): string {
  return `
  (function() {
    const vscode = acquireVsCodeApi();
    const initialGraph = ${data};
    const colors = { gray: '#7d8790', blue: '#4a98e5', green: '#45b87e', yellow: '#d2a32a', red: '#d05e6a', purple: '#9a79d3' };
    const rawPost = vscode.postMessage.bind(vscode);
    let editSequence = 0;
    vscode.postMessage = message => rawPost({ ...message, editId: 'canvas-' + ++editSequence });

    let graph = initialGraph;
    const canvas = document.querySelector('#canvas');
    const world = document.querySelector('#world');
    const edgesGroup = document.querySelector('#edges-group');
    const edgeHandlesGroup = document.querySelector('#edge-handles-group');
    const tempWire = document.querySelector('#temp-wire');
    const nodes = document.querySelector('#nodes');
    const marquee = document.querySelector('#selection-marquee');
    const editorBody = document.querySelector('#editor-body');
    const editorRight = document.querySelector('#editor-right');
    const outlineList = document.querySelector('#outline-list');
    const zoomVal = document.querySelector('#zoom-val');
    const searchBox = document.querySelector('#search-box');
    const contextMenu = document.querySelector('#context-menu');
    const shortcutsModal = document.querySelector('#shortcuts-modal');

    const selectedNodeIds = new Set();
    let selectedEdgeId = null;

    let isPanning = false;
    let panStart = { x: 0, y: 0, panX: 0, panY: 0 };
    let spaceDown = false;

    let isMarquee = false;
    let marqueeStart = { x: 0, y: 0 };

    let dragGroup = null;
    let isNodeDragging = false;
    let rafNodeMovePending = false;
    let pendingNodeDragPoint = null;

    let resizing = null;
    let connecting = null;
    let pendingConnectionPointer = null;
    let connectionPreviewFrame = 0;
    let draggingEdgeEndpoint = null;
    let draggingEdgeSegment = null;
    let activeNodeEditor = null;
    let saveViewportTimer = null;

    let pan = {
      x: graph.meta?.viewport?.x ?? 40,
      y: graph.meta?.viewport?.y ?? 40,
      zoom: graph.meta?.viewport?.zoom ?? 1
    };

    const esc = v => String(v).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
    const findNode = id => graph.nodes.find(n => n.id === id);
    const findEdge = id => graph.edges.find(e => e.id === id);

    function view() {
      world.style.transform = 'translate(' + pan.x + 'px, ' + pan.y + 'px) scale(' + pan.zoom + ')';
      const size = Math.max(8, Math.round(24 * pan.zoom));
      canvas.style.backgroundPosition = (pan.x % size) + 'px ' + (pan.y % size) + 'px';
      canvas.style.backgroundSize = size + 'px ' + size + 'px';
      zoomVal.textContent = Math.round(pan.zoom * 100) + '%';
    }

    function scheduleSaveViewport() {
      clearTimeout(saveViewportTimer);
      saveViewportTimer = setTimeout(() => {
        vscode.postMessage({
          type: 'saveViewport',
          viewport: { x: Math.round(pan.x), y: Math.round(pan.y), zoom: Math.round(pan.zoom * 100) / 100 }
        });
      }, 600);
    }

    ${getCanvasEdgeEndpointsScript()}
    ${getCanvasEdgeRouterScript()}
    ${getCanvasEdgeSegmentsScript()}
    ${getCanvasGeometryScript()}
    ${getCanvasInspectorScript()}
    ${getCanvasNodeEditingScript()}
    ${getCanvasInteractionsScript()}
    ${getCanvasRenderingScript()}

    function applyNodeDragPosition(point) {
      if (!dragGroup || !point) return;
      const dx = point.x - dragGroup.startX;
      const dy = point.y - dragGroup.startY;
      const movedSet = new Set();
      for (const item of dragGroup.items) {
        item.node.x = Math.round(item.origX + dx);
        item.node.y = Math.round(item.origY + dy);
        if (item.el) {
          item.el.style.left = item.node.x + 'px';
          item.el.style.top = item.node.y + 'px';
        }
        movedSet.add(item.id);
      }
      updateEdgesForNodes(movedSet);
    }

    function findConnectionTarget(clientX, clientY) {
      const directTarget = document.elementFromPoint(clientX, clientY)?.closest('.node');
      if (directTarget && directTarget.id !== 'node-' + connecting.sourceNodeId) return directTarget;
      const point = screenToWorld(clientX, clientY);
      const endpoint = endpointFromPoint(point, connecting.sourceNodeId);
      return endpoint.kind === 'node' ? document.querySelector('#node-' + CSS.escape(endpoint.nodeId)) : null;
    }

    function computeConnectionRoute(clientX, clientY) {
      const pointer = screenToWorld(clientX, clientY);
      const targetElement = findConnectionTarget(clientX, clientY);
      const targetEndpoint = endpointFromPoint(pointer, connecting.sourceNodeId);
      const targetPoint = resolveEndpoint(targetEndpoint) || pointer;
      const targetId = targetElement ? targetElement.id.replace('node-', '') : (targetEndpoint.kind === 'node' ? targetEndpoint.nodeId : null);
      const route = calculateConnectorRoute(
        { x: connecting.startX, y: connecting.startY },
        connecting.sourceDirection,
        targetPoint,
        endpointDirection(targetEndpoint),
        connecting.sourceNodeId,
        targetId
      );
      return { pointer, targetElement, targetEndpoint, targetId, route };
    }

    function updateConnectionPreview(clientX, clientY) {
      if (!connecting) return;
      const result = computeConnectionRoute(clientX, clientY);
      connecting.currentPointerPosition = result.pointer;
      connecting.currentRoute = result.route;
      tempWire.setAttribute('d', roundedOrthogonalPath(result.route));
      document.querySelectorAll('.node.drop-target').forEach(element => element.classList.remove('drop-target'));
      if (result.targetElement && result.targetId !== connecting.sourceNodeId) result.targetElement.classList.add('drop-target');
      connecting.targetNodeId = result.targetId;
    }

    canvas.onpointerdown = e => {
      closeContextMenu();
      if (e.target.closest('#shortcuts-modal') || e.target.closest('#editor-right')) return;

      if (e.button === 1 || (e.button === 0 && spaceDown)) {
        isPanning = true;
        panStart = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
        canvas.classList.add('panning');
        e.preventDefault();
        return;
      }

      if (e.button === 0 && !e.target.closest('.node')) {
        if (!e.shiftKey) {
          selectedNodeIds.clear();
          selectedEdgeId = null;
          highlightSelection();
          inspectEmpty();
        }
        isMarquee = true;
        marqueeStart = { x: e.clientX, y: e.clientY };
        const canvasRect = canvas.getBoundingClientRect();
        marquee.style.left = (e.clientX - canvasRect.left) + 'px';
        marquee.style.top = (e.clientY - canvasRect.top) + 'px';
        marquee.style.width = '0px';
        marquee.style.height = '0px';
        marquee.style.display = 'block';
      }
    };

    window.addEventListener('pointermove', e => {
      if (draggingEdgeSegment) {
        const point = screenToWorld(e.clientX, e.clientY);
        const edge = draggingEdgeSegment.edge;
        edge.endpoints.guide = { axis: draggingEdgeSegment.axis, value: draggingEdgeSegment.axis === 'x' ? point.x : point.y };
        const geometry = calculateEdgeGeometry(edge);
        const pathElement = document.querySelector('#edge-' + CSS.escape(edge.id));
        if (pathElement) pathElement.setAttribute('d', geometry.d);
        refreshEdgeHandles(edge, geometry);
        return;
      }
      if (draggingEdgeEndpoint) {
        const edge = draggingEdgeEndpoint.edge;
        const endpoint = endpointFromPoint(screenToWorld(e.clientX, e.clientY));
        edge.endpoints[draggingEdgeEndpoint.key] = endpoint;
        document.querySelectorAll('.node.drop-target').forEach(el => el.classList.remove('drop-target'));
        if (endpoint.kind === 'node') document.querySelector('#node-' + CSS.escape(endpoint.nodeId))?.classList.add('drop-target');
        updateEdgesForNodes(new Set([edge.source, edge.target]));
        return;
      }
      if (isPanning) {
        pan.x = panStart.panX + (e.clientX - panStart.x);
        pan.y = panStart.panY + (e.clientY - panStart.y);
        view();
        return;
      }

      if (resizing) {
        const dw = (e.clientX - resizing.startX) / pan.zoom;
        const dh = (e.clientY - resizing.startY) / pan.zoom;
        const node = findNode(resizing.id);
        if (node) {
          node.width = Math.max(110, Math.round(resizing.origW + dw));
          node.resized = true;
          resizing.el.style.width = node.width + 'px';
          const minimumHeight = getNodeMinimumHeight(resizing.el);
          node.height = Math.max(minimumHeight, Math.round(resizing.origH + dh));
          resizing.el.style.height = node.height + 'px';
          updateEdgesForNodes(new Set([node.id]));
        }
        return;
      }

      if (isMarquee) {
        const canvasRect = canvas.getBoundingClientRect();
        const x1 = Math.min(marqueeStart.x, e.clientX);
        const y1 = Math.min(marqueeStart.y, e.clientY);
        const x2 = Math.max(marqueeStart.x, e.clientX);
        const y2 = Math.max(marqueeStart.y, e.clientY);

        marquee.style.left = (x1 - canvasRect.left) + 'px';
        marquee.style.top = (y1 - canvasRect.top) + 'px';
        marquee.style.width = (x2 - x1) + 'px';
        marquee.style.height = (y2 - y1) + 'px';

        const marqueeRect = { left: x1, top: y1, right: x2, bottom: y2 };
        document.querySelectorAll('.node').forEach(nodeEl => {
          const nr = nodeEl.getBoundingClientRect();
          const intersects = !(nr.right < marqueeRect.left || nr.left > marqueeRect.right || nr.bottom < marqueeRect.top || nr.top > marqueeRect.bottom);
          const nodeId = nodeEl.id.replace('node-', '');
          if (intersects) selectedNodeIds.add(nodeId);
          else if (!e.shiftKey) selectedNodeIds.delete(nodeId);
        });
        highlightSelection();
        return;
      }

      if (isNodeDragging && dragGroup) {
        dragGroup.moved = true;
        pendingNodeDragPoint = screenToWorld(e.clientX, e.clientY);

        if (!rafNodeMovePending) {
          rafNodeMovePending = true;
          requestAnimationFrame(() => {
            rafNodeMovePending = false;
            const point = pendingNodeDragPoint;
            pendingNodeDragPoint = null;
            applyNodeDragPosition(point);
          });
        }
        return;
      }

      if (connecting) {
        pendingConnectionPointer = { clientX: e.clientX, clientY: e.clientY };
        if (!connectionPreviewFrame) connectionPreviewFrame = requestAnimationFrame(() => {
          connectionPreviewFrame = 0;
          const current = pendingConnectionPointer;
          pendingConnectionPointer = null;
          if (current) updateConnectionPreview(current.clientX, current.clientY);
        });
      }
    });

    window.addEventListener('pointerup', e => {
      if (draggingEdgeSegment) {
        const edge = draggingEdgeSegment.edge;
        const geometry = calculateEdgeGeometry(edge);
        const guide = normalizedEdgeGuide(edge, geometry);
        if (guide) edge.endpoints.guide = guide; else delete edge.endpoints.guide;
        const normalizedGeometry = calculateEdgeGeometry(edge);
        const pathElement = document.querySelector('#edge-' + CSS.escape(edge.id));
        if (pathElement) pathElement.setAttribute('d', normalizedGeometry.d);
        refreshEdgeHandles(edge, normalizedGeometry);
        vscode.postMessage({ type: 'saveEdgeLayout', id: edge.id, endpoints: edge.endpoints });
        draggingEdgeSegment = null;
        document.body.classList.remove('adjusting-edge');
      }
      if (draggingEdgeEndpoint) {
        const edge = draggingEdgeEndpoint.edge;
        edge.endpoints[draggingEdgeEndpoint.key] = endpointFromPoint(screenToWorld(e.clientX, e.clientY));
        vscode.postMessage({ type: 'saveEdgeLayout', id: edge.id, endpoints: edge.endpoints });
        draggingEdgeEndpoint = null;
        document.body.classList.remove('connecting');
        document.querySelectorAll('.node.drop-target').forEach(el => el.classList.remove('drop-target'));
      }
      if (isPanning) {
        isPanning = false;
        canvas.classList.remove('panning');
        scheduleSaveViewport();
      }

      if (resizing) {
        vscode.postMessage({
          type: 'saveLayout',
          nodes: graph.nodes.map(n => ({ id: n.id, x: n.x, y: n.y, width: n.width, height: n.height })),
          viewport: pan
        });
        resizing = null;
      }

      if (isMarquee) {
        isMarquee = false;
        marquee.style.display = 'none';
        if (selectedNodeIds.size === 1) {
          inspectNode(Array.from(selectedNodeIds)[0]);
          editorRight.classList.remove('collapsed');
        } else if (selectedNodeIds.size > 1) {
          inspectMulti();
          editorRight.classList.remove('collapsed');
        }
      }

      if (isNodeDragging && dragGroup) {
        if (pendingNodeDragPoint) {
          applyNodeDragPosition(pendingNodeDragPoint);
          pendingNodeDragPoint = null;
        }
        if (dragGroup.moved) {
          vscode.postMessage({
            type: 'saveLayout',
            nodes: graph.nodes.map(n => ({ id: n.id, x: n.x, y: n.y, width: n.width, height: n.height })),
            viewport: pan
          });
        }
        dragGroup = null;
        isNodeDragging = false;
      }

      if (connecting) {
        if (connectionPreviewFrame) cancelAnimationFrame(connectionPreviewFrame);
        connectionPreviewFrame = 0;
        pendingConnectionPointer = null;
        document.body.classList.remove('connecting');
        tempWire.style.display = 'none';
        document.querySelectorAll('.node.drop-target').forEach(el => el.classList.remove('drop-target'));

        const result = computeConnectionRoute(e.clientX, e.clientY);
        if (result.targetId && result.targetId !== connecting.sourceNodeId) {
          const endpoints = { source: connecting.sourceEndpoint, target: result.targetEndpoint };
          vscode.postMessage({ type: 'addEdge', source: connecting.sourceNodeId, target: result.targetId, path: 'orthogonal', endpoints });
        }
        connecting = null;
      }
    });

    canvas.onwheel = e => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.12 : 0.88;
      zoomAt(e.clientX, e.clientY, factor);
    };

    canvas.oncontextmenu = e => {
      e.preventDefault();
      showContextMenu(e.clientX, e.clientY);
    };

    ${getCanvasUiControlsScript()}

    setupKeyShortcuts();
    window.addEventListener('dragstart', e => e.preventDefault());

    window.addEventListener('message', event => {
      if (event.data?.type !== 'graph') return;
      if (isNodeDragging || resizing || connecting || draggingEdgeEndpoint || draggingEdgeSegment || activeNodeEditor) return;
      graph = event.data.graph;
      render();
    });

    render();

    if (!graph.meta?.viewport || (graph.meta.viewport.x === 0 && graph.meta.viewport.y === 0 && graph.meta.viewport.zoom === 1)) {
      setTimeout(() => fitToView(), 35);
    } else {
      pan = { ...graph.meta.viewport };
      view();
    }

    vscode.postMessage({ type: 'ready' });
  })();
  `;
}
