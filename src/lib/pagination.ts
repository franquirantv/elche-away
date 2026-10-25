export const PAGE_SIZE = 20;

export function pageNumber(value: unknown): number {
  if (typeof value !== "string" || !/^[1-9]\d{0,5}$/.test(value)) return 1;
  return Number(value);
}

export function pageOffset(page: number): number {
  if (!Number.isSafeInteger(page) || page < 1 || page > 999999) throw new Error("Página no válida.");
  return (page - 1) * PAGE_SIZE;
}
