const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const script = fs.readFileSync(path.resolve(__dirname, "..", "scripts", "deploy.sh"), "utf8");

test("deploy script backs up sqlite database before pulling code", () => {
  const backupIndex = script.indexOf("cp participantes.db");
  const pullIndex = script.indexOf("git pull");

  assert.notEqual(backupIndex, -1);
  assert.notEqual(pullIndex, -1);
  assert.ok(backupIndex < pullIndex);
});

test("deploy script requires admin password for protected production deploy", () => {
  assert.match(script, /ADMIN_PASSWORD/);
  assert.match(script, /docker compose up -d --build app/);
});
