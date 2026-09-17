/**
 * Inspector panel handlers for md-graph-studio webview.
 */
import { getNodeIconsScript } from './canvasIcons';

export function getCanvasInspectorScript(): string {
  return `
    ${getNodeIconsScript()}
    function highlightSelection() {
      document.body.classList.toggle('editing-edge', Boolean(selectedEdgeId));
      document.querySelectorAll('.node.selected').forEach(el => el.classList.remove('selected'));
      document.querySelectorAll('.edge.selected').forEach(el => el.classList.remove('selected'));

      selectedNodeIds.forEach(id => {
        const el = document.querySelector('#node-' + CSS.escape(id));
        if (el) el.classList.add('selected');
      });
      if (selectedEdgeId) {
        const el = document.querySelector('#edge-' + CSS.escape(selectedEdgeId));
        if (el) el.classList.add('selected');
      }
    }

    function inspectEmpty() {
      editorBody.innerHTML = '<p style="color:var(--muted);text-align:center;margin-top:30px;">Select a node or edge to view properties.</p>';
    }

    function inspectMulti() {
      editorBody.innerHTML = '<h3 style="margin-top:0;font-size:12px;">' + selectedNodeIds.size + ' Nodes Selected</h3>' +
        '<div class="actions"><button class="btn-danger" id="insp-del-multi">Delete All Selected</button></div>';
      const delBtn = document.querySelector('#insp-del-multi');
      if (delBtn) {
        delBtn.onclick = () => {
          vscode.postMessage({ type: 'deleteNodes', ids: Array.from(selectedNodeIds) });
          selectedNodeIds.clear();
          render();
        };
      }
    }

    function inspectNode(id, focus) {
      const n = findNode(id);
      if (!n) { inspectEmpty(); return; }
      const cleanLines = (n.content || '').split(String.fromCharCode(10)).filter(function(l) {
        const t = l.trim();
        return t.indexOf('[[') === -1 && t.indexOf('<!--') === -1;
      });
      const cleanContent = cleanLines.join(String.fromCharCode(10)).trim();

      editorBody.innerHTML = '<div class="field"><label>Title</label><input id="inp-title" value="' + esc(n.title) + '"></div>' +
        '<div class="field">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:3px;">' +
            '<label style="margin-bottom:0;">Content (Markdown)</label>' +
            '<button type="button" class="md-btn" id="btn-md-preview" style="font-size:10px;padding:1px 5px;">Preview</button>' +
          '</div>' +
          '<div class="md-toolbar" id="md-toolbar">' +
            '<button type="button" class="md-btn" data-md="bold" title="Bold (**)">B</button>' +
            '<button type="button" class="md-btn" data-md="italic" title="Italic (*)" style="font-style:italic;">I</button>' +
            '<button type="button" class="md-btn" data-md="code" title="Inline code (\`)">&lt;/&gt;</button>' +
            '<button type="button" class="md-btn" data-md="codeblock" title="Code block (\`\`\`)">\`\`\`</button>' +
            '<button type="button" class="md-btn" data-md="list" title="Bullet list (-)">• List</button>' +
            '<button type="button" class="md-btn" data-md="task" title="Task list (- [ ])">☑ Task</button>' +
            '<button type="button" class="md-btn" data-md="link" title="Link ([title](url))">Link</button>' +
            '<button type="button" class="md-btn" data-md="image" title="Image (![alt](path))">Img</button>' +
            '<button type="button" class="md-btn" data-md="quote" title="Quote (&gt;)">&gt;</button>' +
          '</div>' +
          '<textarea id="inp-content">' + esc(cleanContent) + '</textarea>' +
          '<div id="insp-md-preview" class="md-preview-pane"></div>' +
        '</div>' +
        '<button id="insp-apply-style" class="btn-secondary">Apply toolbar style</button>' +
        '<div class="actions"><button class="btn-danger" id="insp-del">Delete</button><button class="btn-primary" id="insp-save">Save</button></div>';

      function insertMarkdown(prefix, suffix, defaultText) {
        const ta = document.querySelector('#inp-content');
        if (!ta) return;
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const sel = ta.value.substring(start, end) || defaultText || '';
        const replacement = prefix + sel + suffix;
        ta.value = ta.value.substring(0, start) + replacement + ta.value.substring(end);
        ta.focus();
        ta.selectionStart = start + prefix.length;
        ta.selectionEnd = start + prefix.length + sel.length;
      }

      document.querySelectorAll('#md-toolbar .md-btn').forEach(btn => {
        btn.onclick = e => {
          e.preventDefault();
          const action = btn.dataset.md;
          if (action === 'bold') insertMarkdown('**', '**', 'bold text');
          else if (action === 'italic') insertMarkdown('*', '*', 'italic text');
          else if (action === 'code') insertMarkdown('\`', '\`', 'code');
          else if (action === 'codeblock') insertMarkdown('\`\`\`ts\\n', '\\n\`\`\`', '// code');
          else if (action === 'list') insertMarkdown('- ', '', 'list item');
          else if (action === 'task') insertMarkdown('- [ ] ', '', 'task item');
          else if (action === 'link') insertMarkdown('[', '](https://)', 'link title');
          else if (action === 'image') insertMarkdown('![', '](./image.png)', 'Alt text');
          else if (action === 'quote') insertMarkdown('> ', '', 'quote');
        };
      });

      const previewBtn = document.querySelector('#btn-md-preview');
      const contentTa = document.querySelector('#inp-content');
      const previewPane = document.querySelector('#insp-md-preview');
      if (previewBtn && contentTa && previewPane) {
        let isPreview = false;
        previewBtn.onclick = () => {
          isPreview = !isPreview;
          if (isPreview) {
            previewPane.innerHTML = renderMarkdownToHtml(contentTa.value, n.id);
            previewPane.style.display = 'block';
            contentTa.style.display = 'none';
            previewBtn.textContent = 'Edit';
            previewBtn.style.color = 'var(--focus)';
          } else {
            previewPane.style.display = 'none';
            contentTa.style.display = 'block';
            previewBtn.textContent = 'Preview';
            previewBtn.style.color = '';
            contentTa.focus();
          }
        };
      }

      const save = (shape = n.shape, color = n.color) => {
        vscode.postMessage({
          type: 'updateNode',
          id: n.id,
          title: document.querySelector('#inp-title').value.trim(),
          shape,
          color,
          content: document.querySelector('#inp-content').value
        });
      };
      document.querySelector('#insp-save').onclick = () => save();
      document.querySelector('#insp-apply-style').onclick = () => save(nodeShapeSelect.value, nodeColorSelect.value);
      document.querySelector('#inp-content').onkeydown = e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') save(); };
      document.querySelector('#insp-del').onclick = () => {
        vscode.postMessage({ type: 'deleteNode', id: n.id });
        selectedNodeIds.delete(n.id);
        render();
      };
      if (focus) document.querySelector('#inp-content').focus();
    }

    function inspectEdge(id) {
      const e = findEdge(id);
      if (!e) { inspectEmpty(); return; }
      editorBody.innerHTML = '<div class="field"><label>Label</label><input id="inp-label" value="' + esc(e.label || '') + '"></div>' +
        '<div class="field"><label>Arrow</label><select id="inp-arrow">' +
        ['forward', 'backward', 'both', 'none'].map(x => '<option ' + (x === e.arrow ? 'selected' : '') + '>' + x + '</option>').join('') +
        '</select></div>' +
        '<div class="field"><label>Line Style</label><select id="inp-line">' +
        ['solid', 'dashed', 'dotted'].map(x => '<option ' + (x === e.line ? 'selected' : '') + '>' + x + '</option>').join('') +
        '</select></div>' +
        '<div class="actions"><button class="btn-danger" id="insp-del">Delete</button><button class="btn-primary" id="insp-save">Save</button></div>';

      document.querySelector('#insp-save').onclick = () => vscode.postMessage({
        type: 'updateEdge',
        id: e.id,
        label: document.querySelector('#inp-label').value.trim(),
        arrow: document.querySelector('#inp-arrow').value,
        line: document.querySelector('#inp-line').value
      });
      document.querySelector('#insp-del').onclick = () => {
        vscode.postMessage({ type: 'deleteEdge', id: e.id });
        selectedEdgeId = null;
        render();
      };
    }
  `;
}
