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
  assert.match(script, /docker compose --profile worker up -d --build --force-recreate app print-worker/);
});

test("deploy script recreates the print worker with the app", () => {
  assert.match(script, /docker compose --profile worker up -d --build --force-recreate app print-worker/);
});

test("deploy script loads local env file before requiring admin password", () => {
  const envIndex = script.indexOf(". ./.env");
  const passwordCheckIndex = script.indexOf('if [ -z "${ADMIN_PASSWORD:-}" ]');

  assert.notEqual(envIndex, -1);
  assert.notEqual(passwordCheckIndex, -1);
  assert.ok(envIndex < passwordCheckIndex);
});

test("deploy script exports version metadata for compose", () => {
  assert.match(script, /APP_VERSION=.*git rev-parse --short HEAD/);
  assert.match(script, /APP_BUILD_TIME=.*date/);
  assert.match(script, /export APP_VERSION APP_BUILD_TIME/);
});

test("deploy script prunes old backups using backup retention", () => {
  assert.match(script, /BACKUP_RETENTION/);
  assert.match(script, /ls -1t "\$BACKUP_DIR"\/participantes-\*\.db/);
  assert.match(script, /rm -f/);
});
