export function nextAvailableNodeTitle(ids: Iterable<string>): string {
  const existing = new Set(ids);
  let index = 1;
  while (existing.has(`New node ${index}`)) index += 1;
  return `New node ${index}`;
}

export function uniqueNodeTitle(requested: string, currentId: string, ids: Iterable<string>): string {
  const title = requested.trim().replace(/\s+/g, ' ') || currentId;
  const existing = new Set([...ids].filter((id) => id !== currentId));
  if (!existing.has(title)) return title;

  let suffix = 2;
  while (existing.has(`${title} ${suffix}`)) suffix += 1;
  return `${title} ${suffix}`;
}
