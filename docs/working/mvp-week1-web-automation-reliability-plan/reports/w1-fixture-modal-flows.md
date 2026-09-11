# Report: w1-fixture-modal-flows

Worker `w1-fixture-modal-flows`, Wave 1 Batch B, corpus rows W12-W14.

## Outcome

Done. The `modal-flows` placeholder is replaced by a full fixture. The export
(`modalFlowsScenario`), id (`modal-flows`), seed (117), start path
(`/scenarios/modal-flows/`), and title ("Modal flows") are unchanged. Build,
node test (14/14), Playwright spec (7/7, then 21/21 with `--repeat-each=3`),
and structure audit (no finding in my files) all pass.

## What changed and why

All new files are under my owned paths. `scenario.ts` replaces the placeholder.

| File | Responsibility |
| --- | --- |
| `apps/scenario-lab/src/scenarios/modal-flows/scenario.ts` | `defineScenario` wiring (24 lines) |
| `.../modal-flows/manifest.ts` | Manifest: W12 primary, W13 and W14 `workflows[]`, one variant each |
| `.../modal-flows/state.ts` | `ModalFlowsState` and the seeded `createModalFlowsState` |
| `.../modal-flows/mutate.ts` | Reducer `mutateModalFlows`, ten operations |
| `.../modal-flows/page-logic.ts` | Pure display text and email check, shared by the render, the reducer, and the page |
| `.../modal-flows/markup.ts` | Page body and styles |
| `.../modal-flows/client-script.ts` | The page script |
| `.../modal-flows/index.ts` | Barrel |
| `.../modal-flows/tests/scenario.test.ts` | node:test |
| `apps/scenario-lab/e2e/modal-flows.spec.ts` | Playwright spec |

### The page

A "Draft editor" for one seeded draft. Its title is picked by `seed % 4` from four fixed titles.

- **Invite modal (W12).** A `div` with `role="dialog"`, `aria-modal="true"`,
  `aria-labelledby`, and `aria-describedby`. It is opened by `open-invite`, which
  carries `aria-haspopup="dialog"` and `aria-controls`. The form has an email field
  (`type=email` with `novalidate`; the page does its own validation and shows a
  `role="alert"` error), a role select (Viewer/Editor), Cancel, and Confirm.
  While it is open, the page shell is `inert` and Tab/Shift+Tab cycle inside the
  dialog. Escape cancels, and focus returns to the opener on close.
- **Cookie banner (W13).** A labelled `section` fixed to the viewport bottom.
  It is taller than the fixed action bar holding **Publish draft** (the primary
  action) and sits above it, so it covers the button at any scroll position.
  "Accept all cookies" or "Essential only" removes it.
- **Interstitial (W14).** "Unlock Premium templates", a `role="dialog"`
  `aria-modal` offer with one "No thanks" button. Before arming it is not in
  the DOM. While armed it is held in a `<template>`. The first Add section after
  arming shows it synchronously in the click handler, before the mutation is
  sent, so the second click already meets it. While it is open:
  - the shell is `inert`;
  - every page handler returns early;
  - the reducer ignores page operations until `close-interstitial`.

  It survives a reload because the render follows state.
- **Delete draft (Phase 1.2).** Guarded by
  `window.confirm("Delete this draft? This cannot be undone.")`. The answer is
  recorded with `delete-draft { confirmed }`. Accepting deletes the draft and
  disables the button.

The page serialises its mutations in click order. There is no `route` hook,
because the fixture needs no subpath documents.

### Mutate operations (`/__control/final-state` is the oracle)

| Operation | Payload | Effect |
| --- | --- | --- |
| `send-invite` | `{ email, role }` | Appends when the email passes `isInviteEmail` and the role is `viewer`/`editor`; capped at 20 |
| `cancel-invite` | none | `inviteCancellations + 1` |
| `accept-cookies` / `reject-cookies` | none | `pending` becomes `accepted` / `essential-only` |
| `publish` | none | `publishCount + 1` |
| `add-section` | none | `sectionCount + 1` (cap 50); `armed` becomes `open` |
| `close-interstitial` | none | `open` becomes `closed` |
| `delete-draft` | `{ confirmed: boolean }` | true: `draft: deleted`, `accepted + 1`; false: `dismissed + 1`; ignored once deleted |
| `remove-consent-banner` | none | Arm for **banner-absent**: `consent: absent` |
| `arm-interstitial` | none | Arm for **armed**: `interstitial: armed` |

While `interstitial` is `open`, every operation except `close-interstitial`
and the two arms is a no-op.

### Workflows and variants

| Corpus | Workflow / variant | Script | Expected outcome |
| --- | --- | --- | --- |
| W12 | primary (the manifest's own script) | click `open-invite`; type `invite-email` "ada@example.test"; select `invite-role` "editor"; click `invite-confirm`; checkpoint | Success. `invite-result` text "Invitation sent to ada@example.test (Editor)"; `invite-dialog` visible false; events clicked 2, input_changed 1, changed 1; click/type/select succeeded; no console errors |
| W13 | `consent-then-click` | click `consent-accept`; click `publish-draft`; checkpoint | Success. `publish-result` "Draft published"; `consent-banner` exists false; clicked 2 |
| W13 | variant `banner-absent` (arm `remove-consent-banner`) | same | Success, with the same `finalState` restated explicitly; no `failure` |
| W14 | `interstitial` | click `add-section` twice (`add-first-section`, `add-second-section`); checkpoint | Success. `section-count` "2 sections"; `interstitial` exists false; clicked 2 |
| W14 | variant `armed` (arm `arm-interstitial`) | same | `failure: USER_INTERVENTION_REQUIRED`; `finalState`: `section-count` "1 section", `interstitial` visible true |

### Corpus decisions I made

1. **The banner covers the primary action; it does not guard it.** It blocks
   pointer hit-testing, like a real banner, but the Publish handler has no
   guard. A runtime that dispatches a synthetic `element.click()` would get
   past it. The recorded dismissal still makes the flow correct. The
   interstitial is the opposite: a hard block (inert shell, handler guard, and
   reducer gate), because W14's expected failure must hold whatever click
   strategy the runtime uses.
2. **"Clicks twice"** means two recorded clicks on the same Add section button.
3. **The interstitial fires on the first Add section after arming,** not on any
   first click on the page. Arming it therefore touches only the W14 surface.
4. **Arms are unconditional.** They override whatever the recording left, so
   they hold whether or not the harness resets between recording and run. The
   counter facts ("2 sections", "1 section") do assume a reset before the run,
   as other counter fixtures do.
5. **The armed variant inherits `expected.actions`** from the workflow
   (`web.dom.click` succeeded), which the first click satisfies. I did not add
   a failed-action entry because the runner's `actions` semantics were not
   given to me.
6. **Whether the invite dialog is open is view state,** so it is not in state;
   a reload closes it, as on a real page. Invites sent and cancellations are in
   state.
7. **Delete draft has no workflow.** It is there for Phase 1.2 and is covered
   only by the unit and Playwright tests.
8. **`capabilities: ["forms", "mutation"]`.** I left out `popup` because it
   appears to mean windows, not in-page dialogs.

### Design notes

- `page-logic.ts` entries are self-contained arrow functions. The page script
  embeds their compiled source through `Function.prototype.toString`, so the
  server render, the reducer, and the page cannot drift apart. The unit test
  asserts the embedded source is present, and the scratch check printed it as
  plain JS.
- The Playwright spec drives each manifest script with a small testid-only step
  driver. It checks the manifest's `finalState` facts with a small
  text/visible/exists evaluator, which proves the manifest itself runs against
  the page. It arms each variant through `/api/modal-flows/<arm.operation>`,
  read from the manifest.
- The spec copies the `lab`/`networkGuard` fixtures from
  `scenario-pages.spec.ts`, which does not export them. It adds an auto
  `pageErrors` fixture that fails the test on uncaught page errors or console
  errors (ignoring "Failed to load resource" 404s). That enforces
  `allowedConsoleErrors: []`.

## Commands run and observed results

1. `node scripts/structure-audit.mjs`, before any edit, returned
   `structure-audit: passed (27 warning(s), 19 baselined).` and
   `structure-audit: 1 baseline entries can be lowered. Run "pnpm structure:baseline" to record the improvement.`
   The lowerable line was there before my edits, and the tool does not name the entry.
2. `pnpm --filter @fluxiq-web-extension/scenario-lab build`, first run:
   `src/scenarios/modal-flows/mutate.ts(35,22): error TS2322`. The narrowed
   `role` widened to `string` inside the array literal. I typed the new array
   as `ModalFlowsState["invites"]`, and the rerun exited 0.
3. `node --test apps/scenario-lab/dist/scenarios/modal-flows/tests/scenario.test.js`
   failed on the first run and on the one rerun with
   `ERR_MODULE_NOT_FOUND ... packages/test-contracts/dist/bench-report-validation.js`.
   `dist/index.js` (12:50:38) re-exported that module, but
   `src/bench-report-validation.ts` was saved at 12:51:00 and not yet built;
   another worker was editing test-contracts in parallel. A bounded background
   poll saw the file appear at 12:53:25. The next run returned
   `# tests 14 / # pass 14 / # fail 0`.
4. `pnpm --filter @fluxiq-web-extension/scenario-lab exec playwright test -c e2e/playwright.config.ts e2e/modal-flows.spec.ts`,
   first attempt: the same missing module, then `Error: No tests found.`
   pnpm then printed `Command "playwright" not found`, which is its message
   after the failed exec, not a separate fault. After the rebuild:
   `7 passed (4.2s)`. With `--repeat-each=3`: `21 passed (12.8s)`.
5. While waiting, I ran a scratch smoke script from the scratchpad against the
   dist `state`, `mutate`, `markup`, and `client-script` modules, none of which
   import test-contracts:
   - an armed add gives `sectionCount 1, interstitial "open"`;
   - a blocked add is a no-op (`true`);
   - the open render has an inert shell (`true`);
   - the page script parses.
6. `node scripts/structure-audit.mjs`, after all edits: the same two lines
   (passed with 27 warnings and 19 baselined; 1 entry can be lowered). No line
   names `modal-flows`.
7. `git status --short` on my paths: `?? apps/scenario-lab/src/scenarios/modal-flows/`
   and `?? apps/scenario-lab/e2e/modal-flows.spec.ts`. No run artifacts are untracked.

## Not verified

- Nothing ran through the FluxIQ extension's recording lane or the test
  runner. The `recordingEvents` counts and `actions` follow `basic-form`'s
  conventions; I did not observe them from a real recording.
- Whether the runner reports `USER_INTERVENTION_REQUIRED` for `armed` is
  Phase 1.5 runtime work. The fixture only supplies the evidence: an
  unrecorded `aria-modal` dialog, a blocked page, and one section.
- Whether the runtime tolerates the missing dismissal target under
  `banner-absent`. That is runtime behaviour, not fixture behaviour.
- Whether the harness resets state between recording and run. The counter
  facts assume it does.
- Only headless Chromium (`channel: "chromium"`) at 1280x720 ran. No Firefox,
  no Edge, and no other viewports, so the covering geometry is proven at that
  size only.
- I did not run the full scenario-lab suite (`pnpm ... test`), the
  registry/server tests, or other specs; sibling workers are editing them.

## Open questions or contradictions found

- None blocking. The contract had everything I needed.
- The contract does not say whether `expected.actions` and
  `recordingEvents.count` mean exact or at-least, or how an inherited "click
  succeeded" combines with a failed second click under `expected.failure`.
  The `w1-runner-asserts` worker should confirm this against W14 `armed`.
- The e2e `lab`/`networkGuard` fixture is now copied into every fixture spec.
  Whether to extract it into a shared e2e module is a supervisor decision,
  since that module would sit outside fixture ownership.
- I added a barrel `index.ts` under the code-structure rule. Other scenario
  directories have none, and the registry still imports `scenario.js`
  directly, so the supervisor may want consistency one way or the other.
- For about three minutes (around 12:50 to 12:53), `packages/test-contracts/dist`
  was inconsistent: `index.js` re-exported a module that had not been built.
  Any worker that tested in that window will have seen `ERR_MODULE_NOT_FOUND`.
