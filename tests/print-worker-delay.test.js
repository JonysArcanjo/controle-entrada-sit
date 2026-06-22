const assert = require("node:assert/strict");
const test = require("node:test");

const { getDryRunDelay } = require("../scripts/print-worker-delay");

test("dry-run prefers the positive per-job delay", () => {
  assert.equal(getDryRunDelay({ simulationDelayMs: 3000 }, { dryRunDelayMs: 1000 }), 3000);
});

test("dry-run falls back to worker config for normal jobs", () => {
  assert.equal(getDryRunDelay({}, { dryRunDelayMs: 1000 }), 1000);
  assert.equal(getDryRunDelay({ simulationDelayMs: 0 }, { dryRunDelayMs: 2500 }), 2500);
});
