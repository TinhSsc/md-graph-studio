/**
 * Webview surface for graph diagnostics: issues chip in the top toolbar,
 * a toggleable issues panel and per-node warning badges. This script is
 * embedded verbatim inside the canvas IIFE, so it obeys the same constraints
 * as the rest of the webview: no backticks, no template interpolation, no
 * regex literals and string concatenation only. esc() comes from canvasScript.
 */
export function getCanvasDiagnosticsScript(): string {
  return `
    let diagnosticsSnapshot = [];

    function normalizedDiagSeverity(severity) {
      if (severity === 'error' || severity === 'info') return severity;
      return 'warning';
    }

    function diagnosticIcon(severity) {
      if (severity === 'error') return '✖';
      if (severity === 'info') return 'ⓘ';
      return '⚠';
    }

    function ensureDiagnosticsChip() {
      const existing = document.getElementById('mgs-diag-chip');
      if (existing) return existing;
      const toolbar = document.getElementById('toolbar-top');
      if (!toolbar) return null;
      const chip = document.createElement('button');
      chip.id = 'mgs-diag-chip';
      chip.className = 'mgs-diag-chip';
      chip.setAttribute('role', 'status');
      chip.textContent = '⚠ 0 issue(s)';
      chip.style.display = 'none';
      chip.addEventListener('click', function() { toggleDiagnosticsPanel(); });
      toolbar.appendChild(chip);
      return chip;
    }

    function ensureDiagnosticsPanel() {
      const existing = document.getElementById('mgs-diag-panel');
      if (existing) return existing;
      const panel = document.createElement('div');
      panel.id = 'mgs-diag-panel';
      panel.className = 'mgs-diag-panel';
      panel.setAttribute('role', 'dialog');
      panel.style.display = 'none';
      panel.addEventListener('click', function(e) {
        const target = e.target;
        if (target && target.classList && target.classList.contains('mgs-diag-close')) {
          panel.style.display = 'none';
        }
      });
      document.body.appendChild(panel);
      return panel;
    }

    function toggleDiagnosticsPanel() {
      const panel = ensureDiagnosticsPanel();
      if (!panel) return;
      if (panel.style.display === 'block') {
        panel.style.display = 'none';
        return;
      }
      renderDiagnosticsPanel(panel);
      panel.style.display = 'block';
    }

    function renderDiagnosticsPanel(panel) {
      let errorCount = 0;
      let warningCount = 0;
      let infoCount = 0;
      for (let i = 0; i < diagnosticsSnapshot.length; i++) {
        const severity = normalizedDiagSeverity(diagnosticsSnapshot[i] && diagnosticsSnapshot[i].severity);
        if (severity === 'error') errorCount += 1;
        else if (severity === 'info') infoCount += 1;
        else warningCount += 1;
      }
      const summary = (errorCount + warningCount) + ' issue(s)' + (infoCount > 0 ? ' · ' + infoCount + ' info' : '');
      let html = '<div class="mgs-diag-head"><span class="mgs-diag-title">' + esc(summary) + '</span>'
        + '<button class="mgs-diag-close" title="Close">✕</button></div><div class="mgs-diag-rows">';
      for (let i = 0; i < diagnosticsSnapshot.length; i++) {
        const item = diagnosticsSnapshot[i] || {};
        const severity = normalizedDiagSeverity(item.severity);
        const code = item.code ? '<span class="mgs-diag-code">' + esc(item.code) + '</span>' : '';
        html += '<div class="mgs-diag-row mgs-diag-row-' + severity + '">'
          + '<span class="mgs-diag-icon">' + diagnosticIcon(severity) + '</span>'
          + '<span class="mgs-diag-msg">' + esc(item.message || '') + '</span>' + code + '</div>';
      }
      panel.innerHTML = html + '</div>';
    }

    function clearNodeDiagnosticBadges() {
      const badges = document.querySelectorAll('.node-diag-badge');
      for (let i = 0; i < badges.length; i++) badges[i].remove();
    }

    function nodeForDiagnosticOffset(graph, offset) {
      const nodes = graph && Array.isArray(graph.nodes) ? graph.nodes : [];
      for (let i = 0; i < nodes.length; i++) {
        const range = nodes[i] && nodes[i].sourceRange;
        if (!range || typeof range.start !== 'number' || typeof range.end !== 'number') continue;
        if (offset >= range.start && offset <= range.end) return nodes[i];
      }
      return null;
    }

    function refreshNodeDiagnosticBadges(graph) {
      clearNodeDiagnosticBadges();
      if (!graph || !Array.isArray(graph.diagnostics)) return;
      const worstByNode = {};
      for (let i = 0; i < graph.diagnostics.length; i++) {
        const item = graph.diagnostics[i];
        if (!item || typeof item.offset !== 'number' || !Number.isFinite(item.offset)) continue;
        const severity = normalizedDiagSeverity(item.severity);
        if (severity === 'info') continue;
        const owner = nodeForDiagnosticOffset(graph, item.offset);
        if (!owner || owner.ghost || !owner.id) continue;
        const current = worstByNode[owner.id];
        if (!current || (severity === 'error' && current.severity !== 'error')) {
          worstByNode[owner.id] = { severity: severity, message: item.message || '' };
        }
      }
      const ids = Object.keys(worstByNode);
      for (let i = 0; i < ids.length; i++) {
        const el = document.getElementById('node-' + ids[i]);
        if (!el) continue;
        const header = el.querySelector('.node-header');
        if (!header) continue;
        const badge = worstByNode[ids[i]];
        const cls = 'node-diag-badge' + (badge.severity === 'error' ? ' node-diag-badge-error' : '');
        header.insertAdjacentHTML('beforeend', '<span class="' + cls + '" title="' + esc(badge.message) + '">!</span>');
      }
    }

    function refreshDiagnosticsUI(graph) {
      try {
        const diags = (graph && graph.diagnostics) || [];
        diagnosticsSnapshot = Array.isArray(diags) ? diags : [];
        let errorCount = 0;
        let warningCount = 0;
        for (let i = 0; i < diagnosticsSnapshot.length; i++) {
          const severity = normalizedDiagSeverity(diagnosticsSnapshot[i] && diagnosticsSnapshot[i].severity);
          if (severity === 'error') errorCount += 1;
          else if (severity === 'warning') warningCount += 1;
        }
        const chip = ensureDiagnosticsChip();
        if (chip) {
          const count = errorCount + warningCount;
          chip.textContent = '⚠ ' + count + ' issue(s)';
          chip.style.display = count === 0 ? 'none' : '';
          chip.title = errorCount + ' error(s), ' + warningCount + ' warning(s)';
        }
        refreshNodeDiagnosticBadges(graph);
        const panel = document.getElementById('mgs-diag-panel');
        if (panel && panel.style.display === 'block') renderDiagnosticsPanel(panel);
      } catch (error) {
        // Diagnostics UI must never break the canvas render loop.
      }
    }
  `;
}
