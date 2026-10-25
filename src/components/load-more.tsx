"use client";

import Link from "next/link";
import { useState, useTransition, type ReactNode } from "react";

export type ListChunk = { content: ReactNode; hasMore: boolean };

export function LoadMore({ initial, load, firstPage = 1, baseHref }: { initial: ListChunk; load: (page: number) => Promise<ListChunk>; firstPage?: number; baseHref?: string }) {
  const [chunks, setChunks] = useState([initial]);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(false);
  return <div>
    {chunks.map((chunk, index) => <div key={index}>{chunk.content}</div>)}
    {baseHref && <noscript><style>{"[data-load-more] { display: none; }"}</style><nav className="list-pagination" aria-label="Paginación">{firstPage > 1 && <Link href={`${baseHref}&page=${firstPage - 1}`} scroll={false}>← Anterior</Link>}{initial.hasMore && <Link href={`${baseHref}&page=${firstPage + 1}`} scroll={false}>Siguiente →</Link>}</nav></noscript>}
    {chunks.at(-1)?.hasMore && <div className="list-pagination" data-load-more>
      <button type="button" className="button-link" disabled={pending} onClick={() => {
        setError(false);
        startTransition(async () => {
          try { const next = await load(firstPage + chunks.length); setChunks((previous) => [...previous, next]); }
          catch { setError(true); }
        });
      }}>{pending ? "Cargando…" : "Cargar más"}</button>
      <span role="status">{error ? "No se pudo cargar. Vuelve a intentarlo." : pending ? "Cargando más elementos." : ""}</span>
    </div>}
  </div>;
}
