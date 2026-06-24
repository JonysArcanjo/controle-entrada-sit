const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "admin.html"), "utf8");
const script = fs.readFileSync(path.join(root, "admin.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "admin.css"), "utf8");

test("admin exposes a dedicated print test view", () => {
  assert.match(html, /data-admin-view="teste-impressao"/);
  assert.match(html, /data-admin-panel="teste-impressao"/);
  assert.match(html, /id="printTestQuantity"/);
  assert.match(html, /id="printTestDelaySeconds"[^>]*min="1"[^>]*max="10"[^>]*value="3"/);
  assert.match(html, /id="startPrintTestButton"/);
  assert.match(html, /id="printTestProgressBar"/);
});

test("admin calls print test API and tracks batch progress", () => {
  assert.match(script, /action:\s*"printTestInfo"/);
  assert.match(script, /action:\s*"startPrintTest"/);
  assert.match(script, /delaySeconds/);
  assert.match(script, /action:\s*"printTestStatus"/);
  assert.match(script, /PRINT_TEST_REFRESH_MS\s*=\s*1000/);
  assert.match(script, /printTestProgressBar\.style\.width/);
});

test("print test panel has responsive component styles", () => {
  assert.match(styles, /\.print-test-card/);
  assert.match(styles, /\.print-test-config-grid/);
  assert.match(styles, /\.print-test-progress/);
});

test("company report identifies full participant coverage", () => {
  assert.match(html, /Participantes por empresa[\s\S]*100% dos inscritos/);
});

test("admin shows system status with deploy metadata", () => {
  assert.match(html, /Status do sistema/);
  assert.match(html, /id="systemVersion"/);
  assert.match(html, /id="systemBuildTime"/);
  assert.match(html, /id="systemDataSource"/);
  assert.match(html, /id="systemAdminAuth"/);
  assert.match(html, /id="systemLastBackup"/);
  assert.match(html, /id="systemPrintingStatus"/);
  assert.match(script, /action:\s*"version"/);
  assert.match(script, /renderSystemStatus/);
  assert.match(styles, /\.system-status-card/);
  assert.match(styles, /\.system-status-grid/);
});
