import { icons } from './canvasIcons';
import template from './canvasTemplate.html';

export function getCanvasTemplate(): string {
  return template.replace(/{{(\w+)}}/g, (_, name: keyof typeof icons) => icons[name] ?? '');
}
