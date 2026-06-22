# Print Delay and Centered Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-batch simulated print duration and center the upload modal exactly in the viewport.

**Architecture:** Store an optional simulated delay on each print queue job and expose it to the worker, which applies it only in dry-run mode. Add the delay control to the existing print-test panel. Keep modal positioning as an isolated CSS change using a fixed full-viewport grid.

**Tech Stack:** Python 3, SQLite, Node.js, static HTML/CSS/JavaScript, Python unittest, Node test runner, Docker Compose.

---

### Task 1: Persist and Expose Per-Job Delay

**Files:**
- Modify: `tests/test_print_test.py`
- Modify: `server.py`
- Modify: `sqlite-schema.sql`

- [ ] Add failing tests asserting default 3000ms, clamping to 1000/10000ms, response `delaySeconds`, and job `simulationDelayMs`.
- [ ] Run `python3 -B -m unittest tests.test_print_test -v`; expect failures because `startPrintTest` does not accept the delay.
- [ ] Add optional `atraso_simulado_ms INTEGER`, pass it through `adicionarItemFila`, and expose it in `fila_row_to_api`.
- [ ] Parse `delaySeconds` in `startPrintTest`, default to 3, clamp to 1..10, and persist milliseconds on every batch job.
- [ ] Route `delaySeconds` from `handle_api_action` and rerun backend tests; expect PASS.

### Task 2: Apply Delay in Dry-Run Worker

**Files:**
- Create: `tests/print-worker-delay.test.js`
- Modify: `scripts/print-worker.js`

- [ ] Add a failing source-level test requiring a reusable `getDryRunDelay(job, config)` policy and exports guarded by `require.main === module`.
- [ ] Run `node --test tests/print-worker-delay.test.js`; expect failure because the helper is absent.
- [ ] Implement `getDryRunDelay`: use positive integer `job.simulationDelayMs`, otherwise `config.dryRunDelayMs || 1000`.
- [ ] Use the helper only in the `dryRun` branch and export it without starting `main()` during tests.
- [ ] Rerun all Node tests and syntax checks; expect PASS.

### Task 3: Add Delay Control to Admin

**Files:**
- Modify: `tests/admin-print-test.test.js`
- Modify: `admin.html`
- Modify: `admin.js`

- [ ] Add failing assertions for `printTestDelaySeconds`, limits 1/10, default 3, and `delaySeconds` in the API request.
- [ ] Run `node --test tests/admin-print-test.test.js`; expect failure.
- [ ] Add the numeric field next to quantity and send its clamped integer in `startPrintTest`.
- [ ] Include quantity and seconds in the confirmation and result message.
- [ ] Increment `admin.js` cache bust and rerun tests; expect PASS.

### Task 4: Center Upload Modal

**Files:**
- Create: `tests/admin-modal.test.js`
- Modify: `admin.css`
- Modify: `admin.html`

- [ ] Add failing CSS assertions for fixed full-screen backdrop, `place-items: center`, edge padding, modal max-height, and vertical overflow.
- [ ] Run `node --test tests/admin-modal.test.js`; expect failure against the current bottom-aligned layout.
- [ ] Update `.modal-backdrop` and `.upload-modal` to center in the viewport and scroll internally on short screens.
- [ ] Increment `admin.css` cache bust and rerun tests; expect PASS.

### Task 5: Docker Integration and Documentation

**Files:**
- Modify: `AGENTS.md`

- [ ] Run all Python and Node tests plus syntax checks.
- [ ] Rebuild app and worker with Docker Compose.
- [ ] Import or create a disposable pending participant if needed, start a one-item batch at 3 seconds, measure duration, and verify automatic pause.
- [ ] Verify served HTML cache versions and modal CSS.
- [ ] Update `AGENTS.md` with changes, tests, timing, queue, source, and container state.
- [ ] Run a final fresh verification before reporting completion.
