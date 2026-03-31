# Editor Toolbar Popover Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the current inspector-like editor UI with a fixed icon toolbar that uses mode-specific controls, removes the right sidebar, keeps bbox prompting inline, and preserves direct object editing through popovers.

**Architecture:** Rework the editor layout so the slide stage occupies the main canvas width while the toolbar becomes the single primary control surface. Keep bbox drawing and direct object editing in the same client, but split the toolbar into `bbox` and `select` presentations, with contextual popovers for text, colors, and size.

**Tech Stack:** HTML/CSS/vanilla JS in `src/editor/editor.html`, Node.js editor server in `scripts/editor-server.js`, Node Playwright e2e tests in `tests/editor/editor-ui.e2e.test.js`

---

### Task 1: Capture the redesigned UI with failing editor tests

**Files:**
- Modify: `tests/editor/editor-ui.e2e.test.js`

**Step 1: Write the failing test**

Add or update e2e coverage to assert:
- the right sidebar no longer renders
- bbox mode renders a single-line prompt input, model selector, and send button in the top toolbar
- select mode renders stable icon controls instead of the old inline form groups
- a disabled select control remains visible when no compatible object is selected

**Step 2: Run test to verify it fails**

Run: `node --test tests/editor/editor-ui.e2e.test.js`
Expected: FAIL because the old sidebar and toolbar layout are still present

**Step 3: Tighten selectors if needed**

Make the failure point specific to the redesign, not to unrelated editor timing.

### Task 2: Add failing coverage for popover-based object editing

**Files:**
- Modify: `tests/editor/editor-ui.e2e.test.js`

**Step 1: Extend the failing test**

Add assertions that:
- select mode text button opens a popover
- text edits submitted from the popover update the slide file
- size or color popovers also apply edits without requiring the old always-visible inputs

**Step 2: Run test to verify it still fails for the new behavior**

Run: `node --test tests/editor/editor-ui.e2e.test.js`
Expected: FAIL because the popover UI does not exist yet

### Task 3: Replace the layout and remove the sidebar

**Files:**
- Modify: `src/editor/editor.html`

**Step 1: Write minimal layout changes**

Refactor the editor shell so:
- the sidebar markup is removed
- the slide panel becomes the main workspace
- the toolbar is the only top-level editing surface
- the status bar remains

**Step 2: Run the targeted test**

Run: `node --test tests/editor/editor-ui.e2e.test.js`
Expected: FAIL later, after layout assertions pass but popover/select behavior is still missing

### Task 4: Implement mode-specific toolbar content

**Files:**
- Modify: `src/editor/editor.html`

**Step 1: Write minimal bbox toolbar implementation**

Add:
- compact mode buttons
- inline prompt input for bbox mode
- preserved model selector
- inline send button

Keep the existing bbox run flow and keyboard shortcut behavior intact.

**Step 2: Write minimal select toolbar implementation**

Add:
- stable icon button strip
- disabled-state capability rendering
- removal of selected object chip

**Step 3: Run the targeted test**

Run: `node --test tests/editor/editor-ui.e2e.test.js`
Expected: FAIL later on missing popover editing

### Task 5: Implement popovers and wire direct-edit actions

**Files:**
- Modify: `src/editor/editor.html`

**Step 1: Add popover state and rendering**

Implement one-open-at-a-time popovers for:
- text edit
- text color
- background color
- font size

Use compact anchored overlays that do not resize the toolbar.

**Step 2: Connect direct-edit actions**

Reuse the existing direct-edit and save pipeline so popover submissions:
- update the selected iframe element
- persist the new HTML through the save endpoint
- keep bbox mode behavior untouched

**Step 3: Run the targeted test**

Run: `node --test tests/editor/editor-ui.e2e.test.js`
Expected: PASS for redesigned toolbar coverage

### Task 6: Verify regression coverage and commit

**Files:**
- Modify: `tests/editor/editor-concurrency.e2e.test.js` only if timing/layout changes require selector updates
- Modify: `tests/editor/editor-codex-edit.test.js` only if helper behavior changes require new coverage

**Step 1: Run focused editor verification**

Run: `node --test tests/editor/editor-ui.e2e.test.js tests/editor/editor-concurrency.e2e.test.js tests/editor/editor-codex-edit.test.js`
Expected: PASS

**Step 2: Review scope**

Confirm the redesign does all of the following:
- removes the right sidebar
- keeps model selection in bbox mode
- keeps bbox as the default mode
- uses popovers for text/color/size editing
- shows unavailable actions as disabled instead of hiding them

**Step 3: Commit**

```bash
git add src/editor/editor.html tests/editor/editor-ui.e2e.test.js docs/plans/2026-03-06-editor-toolbar-popover-redesign-design.md docs/plans/2026-03-06-editor-toolbar-popover-redesign.md
git commit -m "feat: redesign editor toolbar for bbox and direct edit"
```
