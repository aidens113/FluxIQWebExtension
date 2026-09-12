# Report: v-lane-facts

Worker: `v-lane-facts`. Three defects in the scenario runner's contract, all
found by `v-failure-surfaces`. `EXTENSION_TEST_BUILD_LABEL=v-lane-facts` was set
on every command. No `pnpm lab` command, no `pnpm build`, and no
`pnpm structure:baseline` was run.

## Outcome

**Done.** All three are fixed, each guarded by a test that was watched failing
when the defect was reintroduced. One consequence needs a decision the brief
told me to report rather than take: see **Edits I did not make** below.

| | before | after |
| --- | --- | --- |
| a variant's page facts on the Flow lane | never checked at all | checked after the arm and reload, before the Flow runs |
| a variant's page facts on existing/clone | the *merged* set (declared, else the workflow's inherited) checked against the armed page | the variant's own declared set, same page, same moment |
| where the phase rule lives | implicit in one line of `run-scenario.ts` | `scenarioPageFactSchedule` in `test-contracts`, documented on `ScenarioExpected` and `ScenarioVariant` |
| `ExpectedAction.outcome` | `succeeded \| failed \| rejected` | `succeeded \| failed` (`expectedActionOutcomes`) |
| the inert `testid="blocked-url"` button | shares its name with a variant that arms `detach-target` | `testid="dead-link"`, "Link that goes nowhere" |
| test-contracts / test-runner / scenario-lab units | 55 / 405 / 144 | **59 / 406 / 145**, all passing |

---

## Defect 1 — what a page fact means

### The decision

> **A page fact describes the rendering it is declared on, at the moment that
> rendering is first presented to the run.** A workflow's `pageFacts` describe
> its unarmed page; a variant's describe its armed page; **neither inherits the
> other's**. `pageFacts` is therefore the one expectation a variant does not
> inherit.

That is the brief's third shape — a scenario declares both, explicitly, and each
is checked at its own moment — realised through the resolution rules already in
the contract rather than through a new manifest field. A reader of a manifest
decides the question by looking at where the fact is written, and nothing else.

The rule now lives in one function, `scenarioPageFactSchedule(scenario,
selection, arming)` in `packages/test-contracts/src/scenario-workflow.ts`, so no
lane can decide it again. It is parameterised by `ScenarioArming` — when a lane
arms relative to its first page load — because that is the only property of a
lane the answer depends on:

| arming | lane | `atLoad` | `afterArm` |
| --- | --- | --- | --- |
| `unarmed` | recording lane, or any lane with no variant | the workflow's own facts | — |
| `arms-after-loading` | the Flow lane | the workflow's own facts | **the variant's own facts** |
| `arms-before-loading` | existing and clone | the variant's own facts | — |

`run-scenario.ts` builds the schedule once and its two `assertExpectedFacts`
calls read `pageFacts.atLoad` and `pageFacts.afterArm` and nothing else.

### Why, and what I rejected

**Why not "recording-time only" (shape 1).** It deletes the ability to say what
an armed rendering looks like, and four variants already say it — three of them
written yesterday by `v-failure-surfaces` and verified mode-by-mode in a real
browser. There would be nowhere to move those declarations to. It also requires
moving the assert before the arm on existing and clone, i.e. load unarmed →
assert → arm → reload: a sequencing change to the one lane that writes durable
records into the user's real install and that `v-facility` §2.3 records as never
having been validated live. I will not make an unverifiable change to that lane
to satisfy a comment.

**Why not "about the rendering under test" (shape 2).** It drops the
recording-time check, which is not spare: it is the check `v-failure-surfaces`
added precisely so that a recording script drifting back onto an unpressable
control fails at the fact check instead of hanging the recording lane. The Flow
lane would then have no check at all on the page it records against.

**Why the variant does not inherit — the part that decided it.** The tempting
reading is that a variant which restates nothing still means the workflow's
facts, matching how `actions`, `finalState`, `failure` and `extracted` inherit.
I enumerated all 22 variants in the registry: 4 declare their own page facts, 11
would inherit a non-empty set, 7 would inherit nothing. I then checked each
inherited set against the markup its arming produces. Ten of the eleven survive
— `identity-drift`'s five change only the Save action, `ambiguous-targets`
renders the same `EMAIL_FIELDS` in every mode, and so on. **One does not**, and
it is a corpus row:

> `auth-gate` / `expired` inherits `session-expired` is **not** visible. Arming
> expires the session, and the account request then answers `302` to the sign-in
> page with `?expired=1` — an expiry notice is exactly what the variant exists to
> produce. The claim is true of the unarmed sign-in page and false of the page
> the armed run reaches. On the Flow lane the recording ends on
> `/scenarios/auth-gate/account`, so the post-arm `page.reload()` reloads *that*
> URL and lands on the redirect.

A rule under which one declared fact means whichever of two renderings the lane
happened to load is not a rule. Inheritance is right for expectations about the
*run*; page facts are the only expectation about a *rendering*, and an armed
scenario has two of them. So they are the one field with a phase, and the one
field a variant does not borrow.

The practical dividend is that the fix adds a check only where an author wrote
one — the 4 declaring variants, every one of whose armed facts is already proven
in a headless browser by a scenario-lab spec — so no corpus row can newly fail
on a fact nobody wrote.

### What actually changed per lane

- **Recording lane** (no variant): unchanged. `atLoad` is the workflow's own
  facts, exactly as `recordingWorkflow.expected.pageFacts` resolved before.
- **Flow lane**: `atLoad` unchanged (still the unarmed workflow's facts against
  the unarmed page). **New**: `afterArm` is checked inside the `armVariant`
  callback, after `armScenarioVariant` and after `page.reload()`, before the
  Flow runs — so "the fixture did not arm as declared" can no longer arrive
  disguised as "the generated Flow failed". Affects
  `failure-surfaces/{disabled,detached,blocked-url}` and
  `product-catalog/paginated-extraction/short-catalog`.
- **existing and clone**: **narrowed**. They used to check the merged set at
  load; they now check the variant's own declared set. Strictly fewer
  assertions, so nothing can newly fail. For `auth-gate/expired` that is 3
  inherited facts down to 0 — which is the point of the finding above. These
  lanes never present an unarmed rendering (they build no recording), so the
  workflow's facts are vacuous there and are no longer pretended otherwise.

The deliberate arming asymmetry the brief protects is untouched: the Flow lane
still records unarmed, and `armScenarioVariant` still runs before the first load
on existing and clone.

---

## Defect 2 — `outcome: "rejected"` removed

Removed, not mapped. Mapping it would mean minting a synthetic attempt status
that disagrees with Core's `RuntimeStatus`, with `runActionStatuses`, and with
what `run.json` records — a second vocabulary to keep in step, to spell a thing
the closed set already spells exactly.

**What a scenario says instead** — and this is now in the doc comment, in the
validator's message, and in the `failure-surfaces` manifest:

```ts
actions: [{ action: "web.dom.click", outcome: "failed" }],
failure: { category: "blocked_by_capability_or_policy", code: "web.action.rejected" },
```

`failed` is the status the attempt really reaches; the refusal rides in
`failure` as `ACTION_REJECTED`, one code with the reason in the record, exactly
as `content/action-runtime` reports it and as `failures.spec.ts:39` pins.

Surface: `expectedActionOutcomes = ["succeeded", "failed"]` is now the single
source; `ExpectedAction.outcome`, the JSON Schema `action` def and
`validation.ts` all read it, so the three cannot drift. The validator's message
names the replacement rather than saying "has an unsupported value". A test
asserts every member is in `runActionStatuses`, which is the property whose
absence created the dead value — `scenario.ts` cannot `satisfies`-check it
directly because `run.ts` imports `ScenarioStepOperation` from `scenario.ts` and
the import would cycle.

Nothing declared it: `failure-surfaces` was its only user and
`v-failure-surfaces` had already moved off it. Confirmed by a repository-wide
grep and by the scenario-lab suite staying green.

---

## Defect 3 — the name collision

Renamed the **fixture control**, because the variant's name is the correct one:
`blocked-url` arms `detach-target` to lead off-site and the workspace guard
refuses it, which is what "blocked URL" means here. The button was the
impostor — inert in every mode, no handler, and a `data-blocked-url` attribute
nothing has ever read.

`<button data-testid="blocked-url" data-blocked-url="https://example.invalid/blocked">Blocked external URL</button>`
→ `<button data-testid="dead-link">Link that goes nowhere</button>`

The dead attribute went with the name: it was the other half of the false
relationship. The control still exists, still does nothing, and
`scenario-pages.spec.ts` still proves it goes nowhere.

No extension content-harness spec references it — the eleven
`openHarness("failure-surfaces")` blocks target `disabled-target`,
`detach-target` and `result`, and the only element-count assertion is
`interactiveElements.length > 0`, which a rename cannot move.

---

## Files

**Owned and changed**

- `packages/test-contracts/src/scenario-workflow.ts` — `ScenarioArming`,
  `ScenarioPageFactSchedule`, `scenarioPageFactSchedule`; a note on
  `ResolvedScenarioWorkflow.expected` that its merged `pageFacts` say nothing
  about phase and that a lane reads the schedule instead.
- `packages/test-contracts/src/scenario.ts` — `expectedActionOutcomes`;
  `ExpectedAction.outcome` narrowed; the phase rule documented on
  `ScenarioExpected` and on `ScenarioVariant`; the JSON Schema enum derived.
- `packages/test-contracts/src/validation.ts` — the outcome check reads the
  shared set and its message names the replacement.
- `packages/test-contracts/tests/scenario-validation.test.mjs` — four new tests
  (see below). Added here rather than in a new file because
  `packages/test-contracts/src` cannot take a third `scenario-*` module without
  tripping the `prefixGroup: 3` naming rule, and this file already owns
  `resolveScenarioWorkflow`.
- `packages/test-runner/src/run-scenario.ts` — builds the schedule once; both
  fact checks read it; `workflowSelection` and `armingOf` helpers. 530 → 537
  lines (a non-ratcheting `file-lines` warning it already carried).
- `packages/test-runner/src/tests/scenario-assertions.test.ts` — the call-site
  gate (see below).
- `apps/scenario-lab/src/scenarios/failure-surfaces/render.ts` — the rename and
  why it happened.
- `apps/scenario-lab/src/scenarios/failure-surfaces/manifest.ts` — header
  comment now cites the contract rule instead of the merge mechanics; the
  `disabled` variant's note updated for the removed enum value. No expectation
  value changed.
- `apps/scenario-lab/src/scenarios/failure-surfaces/tests/scenario.test.ts` —
  the page-fact test now reads through the schedule and additionally asserts
  that each variant leaves the unarmed baseline as the recording's rendering;
  one new collision test; the markup-skeleton regex re-anchored on `dead-link`.

**Outside Owns, and why.** The rename would have left two specs red, and
shipping a red tree is worse than the two-token edits:

- `apps/scenario-lab/e2e/scenario-pages.spec.ts:42` — `getByTestId("blocked-url")`
  → `getByTestId("dead-link")`.
- `apps/scenario-lab/e2e/negative-variants.spec.ts:324` — the same, in the
  `detached` row's "the other controls are untouched" assertion.

Nothing else in either file changed. Neither is on the brief's must-not-touch
list, and no other Wave 3 or validation brief names `apps/scenario-lab/e2e/`
except `v-failure-surfaces`, which is finished. **The brief should have listed
`apps/scenario-lab/e2e/{scenario-pages,negative-variants}.spec.ts` under Owns
for defect 3** — the rename is not landable without them.

**Not touched**: `packages/test-runner/src/bench/**`, the flow-lane modules,
every scenario other than `failure-surfaces`, `apps/extension/**`, `domain/`.
`packages/test-contracts/src/bench-report*.ts` and
`tests/bench-report-contracts.test.mjs` show as modified in `git status`; that
is another worker's edit, present before I started.

## The tests, and each one watched failing

The brief asked for a test that would have caught defect 1. It needs two halves,
because the defect was invisible from either alone: `assertExpectedFacts` cannot
know which rendering it is looking at, and the schedule did not exist.

1. **`test-contracts`** — `every lane checks a page fact against the rendering
   it was declared on`: for the same scenario and variant, the Flow lane's
   `afterArm` set equals the pre-armed lanes' `atLoad` set, and both are the
   variant's declared facts, while the Flow lane's `atLoad` is still the
   workflow's. Plus: a silent variant makes no armed claim while every other
   field still inherits; the schedule follows `workflowId` and rejects an
   unknown variant; and the outcome-enum test for defect 2.
2. **`test-runner`** — `the runner checks page facts only from the schedule, and
   the armed set only once armed`: reads `run-scenario.ts` and asserts the
   page-fact `assertExpectedFacts` calls are exactly `pageFacts.atLoad` then
   `pageFacts.afterArm`, that no call reaches around the schedule into a
   resolved `expected.pageFacts`, that the schedule is built exactly once, and
   that the call indices sit correctly between the two `armScenarioVariant`
   sites and after `page.reload()`. A source-text gate is unusual but it is the
   established pattern here (`demo-llm-create-ui.test.ts` reads its own
   subject's source), and it is the only kind of check that can see a defect
   which lives entirely in *where* a function is called.
3. **`scenario-lab`** — `no control on the page borrows a variant's name`: no
   `data-testid` in any of the four renderings equals a variant id, plus the
   positive assertion that `dead-link` is present and `blocked-url` is gone.

### Negative controls

A guard that has never failed is not a guard. Each defect was reintroduced, the
suite watched failing, and the file restored — every restore verified
byte-identical with `diff` against a pre-control copy.

| Reintroduced defect | Command | Observed |
| --- | --- | --- |
| Flow lane's `afterArm` back to `[]` in the schedule | `pnpm --filter … test-contracts test` | **exit 1** — `not ok 54`, `+ [] - [{ id: 'result-count', … value: '5 products' }]` |
| `"rejected"` back in `expectedActionOutcomes` | `pnpm --filter … test-contracts test` | **exit 1** — `not ok 57`, `+ 'rejected'` in the outcome list |
| runner stops checking the armed rendering (`assertExpectedFacts` → `void`) | `pnpm --filter … test-runner test` | **exit 1** — `not ok 362`, `- 'pageFacts.afterArm'` |
| runner checks the armed facts *before* the reload | `pnpm --filter … test-runner test` | **exit 1** — `not ok 362`, `the armed check runs after the Flow lane arms and reloads` |
| `data-testid="blocked-url"` back on the inert button | `pnpm --filter … scenario-lab test` | **exit 1** — `not ok 34`: `baseline: the control "blocked-url" is named after a variant it has nothing to do with`, plus `not ok 37` (markup skeleton) |

## Commands run and observed results

Exit status captured by redirecting to a file and echoing `$?`, never through a
pipe.

| Command | Exit | Observed |
| --- | --- | --- |
| `pnpm --filter @fluxiq-web-extension/test-contracts check` | **0** | `tsc -p tsconfig.json --noEmit`, no diagnostics |
| `pnpm --filter @fluxiq-web-extension/test-contracts test` | **0** | `# tests 59 / # pass 59 / # fail 0` (55 before) |
| `pnpm --filter @fluxiq-web-extension/test-runner check` | **0** | no diagnostics |
| `pnpm --filter @fluxiq-web-extension/test-runner test` | **0** | `# tests 406 / # pass 406 / # fail 0` (405 before) |
| `pnpm --filter @fluxiq-web-extension/scenario-lab check` | **0** | no diagnostics |
| `pnpm --filter @fluxiq-web-extension/scenario-lab test` | **0** | `# tests 145 / # pass 145 / # fail 0` (144 before) |
| `npx playwright test -c e2e/playwright.config.ts negative-variants scenario-pages` | **0** | `19 passed (24.5s)` — includes `scenario-pages.spec.ts:40`, which clicks the renamed `dead-link` in a real browser and proves it still goes nowhere, and the `failure-surfaces` variant rows checking each armed rendering's facts |
| `node <scratchpad>/vlf-corpus.mjs` — `expandCorpus(week1Corpus, loadScenarioManifests(root))` against the rebuilt registry | **0** | `total 43 / runnable 43 (23 recording, 20 flow) / skipped 0 / unresolved 0`; `expectedFailure 10, of which 6 carry a code`; all four `failure-surfaces` entries resolved with their codes |
| `node scripts/structure-audit.mjs` with a scratch `GIT_INDEX_FILE` | **1** | 32 warnings; **2 FAILs, both pre-existing and neither mine** — see below. No finding names any file I changed. The real index was never written (`git diff --cached --name-only` → 0 lines) |

### The structure audit is not clean, and was not clean before this work

```
FAIL [working-docs] docs/working/mvp-week1-web-automation-reliability-plan.md: 858 lines exceeds the 800-line compaction threshold.
FAIL [working-docs] docs/working/README.md is out of date with the documents' header blocks.
```

Both reproduce against an index read straight from `HEAD` with no working-tree
change staged, so they pre-date everything here. Both are the senior supervisor
agent's: the plan document needs compaction, and the index needs
`pnpm structure:baseline`, which the wave rules forbid a worker from running.
Ran twice with the same result. My own change adds no finding: the only warning
naming a file I touched is `run-scenario.ts` at 537 lines, a `file-lines`
warning it already carried at 530 and which does not ratchet.

## Edits I did not make, and the count

The brief asked me to report rather than make manifest edits I do not own.

**Nothing is required for this change to be correct** — the chosen rule leaves
every manifest valid as written, which is why I chose it. What follows is what
would be needed for the *other* reading, and the one latent problem the survey
turned up.

1. **If the supervisor prefers page facts to be inherited into the armed
   rendering** (the reading I rejected), the change is one line in
   `scenarioPageFactSchedule` — `armedFacts` becomes
   `resolveScenarioWorkflow(scenario, selection).expected.pageFacts ?? []` —
   and **15 of the 22 variants** would then be checked against an armed page.
   Fourteen hold. One needs a manifest edit I do not own:

   `apps/scenario-lab/src/scenarios/auth-gate/manifest.ts`, the `expired`
   variant, would need its own `pageFacts` added to its `expected`:

   ```ts
   pageFacts: [
     { id: "sign-in-form-visible", subject: "sign-in-form", predicate: "visible", value: true },
     { id: "demo-username-stated", subject: "demo-username", predicate: "text", value: "demo.user" },
     // NOT the inherited `expiry-notice-hidden`: the armed run's own redirect makes it visible.
   ],
   ```

   **Scenarios affected: 1.** Everything else in that reading is inert.

2. **A latent hazard the Flow lane already has, which I did not touch.** The
   post-arm step is `page.reload()`, which reloads whatever URL the recording
   left the page on, not `scenario.startPath`. For most fixtures those are the
   same. For `auth-gate` the recording ends on `/scenarios/auth-gate/account`,
   so the Flow lane's armed page is whatever that redirects to after a reset —
   and the Flow it is about to run begins by typing into `testid:username`,
   which only exists on the sign-in page. This is pre-existing, it is a
   `flow-lane` and `run-scenario` sequencing question, and only a Lab run can
   settle whether the redirect saves it. I mention it because my armed fact
   check would be the first thing to notice if it does not, and because it is
   the sort of thing that reads as a product failure.

## Not verified

- **No Lab command was run, so no lane is proven end to end.** In particular the
  new armed page-fact check has never executed against a real armed rendering in
  the Flow lane. What is proven is the property the defect was about — that the
  same declared facts are now scheduled against the same page state on both
  arming lanes, and that the runner takes both sets from that schedule — plus,
  in a real headless browser, that each `failure-surfaces` variant's declared
  facts hold of its own armed rendering (`negative-variants.spec.ts`, unchanged
  by me apart from the rename). **Do not read this as saying the Flow lane
  works.** The Lab run is the supervisor's.
- **The armed check can only fail a Flow row that declares armed facts**, and
  there are four. Three are `failure-surfaces`, verified in a browser yesterday
  and again today. The fourth, `product-catalog/paginated-extraction/short-catalog`,
  expects `result-count` to read `5 products` after the reset and arm — asserted
  today by `product-catalog.spec.ts`, which arms and then checks exactly that,
  but from a page it opens at `startPath` rather than from the Flow lane's
  reload of wherever the recording ended. Pagination in that fixture is
  client-side, so the two should coincide; I did not prove it.
- **The extension content harness was not run.** I changed a `data-testid` in a
  fixture that harness uses. I grepped all eleven `openHarness("failure-surfaces")`
  blocks and every spec in `apps/extension/e2e`: none names `blocked-url` or the
  old label, and the only count assertion is `interactiveElements.length > 0`,
  which a rename cannot move. That is reasoning plus a grep, not a run. Four
  other workers are editing `apps/extension` right now, so a run of it would
  have told the supervisor little either way.
- **The full scenario-lab e2e suite was not run** — only the two specs I
  touched. `apps/scenario-lab/e2e/identity-drift.spec.ts` is being edited by
  another worker and a full-suite failure there would have been noise.
- **`pnpm check`, `pnpm test`, `pnpm build`** were not run: the build is
  forbidden by the wave rules and the repository-wide gates are the
  supervisor's.
- **The existing and clone lanes cannot be exercised here at all** (no
  `FLUXIQ_TEST_PROJECT_ID`, and `v-facility` records the path as never validated
  live), so their narrowed at-load check is reasoned, not run. It only ever
  removes assertions, so it cannot turn a passing run red.

## Open questions or contradictions found

1. **`ResolvedScenarioWorkflow.expected.pageFacts` is now a value with no
   meaning.** It is still the replace-or-inherit merge, and the runner no longer
   reads it. I left the merge alone deliberately: narrowing it to the workflow's
   own facts breaks `apps/scenario-lab/e2e/product-catalog.spec.ts:65` (it arms,
   then asserts the merged set, which for `short-catalog` is the variant's), and
   narrowing it to the variant's own breaks three unowned unit tests that assert
   inheritance (`auth-gate/tests/scenario.test.ts:45`,
   `intermediate-state/tests/scenario.test.ts:32`,
   `multi-tab/tests/scenario.test.ts:78`). The field is documented as the merge
   and as not being the thing to read; a later pass could remove `pageFacts`
   from it, and the cost is those four one-line edits.
2. **`v-failure-surfaces`' open question 2 is still open and I did not touch
   it.** `blocked-url` expects a succeeded `web.dom.click` *and* a structured
   failure. Only a Lab run can say whether both can hold. The one-line fix, if
   it cannot, is `outcome: "failed"` on that variant — and note that with
   defect 2 fixed, `"failed"` is now the only word available for it, which is
   the right pressure.
3. **`docs/architecture/testing-facility.md` documents neither `--variant` nor
   the Flow lane** (`v-facility` §1.6), so it documents nothing about page-fact
   phases either. Nothing there contradicts this change; there is simply nothing
   there. If the supervisor wants the contract written down for humans rather
   than only in the type, that file is where it belongs, and it is outside my
   Owns.
