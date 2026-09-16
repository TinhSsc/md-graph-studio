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

      function closeList() {
        if (inList) {
          html += '</' + listType + '>';
          inList = false;
          listType = '';
        }
      }

      function formatInline(str) {
        if (!str) return '';
        let res = esc(str);

        // Images: ![alt](url)
        res = res.replace(/!\\[(.*?)\\]\\((.+?)\\)/g, (match, alt, src) => {
          const rawSrc = src.trim();
          const resolved = (graph && graph.resolvedImages && graph.resolvedImages[rawSrc]) || rawSrc;
          return '<div class="node-image-container"><img class="node-img" src="' + esc(resolved) + '" alt="' + esc(alt) + '" title="' + esc(alt) + '" loading="lazy" onerror="this.classList.add(\\'img-error\\'); this.alt=\\'[Image unavailable]\\';" /></div>';
        });

        // Links: [text](url)
        res = res.replace(/\\[(.*?)\\]\\((.+?)\\)/g, (match, label, href) => {
          return '<a href="' + esc(href) + '" class="node-link" data-href="' + esc(href) + '" title="' + esc(href) + '">' + (label || href) + '</a>';
        });

        // Bold + Italic: ***text***
        res = res.replace(/\\*\\*\\*(.*?)\\*\\*\\*/g, '<strong><em>$1</em></strong>');
        // Bold: **text**
        res = res.replace(/\\*\\*(.*?)\\*\\*/g, '<strong>$1</strong>');
        // Italic: *text*
        res = res.replace(/\\*([^*]+)\\*/g, '<em>$1</em>');
        // Strikethrough: ~~text~~
        res = res.replace(/~~(.*?)~~/g, '<del>$1</del>');
        // Inline code: \`code\`
        res = res.replace(/\`([^\`]+)\`/g, '<code class="inline-code">$1</code>');
        // Tags: #tag (letters, numbers, hyphens, underscores)
        res = res.replace(/(?:^|\\s)(#[a-zA-Z0-9_\\-]+)/g, (match, tag) => {
          return ' <span class="node-tag">' + tag + '</span>';
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
            inCodeBlock = true;
            codeBlockLang = trimmed.replace(/^(\`\`\`|~~~)/, '').trim();
            codeBlockLines = [];
          } else {
            inCodeBlock = false;
            html += '<pre class="node-code-block"' + (codeBlockLang ? ' data-lang="' + esc(codeBlockLang) + '"' : '') + '><code>' + esc(codeBlockLines.join(String.fromCharCode(10))) + '</code></pre>';
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
          continue;
        }

        // Checklist task: - [ ] or - [x]
        const taskMatch = /^\\s*[-*]\\s*\\[([ xX])\\]\\s*(.*)$/.exec(line);
        if (taskMatch) {
          closeList();
          const isDone = taskMatch[1].toLowerCase() === 'x';
          const taskText = taskMatch[2];
          html += '<div class="node-task-item' + (isDone ? ' completed' : '') + '">' +
            '<input type="checkbox" class="task-checkbox" data-node-id="' + esc(nodeId) + '" data-task-index="' + taskIndex + '" ' + (isDone ? 'checked' : '') + ' />' +
            '<span class="task-text">' + formatInline(taskText) + '</span>' +
          '</div>';
          taskIndex++;
          continue;
        }

        // Headings: ### or ####
        const headingMatch = /^\\s*(#{3,6})\\s+(.*)$/.exec(line);
        if (headingMatch) {
          closeList();
          const level = headingMatch[1].length;
          html += '<div class="node-h' + level + '">' + formatInline(headingMatch[2]) + '</div>';
          continue;
        }

        // Blockquote: >
        const quoteMatch = /^\\s*>\\s*(.*)$/.exec(line);
        if (quoteMatch) {
          closeList();
          html += '<blockquote class="node-blockquote">' + formatInline(quoteMatch[1]) + '</blockquote>';
          continue;
        }

        // Unordered list: - or *
        const ulMatch = /^\\s*[-*]\\s+(.*)$/.exec(line);
        if (ulMatch) {
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
        html += '<p class="node-paragraph">' + formatInline(line) + '</p>';
      }

      if (inCodeBlock) {
        html += '<pre class="node-code-block"><code>' + esc(codeBlockLines.join(String.fromCharCode(10))) + '</code></pre>';
      }
      closeList();
      return html;
    }
  `;
}
