const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const compose = fs.readFileSync(path.resolve(__dirname, "..", "docker-compose.yml"), "utf8");

test("app service forwards admin auth environment variables", () => {
  assert.match(compose, /ADMIN_USERNAME:\s*\$\{ADMIN_USERNAME:-admin\}/);
  assert.match(compose, /ADMIN_PASSWORD:\s*\$\{ADMIN_PASSWORD:-\}/);
});
