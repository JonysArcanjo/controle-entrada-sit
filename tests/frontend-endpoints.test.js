const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

function readProjectFile(file) {
  return fs.readFileSync(path.resolve(__dirname, "..", file), "utf8");
}

test("browser frontends use relative application endpoints", () => {
  const app = readProjectFile("app.js");
  const admin = readProjectFile("admin.js");
  const fila = readProjectFile("fila.js");

  const endpointDeclarations = [
    app.match(/const SHEETS_ENDPOINT\s*=\s*"[^"]+"/)?.[0],
    admin.match(/const SHEETS_ENDPOINT\s*=\s*"[^"]+"/)?.[0],
    admin.match(/const PARTICIPANTS_UPLOAD_ENDPOINT\s*=\s*"[^"]+"/)?.[0],
    fila.match(/const SHEETS_ENDPOINT\s*=\s*"[^"]+"/)?.[0],
  ];

  assert.deepEqual(endpointDeclarations, [
    'const SHEETS_ENDPOINT = "/api"',
    'const SHEETS_ENDPOINT = "/api"',
    'const PARTICIPANTS_UPLOAD_ENDPOINT = "/admin/upload-participantes"',
    'const SHEETS_ENDPOINT = "/api"',
  ]);
});
