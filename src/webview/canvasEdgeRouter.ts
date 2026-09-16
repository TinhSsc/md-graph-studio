export function getCanvasEdgeRouterScript(): string {
  return `
    const routingDirectionVectors = {
      top: { x: 0, y: -1 }, right: { x: 1, y: 0 },
      bottom: { x: 0, y: 1 }, left: { x: -1, y: 0 }
    };

    function endpointDirection(endpoint) {
      if (!endpoint || endpoint.kind !== 'node') return null;
      const distances = [endpoint.yRatio, 1 - endpoint.xRatio, 1 - endpoint.yRatio, endpoint.xRatio];
      return ['top', 'right', 'bottom', 'left'][distances.indexOf(Math.min(...distances))];
    }

    function offsetRoutingPoint(point, direction, distance) {
      const vector = routingDirectionVectors[direction];
      return vector ? { x: point.x + vector.x * distance, y: point.y + vector.y * distance } : point;
    }

    function normalizeOrthogonalRoute(points) {
      const route = [];
      for (const point of points) {
        const next = { x: Math.round(point.x * 10) / 10, y: Math.round(point.y * 10) / 10 };
        const last = route[route.length - 1];
        if (!last || Math.hypot(next.x - last.x, next.y - last.y) > 0.5) route.push(next);
      }
      let changed = true;
      while (changed && route.length > 2) {
        changed = false;
        for (let index = 1; index < route.length - 1; index += 1) {
          const a = route[index - 1]; const b = route[index]; const c = route[index + 1];
          const sameVerticalDirection = a.x === b.x && b.x === c.x && (b.y - a.y) * (c.y - b.y) >= 0;
          const sameHorizontalDirection = a.y === b.y && b.y === c.y && (b.x - a.x) * (c.x - b.x) >= 0;
          if (sameVerticalDirection || sameHorizontalDirection) {
            route.splice(index, 1); changed = true; break;
          }
        }
      }
      return route;
    }

    function segmentHitsRoutingBox(a, b, box) {
      if (a.y === b.y) {
        return a.y > box.top && a.y < box.bottom && Math.max(a.x, b.x) > box.left && Math.min(a.x, b.x) < box.right;
      }
      if (a.x === b.x) {
        return a.x > box.left && a.x < box.right && Math.max(a.y, b.y) > box.top && Math.min(a.y, b.y) < box.bottom;
      }
      return true;
    }

    function segmentIsClear(a, b, obstacles) {
      return !obstacles.some(box => segmentHitsRoutingBox(a, b, box));
    }

    function routingStepMatches(a, b, direction) {
      const vector = routingDirectionVectors[direction];
      if (!vector) return false;
      return Math.sign(b.x - a.x) === vector.x && Math.sign(b.y - a.y) === vector.y;
    }

    function buildVisibilityRoute(start, end, obstacles, sourceDirection, targetDirection) {
      const xs = [start.x, end.x]; const ys = [start.y, end.y];
      obstacles.forEach(box => { xs.push(box.left, box.right); ys.push(box.top, box.bottom); });
      xs.push(Math.min(...xs) - 24, Math.max(...xs) + 24);
      ys.push(Math.min(...ys) - 24, Math.max(...ys) + 24);
      const uniqueX = [...new Set(xs)].sort((a, b) => a - b);
      const uniqueY = [...new Set(ys)].sort((a, b) => a - b);
      const points = []; const pointIndex = new Map();
      for (const y of uniqueY) for (const x of uniqueX) {
        if (obstacles.some(box => x > box.left && x < box.right && y > box.top && y < box.bottom)) continue;
        pointIndex.set(x + ':' + y, points.length); points.push({ x, y });
      }
      const links = points.map(() => []);
      const connectLine = (indexes, axis) => {
        indexes.sort((a, b) => points[a][axis] - points[b][axis]);
        for (let index = 1; index < indexes.length; index += 1) {
          const from = indexes[index - 1]; const to = indexes[index];
          if (!segmentIsClear(points[from], points[to], obstacles)) continue;
          const distance = Math.abs(points[to][axis] - points[from][axis]);
          const direction = axis === 'x' ? 'h' : 'v';
          links[from].push({ to, distance, direction }); links[to].push({ to: from, distance, direction });
        }
      };
      for (const y of uniqueY) connectLine(points.map((point, index) => point.y === y ? index : -1).filter(index => index >= 0), 'x');
      for (const x of uniqueX) connectLine(points.map((point, index) => point.x === x ? index : -1).filter(index => index >= 0), 'y');

      const startIndex = pointIndex.get(start.x + ':' + start.y);
      const endIndex = pointIndex.get(end.x + ':' + end.y);
      if (startIndex === undefined || endIndex === undefined) return [];
      const open = [];
      const pushOpen = item => {
        open.push(item);
        let index = open.length - 1;
        while (index > 0) {
          const parent = Math.floor((index - 1) / 2);
          if (open[parent].score <= item.score) break;
          open[index] = open[parent]; index = parent;
        }
        open[index] = item;
      };
      const popOpen = () => {
        const first = open[0]; const last = open.pop();
        if (!open.length) return first;
        open[0] = last;
        let index = 0;
        while (true) {
          const left = index * 2 + 1; const right = left + 1;
          if (left >= open.length) break;
          const child = right < open.length && open[right].score < open[left].score ? right : left;
          if (open[index].score <= open[child].score) break;
          [open[index], open[child]] = [open[child], open[index]]; index = child;
        }
        return first;
      };
      pushOpen({ point: startIndex, direction: '', cost: 0, score: Math.abs(end.x - start.x) + Math.abs(end.y - start.y), key: startIndex + ':' });
      const costs = new Map([[startIndex + ':', 0]]); const parents = new Map();
      let resultKey = null;
      while (open.length) {
        const current = popOpen();
        if (current.cost !== costs.get(current.key)) continue;
        if (current.point === endIndex) { resultKey = current.key; break; }
        for (const link of links[current.point]) {
          if (current.point === startIndex && routingStepMatches(points[current.point], points[link.to], sourceDirection === 'top' ? 'bottom' : sourceDirection === 'right' ? 'left' : sourceDirection === 'bottom' ? 'top' : 'right')) continue;
          if (link.to === endIndex && targetDirection && routingStepMatches(points[current.point], points[link.to], targetDirection)) continue;
          const bendCost = current.direction && current.direction !== link.direction ? 36 : 0;
          const shortSegmentCost = link.distance < 10 ? 28 : 0;
          const cost = current.cost + link.distance + bendCost + shortSegmentCost;
          const key = link.to + ':' + link.direction;
          if (cost >= (costs.get(key) ?? Infinity)) continue;
          costs.set(key, cost); parents.set(key, current.key);
          const point = points[link.to];
          pushOpen({ point: link.to, direction: link.direction, cost, score: cost + Math.abs(end.x - point.x) + Math.abs(end.y - point.y), key });
        }
      }
      if (!resultKey) return [];
      const route = [];
      while (resultKey) {
        route.push(points[Number(resultKey.split(':')[0])]);
        resultKey = parents.get(resultKey) || null;
      }
      return route.reverse();
    }

    function calculateOrthogonalRoute(source, target, obstacles) {
      const distance = Math.abs(target.point.x - source.point.x) + Math.abs(target.point.y - source.point.y);
      const lead = Math.min(32, Math.max(20, distance * 0.22));
      const sourceLead = offsetRoutingPoint(source.point, source.direction, lead);
      const targetLead = target.direction ? offsetRoutingPoint(target.point, target.direction, lead) : target.point;
      const preferredMiddle = source.direction === 'top' || source.direction === 'bottom'
        ? [sourceLead, { x: sourceLead.x, y: targetLead.y }, targetLead]
        : [sourceLead, { x: targetLead.x, y: sourceLead.y }, targetLead];
      const preferredRoute = normalizeOrthogonalRoute([source.point, ...preferredMiddle, target.point]);
      const preferredIsClear = preferredRoute.slice(1).every((point, index) => {
        const isFirst = index === 0; const isLast = index === preferredRoute.length - 2;
        const relevantObstacles = obstacles.filter(box => {
          const containsSource = source.point.x >= box.left && source.point.x <= box.right && source.point.y >= box.top && source.point.y <= box.bottom;
          const containsTarget = target.point.x >= box.left && target.point.x <= box.right && target.point.y >= box.top && target.point.y <= box.bottom;
          return !(isFirst && containsSource) && !(isLast && containsTarget);
        });
        return segmentIsClear(preferredRoute[index], point, relevantObstacles);
      });
      if (preferredIsClear) return preferredRoute;
      let middle = buildVisibilityRoute(sourceLead, targetLead, obstacles, source.direction, target.direction);
      if (!middle.length) {
        const horizontalFirst = [sourceLead, { x: targetLead.x, y: sourceLead.y }, targetLead];
        const verticalFirst = [sourceLead, { x: sourceLead.x, y: targetLead.y }, targetLead];
        const blocked = route => route.slice(1).reduce((count, point, index) => count + obstacles.filter(box => segmentHitsRoutingBox(route[index], point, box)).length, 0);
        middle = blocked(horizontalFirst) <= blocked(verticalFirst) ? horizontalFirst : verticalFirst;
      }
      return normalizeOrthogonalRoute([source.point, ...middle, target.point]);
    }

    function getConnectorObstacles(sourceId, targetId, sourcePoint, targetPoint) {
      const margin = 180;
      const center = { x: (sourcePoint.x + targetPoint.x) / 2, y: (sourcePoint.y + targetPoint.y) / 2 };
      const corridor = { left: Math.min(sourcePoint.x, targetPoint.x) - margin, right: Math.max(sourcePoint.x, targetPoint.x) + margin, top: Math.min(sourcePoint.y, targetPoint.y) - margin, bottom: Math.max(sourcePoint.y, targetPoint.y) + margin };
      return graph.nodes.map(node => {
        const size = getNodeSize(node); const padding = 18;
        return { id: node.id, left: node.x - padding, right: node.x + size.width + padding, top: node.y - padding, bottom: node.y + size.height + padding };
      }).filter(box => box.right >= corridor.left && box.left <= corridor.right && box.bottom >= corridor.top && box.top <= corridor.bottom)
        .sort((a, b) => {
          const aEndpoint = a.id === sourceId || a.id === targetId;
          const bEndpoint = b.id === sourceId || b.id === targetId;
          if (aEndpoint !== bEndpoint) return aEndpoint ? -1 : 1;
          const aDistance = Math.abs((a.left + a.right) / 2 - center.x) + Math.abs((a.top + a.bottom) / 2 - center.y);
          const bDistance = Math.abs((b.left + b.right) / 2 - center.x) + Math.abs((b.top + b.bottom) / 2 - center.y);
          return aDistance - bDistance;
        }).slice(0, 20);
    }

    function calculateConnectorRoute(sourcePoint, sourceDirection, targetPoint, targetDirection, sourceId, targetId, guide) {
      const obstacles = getConnectorObstacles(sourceId, targetId, sourcePoint, targetPoint);
      const source = { point: sourcePoint, direction: sourceDirection };
      const target = { point: targetPoint, direction: targetDirection };
      return guide ? calculateGuidedOrthogonalRoute(source, target, guide) : calculateOrthogonalRoute(source, target, obstacles);
    }

    function roundedOrthogonalPath(points, borderRadius = 16) {
      if (!points.length) return '';
      let path = 'M ' + points[0].x + ' ' + points[0].y;
      for (let index = 1; index < points.length - 1; index += 1) {
        const previous = points[index - 1]; const corner = points[index]; const next = points[index + 1];
        const incoming = Math.hypot(corner.x - previous.x, corner.y - previous.y);
        const outgoing = Math.hypot(next.x - corner.x, next.y - corner.y);
        const radius = Math.min(borderRadius, incoming * 0.45, outgoing * 0.45);
        const enter = { x: corner.x + (previous.x - corner.x) * radius / incoming, y: corner.y + (previous.y - corner.y) * radius / incoming };
        const exit = { x: corner.x + (next.x - corner.x) * radius / outgoing, y: corner.y + (next.y - corner.y) * radius / outgoing };
        path += ' L ' + enter.x + ' ' + enter.y + ' Q ' + corner.x + ' ' + corner.y + ' ' + exit.x + ' ' + exit.y;
      }
      const end = points[points.length - 1];
      return path + ' L ' + end.x + ' ' + end.y;
    }
  `;
}
