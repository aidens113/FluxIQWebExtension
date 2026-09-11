# w1-fixture-identity-drift report

## Outcome

**Done.** The final run of every definition-of-done check passed, between
12:53 and 12:54:

| Check | Result |
| --- | --- |
| `pnpm --filter @fluxiq-web-extension/scenario-lab build` | exit 0 |
| `node --test apps/scenario-lab/dist/scenarios/identity-drift/tests/scenario.test.js` | 9/9 pass |
| `pnpm --filter @fluxiq-web-extension/scenario-lab exec playwright test -c e2e/playwright.config.ts e2e/identity-drift.spec.ts` | `7 passed (6.0s)` |
| `node scripts/structure-audit.mjs` | exit 0, no finding in my files |

Earlier runs failed only on other workers' in-progress files. While those
were broken, I checked the fixture in an isolated scratch lab: 7/7, then
35/35 at `--repeat-each=5`.

## What changed and why

I replaced the placeholder `identity-drift` fixture. The export name
(`identityDriftScenario`), id (`identity-drift`), seed (121), start path
(`/scenarios/identity-drift/`), and title ("Identity drift") are unchanged.
It is now a workspace settings page whose "Save changes" action changes
identity by mode, covering corpus rows W20 to W23.

Files, all under `apps/scenario-lab/`:

| File | Responsibility |
| --- | --- |
| `src/scenarios/identity-drift/modes.ts` | `identityDriftModes` (`baseline` plus the four drift modes) and `IdentityDriftMode` |
| `src/scenarios/identity-drift/state.ts` | `IdentityDriftState`, `createIdentityDriftState(seed)`, and `mutateIdentityDriftState` (the `save`, `discard`, and `set-mode` operations) |
| `src/scenarios/identity-drift/save-action.ts` | `renderSaveAction(mode)`: the Save button markup for each mode |
| `src/scenarios/identity-drift/render.ts` | `renderIdentityDriftPage`: the page layout (the footer placement for `moved`) and the client script |
| `src/scenarios/identity-drift/manifest.ts` | `identityDriftManifest` |
| `src/scenarios/identity-drift/scenario.ts` | `identityDriftScenario` (replaces the placeholder), which puts the modules above together |
| `src/scenarios/identity-drift/tests/scenario.test.ts` | 9 node:test tests: manifest validity and identity; variants and arms through `resolveScenarioWorkflow`; deterministic state and render; every `mutate` operation, including each variant arm and invalid payloads; per-mode markup; no `route` |
| `e2e/identity-drift.spec.ts` | 7 Playwright tests: the primary workflow; Discard; a variant-to-drift-case coverage check; each of the four variants |

The scenario directory has no `index.ts` barrel, on purpose. `registry.ts`,
which I must not touch, imports `./scenarios/identity-drift/scenario.js`
directly. With a barrel present, the structure audit's `imports` rule would
count that import as reaching past a barrel and fail it against
`registry.ts`. No sibling scenario directory has a barrel either.

### The page

- An `h1` reading "Workspace settings", then a form labelled "Workspace
  settings".
- A General section with a labelled text field, "Workspace name"
  (`data-testid="display-name"`). Its value is seeded as `Workspace <seed>`.
- A primary actions group (`role="group"`, labelled "General actions",
  `data-testid="primary-actions"`). It holds Save, then "Discard changes"
  (`type="reset"`, `data-testid="discard-changes"`).
- A read-only Advanced section with `min-height: 110vh`.
- A form footer group (`role="group"`, labelled "Footer actions",
  `data-testid="footer-actions"`).
- A status line (`role="status"`, `data-testid="save-status"`) rendered from
  the fixture state.

The fixture has no clock, no randomness, and no network access beyond
loopback. Only the Save action differs between modes:

| Mode | id | class | data-testid | Name and text | Container |
| --- | --- | --- | --- | --- | --- |
| `baseline` (recorded) | `save-settings` | `btn btn-primary` | `save-changes` | "Save changes" | primary group, first |
| `selector-only` (W20) | `workspace-settings-submit` | `ui-button ui-button--accent` | `settings-submit` | "Save changes" | primary group, first (same bounding box, asserted) |
| `text-only` (W21) | `save-settings` | `btn btn-primary` | none | "Apply changes" | primary group, first (same x and y, asserted) |
| `moved` (W22) | `save-settings` | `btn btn-primary` | none | "Save changes" | footer group, below the fold (asserted not in the viewport) |
| `wrapped-aria` (W23) | `save-settings` | `btn btn-primary` | none | "Save changes", taken from `aria-labelledby="save-settings-label"` | primary group, inside two wrapper `span`s (depth 2 against the baseline's 0, asserted), with its label inside two more |

### The oracle

The oracle is the fixture state served at `/__control/final-state`:
`savedDisplayName`, `saveCount`, `savedInMode`, `discardCount`,
`lastOperation`, and `status`. `set-mode` clears the save record. Once a
variant is armed, only a save made through the drifted rendering counts; the
recording's baseline save cannot satisfy the oracle, and `savedInMode` names
the rendering the save went through. The runner's DOM fact is the
`save-status` text `Saved: Aurora Field Team`, which shows `state.status`.

### Workflows and variants

| Workflow or variant | Corpus row | Arm | Expected outcome |
| --- | --- | --- | --- |
| primary: type "Aurora Field Team" into `testid:display-name`, click `testid:save-changes`, checkpoint | none; the brief gives rows only to the variants | none | Success. Actions `web.dom.type` and `web.dom.click` both succeed. Final state `save-status` reads `Saved: Aurora Field Team`. Recording events: `web.element.input_changed` x1, `web.element.clicked` x1. Page facts: `settings-form` and `display-name` visible. |
| `selector-only` | W20 | `set-mode {mode: "selector-only"}` | Success, same actions and final state (recovered without the harness) |
| `text-only` | W21 | `set-mode {mode: "text-only"}` | Success, same actions and final state |
| `moved` | W22 | `set-mode {mode: "moved"}` | Success, same actions and final state |
| `wrapped-aria` | W23 | `set-mode {mode: "wrapped-aria"}` | Success, same actions and final state |

There are no `workflows[]` entries. The fixture has one workflow, the
primary.

### Corpus decisions I had to make

1. **Test ids.** The brief says the drifted target does not keep its
   `data-testid`. `selector-only` gets a different test id
   (`settings-submit`) because its row says the test id changes.
   `text-only`, `moved`, and `wrapped-aria` have none. Apart from that, each
   mode keeps every signal its row does not name, so each variant removes one
   family of signals:
   - `selector-only` keeps text, role, and position.
   - `text-only` keeps id, class, and position.
   - `moved` keeps text, role, id, and class.
   - `wrapped-aria` keeps id, class, text, and the name's value.
2. **text-only wording.** The new name is "Apply changes": the same meaning,
   worded differently.
3. **wrapped-aria.** The accessible name's value stays "Save changes", but it
   now comes from `aria-labelledby`, which points at a label span inside the
   button. The wrappers are inline `span`s: two outside the button, two
   inside. Inline spans keep the layout where it was, since the row does not
   describe a position change.
4. **moved.** The attributes match the baseline except that the test id is
   gone. The footer sits after an Advanced section with `min-height: 110vh`,
   so it is below the fold at any viewport height. "Discard changes" now
   occupies the Save action's old slot, which is a realistic position trap.
5. **Discard control.** I added a realistic secondary action and record its
   use through `discard`. A wrong-target click then shows up in the oracle as
   `discardCount` and the status "Changes discarded" instead of passing
   silently.
6. **Explicit variant expectations.** Each variant's `expected` restates
   `actions` and `finalState`, with the same values as the primary, rather
   than being `{}`.
7. **Stable page facts.** `pageFacts` name only stable elements
   (`settings-form` and `display-name`), never the drifting button, so a
   variant that inherits them cannot fail on the drift itself.
8. **No `route`.** Nothing in the brief needs extra documents. The unit test
   asserts that `route` is undefined, which is the fixture's whole route
   surface.
9. **Metadata.** The `playbackGoal` is `rename-workspace`, with the same
   success fact. The tags are `forms`, `target-drift`, `element-identity`,
   and `recovery`. The capabilities are `forms` and `scroll` (the `moved`
   target sits below the fold).

## Commands run and observed results

### Final run (definition of done)

1. `pnpm --filter @fluxiq-web-extension/scenario-lab build` printed
   `build exit=0` at 12:53:58.
2. `node --test apps/scenario-lab/dist/scenarios/identity-drift/tests/scenario.test.js`
   printed `ok 1` through `ok 9`, `# tests 9`, `# pass 9`, `# fail 0`.
3. `pnpm --filter @fluxiq-web-extension/scenario-lab exec playwright test -c e2e/playwright.config.ts e2e/identity-drift.spec.ts`
   ran headless Chromium (`channel: "chromium"`). Output: `Running 7 tests
   using 6 workers`, all 7 `ok`, then `7 passed (6.0s)`.
4. `node scripts/structure-audit.mjs` exited 0, and no finding names an
   identity-drift file. It printed one line:
   `structure-audit: 1 baseline entries can be lowered. Run "pnpm structure:baseline" to record the improvement.`
   That line was also there in my first run, before I edited anything, so
   it is not from my files. I did not run `pnpm structure:baseline`.

### Earlier runs blocked by other workers (each rerun as the concurrency notes say)

- The build failed with exit 2 three times, all on a sibling's file:
  `src/scenarios/data-table/table-page.ts(15,49)` and `(16,50)`,
  `error TS1487: Octal escape sequences are not allowed`. tsc still emitted
  my files, and the unit tests then passed 9/9 at 12:46.
- My e2e spec is outside the package tsconfig's `include`, so I type-checked
  it with a scratch tsconfig. That config extends
  `apps/scenario-lab/tsconfig.json` and includes only
  `e2e/identity-drift.spec.ts`, with DOM lib and `noEmit`. The only errors
  were the same two data-table ones, pulled in through `server.ts` and the
  registry. There were none in the spec or in any identity-drift module.
  Later, a type-check Monitor reported
  `failing in: src/scenarios/modal-flows/mutate.ts`, and then `clean`.
- The Playwright command failed four times:
  - Twice with
    `SyntaxError: ...data-table/table-page.ts: Invalid escape sequence in template. (15:49)`.
  - Twice with
    `Error: Cannot find module '...packages/test-contracts/dist/bench-report.js'`,
    and once more with the same error for `bench-report-validation.js`. The
    test-contracts `dist/index.js` re-exported those two modules before they
    existed, because w1-eval-contracts was mid-build. The unit-test file
    failed to load once for the same reason (`# tests 1`, `# fail 1`, at
    12:53:08). A background wait confirmed that every re-export existed from
    12:53:39, and the final run above followed.

### Isolated checks (scratchpad only, nothing in the repo)

- Setup: copies of the lab's `server.ts`, `state-store.ts`, `types.ts`, and
  `html.ts`; my scenario modules, spec, and `network-policy.ts` unchanged;
  the working-tree playwright config. A registry stub lists only
  `identity-drift`, and `node_modules` is a junction to
  `apps/scenario-lab/node_modules`.
- The only edit: the test-contracts value imports point at the existing
  `dist/validation.js` and `dist/scenario-workflow.js`.
- Results:
  - `node node_modules/@playwright/test/cli.js test -c e2e/playwright.config.ts --reporter=list`
    printed `7 passed (4.6s)`.
  - The same with `--repeat-each=5` printed `35 passed (19.0s)`.
  - The freshly built unit tests, run the same way, passed 9/9.

## Not verified

- The recording lane and any FluxIQ Flow run (`pnpm lab run identity-drift`)
  were not run: they are not in this brief's definition of done, and
  w1-runner-asserts owns the runner. The expected `recordingEvents`
  (`web.element.input_changed` x1, `web.element.clicked` x1) follow
  basic-form's convention of one `input_changed` per typed field. I have not
  seen the extension produce them for this page.
- Whether FluxIQ actually recovers each drift without the harness. That is
  what the corpus rows measure, not something the fixture can prove. The
  spec proves only that each drifted control can be found by the signals
  its row leaves intact, and that a save through it satisfies the oracle.
- Firefox, and viewports other than the config's 1280x720. `moved` uses
  `110vh`, so it is below the fold at any height, but I did not exercise
  other sizes.

## Open questions or contradictions found

1. **A possible false success on the primary workflow (runner level).**
   Arming clears the save record, so a variant cannot pass on the
   recording's own save. The primary workflow has no arm. Unless the runner
   resets the lab (`/__control/reset`) between the recording lane and the
   playback run, the recording's save already satisfies the primary's
   final-state fact. basic-form has the same property. The fix belongs in
   the runner (reset before playback), not in each fixture.
2. **Transient breakage from parallel workers.** While I worked, the
   scenario-lab build and the in-repo e2e command were blocked by other
   workers: `data-table/table-page.ts`, then `modal-flows/mutate.ts`, then
   the incomplete test-contracts `dist`. All three had cleared by 12:53:58.
   None is in my paths.
