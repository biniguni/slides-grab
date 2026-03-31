# Editor Vercel Minimal Dark Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restyle the existing slide editor into a Pretendard-only, Vercel-inspired minimal dark UI while preserving the persistent inspector workflow and every current editor feature.

**Architecture:** Keep the editor as the current server-rendered HTML shell in `src/editor/editor.html`, with behavior continuing to live in the existing vanilla ES module files under `src/editor/js/`. Most of the work should stay in CSS plus a small amount of markup cleanup, while tests in `tests/editor/editor-ui.e2e.test.js` are updated first to reflect the real persistent-inspector editor contract and a few key style/layout invariants. Use @test-driven-development for each slice and @verification-before-completion before claiming the redesign is done.

**Tech Stack:** Static HTML/CSS in `src/editor/editor.html`, vanilla ES modules in `src/editor/js/*.js`, Playwright browser automation, Node.js built-in `node:test`, editor server in `scripts/editor-server.js`

---

### Task 1: Rebaseline the editor UI test around the real sidebar contract and Pretendard-only typography

**Files:**
- Modify: `tests/editor/editor-ui.e2e.test.js`
- Modify: `src/editor/editor.html`
- Test: `tests/editor/editor-ui.e2e.test.js`

**Step 1: Write the failing test**

Replace the stale top-toolbar assumptions in `tests/editor/editor-ui.e2e.test.js` with assertions that match the current editor product shape and the approved redesign typography:

```js
assert.equal(await page.locator('#editor-sidebar').count(), 1);
assert.equal(await page.locator('#editor-sidebar').isVisible(), true);
assert.equal(await page.locator('#bbox-toolbar').isVisible(), true);

const promptTag = await page.$eval('#prompt-input', (el) => el.tagName);
assert.equal(promptTag, 'TEXTAREA');

const bodyFont = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
assert.match(bodyFont, /Pretendard/i);
assert.ok(!/Geist/i.test(bodyFont), `unexpected body font stack: ${bodyFont}`);
```

Also remove or rewrite test expectations that still assume:
- no persistent sidebar
- a top-level `#slide-toolbox`
- removed select-mode trigger ids such as `#select-action-text`

**Step 2: Run test to verify it fails**

Run: `node --test tests/editor/editor-ui.e2e.test.js`

Expected: FAIL because:
- the current test file still references the removed top-toolbar contract
- the editor `<head>` still loads `Geist Sans` / `Geist Mono`
- the current root font stack still prefers Geist

**Step 3: Write minimal implementation**

In `src/editor/editor.html`, remove the Geist font imports and make Pretendard the only editor font:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css">
```

```css
--sans: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
--mono: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
```

Update the e2e file so its bbox and direct-edit scenarios use the live persistent-sidebar DOM:

```js
await page.click('#tool-mode-select');
await page.waitForFunction(() => {
  const textInput = document.querySelector('#popover-text-input');
  const sizeInput = document.querySelector('#popover-size-input');
  return textInput && sizeInput && textInput.disabled && sizeInput.disabled;
});
```

**Step 4: Run test to verify it passes**

Run: `node --test tests/editor/editor-ui.e2e.test.js`

Expected: PASS for the updated editor shell contract and Pretendard-only font assertions.

**Step 5: Commit**

```bash
git add tests/editor/editor-ui.e2e.test.js src/editor/editor.html
git commit -m "test: rebaseline editor shell contract"
```

### Task 2: Add the quieter stage shell and minimal navigation/status chrome

**Files:**
- Modify: `src/editor/editor.html`
- Modify: `tests/editor/editor-ui.e2e.test.js`
- Test: `tests/editor/editor-ui.e2e.test.js`

**Step 1: Write the failing test**

Add a layout assertion for the elevated stage shell and the restrained chrome:

```js
await page.waitForSelector('#stage-shell');

const stageShellBox = await page.locator('#stage-shell').boundingBox();
const wrapperBox = await page.locator('#slide-wrapper').boundingBox();
const navHeight = await page.$eval('.nav-bar', (el) => parseFloat(getComputedStyle(el).height));
const statusHeight = await page.$eval('.status-bar', (el) => parseFloat(getComputedStyle(el).height));

assert.ok(stageShellBox, 'stage shell not found');
assert.ok(wrapperBox, 'slide wrapper not found');
assert.ok(stageShellBox.width > wrapperBox.width, 'stage shell should frame the slide');
assert.ok(navHeight <= 48, `nav should stay compact, got ${navHeight}`);
assert.ok(statusHeight <= 36, `status bar should stay compact, got ${statusHeight}`);
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/editor/editor-ui.e2e.test.js`

Expected: FAIL because `#stage-shell` does not exist yet and the current shell styling has not been updated.

**Step 3: Write minimal implementation**

Wrap the slide frame in a dedicated shell inside `src/editor/editor.html`:

```html
<div class="slide-stage" id="slide-stage">
  <div class="stage-shell" id="stage-shell">
    <div class="slide-wrapper" id="slide-wrapper">
      ...
    </div>
  </div>
</div>
```

Then restyle the app shell with restrained neutral surfaces:

```css
.nav-bar {
  height: 44px;
  background: #08090b;
  border-bottom: 1px solid #171a20;
}

.slide-panel {
  padding: 24px 28px;
  background: #050607;
}

.stage-shell {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 28px;
  border: 1px solid #17191e;
  border-radius: 20px;
  background: #0b0d10;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.32);
}

.status-bar {
  min-height: 32px;
  background: #08090b;
  border-top: 1px solid #15181d;
}
```

Keep the existing IDs used by the editor logic, and do not move the clear-bboxes control out of `#slide-wrapper`.

**Step 4: Run test to verify it passes**

Run: `node --test tests/editor/editor-ui.e2e.test.js`

Expected: PASS with `#stage-shell` present and the compact shell assertions satisfied.

**Step 5: Commit**

```bash
git add src/editor/editor.html tests/editor/editor-ui.e2e.test.js
git commit -m "feat: add minimal editor stage shell"
```

### Task 3: Restyle the persistent inspector, send action, and overlay affordances without changing behavior

**Files:**
- Modify: `src/editor/editor.html`
- Modify: `tests/editor/editor-ui.e2e.test.js`
- Reference: `src/editor/js/editor-select.js`
- Test: `tests/editor/editor-ui.e2e.test.js`

**Step 1: Write the failing test**

Extend the UI test to lock the approved inspector direction:

```js
const sendUsesNeutralStyle = await page.$eval('#btn-send', (el) => !el.classList.contains('sidebar-btn-primary'));
assert.equal(sendUsesNeutralStyle, true, 'send button should no longer use accent-primary styling');

const sidebarWidth = await page.$eval('#editor-sidebar', (el) => el.getBoundingClientRect().width);
assert.ok(sidebarWidth >= 300 && sidebarWidth <= 380, `unexpected sidebar width: ${sidebarWidth}`);

await page.click('#tool-mode-select');
await page.waitForFunction(() => {
  const emptyHint = document.querySelector('#select-empty-hint');
  return emptyHint && /click an object/i.test(emptyHint.textContent || '');
});
```

Keep the existing direct-edit behavior assertions that verify:
- text editing
- text/background color changes
- size changes
- emphasis toggles
- alignment
- saved HTML persistence

**Step 2: Run test to verify it fails**

Run: `node --test tests/editor/editor-ui.e2e.test.js`

Expected: FAIL because the current markup still uses `sidebar-btn-primary` and the inspector styling has not been simplified yet.

**Step 3: Write minimal implementation**

In `src/editor/editor.html`:
- remove the `sidebar-btn-primary` class from `#btn-send`
- keep `#btn-send` full-width, but restyle it as a neutral action surface
- restyle `.editor-sidebar`, `.sidebar-mode-tabs`, `.sidebar-mode-tab`, `.sidebar-section`, `.sidebar-label`, `.sidebar-divider`, `.sidebar-textarea`, `.sidebar-input`, `.tool-icon-btn`, `.sidebar-object-card`, and `.sidebar-hint`
- soften `.bbox-item`, `.bbox-index`, `.bbox-action-btn`, `.object-outline.hover`, and `.object-outline.selected`

Use this visual baseline:

```css
.editor-sidebar {
  width: 336px;
  background: #0a0c0f;
  border-left: 1px solid #171a20;
}

.sidebar-mode-tabs {
  padding: 4px;
  border: 1px solid #1b1f27;
  border-radius: 14px;
  background: #0d0f13;
}

.sidebar-mode-tab.active {
  border-color: rgba(96, 165, 250, 0.28);
  background: rgba(59, 130, 246, 0.12);
}

#btn-send {
  border: 1px solid #1f2530;
  background: #111318;
  color: #f5f7fb;
}

.object-outline.selected {
  border: 1.5px solid rgba(96, 165, 250, 0.92);
  background: rgba(96, 165, 250, 0.08);
  box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.14);
}

.bbox-item.pending {
  border-color: rgba(239, 68, 68, 0.78);
  background: rgba(239, 68, 68, 0.08);
}
```

Do not change IDs used by `src/editor/js/editor-select.js` unless the JavaScript is updated in the same commit.

**Step 4: Run test to verify it passes**

Run: `node --test tests/editor/editor-ui.e2e.test.js`

Expected: PASS with the persistent inspector, neutral send action, direct-edit flow, and saved HTML assertions all intact.

**Step 5: Commit**

```bash
git add src/editor/editor.html tests/editor/editor-ui.e2e.test.js
git commit -m "feat: restyle editor inspector and overlays"
```

### Task 4: Run the focused regression suite and fix anything the redesign exposed

**Files:**
- Modify if needed: `src/editor/editor.html`
- Modify if needed: `src/editor/js/editor-dom.js`
- Modify if needed: `src/editor/js/editor-select.js`
- Modify if needed: `tests/editor/editor-ui.e2e.test.js`
- Test: `tests/editor/editor-concurrency.e2e.test.js`
- Test: `tests/editor/editor-codex-edit.test.js`
- Test: `tests/editor/editor-ui.e2e.test.js`

**Step 1: Run the regression suite**

Run:
- `node --test tests/editor/editor-codex-edit.test.js`
- `node --test tests/editor/editor-concurrency.e2e.test.js`
- `node --test tests/editor/editor-ui.e2e.test.js`

Expected:
- `editor-codex-edit.test.js`: PASS
- `editor-concurrency.e2e.test.js`: PASS
- `editor-ui.e2e.test.js`: PASS

**Step 2: Write the minimal fix for any regression**

If anything fails, keep fixes narrow:

```js
// Only update editor-dom.js / editor-select.js if a markup wrapper or id change
// broke an actual runtime selector. Do not rewrite behavior that still works.
```

Typical acceptable fixes:
- export a newly introduced wrapper element if a helper needs it
- update an e2e selector after a deliberate markup rename
- tune `scaleSlide()` padding only if the new stage shell clips the canvas

**Step 3: Re-run the regression suite**

Run:
- `node --test tests/editor/editor-codex-edit.test.js`
- `node --test tests/editor/editor-concurrency.e2e.test.js`
- `node --test tests/editor/editor-ui.e2e.test.js`

Expected: all PASS

**Step 4: Commit**

```bash
git add src/editor/editor.html src/editor/js/editor-dom.js src/editor/js/editor-select.js tests/editor/editor-ui.e2e.test.js
git commit -m "test: verify editor redesign regressions"
```
