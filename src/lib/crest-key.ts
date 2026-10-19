const uuid = "[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}";
const pattern = new RegExp(`^crests/${uuid}/${uuid}\\.webp$`);
export function isCrestKey(value: string): boolean { return pattern.test(value); }
export function crestMediaPath(key: string | null): string | null {
  return key && isCrestKey(key) ? `/media/${key}` : null;
}
