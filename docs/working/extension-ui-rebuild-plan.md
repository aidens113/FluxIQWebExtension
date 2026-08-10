# Extension UI Rebuild Plan

## Goal

Replace the current card-heavy, unstable popup/side-panel UI with one coherent
application shell, persistent accessible tabs, predictable list scrolling, and
a small reusable visual system.

## Terms

- **Application shell**: the stable page frame shared by every view: header,
  connection strip, tab navigation, and content workspace.
- **Canvas**: the lowest-level page background behind the application surface.
- **Surface**: a visually grouped region placed on the canvas. A surface is not
  automatically a card; it uses a border or elevation only when that clarifies
  ownership or interaction.
- **Tab bar**: persistent navigation between peer views. It is not a set of
  toggle buttons and must never hide the current destination.
- **Active pane**: the one tab panel currently shown beneath the tab bar.
- **Scroll owner**: the one element responsible for scrolling a specific body
  of content. A view should not have both its page and list competing to scroll.
- **Inner scroll region**: a bounded scroll owner inside a pane, used for the
  event and recording lists while their heading and footer remain visible.
- **Design token**: a named reusable visual value, such as surface color,
  divider color, spacing, radius, or focus ring.

## Current Findings

- `applyLayoutMode()` hides the currently selected tab and can hide the entire
  tab bar, so the current controls behave as conditional toggles rather than
  tabs.
- The outer shell and list views compete for height and overflow ownership.
  Event and recording lists need their own bounded scroll region.
- Nearly every visible section repeats a background, border, and radius,
  fragmenting the UI into unrelated cards.
- Popup and side panel reuse markup but do not share a deliberate responsive
  shell or presentation model.

## Implementation Plan

### 1. Establish a shared application shell

**Goal:** make popup and side panel feel like the same product and give every
subsequent UI change a stable layout boundary.

Create one shared structure for popup and side panel:

```text
header
connection/status strip
content workspace
  persistent tabs
  active view
```

- Use one canvas background and one primary app surface.
- Move content views into an `app-main` workspace with a controlled minimum
  height and overflow boundary.
- Keep settings and modal overlays outside the normal workspace flow.
- Retain existing IDs and behavior while the shell is introduced.

**Implementation scope:**

- Put all normal content inside an `app-main` workspace below the header and
  connection strip.
- Keep settings drawer and modal overlays as shell-level layers so they do not
  change normal layout measurements.
- Set `min-height: 0` and `overflow` deliberately on the workspace so later
  view panes can safely own their own scrolling.
- Use the same markup hierarchy in popup and side panel; vary only size tokens
  and padding in their stylesheets.

**Acceptance criteria:**

- The header and connection strip remain stable while views change.
- Popup and side panel render the same hierarchy without duplicated logic.
- No content is clipped merely because the shell was resized.

### 2. Replace conditional toggles with accessible persistent tabs

**Goal:** provide predictable, conventional navigation between Recorder,
Events, and Recordings at every extension size.

- Keep Recorder, Events, and Recordings visible in every layout.
- Remove `combinedRecorderView` and all per-tab `hidden` behavior from
  `applyLayoutMode()`.
- Use tablist semantics, selected state, controlled panels, and keyboard
  navigation.
- Preserve the selected tab through refreshes and resize events.

**Implementation scope:**

- Remove `combinedRecorderView`, every `button.hidden` assignment, and the
  responsive behavior that removes the selected tab.
- Give the navigation `role="tablist"`; each control gets `role="tab"`,
  `aria-selected`, `aria-controls`, and a stable panel ID.
- Give every panel `role="tabpanel"` and associate it with its tab using
  `aria-labelledby`.
- Support Left/Right, Home, and End keyboard navigation; focus follows the
  selected tab without losing the current view during status refreshes.

**Acceptance criteria:**

- All three tabs are always visible.
- Exactly one tab is selected and exactly one panel is visible.
- Mouse, keyboard, resize, and status polling cannot make the tab bar vanish.

### 3. Give each data view one dedicated inner scroll region

**Goal:** make long event and recording lists easy to browse without moving
their controls or producing nested-scroll jitter.

- Make view panes grid/flex containers with `min-height: 0`.
- Keep headings and pagers fixed.
- Make only event and recording lists scroll.
- Center empty states inside the list viewport without affecting pagination.

**Implementation scope:**

- Make Events and Recordings three-row pane grids: heading, scroll body, and
  footer/pager.
- Apply `min-height: 0` to the pane and scroll body; apply `overflow: auto`
  only to the scroll body.
- Remove list sizing rules that allow the outer shell to become a second scroll
  owner.
- Preserve the list scroll position during a status render when the user has
  not changed event/recording page.

**Acceptance criteria:**

- A long list displays one visible inner scrollbar.
- Pane headings and pagers remain visible while scrolling list rows.
- Empty, loading, and error states retain the same pane height.

### 4. Redesign the recorder, events, recordings, and settings views

**Goal:** make each view communicate one primary task rather than presenting
every group as an equally heavy card.

- Recorder: clear record control, compact metrics, and connection context.
- Events: readable timeline rows with time, event type, detail, and tone.
- Recordings: calm rows with name, status, count, and timestamp.
- Settings: grouped slide-over, backdrop, and separated destructive controls.

**Implementation scope:**

- Recorder prioritizes the record/stop action; timer, action count, and queue
  are supporting metrics rather than separate floating cards.
- Events become compact timeline rows with a tone indicator, readable title,
  timestamp, and optional detail.
- Recordings become scan-friendly rows with title, status badge, event count,
  and relative time; refresh belongs in the view heading.
- Settings use labelled groups for connection, capture behavior, diagnostics,
  and destructive recovery. Reset Session is visually and spatially separated.

**Acceptance criteria:**

- Each view has one obvious primary action or purpose.
- Rows remain readable at the minimum popup width.
- Pairing, lock, unsupported-page, loading, and error states explain what the
  user can do next.

### 5. Build a compact visual system

**Goal:** replace repeated hard-coded card styles with a consistent visual
language that is easier to maintain and less visually noisy.

- Define surface, divider, text, status, spacing, radius, control, and focus
  tokens.
- Replace arbitrary card styling with reusable buttons, badges, metric blocks,
  list rows, and empty states.
- Use borders only to establish meaningful hierarchy.

**Implementation scope:**

- Define CSS custom properties for canvas, surface, raised surface, divider,
  text, muted text, accent, success, warning, danger, focus ring, spacing, and
  radii.
- Standardize controls into primary, secondary, quiet/icon, and danger button
  variants with shared height and focus behavior.
- Standardize status badges, metrics, list rows, notices, and empty states.
- Remove decorative borders/backgrounds from peer sections that do not need a
  separate surface.

**Acceptance criteria:**

- Equivalent components share the same spacing, radius, color, and focus rule.
- The interface has one dominant canvas and only purposeful visual elevation.
- Status colors are reserved for state and not used as general decoration.

### 6. Improve interaction and accessibility

**Goal:** ensure the rebuilt UI works with keyboard navigation, assistive
technology, reduced-motion preferences, and all runtime states.

- Add visible keyboard focus and reduced-motion support.
- Use proper icon labels and correct malformed glyphs.
- Keep loading, pairing, lock, error, disconnected, and recording states from
  causing layout shifts.

**Implementation scope:**

- Replace textual placeholder icons (`...`, `x`, and malformed lock glyph) with
  accessible icon buttons or clear text labels.
- Add `:focus-visible` styling, button disabled semantics, and labelled status
  updates where appropriate.
- Add `prefers-reduced-motion` handling for recording and connection activity.
- Give drawers and modal overlays focus management, Escape behavior where
  appropriate, and reliable close controls.

**Acceptance criteria:**

- Every interactive control is reachable and visibly focused by keyboard.
- Screen-reader tab and modal relationships are correctly announced.
- State transitions do not unexpectedly move controls or content.

### 7. Validate

**Goal:** verify the redesign behaves correctly across both extension surfaces
and does not regress the build pipeline.

- Test popup and side-panel dimensions, every tab, long lists, and overlays.
- Confirm tabs never disappear and event/recording lists have only one inner
  scrollbar.
- Run extension check, smoke test, and build.

**Validation matrix:**

- Popup at minimum and normal widths; side panel at narrow and wide widths.
- Recorder, Events, and Recordings selected through mouse and keyboard.
- Empty, long-list, loading, connected, disconnected, pairing, locked, and
  unsupported-page states.
- Settings open/close, overlays, and error presentation.
- `pnpm --filter @fluxiq-web-extension/extension check`, `test`, and `build`.

## Progress

- [x] Plan documented.
- [x] Shared application shell.
- [x] Persistent accessible tabs.
- [x] Dedicated inner scrolling panes.
- [x] View redesign and visual system.
- [x] Accessibility pass and validation.
