import Link from "next/link";

export function Pagination({ page, hasMore, params }: { page: number; hasMore: boolean; params: Record<string, string | undefined> }) {
  const href = (value: number) => {
    const query = new URLSearchParams();
    for (const [key, item] of Object.entries(params)) if (item && key !== "page") query.set(key, item);
    query.set("page", String(value));
    return `/admin?${query}`;
  };
  return <nav className="list-pagination" aria-label="Paginación">
    {page > 1 && <Link prefetch={false} className="text-link" href={href(page - 1)}>← Anterior</Link>}
    <span>Página {page}</span>
    {hasMore && <Link prefetch={false} className="text-link" href={href(page + 1)}>Siguiente →</Link>}
  </nav>;
}
