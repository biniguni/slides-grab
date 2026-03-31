# Editor Direct Object Edit Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a select-object mode to the slide editor so users can click slide DOM elements and immediately edit limited text and style properties while preserving the existing bbox workflow as the default mode.

**Architecture:** Extend the current inline editor client with a second interaction mode and a direct-edit toolbar. Persist edits by updating the iframe DOM locally, serializing the slide HTML, and writing it through a new server endpoint while suppressing self-triggered iframe reloads.

**Tech Stack:** HTML/CSS/vanilla JS in `src/editor/editor.html`, Node.js + Express in `scripts/editor-server.js`, Playwright-based Node e2e tests

---

### Task 1: Capture the new behavior with failing editor e2e coverage

**Files:**
- Modify: `tests/editor/editor-ui.e2e.test.js`

**Step 1: Write the failing test**

Add an e2e test that:
- starts the editor server with temp slides
- switches the tool mode from bbox to object select
- clicks an `h1` in the iframe
- edits the selected object text, color, font weight, strikethrough, and alignment
- verifies the slide file on disk contains the changed text and inline styles
- switches back to bbox mode and confirms bbox drawing still works

**Step 2: Run test to verify it fails**

Run: `node --test tests/editor/editor-ui.e2e.test.js`
Expected: FAIL because the tool mode UI and direct-edit controls do not exist yet

**Step 3: Keep the failing assertions focused**

If the first failure is too early or ambiguous, tighten selectors/assertions until the test fails specifically on missing object-edit UI behavior.

### Task 2: Add direct-edit save support to the editor server

**Files:**
- Modify: `scripts/editor-server.js`

**Step 1: Write or extend failing coverage first**

Rely on the e2e added in Task 1 to fail on missing save behavior.

**Step 2: Write minimal implementation**

Add a JSON endpoint that:
- validates the slide filename
- accepts updated HTML content
- writes it to the correct slide file
- returns a success payload

Keep the existing `/api/apply` flow unchanged.

**Step 3: Run the targeted test**

Run: `node --test tests/editor/editor-ui.e2e.test.js`
Expected: Still FAIL, but later, because the client UI is not implemented yet

### Task 3: Implement select-object mode and inline direct-edit controls

**Files:**
- Modify: `src/editor/editor.html`

**Step 1: Write the minimal client implementation to satisfy the test**

Add:
- a top toolbox with mode buttons
- select-mode hover and selected overlays
- element hit-testing inside the iframe
- selected element state per slide
- direct-edit controls for text, colors, font size, emphasis, and alignment
- save calls to the new server endpoint
- suppression of self-triggered reloads after local saves

**Step 2: Run the targeted test**

Run: `node --test tests/editor/editor-ui.e2e.test.js`
Expected: PASS for the new direct-edit scenario and existing editor UI coverage

**Step 3: Refactor carefully**

Refine helper functions in `src/editor/editor.html` only after the test passes. Keep bbox behavior stable and avoid expanding the feature beyond the approved scope.

### Task 4: Verify regression coverage for editor flows

**Files:**
- Modify: `tests/editor/editor-concurrency.e2e.test.js` only if direct-edit changes affect shared server behavior
- Modify: `tests/editor/editor-codex-edit.test.js` only if new pure helpers are added there

**Step 1: Run focused editor test suite**

Run: `node --test tests/editor/editor-ui.e2e.test.js tests/editor/editor-concurrency.e2e.test.js tests/editor/editor-codex-edit.test.js`
Expected: PASS

**Step 2: Review against the approved scope**

Confirm the implementation does all of the following and no more:
- bbox remains the default mode
- object select requires explicit mode switch
- immediate edits are limited to the approved styling controls
- no layout move/resize behavior was added

**Step 3: Commit**

```bash
git add src/editor/editor.html scripts/editor-server.js tests/editor/editor-ui.e2e.test.js
git commit -m "feat: add direct object editing to slide editor"
```
