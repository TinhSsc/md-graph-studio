// Tìm tiêu đề tiếp theo chưa bị trùng
export function nextAvailableNodeTitle(ids: Iterable<string>): string {
  const existing = new Set(ids);
  let index = 1;
  while (existing.has(`New node ${index}`)) index += 1;
  return `New node ${index}`;
}

// Đảm bảo tiêu đề node là duy nhất
export function uniqueNodeTitle(requested: string, currentId: string, ids: Iterable<string>): string {
  const title = requested.trim().replace(/\s+/g, ' ') || currentId;
  const existing = new Set([...ids].filter((id) => id !== currentId));
  if (!existing.has(title)) return title;

  let suffix = 2;
  while (existing.has(`${title} ${suffix}`)) suffix += 1;
  return `${title} ${suffix}`;
}

// Sinh định danh ngẫu nhiên duy nhất cho node
export function generateNodeId(ids: Iterable<string>): string {
  const existing = new Set(ids);
  let id = '';
  do {
    id = `node-${Math.random().toString(36).slice(2, 6)}`;
  } while (existing.has(id));
  return id;
}
