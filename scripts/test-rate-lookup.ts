/**
 * Unit tests for the tax_rates row picker.
 *   npx tsx --test scripts/test-rate-lookup.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeCity, pickRate, type RateCandidate } from "../src/lib/tax/rate-lookup";

const r = (p: Partial<RateCandidate<string>> & { row: string }): RateCandidate<string> => ({
  zip5: "92337", plus4Low: null, plus4High: null, cityName: null, countyName: null, isPrimary: false, ...p,
});

const rows = [
  r({ row: "fontana", cityName: "Fontana", isPrimary: true }),
  r({ row: "uninc", cityName: null, countyName: "San Bernardino" }),
  r({ row: "stlouis", cityName: "Saint Louis" }),
  r({ row: "p4-wide", plus4Low: "0000", plus4High: "4999", cityName: "Fontana" }),
  r({ row: "p4-narrow", plus4Low: "1200", plus4High: "1299", cityName: null }),
];

test("empty input -> null", () => assert.equal(pickRate([], { city: "X", zip4: null }), null));

test("zip4 range wins, narrowest first", () => {
  const p = pickRate(rows, { city: "Fontana", zip4: "1234" })!;
  assert.equal(p.row.row, "p4-narrow");
  assert.equal(p.matchedBy, "zip4");
  assert.equal(pickRate(rows, { city: null, zip4: "0042" })!.row.row, "p4-wide");
});

test("zip4 outside every range falls through to city", () => {
  const p = pickRate(rows, { city: "st. louis", zip4: "8888" })!;
  assert.equal(p.row.row, "stlouis");
  assert.equal(p.matchedBy, "city");
});

test("city match is case/punctuation insensitive and ignores plus4 rows", () => {
  assert.equal(pickRate(rows, { city: "FONTANA", zip4: null })!.row.row, "fontana");
  assert.equal(pickRate(rows, { city: "Saint Louis", zip4: "" })!.matchedBy, "city");
});

test("unknown city -> primary", () => {
  const p = pickRate(rows, { city: "Nowhere", zip4: null })!;
  assert.equal(p.row.row, "fontana");
  assert.equal(p.matchedBy, "primary");
});

test("single row without primary flag -> only", () => {
  const p = pickRate([r({ row: "x" })], { city: null, zip4: null })!;
  assert.equal(p.matchedBy, "only");
});

test("no primary among several -> first row", () => {
  const p = pickRate([r({ row: "a" }), r({ row: "b" })], { city: null, zip4: null })!;
  assert.equal(p.row.row, "a");
});

test("zip4 with dash or 9-digit noise is ignored unless 4 digits", () => {
  assert.equal(pickRate(rows, { city: null, zip4: "12" })!.matchedBy, "primary");
});

test("normalizeCity", () => {
  assert.equal(normalizeCity("Ft. Worth"), normalizeCity("FORT WORTH"));
  assert.equal(normalizeCity("Mt Pleasant"), normalizeCity("Mount Pleasant"));
  assert.equal(normalizeCity("Winston-Salem"), "WINSTONSALEM");
  assert.equal(normalizeCity("Ste. Genevieve"), normalizeCity("Sainte Genevieve"));
});
