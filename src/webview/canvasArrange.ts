import { icons } from './canvasIcons';

/**
 * Multi-node arrangement module (Grid, Vertical, Horizontal, Sort A-Z / Z-A)
 * and Quick Arrange floating capsule toolbar.
 */
export function getCanvasArrangeScript(): string {
  const iconLayout = icons.layout;
  const iconGrid = icons.layoutGrid;
  const iconDown = icons.arrowDown;
  const iconRight = icons.arrowRight;
  const iconSortAZ = icons.arrowDownAZ;
  const iconSortZA = icons.arrowDownZA;
  const iconSliders = icons.sliders;
  const iconChevronRight = icons.chevronRight;

  return `
    let currentArrangeState = {
      type: 'square',
      sort: 'none',
      gap: 40
    };

    function buildArrangeContextMenuHtml(count) {
      return '<div class="menu-item menu-item-has-submenu" id="ctx-arrange-root">' +
        '<span style="display:inline-flex;align-items:center;gap:6px;"><span class="menu-icon">${iconLayout}</span><span>Arrange (' + count + ')</span></span>' +
        '<span class="menu-caret" style="display:inline-flex;align-items:center;">${iconChevronRight}</span>' +
        '<div class="menu-submenu" id="ctx-arrange-submenu">' +
          '<div class="menu-item-nested" data-arrange="square">' +
            '<span class="menu-icon">${iconGrid}</span><span>Grid</span>' +
          '</div>' +
          '<div class="menu-item-nested" data-arrange="vertical">' +
            '<span class="menu-icon">${iconDown}</span><span>Vertical Column</span>' +
          '</div>' +
          '<div class="menu-item-nested" data-arrange="horizontal">' +
            '<span class="menu-icon">${iconRight}</span><span>Horizontal Row</span>' +
          '</div>' +
          '<div class="menu-divider"></div>' +
          '<div class="menu-item-nested" data-arrange="square" data-sort="alpha-asc">' +
            '<span class="menu-icon">${iconSortAZ}</span><span>Sort A → Z</span>' +
          '</div>' +
          '<div class="menu-item-nested" data-arrange="square" data-sort="alpha-desc">' +
            '<span class="menu-icon">${iconSortZA}</span><span>Sort Z → A</span>' +
          '</div>' +
          '<div class="menu-divider"></div>' +
          '<div class="menu-item-nested highlight" id="ctx-open-arrange-bar">' +
            '<span class="menu-icon">${iconSliders}</span><span>Quick Adjust...</span>' +
          '</div>' +
        '</div>' +
      '</div>';
    }

    function sortArrangeNodes(nodes, sortType) {
      const list = nodes.slice();
      if (sortType === 'alpha-asc') {
        return list.sort((a, b) => {
          const ta = (a.title || a.id || '').trim();
          const tb = (b.title || b.id || '').trim();
          return ta.localeCompare(tb, 'vi', { sensitivity: 'base', numeric: true });
        });
      }
      if (sortType === 'alpha-desc') {
        return list.sort((a, b) => {
          const ta = (a.title || a.id || '').trim();
          const tb = (b.title || b.id || '').trim();
          return tb.localeCompare(ta, 'vi', { sensitivity: 'base', numeric: true });
        });
      }
      return list.sort((a, b) => {
        const dy = a.y - b.y;
        if (Math.abs(dy) > 30) return dy;
        return a.x - b.x;
      });
    }

    function getArrangeNodeDimensions(node) {
      const el = document.querySelector('#node-' + CSS.escape(node.id));
      const w = el && el.offsetWidth ? el.offsetWidth : (node.width || 240);
      const h = el && el.offsetHeight ? el.offsetHeight : (node.height || 160);
      return { width: w, height: h };
    }

    function applyArrange(options = {}) {
      if (selectedNodeIds.size < 2) return;
      const ids = Array.from(selectedNodeIds);
      const allSelected = ids.map(id => findNode(id)).filter(Boolean);
      const arrangeable = allSelected.filter(n => !n.locked);

      if (arrangeable.length === 0) {
        if (typeof showToast === 'function') showToast('info', 'Selected nodes are locked');
        return;
      }

      currentArrangeState.type = options.type || currentArrangeState.type || 'square';
      currentArrangeState.sort = options.sort !== undefined ? options.sort : currentArrangeState.sort;
      if (typeof options.gap === 'number') currentArrangeState.gap = options.gap;

      const gap = currentArrangeState.gap;
      const sorted = sortArrangeNodes(arrangeable, currentArrangeState.sort);

      const anchorX = Math.min(...arrangeable.map(n => n.x));
      const anchorY = Math.min(...arrangeable.map(n => n.y));

      if (currentArrangeState.type === 'vertical') {
        let currY = anchorY;
        for (const node of sorted) {
          node.x = Math.round(anchorX);
          node.y = Math.round(currY);
          const dim = getArrangeNodeDimensions(node);
          currY += dim.height + gap;
        }
      } else if (currentArrangeState.type === 'horizontal') {
        let currX = anchorX;
        for (const node of sorted) {
          node.x = Math.round(currX);
          node.y = Math.round(anchorY);
          const dim = getArrangeNodeDimensions(node);
          currX += dim.width + gap;
        }
      } else {
        // Grid (Square)
        const cols = Math.max(1, Math.min(sorted.length, Math.ceil(Math.sqrt(sorted.length))));
        const rows = Math.ceil(sorted.length / cols);

        const colWidths = new Array(cols).fill(0);
        const rowHeights = new Array(rows).fill(0);

        for (let i = 0; i < sorted.length; i++) {
          const c = i % cols;
          const r = Math.floor(i / cols);
          const dim = getArrangeNodeDimensions(sorted[i]);
          colWidths[c] = Math.max(colWidths[c], dim.width);
          rowHeights[r] = Math.max(rowHeights[r], dim.height);
        }

        const colOffsets = [0];
        for (let c = 0; c < cols - 1; c++) {
          colOffsets.push(colOffsets[c] + colWidths[c] + gap);
        }
        const rowOffsets = [0];
        for (let r = 0; r < rows - 1; r++) {
          rowOffsets.push(rowOffsets[r] + rowHeights[r] + gap);
        }

        for (let i = 0; i < sorted.length; i++) {
          const c = i % cols;
          const r = Math.floor(i / cols);
          sorted[i].x = Math.round(anchorX + colOffsets[c]);
          sorted[i].y = Math.round(anchorY + rowOffsets[r]);
        }
      }

      vscode.postMessage({
        type: 'saveLayout',
        nodes: graph.nodes.map(n => ({ id: n.id, x: n.x, y: n.y, layer: n.layer })),
        viewport: pan
      });

      render();
      highlightSelection();
      updateArrangeQuickBarUi();
      updateArrangeQuickBarPosition();

      if (typeof showToast === 'function') {
        showToast('info', 'Arranged ' + arrangeable.length + ' nodes');
      }
    }

    function getSelectionScreenBoundingRect() {
      if (selectedNodeIds.size === 0) return null;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const id of selectedNodeIds) {
        const el = document.querySelector('#node-' + CSS.escape(id));
        if (!el) continue;
        const r = el.getBoundingClientRect();
        minX = Math.min(minX, r.left);
        minY = Math.min(minY, r.top);
        maxX = Math.max(maxX, r.right);
        maxY = Math.max(maxY, r.bottom);
      }
      if (!isFinite(minX)) return null;
      return {
        top: minY,
        left: minX,
        right: maxX,
        bottom: maxY,
        width: maxX - minX,
        height: maxY - minY
      };
    }

    function showArrangeQuickBar() {
      const bar = document.querySelector('#arrange-quick-bar');
      if (!bar || selectedNodeIds.size < 2) return;
      bar.style.display = 'flex';
      updateArrangeQuickBarUi();
      updateArrangeQuickBarPosition();
    }

    function hideArrangeQuickBar() {
      const bar = document.querySelector('#arrange-quick-bar');
      if (bar) bar.style.display = 'none';
    }

    function updateArrangeQuickBarPosition() {
      const bar = document.querySelector('#arrange-quick-bar');
      if (!bar || bar.style.display === 'none' || selectedNodeIds.size < 2) return;
      const rect = getSelectionScreenBoundingRect();
      if (!rect) return;

      const barWidth = bar.offsetWidth || 230;
      const barHeight = bar.offsetHeight || 32;
      const gap = 8;

      let top = rect.top - barHeight - gap;
      if (top < 45) {
        top = rect.bottom + gap;
      }
      let left = rect.left + rect.width / 2 - barWidth / 2;
      left = Math.max(10, Math.min(window.innerWidth - barWidth - 10, left));

      bar.style.top = Math.round(top) + 'px';
      bar.style.left = Math.round(left) + 'px';
    }

    function updateArrangeQuickBarUi() {
      const bar = document.querySelector('#arrange-quick-bar');
      if (!bar) return;

      // Update layout buttons
      bar.querySelectorAll('button[data-type]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.type === currentArrangeState.type);
      });

      // Update sort buttons
      bar.querySelectorAll('button[data-sort]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.sort === currentArrangeState.sort);
      });

      // Update gap display
      const gapVal = bar.querySelector('#arrange-gap-val');
      if (gapVal) gapVal.textContent = currentArrangeState.gap + 'px';
    }

    function wireArrangeUi() {
      const bar = document.querySelector('#arrange-quick-bar');
      if (!bar) return;
      if (bar.dataset.wired === 'true') return;
      bar.dataset.wired = 'true';

      // Prevent canvas from intercepting or cancelling pointer events
      bar.addEventListener('pointerdown', e => e.stopPropagation());
      bar.addEventListener('mousedown', e => e.stopPropagation());
      bar.addEventListener('pointerup', e => e.stopPropagation());
      bar.addEventListener('mouseup', e => e.stopPropagation());

      // Single delegated click listener to handle all buttons reliably
      bar.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        // 1. Layout type click (Grid, Vertical, Horizontal)
        const typeBtn = e.target.closest('button[data-type]');
        if (typeBtn) {
          applyArrange({ type: typeBtn.dataset.type });
          return;
        }

        // 2. Sort click (A-Z, Z-A)
        const sortBtn = e.target.closest('button[data-sort]');
        if (sortBtn) {
          const targetSort = sortBtn.dataset.sort;
          const newSort = currentArrangeState.sort === targetSort ? 'none' : targetSort;
          applyArrange({ sort: newSort });
          return;
        }

        // 3. Gap minus
        const minusBtn = e.target.closest('#arrange-gap-minus');
        if (minusBtn) {
          const nextGap = Math.max(10, currentArrangeState.gap - 10);
          applyArrange({ gap: nextGap });
          return;
        }

        // 4. Gap plus
        const plusBtn = e.target.closest('#arrange-gap-plus');
        if (plusBtn) {
          const nextGap = Math.min(200, currentArrangeState.gap + 10);
          applyArrange({ gap: nextGap });
          return;
        }

        // 5. Close button
        const closeBtn = e.target.closest('#arrange-bar-close');
        if (closeBtn) {
          hideArrangeQuickBar();
          return;
        }
      });
    }
  `;
}
