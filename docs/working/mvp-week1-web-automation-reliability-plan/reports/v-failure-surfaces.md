# Report: v-failure-surfaces

Worker: `v-failure-surfaces`. Separate record time from replay time in
`failure-surfaces` so its workflow can be recorded and W27's three variants
stop being theoretical. `EXTENSION_TEST_BUILD_LABEL=v-failure-surfaces` was set
for every command. No `pnpm lab` command and no `pnpm build` was run.

## Outcome

**Done.** The scenario now records against a page whose recorded control works,
and breaks that control only when armed — the pattern its three siblings
already used. Three conflations were found in the one manifest, not one; all
three are fixed, and each is now guarded by a test that fails if it returns.

| | before | after |
| --- | --- | --- |
| first recorded step | click `testid:disabled-target`, declared `enabled: false` | click `testid:detach-target`, declared `enabled: true` |
| primary `expected.actions` | `web.dom.click` → `rejected` | `web.dom.click` → `succeeded` |
| `disabled` variant `expected.actions` | `web.dom.click` → `rejected` (unmatchable in any lane) | `web.dom.click` → `failed` |
| page facts about the recorded control | none | asserted for the baseline and restated by each variant |
| scenario-lab unit tests | 140 | **144**, all passing |

**The brief's suggested shape had to be realised the other way round.** It
proposed enabling `disabled-target` in the baseline and disabling it when
armed. That control cannot be enabled: three extension content-harness specs,
all on my must-not-touch list, depend on it being permanently disabled —
`apps/extension/e2e/content/tests/click.spec.ts:169`, `failures.spec.ts:39` and
`check-assert.spec.ts:279`, which is the repository's proof that
`ACTION_REJECTED` is one code whatever the reason. So the phase separation was
made by moving the *script*, not the *page*: the recording now presses
`detach-target`, which is working and clickable unarmed and which the `disabled`
arm disables. That is literally the shape the brief described — a working
clickable first-step target in the baseline, disabled by the armed variant —
and it is exactly what the siblings already did, so nothing was redesigned.
No rendered HTML changed; the only edit to `render.ts` is a doc comment above
`renderFailureSurfaces`, outside every template literal.

## What changed and why

### 1. The recording script no longer presses a control nobody can press

`recordingScript` was `[click disabled-target, click detach-target,
checkpoint]`. The first step is gone. `ScenarioStepRunner.perform` runs
`target().click({})` (`scenario-steps/step-runner.ts:79`); Playwright's click
waits for the enabled actionability check and the step carried no `timeoutMs`,
so it would have burned Playwright's 30 s default and thrown at step one. Both
lanes that build a recording drive `recordingWorkflow.recordingScript`
(`run-scenario.ts:255`), and in the Flow lane `recordingWorkflow` is the
*unarmed* workflow (`run-scenario.ts:47`) — so W27's three variants had no
recording to replay however well they were written.

The disabled *surface* is not lost. `disabled-target` is still on the page,
still permanently disabled, and still a page fact; the refusal the corpus
measures is the armed one, on the control the recording actually pressed. That
is what the `disabled` variant is for, and it declares
`{ category: "blocked_by_capability_or_policy", code: "web.action.rejected" }`
— **`ACTION_REJECTED` from the closed set, confirmed as the brief required.**

### 2. The primary workflow declared a failure while declaring no failure

`expected.actions` on the primary was `[{ web.dom.click, outcome: "rejected" }]`
while `expected.failure` was absent. `assertFlowFailure(undefined, failure)`
throws on *any* structured failure (`flow-lane/expectations.ts:31`), and a
refused attempt carries one (`persisted-flow-run.ts:70`). The unarmed workflow
could therefore never pass even with a recording in hand: it required a refusal
and forbade one in the same breath. It is now `succeeded`, which is what
pressing a live control produces.

### 3. `outcome: "rejected"` can never match an attempt, in any lane

This one is provable by reading, not a judgement. An attempt's status is
`RuntimeStatus` — `queued | running | waiting | succeeded | failed | cancelled`
(`packages/test-runner/src/existing-fluxiq-control.ts:10`) — and the Flow lane
coerces anything outside `runActionStatuses` (`succeeded, failed, timed_out,
cancelled, queued, running, waiting, unknown`) to `unknown`
(`run-manifest/action-timings.ts:5`). Both consumers compare
`action.status === outcome` (`flow-lane/expectations.ts:10`,
`existing-flow-run.ts:107`). `ExpectedAction.outcome` admits `"rejected"`
(`test-contracts/src/scenario.ts:72`) but nothing can ever produce it, so the
`disabled` variant would have failed on its own expectation whatever the page
did. It is now `failed`, which is what the same fixture's content-harness reply
reports for exactly this refusal (`failures.spec.ts:39`: `status: "failed"`
carrying `code: web.action.rejected`) and what the `detached` sibling already
used. The refusal rides in `failure`, as `w3-failure-codes` decided — one code,
the reason in the record.

`failure-surfaces` was the only manifest in the repository using the value; the
dead contract value itself is in the open questions below.

### 4. Page facts now describe each rendering, and assert the property that was false

The primary states that the recorded control is `visible` and `enabled` on the
unarmed page. That is the fact whose absence let the defect through: the runner
checks page facts right after `goto` and before driving a step
(`run-scenario.ts:175`), so a script that drifts back onto a broken control now
fails at the fact check instead of hanging the recording lane.

Because a variant's `expected` field **replaces** the workflow's rather than
merging (`scenario-workflow.ts:29`), a baseline fact inherited by an armed
rendering would be a lie in the other direction — the error the brief warned
about. Each variant therefore restates the facts true of its own page:
`disabled` says the control is present and not enabled, `detached` says it does
not exist, `blocked-url` says it is present and enabled. All four renderings
were checked, mode by mode, in both the unit suite and a real browser.

### 5. The proofs

- `src/scenarios/failure-surfaces/tests/scenario.test.ts` (four new tests):
  every targeted recording step exists in the unarmed rendering and carries no
  `disabled` attribute; the disabled surface stays on the page and out of the
  script; every declared action outcome is in `runActionStatuses`; every
  rendering states page facts and they hold of its markup.
- `e2e/negative-variants.spec.ts`, the browser half the brief asked for: the
  baseline row drives the **manifest's own** `recordingScript` — resolving each
  target the way `parse-target.ts` does — and checks each step against
  Playwright's actionability conditions before performing it: `toBeVisible`,
  `toBeEnabled`, a hit test that the element at the click point is the target
  or inside it, then a real `click({ timeout: 2000 })`, two thirds of a second
  under the config timeout and far under Playwright's 30 s default, so a
  control that becomes actionable *late* still fails. It then applies the
  workflow's declared `pageFacts` and `finalState`. The `disabled` row is the
  mirror: the same step's target is visible, hit-testable, **disabled**, and
  the same click rejects with `Timeout`.

## Commands run and observed results

Exit status captured by redirecting to a file and echoing `$?`, never through a
pipe.

| Command | Exit | Observed |
| --- | --- | --- |
| `pnpm --filter @fluxiq-web-extension/scenario-lab check` | **0** | `tsc -p tsconfig.json --noEmit`, no diagnostics |
| `pnpm --filter @fluxiq-web-extension/scenario-lab test` | **0** | `# tests 144 / # pass 144 / # fail 0` (140 before) |
| `npx playwright test -c e2e/playwright.config.ts negative-variants` | **0** | `8 passed (24.2s)` |
| `npx playwright test -c e2e/playwright.config.ts` (whole scenario-lab e2e suite) | **0** | `73 passed (29.6s)` — the same 73 as before, including `scenario-pages.spec.ts:40`, which still asserts `disabled-target` is disabled |
| `node <scratchpad>/vfs-corpus.mjs` — `expandCorpus(week1Corpus, loadScenarioManifests(root))` against the rebuilt registry | **0** | `total 43 / runnable 43 (23 recording, 20 flow) / skipped 0 / unresolved 0 / expectedFailure 10, of which 6 carry a code`; all four `failure-surfaces` entries resolved, W27's three carrying `web.action.rejected`, `web.target.not_found`, `web.navigation.unexpected` |
| `node scripts/structure-audit.mjs` with a scratch `GIT_INDEX_FILE` | **0** | `structure-audit: passed (31 warning(s), 19 baselined)`; **no finding names any `failure-surfaces` or `negative-variants` path**. The real index was never written (`git diff --cached --name-only \| wc -l` → 0) |

### Negative controls: the new gates were watched failing

A guard that has never failed is not a guard. Each was reverted to the defect,
observed to fail, and restored (the manifest was `diff`ed against its
pre-control copy afterwards, byte-identical):

| Reintroduced defect | Command | Observed |
| --- | --- | --- |
| first recorded step back to `testid:disabled-target` | `npx playwright test … -g "baseline: every recorded step"` | **exit 1** — `Error: disabled-target: enabled … locator resolved to <button disabled data-testid="disabled-target">` at the `toBeEnabled()` line |
| the same, unit level | `pnpm --filter … scenario-lab test` | **exit 1** — `# fail 3`: `not ok 30 - the recording script presses only controls the unarmed page can actually offer`, plus the manifest-shape and disabled-surface rows |
| `disabled` variant outcome back to `"rejected"` | `pnpm --filter … scenario-lab test` | **exit 1** — `not ok 32 - every declared action outcome is one a run can actually record` |

## Not verified

- **Nothing was run through the Lab, so the recording lane is still unproven
  end to end.** A green scenario-lab suite is not evidence that the recording
  now completes: it proves the property whose falsity blocked it — that every
  step of the manifest's own script is actionable on the unarmed page, driven
  by the same Playwright calls the runner makes, inside a two-second bound.
  What is untested is everything downstream of Playwright: the extension
  recording, the Flow the proposal builds from it, and the codes Core reports
  when the variants are armed. **Do not read this report as saying the
  recording lane works.** The Lab run is the supervisor's, and it is the only
  thing that can close W27.
- **The `blocked-url` variant's action expectation is unproven** — see the open
  questions; I did not change it.
- **The extension content harness was not run.** I touch no extension code and
  no rendered HTML, and the three specs that depend on `disabled-target` depend
  on it being disabled, which it still is; but that is reasoning, not a run.
  The tree is being edited by three other workers, so a run of it would have
  told the supervisor little either way.
- **`pnpm check`, `pnpm test`, `pnpm build`** were not run: the wave rules
  forbid the build and the repository-wide gates are the supervisor's.
- **The package's `check` does not type-check `e2e/` at all** — its tsconfig is
  `include: ["src/**/*.ts"]`, so every scenario-lab spec is transpiled by
  Playwright and never type-checked. Pre-existing, and it means a type error in
  a spec surfaces only if it also breaks at runtime. I ran `tsc` over
  `negative-variants.spec.ts` directly (`--strict --module nodenext
  --skipLibCheck`): one error, and it names
  `packages/test-contracts/src/failure-category.ts`, not my file — an artefact
  of resolving test-contracts to source without the package's `paths` mapping.
  Zero diagnostics in the spec itself.
- **The corpus counts are unchanged (43/43/0), and that is the point.** This
  work adds no corpus entry; it makes three existing ones producible. The
  before/after that matters is not in those numbers, it is in the negative
  controls above.

## Open questions or contradictions found

1. **`ExpectedAction.outcome: "rejected"` is a dead value in the contract.**
   No lane can report it (§3), yet `test-contracts/src/scenario.ts:72`, the
   JSON Schema at `:232` and the validator at `validation.ts:140` all accept
   it. `failure-surfaces` was its only user and no longer uses it, so nothing
   is broken today, but the next negative fixture that reaches for the obvious
   word will write an expectation that cannot be met and will look like a
   product failure. Either drop it from the enum or map an attempt's rejection
   onto it in `runActionStatus`. `packages/test-contracts` and
   `packages/test-runner` are both outside my Owns.
2. **`blocked-url` expects a succeeded click *and* a structured failure, and
   only a Lab run can say whether both can hold.** `assertFlowActions` needs a
   `web.dom.click` attempt with status `succeeded` (the default for an entry
   with no `outcome`), while `assertFlowFailure` needs a non-null `run.failure`
   — which `persisted-flow-run.ts:70` reads off the action attempts themselves.
   With a two-step script there may be exactly one attempt, and
   `NAVIGATION_UNEXPECTED` is stage `confirmation`, i.e. the confirmation of
   that same action. If Core marks the attempt failed, the variant fails on its
   `actions` line. I left it alone deliberately: unlike `"rejected"` this is not
   provable by reading, and guessing would be the same error in a new
   direction. The one-line fix, if the Lab run shows it, is
   `outcome: "failed"` on that variant.
3. **The page a variant arms and the facts checked against it disagree in the
   existing and clone lanes.** `run-scenario.ts:170` arms the variant *before*
   `page.goto`, and `:175` then checks page facts, so those lanes check facts
   against the armed page while the Flow lane checks them against the unarmed
   one. Giving each variant its own facts makes `failure-surfaces` correct
   under both readings, but the contract's own comment
   (`scenario.ts`, `ScenarioVariant`) says page facts are recording-time — so
   either the comment or `run-scenario.ts:170` is wrong, and other fixtures
   inherit baseline facts into armed lanes today.
4. **`<button data-testid="blocked-url">` is an inert control whose test id
   collides with the `blocked-url` variant.** It has no handler in any mode and
   the variant it shares a name with arms `detach-target` instead. It is real
   page furniture (a link that goes nowhere) pinned by
   `scenario-pages.spec.ts:42`, so I left it, but a future script targeting
   `testid:blocked-url` would record a click that does nothing and the name
   would make that look intentional. Renaming it touches an unowned spec.
5. **`docs/architecture/testing-facility.md:684` is still accurate** — the
   fixture does still expose disabled, detached, blocked-URL and closure
   surfaces — so no documentation change was needed. Worth a second opinion if
   the supervisor reads that table as a claim about the *recorded* workflow.

## Files

Changed: `apps/scenario-lab/src/scenarios/failure-surfaces/manifest.ts`
(recording script, primary actions and page facts, per-variant page facts, the
`disabled` outcome, and the header comment stating the record/replay
separation); `apps/scenario-lab/src/scenarios/failure-surfaces/render.ts` (a doc
comment only — no rendered byte changed);
`apps/scenario-lab/src/scenarios/failure-surfaces/tests/scenario.test.ts` (four
new tests, one updated); `apps/scenario-lab/e2e/negative-variants.spec.ts` (the
actionability proof and its mirror, plus per-variant page-fact checks).

Not touched: every other scenario, `packages/test-runner/`,
`packages/test-contracts/`, `apps/extension/`, `domain/`,
`apps/scenario-lab/e2e/scenario-pages.spec.ts`. `apps/scenario-lab/dist/` was
rebuilt only by the package's own `test` script.
