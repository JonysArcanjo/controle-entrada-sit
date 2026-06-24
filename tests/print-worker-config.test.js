const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const config = require(path.resolve(__dirname, "..", "print-worker.config.docker.json"));
const worker = fs.readFileSync(path.join(root, "scripts", "print-worker.js"), "utf8");

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

test("worker periodically resynchronizes printers after app restarts", () => {
  assert.match(worker, /SYNC_PRINTERS_INTERVAL_MS/);
  assert.match(worker, /setInterval\(syncPrintPrinters,\s*SYNC_PRINTERS_INTERVAL_MS\)/);
});
