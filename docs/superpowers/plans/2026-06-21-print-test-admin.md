# Print Test Admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an admin tab that atomically confirms a chosen number of pending SQLite participants, runs their print jobs as a tracked batch, and pauses printing automatically at completion.

**Architecture:** Extend `fila_impressao` with a nullable batch identifier and store the active batch in `configuracoes`. New API actions start and inspect batches; existing completion paths detect the last terminal item and pause printing. The existing admin view system renders configuration and progress while the backend remains responsible for safety and automatic shutdown.

**Tech Stack:** Python 3 standard library, SQLite, Node/browser JavaScript, static HTML/CSS, Node test runner, Python `unittest`, Docker Compose.

---

### Task 1: Backend Batch Domain

**Files:**
- Create: `tests/test_print_test.py`
- Modify: `server.py`

- [ ] **Step 1: Write failing backend tests**

Create isolated temporary SQLite tests that replace `server.DB_PATH`, create participants, and assert:

```python
result = server.startPrintTest(5)
self.assertEqual(result["total"], 3)
self.assertEqual(server.getPrintTestStatus(result["batchId"])["aguardando"], 3)
```

Also assert active queues are rejected, selection follows `ordem_inscricao`, and a batch is not paused until its final job reaches `impresso` or `erro`.

- [ ] **Step 2: Verify RED**

Run: `PYTHONPYCACHEPREFIX=/private/tmp/pycache-sit python3 -B -m unittest tests.test_print_test -v`

Expected: FAIL because `startPrintTest` and `getPrintTestStatus` do not exist.

- [ ] **Step 3: Implement schema and batch operations**

Add `lote_teste_id TEXT` to `fila_impressao`, an index on it, `CONFIG_ACTIVE_PRINT_TEST`, and these interfaces:

```python
def getPrintTestInfo(): ...
def startPrintTest(quantity): ...
def getPrintTestStatus(batch_id): ...
def finishPrintTestIfComplete(batch_id, conn=None): ...
```

`startPrintTest` must use `BEGIN IMMEDIATE`, reject non-SQLite sources or active queue items, clamp quantity to available pending participants, update selected participants, insert jobs with one UUID batch ID, store the active batch, and enable printing in one commit.

- [ ] **Step 4: Integrate automatic pause**

Return `lote_teste_id` from internal queue rows. After `finalizarImpressao`, `registrarErroImpressao`, or cancellation, call `finishPrintTestIfComplete`; when no batch item remains in `aguardando`, `proximo da fila`, or `imprimindo agora`, set `impressao_ativa=false` and clear the active batch.

- [ ] **Step 5: Expose API actions and verify GREEN**

Route `printTestInfo`, `startPrintTest`, and `printTestStatus` in `execute_local_action`, then rerun the unittest command. Expected: all backend tests PASS.

### Task 2: Admin Interface

**Files:**
- Create: `tests/admin-print-test.test.js`
- Modify: `admin.html`
- Modify: `admin.js`
- Modify: `admin.css`

- [ ] **Step 1: Write failing structure tests**

Use `node:test` to read the static assets and assert the presence of `data-admin-view="teste-impressao"`, `data-admin-panel="teste-impressao"`, `printTestQuantity`, `startPrintTestButton`, API actions, and progress rendering.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/admin-print-test.test.js`

Expected: FAIL because the tab and controls do not exist.

- [ ] **Step 3: Add sidebar and panel markup**

Add the approved panel with pending count, printer count, numeric quantity, safety notice, start button, progress bar, counters, status text, and an accessible live region.

- [ ] **Step 4: Add frontend behavior**

Implement wrappers for `printTestInfo`, `startPrintTest`, and `printTestStatus`. Load info when the view opens, clamp the input to pending count, confirm before starting, poll every second while active, render all states, and refresh global stats and queue when complete.

- [ ] **Step 5: Style and cache bust**

Add responsive styles following existing cards and update `admin.css` and `admin.js` query versions in `admin.html`.

- [ ] **Step 6: Verify GREEN**

Run: `node --test tests/admin-print-test.test.js && node --check admin.js`

Expected: all interface tests PASS and syntax check exits 0.

### Task 3: Integrated Docker Verification

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: Run local regression suite**

Run:

```bash
PYTHONPYCACHEPREFIX=/private/tmp/pycache-sit python3 -B -m unittest tests.test_print_test -v
node --test tests/*.test.js
PYTHONPYCACHEPREFIX=/private/tmp/pycache-sit python3 -B -m py_compile server.py
node --check admin.js
node --check scripts/print-worker.js
```

Expected: all tests and syntax checks PASS.

- [ ] **Step 2: Rebuild and verify static assets**

Run: `docker compose --profile worker up -d --build app print-worker`

Verify `/admin.html` contains the new tab and current cache versions, and `docker compose ps` reports the app healthy and worker running.

- [ ] **Step 3: Execute a controlled batch**

Use a disposable copy of `participantes.db` with a temporary server whenever possible. Start a batch, assert three simultaneous jobs with the Docker worker, wait for terminal state, and assert `printingEnabled=false`, no active jobs, and zero errors.

- [ ] **Step 4: Update permanent project record**

Add summary, changed files, exact tests, timings, and final source/queue/server state to `AGENTS.md`.

- [ ] **Step 5: Final fresh verification**

Rerun the full regression suite and query `printTestInfo`, `printQueue`, and Docker health. Report only evidence from this final run.
