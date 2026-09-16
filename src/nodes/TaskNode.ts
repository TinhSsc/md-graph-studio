export function createTaskMarkdown(text: string): string {
  return `- [ ] ${text}`;
}

export function toggleTask(content: string, taskIndex: number): string {
  let index = -1;
  return content.replace(/([-*]\s*\[)([ xX])(\])/g, (match, prefix, state, suffix) => {
    index += 1;
    if (index !== taskIndex) return match;
    return `${prefix}${state.toLowerCase() === 'x' ? ' ' : 'x'}${suffix}`;
  });
}

export function insertTaskAfterLastTask(content: string, text: string): string {
  const lines = content.split(/(?<=\n)/);
  const fenced = taskFenceMask(lines);
  let lastTaskIndex = -1;
  for (let index = 0; index < lines.length; index += 1) {
    if (!fenced[index] && /^\s*[-*]\s+\[[ xX]\]\s/.test(lines[index])) lastTaskIndex = index;
  }
  if (lastTaskIndex === -1) {
    const task = createTaskMarkdown(text);
    return content ? `${content.trimEnd()}\n\n${task}` : task;
  }
  const indent = /^\s*/.exec(lines[lastTaskIndex])![0];
  const newline = lines[lastTaskIndex].endsWith('\n') ? '' : '\n';
  lines[lastTaskIndex] = `${lines[lastTaskIndex]}${newline}${indent}${createTaskMarkdown(text)}\n`;
  return lines.join('');
}

export function deleteTask(content: string, taskIndex: number): string {
  let index = -1;
  const lines = content.split(/(?<=\n)/);
  const fenced = taskFenceMask(lines);
  return lines.filter((line, lineIndex) => {
    if (!fenced[lineIndex] && /^\s*[-*]\s+\[[ xX]\]/.test(line)) {
      index += 1;
      if (index === taskIndex) return false;
    }
    return true;
  }).join('');
}

export function updateTaskText(content: string, taskIndex: number, newText: string): string {
  let index = -1;
  const lines = content.split(/(?<=\n)/);
  const fenced = taskFenceMask(lines);
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    if (!fenced[lineIndex] && /^\s*[-*]\s+\[[ xX]\]/.test(lines[lineIndex])) {
      index += 1;
      if (index === taskIndex) {
        lines[lineIndex] = lines[lineIndex].replace(/^(\s*[-*]\s+\[[ xX]\]\s*)[^\r\n]*/, `$1${newText.trim()}`);
        break;
      }
    }
  }
  return lines.join('');
}

export function taskFenceMask(lines: string[]): boolean[] {
  let inFence = false;
  return lines.map((line) => {
    const isFence = /^\s*(```|~~~)/.test(line);
    const masked = inFence;
    if (isFence) inFence = !inFence;
    return isFence || masked;
  });
}
