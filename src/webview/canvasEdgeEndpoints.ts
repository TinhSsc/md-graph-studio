export function getCanvasEdgeEndpointsScript(): string {
  return `
    function getNodeSize(node) {
      const element = document.querySelector('#node-' + CSS.escape(node.id));
      return { width: element ? element.offsetWidth : (node.width || 140), height: element ? element.offsetHeight : (node.height || 48) };
    }

    function resolveEndpoint(endpoint) {
      if (!endpoint) return null;
      if (endpoint.kind === 'free') return { x: endpoint.x, y: endpoint.y };
      const node = findNode(endpoint.nodeId);
      if (!node) return null;
      const size = getNodeSize(node);
      return { x: node.x + size.width * endpoint.xRatio, y: node.y + size.height * endpoint.yRatio };
    }

    function endpointForNode(point, node) {
      const size = getNodeSize(node);
      const localX = Math.max(0, Math.min(size.width, point.x - node.x));
      const localY = Math.max(0, Math.min(size.height, point.y - node.y));
      const sides = [localX, size.width - localX, localY, size.height - localY];
      const side = sides.indexOf(Math.min(...sides));
      let xRatio = side === 0 ? 0 : side === 1 ? 1 : localX / size.width;
      let yRatio = side === 2 ? 0 : side === 3 ? 1 : localY / size.height;
      if (side === 0 || side === 1) {
        if (Math.abs(yRatio - 0.5) < 0.22) yRatio = 0.5;
      } else {
        if (Math.abs(xRatio - 0.5) < 0.22) xRatio = 0.5;
      }
      return { kind: 'node', nodeId: node.id, xRatio, yRatio };
    }

    function endpointFromPoint(point, excludedNodeId) {
      const snapDistance = 18 / pan.zoom;
      for (let index = graph.nodes.length - 1; index >= 0; index -= 1) {
        const node = graph.nodes[index];
        if (node.id === excludedNodeId) continue;
        const size = getNodeSize(node);
        if (point.x < node.x - snapDistance || point.x > node.x + size.width + snapDistance || point.y < node.y - snapDistance || point.y > node.y + size.height + snapDistance) continue;
        return endpointForNode(point, node);
      }
      return { kind: 'free', x: Math.round(point.x), y: Math.round(point.y) };
    }

    function endpointFromClientPoint(clientX, clientY, excludedNodeId) {
      const point = screenToWorld(clientX, clientY);
      const topElement = document.elementFromPoint(clientX, clientY);
      const topPort = topElement?.closest('.port');
      if (topPort) {
        const topNode = topPort.closest('.node');
        const nodeId = topNode?.id?.replace('node-', '');
        if (nodeId && nodeId !== excludedNodeId) {
          const p = topPort.dataset.port;
          const xRatio = p === 'left' ? 0 : p === 'right' ? 1 : 0.5;
          const yRatio = p === 'top' ? 0 : p === 'bottom' ? 1 : 0.5;
          return { kind: 'node', nodeId, xRatio, yRatio };
        }
      }
      const topNodeElement = topElement?.closest('.node');
      if (topNodeElement) {
        const nodeId = topNodeElement.id.replace('node-', '');
        if (nodeId === excludedNodeId) return { kind: 'free', x: Math.round(point.x), y: Math.round(point.y) };
        const node = findNode(nodeId);
        if (node) return endpointForNode(point, node);
      }

      return endpointFromPoint(point, excludedNodeId);
    }

    function endpointForEdgeHandle(edge, key, clientX, clientY) {
      const ownerId = key === 'source' ? edge.source : edge.target;
      const owner = findNode(ownerId);
      if (!owner) return null;
      return endpointForNode(screenToWorld(clientX, clientY), owner);
    }

    function ensureEdgeEndpoints(edge, geometry) {
      if (edge.endpoints) return;
      const source = findNode(edge.source);
      const target = findNode(edge.target);
      if (!source || !target) return;
      const sourceSize = getNodeSize(source);
      const targetSize = getNodeSize(target);
      edge.endpoints = {
        source: { kind: 'node', nodeId: source.id, xRatio: (geometry.p1.x - source.x) / sourceSize.width, yRatio: (geometry.p1.y - source.y) / sourceSize.height },
        target: { kind: 'node', nodeId: target.id, xRatio: (geometry.p2.x - target.x) / targetSize.width, yRatio: (geometry.p2.y - target.y) / targetSize.height }
      };
    }

    function renderEndpointHandle(edge, key, point) {
      if (selectedEdgeId !== edge.id) return;
      const handle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      handle.id = 'endpoint-' + key + '-' + edge.id;
      handle.setAttribute('cx', point.x); handle.setAttribute('cy', point.y);
      handle.setAttribute('r', 7); handle.setAttribute('class', 'edge-endpoint');
      handle.onpointerdown = event => {
        event.stopPropagation(); event.preventDefault();
        ensureEdgeEndpoints(edge, calculateEdgeGeometry(edge));
        draggingEdgeEndpoint = { edge, key };
        document.body.classList.add('connecting');
      };
      edgeHandlesGroup.append(handle);
    }
  `;
}
