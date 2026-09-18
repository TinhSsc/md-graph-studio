/**
 * Quản lý hiển thị thanh công cụ nổi thao tác node, định vị theo node được chọn và điều hướng các hành động.
 */
export function getCanvasActionBarScript(): string {
  return `
    const actionBar = document.querySelector('#node-action-bar');
    const imageMenu = document.querySelector('#action-image-menu');
    let actionBarNodeId = null;
    let actionBarSource = 'selection';
    let hoverTimer = null;
    let hoverCandidate = null;

    function actionBarButtons() {
      return actionBar ? Array.from(actionBar.querySelectorAll('button[data-action]')) : [];
    }

    function hideNodeActionBar() {
      actionBarNodeId = null;
      if (actionBar) actionBar.style.display = 'none';
    }

    function isActionBarVisible() {
      return Boolean(actionBar) && actionBar.style.display !== 'none' && actionBarNodeId;
    }

    function computeAnchoredPosition(anchorRect, selfRect, containerRect, gap) {
      const fitsAbove = anchorRect.top - selfRect.height - gap >= containerRect.top + 8;
      const fitsBelow = anchorRect.bottom + selfRect.height + gap <= containerRect.bottom - 8;
      let top = fitsAbove ? anchorRect.top - selfRect.height - gap
        : fitsBelow ? anchorRect.bottom + gap
        : Math.max(containerRect.top + 8, containerRect.bottom - selfRect.height - 8);
      let left = anchorRect.left + anchorRect.width / 2 - selfRect.width / 2;
      left = Math.max(containerRect.left + 8, Math.min(containerRect.right - selfRect.width - 8, left));
      return { top, left };
    }

    function placeFloatingPanel(panel, anchorRect, gap) {
      const containerRect = document.querySelector('#canvas-container').getBoundingClientRect();
      const prevDisplay = panel.style.display;
      const prevVisibility = panel.style.visibility;
      if (prevDisplay === 'none' || !prevDisplay) {
        panel.style.visibility = 'hidden';
        panel.style.display = 'flex';
      }
      const size = { width: panel.offsetWidth || 320, height: panel.offsetHeight || 38 };
      const position = computeAnchoredPosition(anchorRect, size, containerRect, gap);
      panel.style.left = Math.round(position.left) + 'px';
      panel.style.top = Math.round(position.top) + 'px';
      panel.style.visibility = prevVisibility;
      panel.style.display = prevDisplay === 'none' ? 'flex' : prevDisplay;
    }

    function updateNodeActionBar() {
      if (!actionBar) return;
      if (activeNodeEditor || isPopoverOpen()) { hideNodeActionBar(); return; }

      let nodeId = null;
      if (selectedNodeIds.size === 1) nodeId = Array.from(selectedNodeIds)[0];
      else if (actionBarSource === 'hover' && hoverCandidate && selectedNodeIds.size === 0) nodeId = hoverCandidate;
      else if (actionBarSource === 'hover' && hoverCandidate && selectedNodeIds.size > 0 && hoverCandidate === actionBarNodeId) nodeId = hoverCandidate;
      if (!nodeId) { hideNodeActionBar(); return; }

      const nodeEl = document.querySelector('#node-' + CSS.escape(nodeId));
      const node = findNode(nodeId);
      if (!nodeEl || !node) { hideNodeActionBar(); return; }

      actionBar.style.display = 'flex';
      actionBar.dataset.nodeId = nodeId;
      const isGhostNode = Boolean(node.ghost);
      actionBarButtons().forEach((button) => {
        const action = button.getAttribute('data-action');
        if (action === 'lock') {
          button.disabled = isGhostNode;
          button.setAttribute('aria-pressed', node.locked ? 'true' : 'false');
          button.title = node.locked ? 'Unlock node' : 'Lock node';
          button.setAttribute('aria-label', button.title);
          button.setAttribute('aria-disabled', button.disabled ? 'true' : 'false');
          return;
        }
        if (action === 'icon') {
          button.disabled = isGhostNode;
          button.setAttribute('aria-disabled', button.disabled ? 'true' : 'false');
          return;
        }
        if (action === 'edit') {
          button.title = isGhostNode ? 'Create node' : 'Edit node';
          button.setAttribute('aria-label', button.title);
        }
        const disabled = isGhostNode ? (action !== 'edit' && action !== 'delete') : Boolean(node.locked);
        button.disabled = disabled;
        button.setAttribute('aria-disabled', disabled ? 'true' : 'false');
      });
      if (imageMenu) {
        imageMenu.classList.remove('open');
        const imageButton = actionBar.querySelector('button[data-action="image"]');
        if (imageButton) imageButton.setAttribute('aria-expanded', 'false');
      }
      actionBarNodeId = nodeId;
      placeFloatingPanel(actionBar, nodeEl.getBoundingClientRect(), 8);
    }

    function requestHoverActionBar(nodeId) {
      hoverCandidate = nodeId;
      clearTimeout(hoverTimer);
      hoverTimer = setTimeout(() => {
        actionBarSource = 'hover';
        updateNodeActionBar();
      }, 250);
    }

    function cancelHoverActionBar(target) {
      clearTimeout(hoverTimer);
      const overBar = target && ((actionBar && (target === actionBar || actionBar.contains(target))) || (imageMenu && (target === imageMenu || imageMenu.contains(target))));
      const overNode = target && typeof target.closest === 'function' && target.closest('.node');
      if (!overBar && !overNode) {
        hoverCandidate = null;
        if (selectedNodeIds.size === 0) {
          hideNodeActionBar();
        }
      }
    }

    document.addEventListener('pointerover', (event) => {
      const nodeEl = event.target && event.target.closest ? event.target.closest('.node') : null;
      if (nodeEl) {
        const nodeId = nodeEl.id.replace('node-', '');
        if (nodeId !== actionBarNodeId) requestHoverActionBar(nodeId);
        return;
      }
      if (event.target && actionBar && (event.target === actionBar || actionBar.contains(event.target))) return;
      if (event.target && imageMenu && (event.target === imageMenu || imageMenu.contains(event.target))) return;
      cancelHoverActionBar(event.target);
    }, true);

    document.addEventListener('mouseleave', () => {
      clearTimeout(hoverTimer);
      hoverCandidate = null;
      if (selectedNodeIds.size === 0) {
        hideNodeActionBar();
      }
    });

    document.addEventListener('pointerdown', (event) => {
      const inBar = actionBar && (event.target === actionBar || actionBar.contains(event.target));
      const inMenu = imageMenu && (event.target === imageMenu || imageMenu.contains(event.target));
      if (inBar || inMenu) return;
      const nodeEl = event.target && event.target.closest ? event.target.closest('.node') : null;
      if (!nodeEl) {
        clearTimeout(hoverTimer);
        hoverCandidate = null;
        if (actionBarSource === 'hover' || selectedNodeIds.size === 0) {
          hideNodeActionBar();
        }
      }
    });

    if (actionBar) {
      actionBar.addEventListener('click', (event) => {
        const button = event.target && event.target.closest ? event.target.closest('button[data-action]') : null;
        if (!button || button.disabled || !actionBarNodeId) return;
        const action = button.getAttribute('data-action');
        const nodeId = actionBarNodeId;
        if (action === 'image') {
          toggleImageSubmenu();
        } else if (action === 'close') {
          hideNodeActionBar();
        } else if (action === 'link' || action === 'code' || action === 'tag' || action === 'delete') {
          openPopover(action, nodeId);
        } else if (action === 'task') {
          dispatchContentAction('task', { kind: 'task', text: 'New task' }, nodeId);
        } else if (action === 'list') {
          dispatchContentAction('list', { kind: 'list', text: 'New item' }, nodeId);
        } else if (action === 'quote') {
          dispatchContentAction('quote', { kind: 'quote', text: 'New quote' }, nodeId);
        } else if (action === 'table') {
          dispatchContentAction('table', { kind: 'table', cols: 3, rows: 2 }, nodeId);
        } else if (action === 'lock') {
          const node = findNode(nodeId);
          if (node) {
            const locked = !node.locked;
            node.locked = locked;
            vscode.postMessage({ type: 'toggleNodeLocked', id: nodeId, locked });
            render();
          }
        } else if (action === 'icon') {
          openIconPicker([nodeId], button);
        } else if (action === 'edit') {
          const node = findNode(nodeId);
          if (node && node.ghost) {
            vscode.postMessage({ type: 'updateNode', id: nodeId, title: node.title, shape: node.shape, color: node.color, content: '' });
          } else {
            const nodeEl = document.querySelector('#node-' + CSS.escape(nodeId));
            if (node && nodeEl) startInlineNodeEdit(node, nodeEl);
          }
        }
      });
    }

    if (imageMenu) {
      imageMenu.addEventListener('click', (event) => {
        const button = event.target && event.target.closest ? event.target.closest('button[data-subaction]') : null;
        if (!button || !actionBarNodeId) return;
        const subaction = button.getAttribute('data-subaction');
        const nodeId = actionBarNodeId;
        closeImageSubmenu();
        if (subaction === 'image-workspace') {
          vscode.postMessage({ type: 'requestPickImage', id: nodeId });
        } else if (subaction === 'image-url') {
          openPopover('imageUrl', nodeId);
        }
      });
    }

    const baseHighlightSelection = highlightSelection;
    highlightSelection = function() {
      baseHighlightSelection();
      if (selectedNodeIds.size === 1) {
        actionBarSource = 'selection';
        updateNodeActionBar();
      } else {
        hideNodeActionBar();
      }
    };

    const baseView = view;
    view = function() {
      baseView();
      if (isActionBarVisible()) {
        const nodeEl = actionBarNodeId ? document.querySelector('#node-' + CSS.escape(actionBarNodeId)) : null;
        if (nodeEl) placeFloatingPanel(actionBar, nodeEl.getBoundingClientRect(), 8);
      }
      if (isPopoverOpen()) repositionPopover();
    };

    const baseRender = render;
    render = function() {
      baseRender();
      if (selectedNodeIds.size === 1) {
        actionBarSource = 'selection';
        updateNodeActionBar();
      } else if (selectedNodeIds.size === 0 && actionBarSource === 'hover' && hoverCandidate) {
        updateNodeActionBar();
      } else {
        hideNodeActionBar();
      }
    };
  `;
}
