export function getCanvasExportScript(): string {
  return `
    function exportGraphPng() {
      if (!graph.nodes.length) {
        showToast('Add a node before exporting.');
        return;
      }
      const padding = 48;
      const minX = Math.min(...graph.nodes.map(node => node.x));
      const minY = Math.min(...graph.nodes.map(node => node.y));
      const maxX = Math.max(...graph.nodes.map(node => node.x + (node.width || 240)));
      const maxY = Math.max(...graph.nodes.map(node => node.y + (node.height || 160)));
      const width = Math.ceil(maxX - minX + padding * 2);
      const height = Math.ceil(maxY - minY + padding * 2);
      const scale = Math.min(2, 8192 / Math.max(width, height));
      const output = document.createElement('canvas');
      output.width = Math.max(1, Math.round(width * scale));
      output.height = Math.max(1, Math.round(height * scale));
      const ctx = output.getContext('2d');
      if (!ctx) return;
      ctx.scale(scale, scale);
      ctx.fillStyle = '#11151b';
      ctx.fillRect(0, 0, width, height);
      ctx.translate(padding - minX, padding - minY);
      drawExportEdges(ctx);
      graph.nodes.forEach(node => drawExportNode(ctx, node));
      vscode.postMessage({ type: 'exportPng', dataUrl: output.toDataURL('image/png') });
    }

    function drawExportEdges(ctx) {
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#6e7681';
      ctx.fillStyle = '#9aa4b2';
      graph.edges.forEach(edge => {
        const source = findNode(edge.source);
        const target = findNode(edge.target);
        if (!source || !target) return;
        const start = { x: source.x + (source.width || 240) / 2, y: source.y + (source.height || 160) / 2 };
        const end = { x: target.x + (target.width || 240) / 2, y: target.y + (target.height || 160) / 2 };
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
        const angle = Math.atan2(end.y - start.y, end.x - start.x);
        ctx.beginPath();
        ctx.moveTo(end.x, end.y);
        ctx.lineTo(end.x - 10 * Math.cos(angle - 0.45), end.y - 10 * Math.sin(angle - 0.45));
        ctx.lineTo(end.x - 10 * Math.cos(angle + 0.45), end.y - 10 * Math.sin(angle + 0.45));
        ctx.closePath();
        ctx.fill();
      });
    }

    function drawExportNode(ctx, node) {
      const width = node.width || 240;
      const height = node.height || 160;
      const palette = { gray:'#30363d', blue:'#183b62', green:'#183f35', yellow:'#493c19', red:'#52262a', purple:'#3c285a' };
      ctx.fillStyle = palette[node.color] || palette.blue;
      ctx.strokeStyle = '#8b949e';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (node.shape === 'rounded-rectangle') ctx.roundRect(node.x, node.y, width, height, 10);
      else ctx.rect(node.x, node.y, width, height);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#f0f3f6';
      ctx.font = '600 14px system-ui, sans-serif';
      ctx.fillText(node.title || 'Untitled', node.x + 14, node.y + 25, width - 28);
      ctx.fillStyle = '#c5ccd4';
      ctx.font = '12px system-ui, sans-serif';
      wrapExportText(ctx, String(node.content || '').replace(/[#*_~\x60>\[\]]/g, ''), node.x + 14, node.y + 49, width - 28, height - 60);
    }

    function wrapExportText(ctx, text, x, y, maxWidth, maxHeight) {
      const words = text.split(/\s+/).filter(Boolean);
      const lineHeight = 17;
      let line = '';
      let offset = 0;
      for (const word of words) {
        const candidate = line ? line + ' ' + word : word;
        if (ctx.measureText(candidate).width > maxWidth && line) {
          if (offset + lineHeight > maxHeight) return;
          ctx.fillText(line, x, y + offset, maxWidth);
          line = word;
          offset += lineHeight;
        } else line = candidate;
      }
      if (line && offset + lineHeight <= maxHeight) ctx.fillText(line, x, y + offset, maxWidth);
    }
  `;
}
