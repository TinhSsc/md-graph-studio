export function getCanvasEdgeSegmentsScript(): string {
  return `
    function calculateGuidedOrthogonalRoute(source, target, guide) {
      const distance = Math.abs(target.point.x - source.point.x) + Math.abs(target.point.y - source.point.y);
      const lead = Math.min(32, Math.max(20, distance * 0.22));
      const sourceLead = offsetRoutingPoint(source.point, source.direction, lead);
      const targetLead = target.direction ? offsetRoutingPoint(target.point, target.direction, lead) : target.point;
      const middle = guide.axis === 'y'
        ? [{ x: sourceLead.x, y: guide.value }, { x: targetLead.x, y: guide.value }]
        : [{ x: guide.value, y: sourceLead.y }, { x: guide.value, y: targetLead.y }];
      return normalizeOrthogonalRoute([source.point, sourceLead, ...middle, targetLead, target.point]);
    }

    function normalizedEdgeGuide(edge, geometry) {
      const guide = edge.endpoints?.guide;
      if (!guide) return null;
      const sourceDistance = guide.axis === 'x' ? Math.abs(guide.value - geometry.p1.x) : Math.abs(guide.value - geometry.p1.y);
      const targetDistance = guide.axis === 'x' ? Math.abs(guide.value - geometry.p2.x) : Math.abs(guide.value - geometry.p2.y);
      return Math.min(sourceDistance, targetDistance) < 14 ? null : guide;
    }

    function refreshEdgeHandles(edge, geometry) {
      edgeHandlesGroup.innerHTML = '';
      renderEndpointHandle(edge, 'source', geometry.p1);
      renderEndpointHandle(edge, 'target', geometry.p2);
      renderEdgeSegmentHandles(edge, geometry.route);
    }

    function renderEdgeSegmentHandles(edge, route) {
      if (selectedEdgeId !== edge.id || route.length < 2) return;
      route.slice(1).forEach((point, index) => {
        const start = route[index];
        const length = Math.hypot(point.x - start.x, point.y - start.y);
        if (length < 28) return;
        const horizontal = start.y === point.y;
        const inset = Math.min(10, length * 0.2);
        const unit = { x: (point.x - start.x) / length, y: (point.y - start.y) / length };
        const handle = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        handle.setAttribute('x1', start.x + unit.x * inset); handle.setAttribute('y1', start.y + unit.y * inset);
        handle.setAttribute('x2', point.x - unit.x * inset); handle.setAttribute('y2', point.y - unit.y * inset);
        handle.setAttribute('class', 'edge-segment-handle ' + (horizontal ? 'horizontal' : 'vertical'));
        handle.onpointerdown = event => {
          event.stopPropagation(); event.preventDefault();
          ensureEdgeEndpoints(edge, calculateEdgeGeometry(edge));
          draggingEdgeSegment = { edge, axis: horizontal ? 'y' : 'x' };
          document.body.classList.add('adjusting-edge');
        };
        edgeHandlesGroup.append(handle);
      });
    }
  `;
}
