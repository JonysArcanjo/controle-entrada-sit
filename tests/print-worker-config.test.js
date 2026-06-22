const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const config = require(path.resolve(__dirname, "..", "print-worker.config.docker.json"));

test("docker dry-run processes each simulated label within one second", () => {
  assert.equal(config.dryRun, true);
  assert.ok(
    config.dryRunDelayMs <= 1000,
    `dryRunDelayMs must be at most 1000ms, received ${config.dryRunDelayMs}ms`,
  );
});

test("docker worker detects a newly started queue within one second", () => {
  assert.ok(
    config.pollIntervalMs <= 1000,
    `pollIntervalMs must be at most 1000ms, received ${config.pollIntervalMs}ms`,
  );
});
