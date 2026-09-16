/**
 * Quản lý hiển thị popover nhập liệu, kiểm tra dữ liệu đầu vào và gửi thông điệp nội dung tới extension host.
 */
export function getCanvasPopoversScript(): string {
  return `
    const popover = document.querySelector('#node-popover');
    const popoverTitle = document.querySelector('#popover-title');
    const popoverBody = document.querySelector('#popover-body');
    const popoverError = document.querySelector('#popover-error');
    let popoverContext = null;

    function isPopoverOpen() {
      return Boolean(popover) && popover.style.display === 'block' && popoverContext;
    }

    function showToast(level, message) {
      const region = document.querySelector('#toast-region');
      if (!region || !message) return;
      const toast = document.createElement('div');
      toast.className = 'toast toast-' + (level === 'error' ? 'error' : 'info');
      toast.setAttribute('role', level === 'error' ? 'alert' : 'status');
      toast.textContent = message;
      region.appendChild(toast);
      setTimeout(() => toast.remove(), 3500);
    }

    function dispatchContentAction(kind, payload, nodeId) {
      vscode.postMessage({ type: 'appendNodeContent', id: nodeId, kind, payload });
    }

    function countAffectedEdges(nodeId) {
      return graph.edges.filter((edge) => edge.source === nodeId || edge.target === nodeId).length;
    }

    function fieldRow(labelText, inputHtml) {
      return '<label class="popover-field"><span class="field-label">' + esc(labelText) + '</span>' + inputHtml + '<span class="field-error" aria-live="polite"></span></label>';
    }

    function textInput(id, placeholder, value, maxlength) {
      return '<input id="' + id + '" type="text" placeholder="' + esc(placeholder) + '" value="' + esc(value || '') + '" maxlength="' + maxlength + '" />';
    }

    function renderPopoverForm(kind, node) {
      let fields = '';
      if (kind === 'link') {
        fields = fieldRow('Link text', textInput('popover-input-label', 'Documentation', '', 200)) +
          fieldRow('URL or workspace path', textInput('popover-input-href', 'https://example.com', '', 2048));
      } else if (kind === 'imageUrl') {
        fields = fieldRow('Alt text (optional)', textInput('popover-input-alt', 'Diagram', '', 200)) +
          fieldRow('Image URL (http/https)', textInput('popover-input-url', 'https://example.com/photo.png', '', 2048));
      } else if (kind === 'code') {
        fields = fieldRow('Language', textInput('popover-input-language', 'text', '', 40)) +
          fieldRow('Code', '<textarea id="popover-input-code" rows="5" maxlength="20000"></textarea>');
      } else if (kind === 'tag') {
        fields = fieldRow('Tag name', textInput('popover-input-tag', 'research', '', 80));
      } else if (kind === 'delete') {
        const edgeCount = countAffectedEdges(node.id);
        fields = '<p class="popover-confirm">Delete <b>' + esc(node.title) + '</b>?' +
          (edgeCount ? ' ' + edgeCount + ' connected edge' + (edgeCount === 1 ? '' : 's') + ' will be removed.' : '') + '</p>';
      }
      const submitText = kind === 'delete' ? 'Delete' : 'Insert';
      const submitDanger = kind === 'delete' ? ' danger' : '';
      return fields + '<div class="popover-actions"><button type="button" class="btn-cancel" id="popover-btn-cancel">Cancel</button><button type="button" class="btn-submit' + submitDanger + '" id="popover-btn-submit">' + submitText + '</button></div>';
    }

    function setFieldError(input, message) {
      const field = input ? input.closest('.popover-field') : null;
      const errorEl = field ? field.querySelector('.field-error') : null;
      if (errorEl) errorEl.textContent = message || '';
      if (input) input.classList.toggle('invalid', Boolean(message));
      return !message;
    }

    function validatePopoverForm(kind) {
      const get = (id) => document.querySelector('#' + id);
      if (kind === 'link') {
        const label = get('popover-input-label').value.trim();
        const href = get('popover-input-href').value.trim();
        const okHref = setFieldError(get('popover-input-href'), href ? '' : 'URL is required.');
        const okLabel = setFieldError(get('popover-input-label'), label ? '' : 'Link text is required.');
        return okHref && okLabel ? { kind: 'link', label, href } : null;
      }
      if (kind === 'imageUrl') {
        const alt = get('popover-input-alt').value.trim();
        const url = get('popover-input-url').value.trim();
        const okUrl = setFieldError(get('popover-input-url'), /^https?:\\/\\//i.test(url) ? '' : 'Enter a valid http(s) URL.');
        return okUrl ? { kind: 'image', alt, src: url } : null;
      }
      if (kind === 'code') {
        const language = get('popover-input-language').value.trim();
        const code = get('popover-input-code').value;
        const okLanguage = setFieldError(get('popover-input-language'), !language || /^\\S+$/.test(language) ? '' : 'Language must be a single token.');
        const okCode = setFieldError(get('popover-input-code'), code.trim() ? '' : 'Code is required.');
        return okLanguage && okCode ? { kind: 'code', language: language || 'text', code } : null;
      }
      if (kind === 'tag') {
        const name = get('popover-input-tag').value.trim();
        const okName = setFieldError(get('popover-input-tag'), name && !/\\n/.test(name) ? '' : 'Enter a tag name.');
        return okName ? { kind: 'tag', name } : null;
      }
      return {};
    }

    function openPopover(kind, nodeId) {
      if (!popover) return;
      const node = findNode(nodeId);
      if (!node || node.locked) {
        if (node && node.locked) showToast('error', 'This node is locked.');
        return;
      }
      closeImageSubmenu();
      popoverContext = { kind, nodeId, opener: document.activeElement };
      popoverTitle.textContent = kind === 'delete' ? 'Delete node' : kind === 'imageUrl' ? 'Insert image' : kind === 'link' ? 'Insert link' : kind === 'code' ? 'Insert code block' : 'Add tag';
      popoverBody.innerHTML = renderPopoverForm(kind, node);
      popoverError.textContent = '';
      popover.style.display = 'block';
      placeFloatingPanel(popover, document.querySelector('#node-' + CSS.escape(nodeId)).getBoundingClientRect(), 10);

      const cancelBtn = popoverBody.querySelector('#popover-btn-cancel');
      if (cancelBtn) cancelBtn.onclick = () => closePopover(true);
      const submitBtn = popoverBody.querySelector('#popover-btn-submit');
      if (submitBtn) submitBtn.onclick = () => submitPopover();
      const closeBtn = document.querySelector('#popover-close');
      if (closeBtn) closeBtn.onclick = () => closePopover(true);

      popoverBody.querySelectorAll('input, textarea').forEach(input => {
        input.onkeydown = (event) => {
          if (event.key === 'Enter') {
            if (input.tagName === 'TEXTAREA') {
              if (event.ctrlKey || event.metaKey) {
                event.preventDefault();
                submitPopover();
              }
            } else {
              event.preventDefault();
              submitPopover();
            }
          }
        };
      });

      const firstField = popoverBody.querySelector('input, textarea, button');
      if (firstField) firstField.focus();
    }

    function repositionPopover() {
      if (!isPopoverOpen()) return;
      const nodeEl = document.querySelector('#node-' + CSS.escape(popoverContext.nodeId));
      if (!nodeEl) { closePopover(); return; }
      placeFloatingPanel(popover, nodeEl.getBoundingClientRect(), 10);
    }

    function closePopover(restoreFocus) {
      if (!isPopoverOpen()) return;
      const context = popoverContext;
      popover.style.display = 'none';
      popoverContext = null;
      popoverBody.innerHTML = '';
      if (restoreFocus && context.opener && typeof context.opener.focus === 'function') context.opener.focus();
    }

    function submitPopover() {
      if (!isPopoverOpen()) return;
      const { kind, nodeId } = popoverContext;
      const node = findNode(nodeId);
      if (!node) { showToast('error', 'Node no longer exists.'); closePopover(true); return; }
      if (kind === 'delete') {
        vscode.postMessage({ type: 'deleteNode', id: nodeId, confirmed: true });
        closePopover(true);
        return;
      }
      const payload = validatePopoverForm(kind);
      if (!payload) return;
      if (kind === 'tag') {
        const normalized = payload.name.replace(/^#+/, '').trim().toLowerCase().replace(/\\s+/g, '-');
        if (!normalized) { setFieldError(document.querySelector('#popover-input-tag'), 'Enter a tag name.'); return; }
        payload.name = normalized;
      }
      dispatchContentAction(kind, payload, nodeId);
      closePopover(true);
    }

    function closeImageSubmenu() {
      if (!imageMenu) return;
      imageMenu.classList.remove('open');
      const imageButton = actionBar && actionBar.querySelector('button[data-action="image"]');
      if (imageButton) imageButton.setAttribute('aria-expanded', 'false');
    }

    function toggleImageSubmenu() {
      if (!imageMenu || !isActionBarVisible()) return;
      const willOpen = !imageMenu.classList.contains('open');
      imageMenu.classList.toggle('open', willOpen);
      const imageButton = actionBar.querySelector('button[data-action="image"]');
      if (imageButton) imageButton.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
      if (willOpen) {
        const anchor = imageButton.getBoundingClientRect();
        const containerRect = document.querySelector('#canvas-container').getBoundingClientRect();
        const size = { width: imageMenu.offsetWidth || 170, height: imageMenu.offsetHeight || 76 };
        const position = computeAnchoredPosition(anchor, size, containerRect, 6);
        imageMenu.style.left = Math.round(position.left) + 'px';
        imageMenu.style.top = Math.round(position.top) + 'px';
        const firstItem = imageMenu.querySelector('button');
        if (firstItem) firstItem.focus();
      }
    }

    window.addEventListener('pointerdown', (event) => {
      if (imageMenu && imageMenu.classList.contains('open')) {
        const inMenu = imageMenu.contains(event.target);
        const imgBtn = actionBar && actionBar.querySelector('button[data-action="image"]');
        const inBtn = imgBtn && imgBtn.contains(event.target);
        if (!inMenu && !inBtn) closeImageSubmenu();
      }
    });

    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && (isPopoverOpen() || (imageMenu && imageMenu.classList.contains('open')))) {
        event.preventDefault();
        event.stopPropagation();
        const opener = popoverContext && popoverContext.opener;
        if (imageMenu && imageMenu.classList.contains('open')) closeImageSubmenu();
        else closePopover(true);
        if (opener && typeof opener.focus === 'function' && !isPopoverOpen()) opener.focus();
        return;
      }
      if (event.key === 'Tab' && isPopoverOpen()) {
        const focusables = Array.from(popover.querySelectorAll('input, textarea, button')).filter((el) => !el.disabled);
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    }, true);

    window.addEventListener('message', (event) => {
      const data = event.data;
      if (!data || data.type !== 'actionResult') return;
      if (data.ok === false && data.error) showToast('error', data.error);
    });
  `;
}
