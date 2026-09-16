export function getCanvasNodeEditingScript(): string {
  return `
    function startInlineNodeEdit(node, element, clickedTarget) {
      if (activeNodeEditor) activeNodeEditor.finish();

      const titleElement = element.querySelector('.node-title');
      if (!titleElement) return;
      let contentElement = element.querySelector('.node-content');
      const createdContent = !contentElement;
      if (!contentElement) {
        contentElement = document.createElement('div');
        contentElement.className = 'node-content';
        element.insertBefore(contentElement, element.querySelector('.port'));
      }

      const originalTitle = node.title;
      const originalContent = (node.content || '').trimEnd();
      let finished = false;
      const handleFocusout = () => {
        setTimeout(() => {
          if (!finished && !element.contains(document.activeElement)) finish();
        }, 0);
      };
      element.classList.add('editing');
      [titleElement, contentElement].forEach(editable => {
        editable.contentEditable = 'true';
        editable.spellcheck = true;
        editable.setAttribute('role', 'textbox');
        editable.onpointerdown = event => event.stopPropagation();
        editable.onclick = event => event.stopPropagation();
        editable.ondblclick = event => event.stopPropagation();
      });
      contentElement.setAttribute('aria-multiline', 'true');

      const cleanup = () => {
        [titleElement, contentElement].forEach(editable => {
          editable.contentEditable = 'false';
          editable.removeAttribute('role');
          editable.removeAttribute('aria-multiline');
          editable.onpointerdown = null;
          editable.onclick = null;
          editable.ondblclick = null;
          editable.onkeydown = null;
        });
        element.removeEventListener('focusout', handleFocusout);
        element.classList.remove('editing');
        if (createdContent && !contentElement.textContent.trim()) contentElement.remove();
        activeNodeEditor = null;
      };

      const finish = () => {
        if (finished) return;
        finished = true;
        const title = titleElement.innerText.replace(/[\\r\\n]+/g, ' ').trim() || originalTitle;
        const content = contentElement.innerText.replace(/\\r/g, '').trimEnd();
        titleElement.textContent = title;
        cleanup();
        if (title !== originalTitle) {
          selectedNodeIds.delete(node.id);
          selectedNodeIds.add(title);
        }
        if (title !== originalTitle || content !== originalContent) {
          vscode.postMessage({ type: 'updateNode', id: node.id, title, content, shape: node.shape, color: node.color });
        }
      };

      const handleKeydown = event => {
        if (event.isComposing) return;
        if (event.key === 'Escape' || (event.key === 'Enter' && !(event.shiftKey && event.currentTarget === contentElement))) {
          event.preventDefault();
          finish();
        }
      };
      titleElement.onkeydown = handleKeydown;
      contentElement.onkeydown = handleKeydown;
      element.addEventListener('focusout', handleFocusout);

      activeNodeEditor = { finish };
      const focusElement = clickedTarget && clickedTarget.closest('.node-content') ? contentElement : titleElement;
      focusElement.focus();
      const range = document.createRange();
      range.selectNodeContents(focusElement);
      if (focusElement === contentElement) range.collapse(false);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    }
  `;
}
