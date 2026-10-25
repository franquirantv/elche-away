import assert from "node:assert/strict";
import { test } from "node:test";
import { territorialProgress } from "../src/lib/geography";

test("territorial progress counts unique visited territories, islands and separate autonomous cities", () => {
  const result = territorialProgress([
    { provinceCode: "03", visits: 2 }, { provinceCode: "03", visits: 1 },
    { provinceCode: "07", visits: 1 }, { provinceCode: "35", visits: 1 },
    { provinceCode: "38", visits: 1 }, { provinceCode: "51", visits: 1 },
    { provinceCode: null, visits: 1 }, { provinceCode: "99", visits: 1 },
    { provinceCode: "28", visits: 0 },
  ]);
  assert.equal(result.provinces.length, 50);
  assert.equal(result.communities.length, 17);
  assert.equal(result.provinces.filter((item) => item.visited).length, 4);
  assert.equal(result.communities.filter((item) => item.visited).length, 3);
  assert.equal(result.knownStadiums, 6);
  assert.equal(result.visitedStadiums, 8);
  assert.deepEqual(result.cities, [{ name: "Ceuta", visited: true }, { name: "Melilla", visited: false }]);
  assert.equal(result.provinces.find((item) => item.name === "Madrid")?.visited, false);
});

test("empty archive has zero progress with explicit denominators", () => {
  const result = territorialProgress([]);
  assert.equal(result.knownStadiums, 0);
  assert.equal(result.provinces.filter((item) => item.visited).length, 0);
  assert.equal(result.communities.filter((item) => item.visited).length, 0);
});
