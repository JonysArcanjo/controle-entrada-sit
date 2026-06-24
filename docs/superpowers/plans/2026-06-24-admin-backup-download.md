# Admin Backup Download Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add protected admin downloads for the current SQLite database and latest SQLite backup.

**Architecture:** Reuse `AdminRequestHandler` Basic Auth checks and serve files from `DB_PATH` or `BACKUP_DIR`. The admin UI adds two anchor links inside the existing system status card.

**Tech Stack:** Python `http.server`, SQLite file storage, static HTML/CSS/JS, Node test runner, Python unittest.

---

### Task 1: Protected Download Routes

**Files:**
- Modify: `server.py`
- Test: `tests/test_admin_auth.py`
- Test: `tests/test_database_backup.py`

- [ ] **Step 1: Write failing tests**

Add auth assertions for `/admin/download-db` and `/admin/download-backup` in `tests/test_admin_auth.py`. Add tests in `tests/test_database_backup.py` for helper behavior selecting `DB_PATH` and the newest backup.

- [ ] **Step 2: Verify red**

Run:

```bash
PYTHONPYCACHEPREFIX=/private/tmp/pycache-sit python3 -B -m unittest tests.test_admin_auth tests.test_database_backup -v
```

Expected: tests fail because routes/helpers do not exist yet.

- [ ] **Step 3: Implement routes**

In `server.py`, protect both download paths in `request_requires_admin_auth()`. Add helpers to resolve the requested file and a `send_file_download()` method that returns `404` when absent and streams the file with attachment headers.

- [ ] **Step 4: Verify green**

Run:

```bash
PYTHONPYCACHEPREFIX=/private/tmp/pycache-sit python3 -B -m unittest tests.test_admin_auth tests.test_database_backup -v
```

Expected: all selected tests pass.

### Task 2: Admin UI Links

**Files:**
- Modify: `admin.html`
- Modify: `admin.css`
- Modify: `tests/admin-print-test.test.js`

- [ ] **Step 1: Write failing static test**

Add expectations for `href="admin/download-db"` and `href="admin/download-backup"` plus status card link styling.

- [ ] **Step 2: Verify red**

Run:

```bash
node --test tests/admin-print-test.test.js
```

Expected: test fails because links/styles are absent.

- [ ] **Step 3: Add UI**

Add two links in the `Status do sistema` card and style them as compact admin actions.

- [ ] **Step 4: Verify green**

Run:

```bash
node --test tests/admin-print-test.test.js
```

Expected: all admin static tests pass.

### Task 3: Final Verification And Documentation

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: Run full checks**

```bash
PYTHONPYCACHEPREFIX=/private/tmp/pycache-sit python3 -B -m py_compile server.py
PYTHONPYCACHEPREFIX=/private/tmp/pycache-sit python3 -B -m unittest discover -s tests -p 'test_*.py' -v
node --test tests/*.test.js
```

- [ ] **Step 2: Update `AGENTS.md`**

Record summary, changed files, tests, and final state.

- [ ] **Step 3: Commit**

```bash
git add server.py admin.html admin.css tests/test_admin_auth.py tests/test_database_backup.py tests/admin-print-test.test.js docs/superpowers/specs/2026-06-24-admin-backup-download-design.md docs/superpowers/plans/2026-06-24-admin-backup-download.md
git commit -m "Adiciona download protegido de backups"
```

