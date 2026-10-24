import assert from "node:assert/strict";
import { test } from "node:test";
import { mapDetailHref, mapSelection } from "../src/lib/map-navigation";

test("map URLs select one resource and reject ambiguous or unsupported state", () => {
  assert.deepEqual(mapSelection({}), { kind: "map" });
  assert.deepEqual(mapSelection({ view: "trips", utm_source: "archive" }), { kind: "view", view: "trips" });
  assert.deepEqual(mapSelection({ stadium: "a-stadium" }), { kind: "stadium", slug: "a-stadium" });
  for (const params of [{ view: "other" }, { view: ["trips", "summary"] }, { stadium: "" }, { trip: "a", stadium: "b" }, { view: "trips", trip: "a" }, { trip: "a".repeat(201) }]) {
    assert.deepEqual(mapSelection(params), { kind: "invalid" });
  }
});

test("shared resource slugs cannot inject another selection or navigation target", () => {
  const slug = "stadium & trip=other/#name";
  const url = new URL(mapDetailHref("stadium", slug), "https://archive.example");
  assert.equal(url.origin, "https://archive.example");
  assert.equal(url.pathname, "/");
  assert.equal(url.searchParams.get("stadium"), slug);
  assert.equal(url.searchParams.size, 1);
  assert.equal(url.hash, "");
});
