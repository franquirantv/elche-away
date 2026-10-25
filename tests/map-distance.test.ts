import assert from "node:assert/strict";
import { test } from "node:test";
import { distanceFromOrigin, distanceLabel, mapOrigin } from "../src/lib/map-distance";

test("distance uses the owner's fixed origin and one-way geographic kilometres", () => {
  assert.equal(distanceFromOrigin(...mapOrigin), 0);
  assert.ok(Math.abs(distanceFromOrigin(mapOrigin[0] + 1, mapOrigin[1]) - 111.195) < 0.001);
  assert.ok(Math.abs(distanceFromOrigin(40.4, -3.7) - 351) < 2);
  assert.ok(Math.abs(distanceFromOrigin(28.1, -15.4) - 1774) < 10);
  assert.ok(Number.isFinite(distanceFromOrigin(-mapOrigin[0], mapOrigin[1] + 180)));
  assert.equal(distanceLabel(...mapOrigin), "≈ 0 km desde Elche · línea recta · solo ida");
});
