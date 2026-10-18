import type { Acquisition } from "./openfootball";
import type { ImportRow, PreviewReferences } from "../db/fixture-import";
export type PlannedReference = { key: string; kind: "clubs" | "seasons" | "competitions"; name: string; id: string; choice: string; startYear?: number };
export type GlobalPlan = { id: string; acquisition: Acquisition; references: PlannedReference[]; targets: Record<string, string>; resultsConfirmed: boolean; batchIndex: number; expectedSnapshot: string; approved: boolean; ready: boolean };
export type GlobalBatchPreview = { label: string; rows: ImportRow[]; candidates: { id: string; label: string }[] };
export type GlobalPreview = { batches: GlobalBatchPreview[]; references: PlannedReference[]; options: PreviewReferences; applicable: boolean; resultsConfirmed: boolean; total: number };
export type BatchOutcome = { created: number; updated: number; protectedCount: number; skipped: number };
export type BatchProgress = { index: number; result: BatchOutcome; replayed: boolean };
export type GlobalImportState = { ok: boolean; message: string; token?: string; acquisition?: Omit<Acquisition, "files">; preview?: GlobalPreview; progress?: BatchProgress[]; nextIndex?: number; batchCount?: number; approved?: boolean };
