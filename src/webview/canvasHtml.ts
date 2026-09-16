import type { GraphDocument } from '../model/graphTypes';
import { getCanvasScript } from './canvasScript';
import { getCanvasStyles } from './canvasStyles';
import { getCanvasTemplate } from './canvasTemplate';

export function canvasHtml(graph: GraphDocument, cspSource?: string): string {
  const data = JSON.stringify(graph).replace(/</g, '\\u003c');
  const styles = getCanvasStyles();
  const template = getCanvasTemplate();
  const script = getCanvasScript(data);
  const cspMeta = cspSource
    ? `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self' data: https: vscode-resource: ${cspSource}; style-src 'unsafe-inline'; script-src 'unsafe-inline';">`
    : '';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  ${cspMeta}
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Markdown Graph Studio</title>
  <style>${styles}</style>
</head>
<body>
  ${template}
  <script>${script}</script>
</body>
</html>`;
}
