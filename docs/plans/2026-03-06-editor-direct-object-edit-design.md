# Editor Direct Object Edit Design

## Goal

Add a second editor mode that lets the user click a slide object inside the iframe and apply a limited set of immediate edits without going through Codex. The existing bbox workflow remains the default mode.

## Scope

In scope:
- Keep bbox drawing as the default interaction mode.
- Add a top toolbox for mode switching and direct-edit controls.
- Add object hover and selection overlays in select mode.
- Support immediate edits for:
  - text content
  - text color
  - background color
  - font size
  - bold
  - italic
  - underline
  - strikethrough
  - text alignment
- Persist direct edits back to the slide HTML file.

Out of scope:
- layout reflow or re-positioning
- drag/move/resize
- arbitrary CSS property editing
- multi-object editing
- editing multiple slides at once

## Constraints

- The editor already renders slides in an iframe with same-origin access, so DOM hit-testing is viable.
- Current bbox behavior and Codex edit flow must remain intact.
- Reloading the iframe after every direct edit would make text editing unusable, so local saves must avoid unnecessary refresh churn.
- The implementation should favor stability over breadth; text-oriented styling is the safe first slice.

## Recommended Approach

Use a dual-mode overlay inside the existing slide wrapper:

1. `bbox` mode
   - Keep current draw-layer behavior as-is.
   - Existing bbox review actions remain available.

2. `select` mode
   - Reuse the overlay area to track pointer position.
   - Resolve the hovered element with `elementFromPoint()` inside the iframe document.
   - Ignore `html`, `head`, and `body`.
   - Show hover and selected outlines on top of the slide.
   - Bind a compact direct-edit toolbar to the selected element.

For persistence, apply changes directly to the iframe DOM and save the full updated slide HTML through a new server endpoint. This is simpler and safer than trying to patch source text with ad hoc string manipulation. To preserve editing flow, the client should mark recent local saves and ignore the next matching `fileChanged` event for that slide.

## UI Design

Add a toolbox above the slide iframe area with:
- mode toggle buttons: `Draw Boxes`, `Select Object`
- object summary chip: selected tag and short text preview
- direct-edit controls shown only in select mode when an object is selected

Direct-edit controls:
- text input for text-capable elements
- color input for text color
- color input for background color
- number input for font size
- toggle buttons: bold, italic, underline, strikethrough
- alignment buttons: left, center, right

Behavior:
- Switching to select mode disables bbox drawing.
- Existing bbox overlays remain in state, but bbox interaction stays tied to draw mode.
- Selecting an object updates the toolbar state from computed styles.
- Each control applies changes immediately to the live iframe DOM and persists them.

## Data Flow

### Selection

1. Pointer moves over overlay in select mode.
2. Client converts viewport coordinates to slide coordinates.
3. Client resolves the iframe element under that point.
4. Client stores the selected element XPath in slide state.
5. Overlay box is rendered from the element bounding rect.

### Direct Edit

1. User changes a control in the toolbox.
2. Client updates the selected DOM element inline style or text content.
3. Client serializes the iframe document with doctype.
4. Client POSTs updated HTML to the server for the current slide.
5. Server writes the file and responds.
6. Client suppresses the immediate self-triggered reload event for that slide.

## Error Handling

- If no valid element is under the cursor, hover state is cleared.
- If the selected element disappears after a reload, selection is cleared gracefully.
- Failed save requests should keep the local change visible but report the failure in the status bar and chat log.
- Text editing controls should be disabled for elements with nested child elements where replacing `textContent` would be destructive.

## Testing Strategy

- Add editor UI e2e coverage for:
  - switching from bbox mode to select mode
  - selecting an object in the iframe
  - editing text and style controls
  - verifying saved HTML contains the expected inline styles/text
  - switching back to bbox mode and ensuring drawing still works
- Add focused unit coverage for any new pure helper functions introduced for direct-edit state or serialization.

## Risks

- Saving serialized HTML can normalize formatting. This is acceptable for the first version because it preserves structure and behavior while keeping implementation scope contained.
- Some elements may derive styles from inherited CSS rather than inline styles. The toolbar should read computed styles, then write explicit inline overrides.
- Background color controls are less meaningful on transparent text nodes, but still useful for blocks and labels.
