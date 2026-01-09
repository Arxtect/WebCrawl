export function parseTagList(value: string) {
  return value
    .split(",")
    .map(tag => tag.trim())
    .filter(Boolean);
}

export function joinUrl(base: string, path: string) {
  if (base.endsWith("/")) {
    return `${base.slice(0, -1)}${path}`;
  }
  return `${base}${path}`;
}
