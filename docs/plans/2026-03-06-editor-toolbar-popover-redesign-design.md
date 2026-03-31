# Editor Toolbar Popover Redesign Design

## Goal

Redesign the slide editor toolbar so it behaves like a compact icon tool strip instead of a shifting inspector form. The bbox workflow remains available, but the primary controls move into a stable top toolbar with mode-specific actions.

## Scope

In scope:
- remove the right-side chat/log inspector from the editor UI
- keep bbox drawing as an explicit mode
- keep model selection in bbox mode
- add a single-line Codex prompt input in bbox mode
- redesign object editing around icon buttons and contextual popovers
- keep unavailable object-edit actions visible but disabled
- stop showing selected DOM tag names or object labels in the toolbar

Out of scope:
- restoring prompt history or execution logs in another panel
- layout move/resize/reposition editing
- arbitrary CSS editing
- multi-object editing
- object hierarchy inspection

## Problems With The Current Toolbar

- The toolbar exposes full inline form controls all the time, so width changes when the selected object text changes.
- The selected object chip and inline input groups compete for horizontal space.
- The right sidebar duplicates the top-level editing flow and adds visual weight without being central to the bbox workflow.
- The current direct-edit UI feels like an inspector, not like a fast editing tool.

## Recommended Approach

Use a fixed-height icon toolbar with two mutually exclusive modes:

1. `BBox` mode
   - The toolbar shows:
     - `BBox` mode button
     - `Select` mode button
     - one-line prompt input
     - model selector
     - send button
   - No direct object-edit controls are shown.

2. `Select` mode
   - The toolbar shows:
     - `BBox` mode button
     - `Select` mode button
     - text edit button
     - text color button
     - background color button
     - font size button
     - bold toggle
     - italic toggle
     - underline toggle
     - strikethrough toggle
     - align left / center / right toggles
   - Text, colors, and size open compact popovers.
   - Toggle-style actions apply immediately.
   - Unsupported actions remain in place but disabled.

This keeps the toolbar frame stable while letting the content inside it change only by mode, not by object text length.

## Layout

- Keep the existing navigation bar at the top.
- Place the toolbar directly below navigation, above the slide stage.
- Remove the entire right sidebar from the layout.
- Let the slide stage consume the reclaimed horizontal width.
- Keep the status bar at the bottom.

Toolbar composition:
- Left cluster: mode switcher
- Center/right cluster in bbox mode: prompt input, model select, send
- Center/right cluster in select mode: icon buttons with separators

The toolbar height stays fixed. Popovers render anchored below the clicked icon and do not resize the toolbar itself.

## Interaction Model

### BBox Mode

- Default mode remains bbox drawing.
- Dragging on the slide creates red pending boxes as before.
- The prompt input becomes the primary Codex entry point.
- `Cmd/Ctrl+Enter` should still submit when the prompt input is focused.

### Select Mode

- Clicking an object selects it.
- Hover and selected outlines remain over the iframe.
- Buttons are enabled or disabled based on the currently selected element.
- No selected object chip is shown.

### Popovers

- Only one popover may be open at a time.
- Clicking the active icon toggles its popover closed.
- Clicking outside the toolbar or popover closes the open popover.
- Switching tool mode closes any open popover.
- Changing slides clears popovers and selection state.

## Data Flow

### BBox Flow

1. User draws or reruns bbox selections.
2. User enters a short prompt in the toolbar input.
3. User picks the model from the toolbar selector.
4. Client submits the same payload to the existing Codex run path.

### Select Flow

1. User switches to select mode.
2. Client hit-tests the iframe DOM and stores the selected object XPath.
3. Toolbar computes capability flags for the selected element.
4. User opens a popover or presses a toggle button.
5. Client updates inline style or text content in the iframe DOM.
6. Client persists the edited slide HTML through the existing save endpoint added for issue #10.

## Capability Rules

- `Text`: enabled only for direct text tags already supported by the first version (`p`, `h1`-`h6`, `li`) and simple editable text nodes.
- `Text color`: enabled when a selected element can receive text styling.
- `Background`: enabled for selected block elements where background color is meaningful.
- `Size`: enabled for text-capable elements.
- `Bold`, `Italic`, `Underline`, `Strikethrough`: enabled for text-capable elements.
- `Align`: enabled for text-capable elements or containers whose text alignment is already editable in the current model.

When capability is ambiguous, prefer disabling the control instead of applying a potentially destructive edit.

## Error Handling

- No selected object: all select-mode action buttons are disabled.
- Save failure: preserve the local visual change, show the failure in the status bar, and keep the object selected.
- Popover submit failure: close nothing automatically; keep the current input visible so the user can retry or cancel.
- Slide reload that invalidates the selection: clear selection and disable controls.

## Testing Strategy

- Update editor e2e coverage to assert:
  - the sidebar is gone
  - the toolbar remains visible above the stage
  - bbox mode shows prompt input, model select, and send
  - select mode shows the icon toolset
  - disabled controls stay rendered without shifting layout
  - text/color/size popovers open and apply edits
  - bbox workflow still works after switching modes
- Keep the existing direct-edit persistence checks by verifying saved slide HTML on disk.

## Risks

- Removing the sidebar changes several selectors and layout assumptions in the test suite.
- Popover focus management can introduce stale open states if slide reload and pointer events race.
- Reusing the existing direct-edit model helps limit scope, but some controls may need stricter capability checks to avoid enabling invalid edits.
