export function getCanvasNodeEditingScript(): string {
  return `
    function startInlineTaskEdit(node, taskElement) {
      if (activeNodeEditor) activeNodeEditor.finish();
      const taskIndex = parseInt(taskElement.dataset.taskIndex, 10);
      if (isNaN(taskIndex)) return;

      const originalText = taskElement.innerText.trim();
      let finished = false;

      taskElement.contentEditable = 'true';
      taskElement.spellcheck = true;
      taskElement.setAttribute('role', 'textbox');
      taskElement.onpointerdown = event => event.stopPropagation();
      taskElement.onclick = event => event.stopPropagation();
      taskElement.ondblclick = event => event.stopPropagation();
      taskElement.focus();

      const range = document.createRange();
      range.selectNodeContents(taskElement);
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(range);
      }

      const cleanup = () => {
        taskElement.contentEditable = 'false';
        taskElement.removeAttribute('role');
        taskElement.onpointerdown = null;
        taskElement.onclick = null;
        taskElement.ondblclick = null;
        taskElement.onkeydown = null;
        taskElement.onblur = null;
        activeNodeEditor = null;
      };

      const finish = () => {
        if (finished) return;
        finished = true;
        const newText = taskElement.innerText.replace(/[\\r\\n]+/g, ' ').trim();
        cleanup();
        if (newText && newText !== originalText) {
          vscode.postMessage({
            type: 'updateTaskText',
            id: node.id,
            taskIndex: taskIndex,
            text: newText
          });
        } else {
          taskElement.innerText = originalText;
        }
      };

      const cancel = () => {
        if (finished) return;
        finished = true;
        taskElement.innerText = originalText;
        cleanup();
      };

      taskElement.onkeydown = event => {
        event.stopPropagation();
        if (event.isComposing) return;
        if (event.key === 'Escape') {
          event.preventDefault();
          cancel();
        } else if (event.key === 'Enter') {
          event.preventDefault();
          finish();
        }
      };

      taskElement.onblur = () => {
        finish();
      };

      activeNodeEditor = { finish, cancel };
    }

    function startInlineBlockEdit(node, target) {
      if (activeNodeEditor) activeNodeEditor.finish();
      const blockKind = target.dataset.editKind;
      const blockIndex = parseInt(target.dataset.editIndex, 10);
      if (!blockKind || isNaN(blockIndex)) return;
      const originalHtml = target.innerHTML;
      const originalText = decodeURIComponent(target.dataset.raw || '');
      const multiline = blockKind === 'code';
      let finished = false;

      target.textContent = originalText;
      target.contentEditable = 'true';
      target.spellcheck = blockKind !== 'code';
      target.setAttribute('role', 'textbox');
      target.setAttribute('aria-multiline', multiline ? 'true' : 'false');
      target.onpointerdown = event => event.stopPropagation();
      target.onclick = event => event.stopPropagation();
      target.ondblclick = event => event.stopPropagation();

      const cleanup = () => {
        target.contentEditable = 'false';
        target.removeAttribute('role');
        target.removeAttribute('aria-multiline');
        target.onpointerdown = null;
        target.onclick = null;
        target.ondblclick = null;
        target.onkeydown = null;
        target.onblur = null;
        activeNodeEditor = null;
      };
      const cancel = () => {
        if (finished) return;
        finished = true;
        target.innerHTML = originalHtml;
        cleanup();
      };
      const finish = () => {
        if (finished) return;
        finished = true;
        const text = multiline ? target.innerText.replace(/\\r/g, '') : target.innerText.replace(/[\\r\\n]+/g, ' ').trim();
        cleanup();
        if (text !== originalText) vscode.postMessage({ type: 'updateMarkdownBlock', id: node.id, blockKind, blockIndex, text });
        else target.innerHTML = originalHtml;
      };

      target.onkeydown = event => {
        event.stopPropagation();
        if (event.isComposing) return;
        if (event.key === 'Escape') {
          event.preventDefault();
          cancel();
        } else if (event.key === 'Enter' && (!multiline || event.ctrlKey || event.metaKey)) {
          event.preventDefault();
          finish();
        }
      };
      target.onblur = finish;
      activeNodeEditor = { finish, cancel };
      target.focus();
      const range = document.createRange();
      range.selectNodeContents(target);
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }

    function startInlineNodeEdit(node, element, clickedTarget) {
      if (activeNodeEditor) activeNodeEditor.finish();

      const taskTarget = clickedTarget ? clickedTarget.closest('.task-text') : null;
      if (taskTarget) {
        startInlineTaskEdit(node, taskTarget);
        return;
      }

      const editableBlock = clickedTarget ? clickedTarget.closest('[data-edit-kind]') : null;
      if (editableBlock) {
        startInlineBlockEdit(node, editableBlock);
        return;
      }

      if (clickedTarget && clickedTarget.closest('.node-content')) {
        if (typeof inspectNode === 'function') {
          inspectNode(node.id);
          const editorRight = document.querySelector('#editor-right');
          if (editorRight) editorRight.classList.remove('collapsed');
          const ta = document.querySelector('#inp-content');
          if (ta) ta.focus();
        }
        return;
      }

      const titleElement = element.querySelector('.node-title');
      if (!titleElement) return;

      const originalTitle = node.title;
      let finished = false;

      const handleFocusout = () => {
        setTimeout(() => {
          if (!finished && !element.contains(document.activeElement)) finish();
        }, 0);
      };

      element.classList.add('editing');
      titleElement.contentEditable = 'true';
      titleElement.spellcheck = true;
      titleElement.setAttribute('role', 'textbox');
      titleElement.onpointerdown = event => event.stopPropagation();
      titleElement.onclick = event => event.stopPropagation();
      titleElement.ondblclick = event => event.stopPropagation();

      const cleanup = () => {
        titleElement.contentEditable = 'false';
        titleElement.removeAttribute('role');
        titleElement.onpointerdown = null;
        titleElement.onclick = null;
        titleElement.ondblclick = null;
        titleElement.onkeydown = null;
        element.removeEventListener('focusout', handleFocusout);
        element.classList.remove('editing');
        activeNodeEditor = null;
      };

      const finish = () => {
        if (finished) return;
        finished = true;
        const title = titleElement.innerText.replace(/[\\r\\n]+/g, ' ').trim() || originalTitle;
        titleElement.textContent = title;
        cleanup();
        if (title !== originalTitle) {
          selectedNodeIds.delete(node.id);
          selectedNodeIds.add(title);
          vscode.postMessage({ type: 'updateNode', id: node.id, title, content: node.content, shape: node.shape, color: node.color });
        }
      };

      const handleKeydown = event => {
        event.stopPropagation();
        if (event.isComposing) return;
        if (event.key === 'Escape' || event.key === 'Enter') {
          event.preventDefault();
          finish();
        }
      };

      titleElement.onkeydown = handleKeydown;
      element.addEventListener('focusout', handleFocusout);

      activeNodeEditor = { finish };
      titleElement.focus();
      const range = document.createRange();
      range.selectNodeContents(titleElement);
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }

    // Kích hoạt ô nhập nhanh để sửa hoặc thêm nhãn cạnh nối trực tiếp trên canvas
    function startInlineEdgeLabelEdit(edge, geom) {
      if (activeNodeEditor) activeNodeEditor.finish();
      const existingInput = document.querySelector('.edge-inline-input');
      if (existingInput) existingInput.remove();

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'edge-inline-input';
      input.value = edge.label || '';
      input.placeholder = 'Nhập nhãn...';

      const worldPoint = geom ? { x: geom.mx, y: geom.my } : { x: 0, y: 0 };
      input.style.left = worldPoint.x + 'px';
      input.style.top = worldPoint.y + 'px';

      world.append(input);
      input.focus();
      input.select();

      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        const newLabel = input.value.trim();
        input.remove();
        activeNodeEditor = null;
        if (newLabel !== (edge.label || '')) {
          edge.label = newLabel;
          vscode.postMessage({
            type: 'updateEdge',
            id: edge.id,
            label: newLabel,
            arrow: edge.arrow || 'forward',
            line: edge.line || 'solid'
          });
          render();
        }
      };

      const cancel = () => {
        if (finished) return;
        finished = true;
        input.remove();
        activeNodeEditor = null;
      };

      input.onkeydown = event => {
        event.stopPropagation();
        if (event.key === 'Enter') {
          event.preventDefault();
          finish();
        } else if (event.key === 'Escape') {
          event.preventDefault();
          cancel();
        }
      };

      input.onpointerdown = event => event.stopPropagation();
      input.onclick = event => event.stopPropagation();
      input.ondblclick = event => event.stopPropagation();
      input.onblur = finish;

      activeNodeEditor = { finish, cancel };
    }
  `;
}
