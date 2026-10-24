"use client";

import { useLinkStatus } from "next/link";

// Keep the hint out of normal flow so slow navigation never shifts a label.
export function ArchiveLinkStatus() {
  const { pending } = useLinkStatus();
  return <span className="archive-link-status" role="status">{pending ? "Abriendo…" : ""}</span>;
}
