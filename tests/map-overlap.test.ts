import assert from "node:assert/strict";
import { test } from "node:test";
import { markersOverlap } from "../src/lib/map-overlap";

test("marker hit areas detect identical and partially obscured stadiums", () => {
  assert.equal(markersOverlap({ x: 0, y: 0 }, { x: 0, y: 0 }), true);
  assert.equal(markersOverlap({ x: 100, y: 100 }, { x: 147, y: 155 }), true);
  assert.equal(markersOverlap({ x: 0, y: 0 }, { x: -47, y: -55 }), true);
  assert.equal(markersOverlap({ x: 0, y: 0 }, { x: 48, y: 0 }), false);
  assert.equal(markersOverlap({ x: 0, y: 0 }, { x: 0, y: 56 }), false);
});
