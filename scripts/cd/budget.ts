import { number, object, string, type JsonObject } from "./http";
import { requireCondition } from "./policy";

export function assertFreeUsage(project: JsonObject) {
  const owner = object(project.owner);
  requireCondition(["free_v2", "free_v3"].includes(string(owner.subscription_type)), "NEON_NOT_FREE");
  requireCondition(number(project.compute_time_seconds) < 90 * 3600
    && number(project.data_transfer_bytes) < 4_000_000_000, "NEON_USAGE_LIMIT");
}

export function assertRecoveryCapacity(project: JsonObject, branches: JsonObject[], parentId: string) {
  requireCondition(branches.length + 2 <= Math.min(10, number(object(project.owner).branches_limit)), "NEON_BRANCH_QUOTA");
  // Shared bytes counted more than once: deliberately conservative, not a billing estimate.
  const logicalBytes = branches.reduce((total, branch) => total + number(branch.logical_size), 0);
  const source = branches.find((branch) => branch.id === parentId);
  requireCondition(source && logicalBytes + 2 * number(source.logical_size) < 800_000_000, "NEON_STORAGE_HEADROOM");
}
