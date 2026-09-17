/**
 * Sidebar format bar logic: toggles Bold / Italic / Highlight Markdown wraps
 * either on the active inline text selection (paragraph/quote blocks) or on
 * the whole content of the single selected node.
 *
 * Consumes (declared elsewhere in the canvas IIFE):
 *   #format-bar [data-format="bold|italic|highlight"] markup (template),
 *   activeNodeEditor / selectedNodeIds / findNode / esc / render / vscode.
 *
 * Inline commits reuse the host contract of canvasNodeEditing:
 *   updateMarkdownBlock {id, blockKind, blockIndex, text}.
 * Node commits reuse the inspector contract:
 *   updateNode {id, title, shape, color, content}.
 */
export function getCanvasFormatPanelScript(): string {
  return `
    function toggleInlineWrap(raw, selection, prefix, suffix) {
      if (!raw || !selection || !prefix || !suffix) return raw;
      const wrapped = prefix + selection + suffix;
      const wrappedAt = raw.indexOf(wrapped);
      if (wrappedAt !== -1) {
        return raw.slice(0, wrappedAt) + selection + raw.slice(wrappedAt + wrapped.length);
      }
      const targetAt = raw.indexOf(selection);
      if (targetAt === -1) return raw;
      return raw.slice(0, targetAt) + wrapped + raw.slice(targetAt + selection.length);
    }

    function wholeWrapDefaultText(prefix) {
      if (prefix === '==') return 'highlighted text';
      if (prefix === '**') return 'bold text';
      if (prefix === '*') return 'italic text';
      return 'text';
    }

    function toggleWholeWrap(content, prefix, suffix) {
      const trimmed = String(content || '').trim();
      if (trimmed.startsWith(prefix) && trimmed.endsWith(suffix) && trimmed.length > prefix.length + suffix.length) {
        return trimmed.slice(prefix.length, trimmed.length - suffix.length);
      }
      if (!trimmed) return prefix + wholeWrapDefaultText(prefix) + suffix;
      return prefix + content + suffix;
    }

    function getFormatPair(format) {
      if (format === 'bold') return { prefix: '**', suffix: '**' };
      if (format === 'italic') return { prefix: '*', suffix: '*' };
      if (format === 'highlight') return { prefix: '==', suffix: '==' };
      return null;
    }

    function isEditingSessionActive() {
      if (typeof activeNodeEditor !== 'undefined' && activeNodeEditor) return true;
      const active = document.activeElement;
      return Boolean(active && active.isContentEditable && active.closest && active.closest('.node-content'));
    }

    function getInlineFormatTarget() {
      const active = document.activeElement;
      if (!active || !active.isContentEditable || !active.closest) return null;
      const contentEl = active.closest('.node-content');
      if (!contentEl) return null;
      const block = active.closest('[data-edit-kind]');
      if (!block || !contentEl.contains(block)) return null;
      // Only single-line rich blocks are wrappable; code blocks are refused.
      if (block.dataset.editKind !== 'paragraph' && block.dataset.editKind !== 'quote') return null;
      return block;
    }

    function getInlineSelectionText(block) {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return '';
      const text = String(sel);
      if (!text || !block.contains(sel.anchorNode)) return '';
      return text;
    }

    function getInlineNodeId(block) {
      const nodeEl = block.closest('.node');
      return nodeEl ? nodeEl.id.replace('node-', '') : null;
    }

    function applyInlineFormat(pair) {
      const block = getInlineFormatTarget();
      if (!block) return;
      const selectionText = getInlineSelectionText(block);
      if (!selectionText) return;
      const raw = decodeURIComponent(block.dataset.raw || '');
      const newRaw = toggleInlineWrap(raw, selectionText, pair.prefix, pair.suffix);
      if (newRaw === raw) return;
      // Keep the open editor consistent with the committed source so its own
      // finish() posts the wrapped text instead of the stale original.
      block.textContent = newRaw;
      block.dataset.raw = encodeURIComponent(newRaw);
      const nodeId = getInlineNodeId(block);
      if (!nodeId) return;
      vscode.postMessage({
        type: 'updateMarkdownBlock',
        id: nodeId,
        blockKind: block.dataset.editKind,
        blockIndex: parseInt(block.dataset.editIndex, 10),
        text: newRaw
      });
    }

    function applyNodeFormat(pair) {
      if (typeof selectedNodeIds === 'undefined' || selectedNodeIds.size !== 1) return;
      const node = findNode(Array.from(selectedNodeIds)[0]);
      if (!node) return;
      if (node.locked) {
        if (typeof showToast === 'function') showToast('error', 'Node is locked');
        return;
      }
      const current = node.content || '';
      const newContent = toggleWholeWrap(current, pair.prefix, pair.suffix);
      if (newContent === current) return;
      node.content = newContent;
      vscode.postMessage({ type: 'updateNode', id: node.id, title: node.title, shape: node.shape, color: node.color, content: newContent });
      if (typeof render === 'function') render();
    }

    function applyFormatClick(format) {
      const pair = getFormatPair(format);
      if (!pair) return;
      if (isEditingSessionActive()) {
        applyInlineFormat(pair);
        return;
      }
      applyNodeFormat(pair);
    }

    function formatBarButtons(bar) {
      return bar ? Array.from(bar.querySelectorAll('[data-format]')) : [];
    }

    function refreshFormatBar() {
      const bar = document.querySelector('#format-bar');
      if (!bar) return;
      const block = getInlineFormatTarget();
      const enabled = Boolean(block && getInlineSelectionText(block)) ||
        (typeof selectedNodeIds !== 'undefined' && selectedNodeIds.size === 1);
      formatBarButtons(bar).forEach(button => {
        button.classList.toggle('disabled', !enabled);
        button.setAttribute('aria-disabled', enabled ? 'false' : 'true');
      });
    }

    function initFormatBar() {
      const bar = document.querySelector('#format-bar');
      if (!bar || bar.dataset.formatInit === '1') return;
      bar.dataset.formatInit = '1';
      formatBarButtons(bar).forEach(button => {
        // Keep focus and selection inside the open inline editor on click.
        button.addEventListener('mousedown', event => event.preventDefault());
        button.addEventListener('click', event => {
          const source = event.currentTarget;
          if (!source || source.classList.contains('disabled')) return;
          applyFormatClick(source.getAttribute('data-format'));
        });
      });
      document.addEventListener('selectionchange', refreshFormatBar);
      if (typeof render === 'function') {
        const baseRender = render;
        render = function() {
          baseRender();
          refreshFormatBar();
        };
      }
      refreshFormatBar();
    }

    initFormatBar();
  `;
}
