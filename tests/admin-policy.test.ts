import assert from "node:assert/strict";
import { test } from "node:test";
import { assertAdminIdentity, AccessDenied } from "../src/server/admin-policy";

// No external service or identity is involved in these policy checks.
test("a Google session never implies admin access without the explicitly configured ID", () => {
  for (const [user, configured] of [[null, "owner"], ["owner", undefined], ["owner", ""], ["owner", "   "], ["another-user", "owner"], ["OWNER", "owner"]] as const) {
    assert.throws(() => assertAdminIdentity(user, configured), AccessDenied);
  }
  assert.doesNotThrow(() => assertAdminIdentity("owner", "owner"));
});
