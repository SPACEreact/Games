import test from "node:test";
import assert from "node:assert/strict";
import { winner, cleanName, validCode } from "../src/rules.js";

test("wins across rows, columns and diagonals", () => {
  assert.equal(winner(["X","X","X","","","","","",""]),"X");
  assert.equal(winner(["O","","","O","","","O","",""]),"O");
  assert.equal(winner(["X","","","","X","","","","X"]),"X");
});
test("draw and unfinished boards", () => {
  assert.equal(winner(["X","O","X","X","O","O","O","X","X"]),"draw");
  assert.equal(winner(["X","","","","","","","",""]),null);
});
test("nickname is untrusted display text", () => {
  assert.equal(cleanName("<Tiger>"),"Tiger");
  assert.equal(cleanName("  Speed   Racer  "),"Speed Racer");
  assert.equal(cleanName(""),"Guest");
  assert.ok(cleanName("A".repeat(40)).length<=18);
});
test("room codes have the expected alphabet and length", () => {
  assert.equal(validCode("ABCDEFGH"),true);
  assert.equal(validCode("23456789"),true);
  assert.equal(validCode("FASTGAME"),true);
  assert.equal(validCode("ABC123"),false);
  assert.equal(validCode("11111111"),false);
  assert.equal(validCode("ABCD?FGH"),false);
});
