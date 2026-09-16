export type EditableBlockKind = 'paragraph' | 'quote' | 'code' | 'codeLanguage';

export function updateMarkdownBlock(content: string, kind: EditableBlockKind, targetIndex: number, value: string): string {
  if (!Number.isInteger(targetIndex) || targetIndex < 0) return content;
  const lines = content.split('\n');
  let paragraphIndex = 0;
  let quoteIndex = 0;
  let codeIndex = 0;

  for (let index = 0; index < lines.length; index += 1) {
    const fence = /^(\s*)(```|~~~)(.*)$/.exec(lines[index]);
    if (fence) {
      const currentCodeIndex = codeIndex++;
      const closingIndex = findClosingFence(lines, index + 1, fence[2]);
      if ((kind === 'code' || kind === 'codeLanguage') && currentCodeIndex === targetIndex) {
        if (kind === 'codeLanguage') lines[index] = `${fence[1]}${fence[2]}${value.trim()}`;
        else lines.splice(index + 1, closingIndex - index - 1, ...value.replace(/\r/g, '').split('\n'));
        return lines.join('\n');
      }
      index = closingIndex;
      continue;
    }

    const quote = /^(\s*>\s?)(.*)$/.exec(lines[index]);
    if (quote) {
      if (kind === 'quote' && quoteIndex === targetIndex) {
        lines[index] = `${quote[1]}${singleLine(value)}`;
        return lines.join('\n');
      }
      quoteIndex += 1;
      continue;
    }

    if (!isEditableParagraph(lines[index])) continue;
    if (kind === 'paragraph' && paragraphIndex === targetIndex) {
      lines[index] = singleLine(value);
      return lines.join('\n');
    }
    paragraphIndex += 1;
  }
  return content;
}

function findClosingFence(lines: string[], start: number, marker: string): number {
  for (let index = start; index < lines.length; index += 1) {
    if (new RegExp(`^\\s*${marker}`).test(lines[index])) return index;
  }
  return lines.length;
}

function isEditableParagraph(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('<!--')) return false;
  return !/^(#{1,6}\s|[-*]\s|\d+\.\s)/.test(trimmed);
}

function singleLine(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim();
}
