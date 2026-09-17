/**
 * Live outline filter: wires the #search-box input at the top of the left sidebar.
 * Rendered as a webview script fragment: string concatenation only, no backticks inside.
 * Injected once inside the canvas IIFE (see canvasScript.ts); relies on searchBox,
 * graph, selectedNodeIds, highlightSelection, inspectNode and render being in scope.
 */
export function getCanvasSidebarSearchScript(): string {
  return `
    function nodeMatchesQuery(node, query) {
      if (!query) return true;
      const title = (node.title || '').toLowerCase();
      const content = (node.content || '').toLowerCase();
      return title.indexOf(query) !== -1 || content.indexOf(query) !== -1;
    }

    function applyOutlineFilter() {
      const outline = document.querySelector('#outline-list');
      const countEl = document.querySelector('#search-count');
      if (!outline) return;
      const query = (searchBox && typeof searchBox.value === 'string') ? searchBox.value.trim().toLowerCase() : '';
      const rows = outline.querySelectorAll('.outline-item');
      let matches = 0;
      const limit = Math.min(graph.nodes.length, rows.length);
      for (let i = 0; i < limit; i++) {
        const isMatch = nodeMatchesQuery(graph.nodes[i], query);
        rows[i].style.display = isMatch ? '' : 'none';
        if (isMatch) matches++;
      }
      if (countEl) countEl.textContent = query ? (matches + (matches === 1 ? ' match' : ' matches')) : '';
    }

    function clearOutlineFilter() {
      if (searchBox) searchBox.value = '';
      applyOutlineFilter();
    }

    function focusFirstSearchMatch() {
      if (!searchBox) return;
      const query = searchBox.value.trim().toLowerCase();
      if (!query) return;
      let match = null;
      for (const node of graph.nodes) {
        if (nodeMatchesQuery(node, query)) { match = node; break; }
      }
      if (!match) return;
      const r = canvas.getBoundingClientRect();
      const nodeEl = document.querySelector('#node-' + CSS.escape(match.id));
      pan.x = (r.width / 2) - (match.x + (nodeEl ? nodeEl.offsetWidth : 140) / 2) * pan.zoom;
      pan.y = (r.height / 2) - (match.y + (nodeEl ? nodeEl.offsetHeight : 50) / 2) * pan.zoom;
      view();
      selectedNodeIds.clear();
      selectedNodeIds.add(match.id);
      highlightSelection();
      inspectNode(match.id);
      editorRight.classList.remove('collapsed');
      scheduleSaveViewport();
    }

    if (searchBox) {
      searchBox.oninput = () => applyOutlineFilter();
      searchBox.onkeydown = e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          focusFirstSearchMatch();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          clearOutlineFilter();
        }
      };
    }

    var baseRenderForSearch = render;
    render = function() {
      baseRenderForSearch();
      applyOutlineFilter();
    };
    applyOutlineFilter();
  `;
}
