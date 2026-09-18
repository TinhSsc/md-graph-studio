import type { GraphDocument } from '../model/graphTypes';
import { getCanvasActionBarStyles } from './canvasActionBarStyles';
import { getCanvasContentStyles } from './canvasContentStyles';
import { getCanvasArrangeStyles } from './canvasArrangeStyles';
import { getCanvasDiagnosticsStyles } from './canvasDiagnosticsStyles';
import { getCanvasFormatStyles } from './canvasFormatStyles';
import { getCanvasNodeIdentityStyles } from './canvasNodeIdentityStyles';
import { getCanvasScript } from './canvasScript';
import { getCanvasStyles } from './canvasStyles';
import { getCanvasTemplate } from './canvasTemplate';

export function canvasHtml(graph: GraphDocument): string {
  const data = JSON.stringify(graph).replace(/</g, '\\u003c');
  const styles =
    getCanvasStyles() +
    getCanvasActionBarStyles() +
    getCanvasArrangeStyles() +
    getCanvasContentStyles() +
    getCanvasDiagnosticsStyles() +
    getCanvasNodeIdentityStyles() +
    getCanvasFormatStyles();
  const template = getCanvasTemplate();
  const script = getCanvasScript(data);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
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
