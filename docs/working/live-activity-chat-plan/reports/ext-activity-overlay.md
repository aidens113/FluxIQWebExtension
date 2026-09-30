# ext-activity-overlay (E2) report

## Outcome

Done. The content script shows the current `ActivityContentMessage` in a
closed-shadow-root overlay in the bottom-right corner. The overlay is inert, it
is marked, and it is excluded from the recorder, snapshots, evidence and
interference. All the checks the brief names pass. The only exception is
`pnpm structure:check`, which fails on two supervisor-owned working-document
findings, not on this work.

## What changed and why

New `apps/extension/src/content/activity-overlay/`:

- `phase-appearance.ts`
  - Holds the display name, accent colour and mark (pulse, check, cross or
    attention) for each `ClientGatewayActivityPhase`.
  - A phase this build does not know gets a neutral "Working" fallback.
  - Every accent is at least 4.5:1 against the overlay's own card, whether the
    page is white or black. A unit test enforces this.
- `overlay-view.ts`
  - A pure function from (activity, preference) to a view, or `null` when the
    activity is null or the preference is hidden.
  - The view holds the phase, Core's label, "Step N of M" (the pill uses the
    short form "N/M"), the latest `detail.title`, and whether the event is final.
  - When N > M, or M is not a count, it shows "Step N" instead of a fraction.
  - Text lines are bounded to 160 characters as a defence. Core already
    truncates.
- `content-message.ts`
  - Reads `ACTIVITY_MESSAGES.content` from an untyped message.
  - Rejects a message with a bad `overlay` value, or with an activity that has
    no string `phase`/`label`.
- `inert-element.ts`
  - Every element the overlay creates comes from here.
  - Each one gets `pointer-events: none` and `user-select: none`.
  - Every declaration is set through the CSSOM with `!important`.
  - An `all` reset is applied first, so it cannot undo `pointer-events`.
- `phase-mark.ts`
  - Builds the SVG mark node by node.
  - The pulse uses the Web Animations API (`element.animate`), which needs no
    stylesheet, so a CSP cannot block it. It is skipped under
    `prefers-reduced-motion`.
- `overlay.ts`, which exports `showActivityOverlay(message)`:
  - Host and root:
    - The host is a custom element, `<fluxiq-activity-overlay>`, on
      `document.documentElement`. No page `div` rule can match it.
    - The host is `all: initial` plus fixed position, bottom-right 16px, with
      the maximum z-index. It carries `data-fluxiq-activity`,
      `aria-hidden="true"` and `inert`.
    - The shadow root is closed. Nothing uses `innerHTML`.
  - Expanded view: a 300px card.
    - The surface is a dark card (rgba(22,24,31,.94)) with a 12px radius, a
      hairline border and a soft shadow, plus a 3px phase-colour stripe.
    - The header shows the mark, the phase name in uppercase in the accent
      colour, "· Step N of M", and a faint "FluxIQ".
    - The label is 13px/500 and clamped to 2 lines. The detail title is 12px,
      muted, on one line with an ellipsis.
  - Collapsed view: a pill with the mark, the phase name and "N/M".
  - Hidden or null removes the host.
  - A final event fades after 6 s, over 400 ms, and then the host is removed.
    A new event cancels the fade. This is the only timer, and it is display-only.
  - Any stale host left by a superseded content-script instance is removed
    before a new host is created.
- `index.ts` is the barrel.
- Tests: `tests/overlay-view.test.ts` and `tests/content-message.test.ts`.

Marker (generalised in place):

- `content/picker-host.ts` gains `ACTIVITY_OVERLAY_HOST_ATTRIBUTE`.
- `isPickerHostNode` is renamed `isExtensionUiNode` and matches either marker.
- I kept the file name because `docs/architecture/extension-client.md` links to
  it, and renaming it broke the docs-links check. I tried the rename and
  reverted it.
- The callers are updated: `picker/session.ts`, and `recorder.ts`, whose
  helper `countOutsidePicker` becomes `countOutsideExtensionUi`.

Exclusions:

- `dom-snapshot.ts` `shouldIncludeSnapshotElement` returns false for
  extension UI.
- The hit-test guards below are defence in depth. The overlay already takes no
  pointer event, so a hit test never lands on it.
  - `evidence/overlays.ts` `blockerAt`
  - `action-runtime/interference/covering-layer.ts` `coveringLayerSentence`
  - `action-runtime/interference/overlays.ts` `coveringDialog`

`message-handler.ts`:

- Handles the activity message in the top frame only (`isTopFrame()`).
- Renders the overlay and answers `{ ok: true }` synchronously (returns `false`).
- A child frame stays silent.

`src/content/tests/recorder.test.ts`:

- A new test proves that the activity host arriving, being restyled and leaving
  counts no mutation.

Spec: `apps/extension/e2e/content/tests/activity-overlay/tests/activity-overlay.spec.ts`

- It lives in a subfolder because the flat `tests/` directory would have
  reached 26 files, over the limit of 25.
- An init script wraps `attachShadow` to capture the closed root, so the spec
  can read what the overlay renders. It has 6 tests:
  1. Content and state:
     - It renders the phase, label, step and detail.
     - The host sits on `<html>`, is marked and is aria-hidden.
     - It has 0 focusable nodes, and every node is `pointer-events: none`.
     - It sits at the bottom-right inset of 16px.
     - The collapsed pill is narrower than the card.
     - Hidden and null remove it.
  2. Page CSS: after `* { all: unset !important } div { display: none !important }`
     and the plain form of the same rules, the host rect and the card's computed
     style are identical.
  3. Hit testing: `elementFromPoint` at the overlay's centre returns the page
     button underneath, and a real `page.mouse.click` there increments that
     button's click count.
  4. Recording: with mutation capture on, the overlay goes up, collapses, hides
     and shows a final event, and no `dom.mutation` is recorded.
  5. Snapshot:
     - The snapshot contains neither the host tag, the marker nor the label.
     - The `interactiveElements` count is unchanged.
  6. Fade: a final event is still up at 3 s and gone by about 6.4 s. A later
     non-final event shows again and is still up at 6.8 s.

## Commands run and observed results

- `EXTENSION_TEST_BUILD_LABEL=e2-overlay pnpm --filter @fluxiq-web-extension/extension test`
  - Printed "Extension smoke test passed."
  - Unit tests: `# tests 1138`, `# pass 1138`, `# fail 0`.
- `pnpm --filter @fluxiq-web-extension/extension check` -> exit 0.
- `pnpm --filter @fluxiq-web-extension/extension test:content -- activity-overlay --workers=1`
  -> `6 passed (1.2m)` (after the move; it also passed before the move,
  `6 passed (1.8m)`).
- `node scripts/test-content.mjs -- recorder-trust evidence/tests actionability-gate dialog-refusal dialog-dismissal click.spec extraction-picker shadow-root-controls failures.spec activity-overlay --workers=1`
  -> `122 passed (6.9m)`.
- `pnpm structure:check` -> 2 violations, neither in my files:
  - [docs-links] `docs/working/live-activity-chat-plan.md:28` links to
    `reports/t185-live-activity-chat.md`, which is missing.
  - [working-docs] `docs/working/README.md` is out of date.
  - My earlier [directory-files] violation (e2e `tests/` at 26 files) was fixed
    by the move.
- Free RAM before each Playwright run, from
  `Get-CimInstance Win32_OperatingSystem`: 3.73, 3.53, 3.72 and 4.11 GB.
- I checked the design visually with a throwaway screenshot spec, since
  deleted. The card on a light page, the card on a dark page (waiting
  permission) and the done pill all render as intended.

## Not verified

- A real extension build in a browser with a real background sending the
  message. The harness runs the content script in the page's main world with a
  stubbed runtime.
- Firefox.
- A page with a strict `style-src` CSP or Trusted Types. This rests on reasoning
  shared with `picker/overlay.ts`: CSSOM `setProperty` and `element.animate`,
  and no `innerHTML`.
- The full content suite. I ran the subset listed above.
- The domain tests. I did not touch domain.

## Open questions or contradictions found

- I assumed `step.index` is 1-based, the ordinal that "Running step N of M"
  speaks. If C2 emits a 0-based index, `overlay-view.ts` `stepText` needs a +1.
  The supervisor should confirm this against C2.
- `docs/architecture/extension-client.md:821` still names `isPickerHostNode`.
  The function is now `isExtensionUiNode`, and that document is owned by E1 or
  the supervisor. The plan's Current State (line 51) also uses the old name.
- The brief says "at most 2 workers", and the dispatch message says 1. I used 1.
