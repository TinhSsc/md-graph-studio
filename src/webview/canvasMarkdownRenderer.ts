/**
 * Chuyển đổi cú pháp Markdown trong nội dung node sang cấu trúc HTML an toàn, hỗ trợ preview ảnh, code, link và task.
 */
export function getCanvasMarkdownRendererScript(): string {
  return `
    function renderMarkdownToHtml(rawText, nodeId) {
      if (!rawText) return '';
      const lines = rawText.split(String.fromCharCode(10)).filter(l => {
        const trimmed = l.trim();
        return !trimmed.startsWith('<!--') && !/^\\s*-\\s*\\[\\[.+?\\]\\]/.test(l);
      });

      let html = '';
      let inCodeBlock = false;
      let codeBlockLang = '';
      let codeBlockLines = [];
      let inList = false;
      let listType = '';
      let taskIndex = 0;
      let paragraphIndex = 0;
      let quoteIndex = 0;
      let codeIndex = 0;
      let inTaskRun = false;

      function closeList() {
        if (inList) {
          html += '</' + listType + '>';
          inList = false;
          listType = '';
        }
      }

      function closeTaskRun() {
        if (inTaskRun) {
          inTaskRun = false;
        }
      }

      function formatInline(str) {
        if (!str) return '';
        let res = esc(str);

        const codeSpans = [];
        res = res.replace(/\`([^\`]+)\`/g, (match, code) => {
          const idx = codeSpans.length;
          codeSpans.push('<code class="inline-code">' + code + '</code>');
          return '@@INLINE_CODE_' + idx + '@@';
        });

        // Images: ![alt](url)
        res = res.replace(/!\\[(.*?)\\]\\((.+?)\\)/g, (match, alt, src) => {
          const rawSrc = src.trim();
          if (/^(?:javascript|data|file):/i.test(rawSrc)) {
            return '<span class="node-blocked-link">[Blocked image source]</span>';
          }
          const resolved = (graph && graph.resolvedImages && graph.resolvedImages[rawSrc]) || rawSrc;
          return '<div class="node-image-container"><img class="node-img" src="' + esc(resolved) + '" alt="' + esc(alt) + '" title="' + esc(alt) + '" loading="lazy" onerror="this.classList.add(\\'img-error\\'); this.alt=\\'[Image unavailable]\\';" /></div>';
        });

        // Links: [text](url)
        res = res.replace(/\\[(.*?)\\]\\((.+?)\\)/g, (match, label, href) => {
          const rawHref = href.trim();
          const isExt = /^https?:\\/\\//i.test(rawHref);
          const extClass = isExt ? ' external-link' : '';
          const extIcon = isExt ? '<span class="external-icon">&nearr;</span>' : '';
          return '<a href="' + esc(rawHref) + '" class="node-link' + extClass + '" data-href="' + esc(rawHref) + '" title="' + esc(rawHref) + '">' + (label || rawHref) + extIcon + '</a>';
        });

        // Bold + Italic: ***text***
        res = res.replace(/\\*\\*\\*(.*?)\\*\\*\\*/g, '<strong><em>$1</em></strong>');
        // Bold: **text**
        res = res.replace(/\\*\\*(.*?)\\*\\*/g, '<strong>$1</strong>');
        // Italic: *text*
        res = res.replace(/\\*([^*]+)\\*/g, '<em>$1</em>');
        // Strikethrough: ~~text~~
        res = res.replace(/~~(.*?)~~/g, '<del>$1</del>');

        // Tags: #tag (letters, numbers, hyphens, underscores)
        res = res.replace(/(?:^|\\s)(#[a-zA-Z0-9_\\-]+)/g, (match, tag) => {
          return ' <span class="node-tag">' + tag + '</span>';
        });

        // Restore inline code
        res = res.replace(/@@INLINE_CODE_(\\d+)@@/g, (match, idx) => {
          return codeSpans[Number(idx)] || '';
        });

        return res;
      }

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        // Code block fence
        if (/^\\s*(\`\`\`|~~~)/.test(line)) {
          if (!inCodeBlock) {
            closeList();
            closeTaskRun();
            inCodeBlock = true;
            codeBlockLang = trimmed.replace(/^(\`\`\`|~~~)/, '').trim();
            codeBlockLines = [];
          } else {
            inCodeBlock = false;
            const rawCode = codeBlockLines.join(String.fromCharCode(10));
            html += '<pre class="node-code-block"><span class="code-language" data-edit-kind="codeLanguage" data-edit-index="' + codeIndex + '" data-raw="' + esc(encodeURIComponent(codeBlockLang)) + '">' + esc(codeBlockLang || 'text') + '</span><code data-edit-kind="code" data-edit-index="' + codeIndex + '" data-raw="' + esc(encodeURIComponent(rawCode)) + '">' + esc(rawCode) + '</code></pre>';
            codeIndex++;
            codeBlockLang = '';
            codeBlockLines = [];
          }
          continue;
        }

        if (inCodeBlock) {
          codeBlockLines.push(line);
          continue;
        }

        // Empty line
        if (!trimmed) {
          closeList();
          closeTaskRun();
          continue;
        }

        // Checklist task: - [ ] or - [x]
        const taskMatch = /^\\s*[-*]\\s*\\[([ xX])\\]\\s*(.*)$/.exec(line);
        if (taskMatch) {
          closeList();
          inTaskRun = true;
          const isDone = taskMatch[1].toLowerCase() === 'x';
          const taskText = taskMatch[2];
          html += '<div class="node-task-item' + (isDone ? ' completed' : '') + '">' +
            '<input type="checkbox" class="task-checkbox" data-node-id="' + esc(nodeId) + '" data-task-index="' + taskIndex + '" ' + (isDone ? 'checked' : '') + ' />' +
            '<span class="task-text" data-node-id="' + esc(nodeId) + '" data-task-index="' + taskIndex + '">' + formatInline(taskText) + '</span>' +
            '<button type="button" class="task-delete-btn" data-node-id="' + esc(nodeId) + '" data-task-index="' + taskIndex + '" title="Delete task" aria-label="Delete task">&times;</button>' +
          '</div>';
          taskIndex++;
          continue;
        }

        // Headings: ### or ####
        const headingMatch = /^\\s*(#{3,6})\\s+(.*)$/.exec(line);
        if (headingMatch) {
          closeList();
          closeTaskRun();
          const level = headingMatch[1].length;
          html += '<div class="node-h' + level + '">' + formatInline(headingMatch[2]) + '</div>';
          continue;
        }

        // Blockquote: >
        const quoteMatch = /^\\s*>\\s*(.*)$/.exec(line);
        if (quoteMatch) {
          closeList();
          closeTaskRun();
          html += '<blockquote class="node-blockquote" data-edit-kind="quote" data-edit-index="' + quoteIndex + '" data-raw="' + esc(encodeURIComponent(quoteMatch[1])) + '">' + formatInline(quoteMatch[1]) + '</blockquote>';
          quoteIndex++;
          continue;
        }

        // Unordered list: - or *
        const ulMatch = /^\\s*[-*]\\s+(.*)$/.exec(line);
        if (ulMatch) {
          closeTaskRun();
          if (!inList || listType !== 'ul') {
            closeList();
            html += '<ul class="node-list">';
            inList = true;
            listType = 'ul';
          }
          html += '<li>' + formatInline(ulMatch[1]) + '</li>';
          continue;
        }

        // Ordered list: 1.
        const olMatch = /^\\s*\\d+\\.\\s+(.*)$/.exec(line);
        if (olMatch) {
          closeTaskRun();
          if (!inList || listType !== 'ol') {
            closeList();
            html += '<ol class="node-list">';
            inList = true;
            listType = 'ol';
          }
          html += '<li>' + formatInline(olMatch[1]) + '</li>';
          continue;
        }

        closeList();
        closeTaskRun();
        html += '<p class="node-paragraph" data-edit-kind="paragraph" data-edit-index="' + paragraphIndex + '" data-raw="' + esc(encodeURIComponent(line)) + '">' + formatInline(line) + '</p>';
        paragraphIndex++;
      }

      if (inCodeBlock) {
        const rawCode = codeBlockLines.join(String.fromCharCode(10));
        html += '<pre class="node-code-block"><span class="code-language" data-edit-kind="codeLanguage" data-edit-index="' + codeIndex + '" data-raw="' + esc(encodeURIComponent(codeBlockLang)) + '">' + esc(codeBlockLang || 'text') + '</span><code data-edit-kind="code" data-edit-index="' + codeIndex + '" data-raw="' + esc(encodeURIComponent(rawCode)) + '">' + esc(rawCode) + '</code></pre>';
      }
      closeList();
      closeTaskRun();
      return html;
    }
  `;
}
