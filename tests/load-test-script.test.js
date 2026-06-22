const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const script = fs.readFileSync(
  path.resolve(__dirname, "..", "scripts", "enqueue-load-test.js"),
  "utf8",
);

test("load test preserves the imported participant company", () => {
  assert.doesNotMatch(script, /searchParams\.set\(["']company["']/);
});
