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

    function endpointFromPoint(point, excludedNodeId) {
      const snapDistance = 18 / pan.zoom;
      for (let index = graph.nodes.length - 1; index >= 0; index -= 1) {
        const node = graph.nodes[index];
        if (node.id === excludedNodeId) continue;
        const size = getNodeSize(node);
        if (point.x < node.x - snapDistance || point.x > node.x + size.width + snapDistance || point.y < node.y - snapDistance || point.y > node.y + size.height + snapDistance) continue;
        const localX = Math.max(0, Math.min(size.width, point.x - node.x));
        const localY = Math.max(0, Math.min(size.height, point.y - node.y));
        const sides = [localX, size.width - localX, localY, size.height - localY];
        const side = sides.indexOf(Math.min(...sides));
        const xRatio = side === 0 ? 0 : side === 1 ? 1 : localX / size.width;
        const yRatio = side === 2 ? 0 : side === 3 ? 1 : localY / size.height;
        return { kind: 'node', nodeId: node.id, xRatio, yRatio };
      }
      return { kind: 'free', x: Math.round(point.x), y: Math.round(point.y) };
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
