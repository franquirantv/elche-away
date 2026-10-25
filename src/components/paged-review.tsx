"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { PAGE_SIZE } from "@/lib/pagination";

// Retain every decision for form submission while mounting only the current page.
export function PagedReview({ items, label }: { items: { key: string; content: ReactNode; fields?: Record<string, string> }[]; label: string }) {
  const [page, setPage] = useState(1);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const container = useRef<HTMLDivElement>(null);
  const pages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const offset = (current - 1) * PAGE_SIZE;
  useLayoutEffect(() => {
    container.current?.querySelectorAll<HTMLSelectElement>("select[name]").forEach((select) => {
      if (edits[select.name] !== undefined) select.value = edits[select.name];
    });
  }, [current, edits]);
  return <div>
    <div className="paged-review-items" ref={container} onChangeCapture={(event) => {
      if (event.target instanceof HTMLSelectElement) {
        const { name, value } = event.target;
        setEdits((previous) => ({ ...previous, [name]: value }));
      }
    }}>
      {items.map((item, index) => index >= offset && index < offset + PAGE_SIZE ? <div key={item.key}>{item.content}</div> : Object.entries(item.fields ?? {}).map(([name, value]) => <input key={name} type="hidden" name={name} value={edits[name] ?? value} />))}
    </div>
    {pages > 1 && <nav aria-label={label} className="list-pagination">
      <button type="button" className="text-link" disabled={current <= 1} onClick={() => setPage(current - 1)}>← Anterior</button>
      <span>Página {current} de {pages}</span>
      <button type="button" className="text-link" disabled={current >= pages} onClick={() => setPage(current + 1)}>Siguiente →</button>
    </nav>}
  </div>;
}
