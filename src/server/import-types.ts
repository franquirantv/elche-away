import type { ImportInput } from "./import-input";
import type { ImportPreview } from "../db/fixture-import";
export type ImportState = {
  message: string; ok: boolean; input?: ImportInput; names?: string[];
  preview?: ImportPreview; token?: string;
};
export const importCategoryLabels = { new: "Partido nuevo", unchanged: "Coincidencia sin cambios", update: "Actualización propuesta", protected: "Corrección local protegida", conflict: "Conflicto manual" } as const;
