/**
 * Converts Markdown syntax inside node bodies into safe HTML structures,
 * supporting images, code, links, autolinks, tasks, headings, blockquotes,
 * nested lists, tables and paragraphs.
 *
 * Inline pipeline order (formatInline):
 *   esc -> inline-code placeholders -> images -> links -> autolinks ->
 *   ==mark== -> *** -> ** -> * -> ~~ ->
 *   __bold__ / _italic_ (word-boundary protected) -> #tags -> restore code.
 *
 * Block features: code fences, horizontal rules, task lists, headings (h3-h6),
 * h1, single-line blockquotes, nested lists (2+ spaces per level, max depth 3),
 * tables and paragraphs.
 *
 * Edit-affordance contract: tables and horizontal rules render without inline
 * edit affordances but still advance the paragraph counter so data-edit-index
 * values stay aligned with the host-side updateMarkdownBlock line counting.
 * H1 lines advance neither the counter nor an affordance, matching the
 * host-side editable-paragraph rules (heading lines are excluded there).
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
      const listStack = [];
      let taskIndex = 0;
      let paragraphIndex = 0;
      let quoteIndex = 0;
      let listItemIndex = 0;
      let codeIndex = 0;
      let inTaskRun = false;

      function closeList() {
        while (listStack.length > 0) {
          const level = listStack.pop();
          if (level.itemOpen) html += '</li>';
          html += '</' + level.type + '>';
        }
      }

      function closeTaskRun() {
        if (inTaskRun) {
          inTaskRun = false;
        }
      }

      function splitTableRow(row) {
        return row.trim().replace(/^\\|/, '').replace(/\\|$/, '').split('|').map(cell => cell.trim());
      }

      function isTableDelimiterRow(row) {
        if (!/^\\s*\\|/.test(row)) return false;
        const cells = row.trim().replace(/^\\|/, '').replace(/\\|$/, '').split('|');
        return cells.length > 0 && cells.every(cell => /^[\\t ]*:?-+:?[\\t ]*$/.test(cell));
      }

      function parseTableAlignments(row) {
        return splitTableRow(row).map(cell => {
          if (cell.startsWith(':') && cell.endsWith(':')) return 'center';
          if (cell.endsWith(':')) return 'right';
          return 'left';
        });
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

        // Autolinks: bare http(s) URLs. Requires a start-of-string, whitespace
        // or open-paren prefix, so URLs inside href="..." attributes or already
        // converted [label](url) anchors (always preceded by a quote or bracket)
        // never match. The matched url is already escaped, trailing punctuation
        // and escaped closing brackets are pushed back out of the anchor.
        res = res.replace(/(^|[\\s(])(https?:\\/\\/[^\\s]+)/g, (match, prefix, rawUrl) => {
          let url = rawUrl;
          while (url.length > 8 && (/&(?:gt|lt|quot);$/.test(url) || /[.,;:!?})>'"\\]]$/.test(url))) {
            url = /&(?:gt|lt|quot);$/.test(url) ? url.slice(0, -4) : url.slice(0, -1);
          }
          if (!/^https?:\\/\\/.+/.test(url)) return match;
          const tail = rawUrl.slice(url.length);
          return prefix + '<a href="' + url + '" class="node-link external-link" data-href="' + url + '" title="' + url + '">' + url + '<span class="external-icon">&nearr;</span></a>' + tail;
        });

        // Highlight: ==text==
        res = res.replace(/==([^=]+)==/g, '<span class="node-mark">$1</span>');

        // Bold + Italic: ***text***
        res = res.replace(/\\*\\*\\*(.*?)\\*\\*\\*/g, '<strong><em>$1</em></strong>');
        // Bold: **text**
        res = res.replace(/\\*\\*(.*?)\\*\\*/g, '<strong>$1</strong>');
        // Italic: *text*
        res = res.replace(/\\*([^*]+)\\*/g, '<em>$1</em>');
        // Strikethrough: ~~text~~
        res = res.replace(/~~(.*?)~~/g, '<del>$1</del>');

        // Bold/Italic via underscores: requires a non-word character (or string
        // start) before the opener and a non-word character after the closer,
        // so intra-word underscores like snake_case or var_name stay literal.
        res = res.replace(/(^|[^\\w])__([^_]+?)__(?!\\w)/g, (match, prefix, text) => {
          return prefix + '<strong>' + text + '</strong>';
        });
        res = res.replace(/(^|[^\\w])_([^_]+?)_(?!\\w)/g, (match, prefix, text) => {
          return prefix + '<em>' + text + '</em>';
        });

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

        // Horizontal rule: 3+ of -, * or _ (optionally space separated), nothing else.
        // Checked before task/list handling so real list and task lines never match.
        if (/^([-*_])(?:[\\t ]*\\1){2,}[\\t ]*$/.test(trimmed)) {
          closeList();
          closeTaskRun();
          html += '<hr class="node-hr" />';
          paragraphIndex += 1;
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

        // Headings: ### to ######
        const headingMatch = /^\\s*(#{3,6})\\s+(.*)$/.exec(line);
        if (headingMatch) {
          closeList();
          closeTaskRun();
          const level = headingMatch[1].length;
          html += '<div class="node-h' + level + '">' + formatInline(headingMatch[2]) + '</div>';
          continue;
        }

        // H1: single hash inside a node body (## starts a new node at parse level)
        const h1Match = /^\\s*#\\s+(.*)$/.exec(line);
        if (h1Match) {
          closeList();
          closeTaskRun();
          html += '<div class="node-h1">' + formatInline(h1Match[1]) + '</div>';
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

        // Unordered (- or *) and ordered (1.) list items with indentation-based
        // nesting: 2+ extra spaces open a deeper level, max depth 3. Task lines
        // are matched earlier and never reach this branch.
        const ulMatch = /^(\\s*)[-*]\\s+(.*)$/.exec(line);
        const olMatch = /^(\\s*)\\d+\\.\\s+(.*)$/.exec(line);
        if (ulMatch || olMatch) {
          closeTaskRun();
          const listKind = ulMatch ? 'ul' : 'ol';
          const listContent = ulMatch ? ulMatch[2] : olMatch[2];
          const indent = (ulMatch ? ulMatch[1] : olMatch[1]).replace(/\\t/g, '  ').length;
          const current = listStack[listStack.length - 1];
          if (!current) {
            html += '<' + listKind + ' class="node-list">';
            listStack.push({ type: listKind, indent: indent, itemOpen: false });
          } else if (indent >= current.indent + 2 && listStack.length < 3) {
            html += '<' + listKind + ' class="node-list">';
            listStack.push({ type: listKind, indent: indent, itemOpen: false });
          } else if (indent < current.indent) {
            while (listStack.length > 1 && listStack[listStack.length - 1].indent > indent) {
              const level = listStack.pop();
              if (level.itemOpen) html += '</li>';
              html += '</' + level.type + '>';
            }
            const base = listStack[listStack.length - 1];
            if (base.indent <= indent && base.type !== listKind) {
              closeList();
              html += '<' + listKind + ' class="node-list">';
              listStack.push({ type: listKind, indent: indent, itemOpen: false });
            }
          } else if (current.type !== listKind) {
            closeList();
            html += '<' + listKind + ' class="node-list">';
            listStack.push({ type: listKind, indent: indent, itemOpen: false });
          }
          const target = listStack[listStack.length - 1];
          if (target.itemOpen) {
            html += '</li>';
            target.itemOpen = false;
          }
          html += '<li><span class="node-list-text" data-edit-kind="listItem" data-edit-index="' + listItemIndex + '" data-raw="' + esc(encodeURIComponent(listContent)) + '">' + formatInline(listContent) + '</span>' +
            '<button type="button" class="list-delete-btn" data-list-index="' + listItemIndex + '" title="Delete list item" aria-label="Delete list item">&times;</button>';
          listItemIndex++;
          target.itemOpen = true;
          continue;
        }

        // Table: header row starting with | followed by a delimiter row such as
        // |---|:--:---:|. Body rows continue while lines start with |. Rendered
        // without edit affordances; every consumed line advances paragraphIndex
        // so later paragraph data-edit-index values stay host-aligned.
        if (/^\\s*\\|/.test(line) && i + 1 < lines.length && isTableDelimiterRow(lines[i + 1])) {
          closeList();
          closeTaskRun();
          const alignments = parseTableAlignments(lines[i + 1]);
          const headerCells = splitTableRow(line);
          let tableHtml = '<div class="node-table-wrap"><table class="node-table"><thead><tr>';
          headerCells.forEach((cell, col) => {
            tableHtml += '<th style="text-align:' + (alignments[col] || 'left') + '">' + formatInline(cell) + '</th>';
          });
          tableHtml += '</tr></thead><tbody>';
          let rowCount = 0;
          let cursor = i + 2;
          while (cursor < lines.length && /^\\s*\\|/.test(lines[cursor])) {
            const cells = splitTableRow(lines[cursor]);
            tableHtml += '<tr>';
            for (let col = 0; col < headerCells.length; col++) {
              tableHtml += '<td style="text-align:' + (alignments[col] || 'left') + '">' + formatInline(cells[col] || '') + '</td>';
            }
            tableHtml += '</tr>';
            rowCount++;
            cursor++;
          }
          tableHtml += '</tbody></table></div>';
          html += tableHtml;
          paragraphIndex += 2 + rowCount;
          i = cursor - 1;
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
