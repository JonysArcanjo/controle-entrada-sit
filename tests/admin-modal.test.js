const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const css = fs.readFileSync(path.resolve(__dirname, "..", "admin.css"), "utf8");

function rule(selector) {
  const match = css.match(new RegExp(`\\${selector}\\s*\\{([^}]+)\\}`));
  return match ? match[1] : "";
}

test("upload backdrop centers the modal in the viewport", () => {
  const backdrop = rule(".modal-backdrop");
  assert.match(backdrop, /position:\s*fixed/);
  assert.match(backdrop, /inset:\s*0/);
  assert.match(backdrop, /place-items:\s*center/);
  assert.match(backdrop, /padding:\s*20px/);
});

test("upload modal remains accessible on short screens", () => {
  const modal = rule(".upload-modal");
  assert.match(modal, /max-height:\s*calc\(100(?:dvh|vh)\s*-\s*40px\)/);
  assert.match(modal, /overflow-y:\s*auto/);
});
