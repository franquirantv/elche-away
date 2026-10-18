import "server-only";
import { requireAdmin } from "./auth";
import { getDatabase } from "@/db/client";
import { readAdminFixtures } from "@/db/admin-fixtures";

export async function getAdminFixtures(filters: { seasonId?: string; competitionId?: string }) {
  await requireAdmin();
  return readAdminFixtures(getDatabase(), filters);
}
