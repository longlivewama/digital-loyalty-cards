import { test } from "node:test";
import assert from "node:assert/strict";
import { GOAL, cycle, displayStamps, remaining, rewardsAvailable } from "../lib/loyalty";

test("the default goal is 9 stamps (buy 9, the 10th is free)", () => {
  assert.equal(GOAL, 9);
});

test("progress through one card", () => {
  assert.deepEqual([0, 1, 6, 8].map((p) => cycle(p)), [0, 1, 6, 8]);
  assert.equal(remaining(6), 3);
  assert.equal(rewardsAvailable(8), 0);
});

test("9 stamps = 1 free coffee, shown as a full card", () => {
  assert.equal(rewardsAvailable(9), 1);
  assert.equal(cycle(9), 0);
  assert.equal(displayStamps(9), 9); // 9/9, not 0/9
  assert.equal(displayStamps(6), 6);
});

test("redeeming subtracts the goal and keeps extra stamps", () => {
  assert.equal(9 - GOAL, 0);
  assert.equal(displayStamps(11 - GOAL), 2);
  assert.equal(rewardsAvailable(18), 2);
});

test("negative or odd balances never break the display", () => {
  assert.equal(rewardsAvailable(-3), 0);
  assert.ok(cycle(-1) >= 0 && cycle(-1) < GOAL);
});
