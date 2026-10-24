import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveMapConfig } from "../src/lib/map-config";

test("public map defaults to Liberty even when obsolete raster settings remain", () => {
  const expected = { styleUrl: "https://tiles.openfreemap.org/styles/liberty", maxZoom: 19 };
  assert.deepEqual(resolveMapConfig({}), expected);
  assert.deepEqual(resolveMapConfig({ MAP_TILE_URL: "https://tile.openstreetmap.org/{z}/{x}/{y}.png", MAP_TILE_MAX_ZOOM: "12" }), expected);
});

test("public vector styles accept an explicit HTTPS document and bounded zoom", () => {
  assert.deepEqual(resolveMapConfig({ MAP_STYLE_URL: "https://example.org/custom-style.json", MAP_MAX_ZOOM: "17" }), { styleUrl: "https://example.org/custom-style.json", maxZoom: 17 });
});

test("invalid or credential-bearing style configuration disables the map", () => {
  for (const styleUrl of ["invalid", "http://example.org/style.json", "javascript:alert(1)", "https://user:password@example.org/style.json", "https://example.org/style.json?token=private", "https://example.org/style.json#private"]) {
    assert.equal(resolveMapConfig({ MAP_STYLE_URL: styleUrl }), null);
  }
  for (const maxZoom of ["0", "20", "12.5", "NaN", "Infinity"]) assert.equal(resolveMapConfig({ MAP_MAX_ZOOM: maxZoom }), null);
});
