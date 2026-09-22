# w2x-integration-fixes

Task t075 — integration worktrees `F:\fxwork\t075\!FluxIQ` and
`F:\fxwork\t075\!FluxIQWebExtension`.

## Outcome

Done. Both repositories' full gates are green. Seven test files are modified
and left uncommitted across the two worktrees: the five the cut-off attempt
left behind, all judged correct and kept, plus two I changed. Only
environmental failures remain, each shown passing when its file is run alone.

No product or runtime code changed. Every edit is a test expectation, so the
brief's live-run condition never triggered.

## What changed and why

### The five edits the previous attempt left, judged on their merits

**1. Core `runtime/llm/tests/verify-result-grant.test.ts` — import path. Kept.**
Commit `b5030d2` ("Group the execution-grant tests into their own feature
folder") moved the fixture to
`runtime/llm/tests/execution-grant/tests/execution-grant-fixture.ts` and moved
the five `execution-grant-*.test.ts` files with it, but left
`verify-result-grant.test.ts` in `runtime/llm/tests/`. The five siblings import
the fixture as `./execution-grant-fixture.ts` from inside the new folder; the
survivor's old `./execution-grant-fixture.ts` no longer resolves.
`./execution-grant/tests/execution-grant-fixture.ts` is the only path that
does. `pnpm check` (structure-audit included) accepts the file where it stands.

**2. Core `runtime/tests/deepseek-bootstrap-exploration.test.ts` — 20 tool calls
to 19. Kept.** Verified against the merged source rather than taken on trust.
In `runtime/llm/evidence-loop.ts`, line 484 sets
`finalDecision = remaining.decisionsLeft === 1 && canComplete`, line 485 sets
`offered = finalDecision ? [] : eligibleTools`, and line 542 returns
`failure("llm_evidence_loop.iteration_limit", …)` on a `tool_call` when
`finalDecision` holds — before the tool is executed. So inside a 20-decision
budget the twentieth decision is offered only completion, and a look asked for
on it is not run: 20 iterations, 19 tool calls. The edit records t057's
designed behaviour. Nothing was weakened — `iterationCount: 20`, the
`flow_bootstrap.evidence_iteration_limit` code, `sentIterations` of 20 and
`activeGrantsAfter: 0` are all unchanged.

**3 and 4. Downstream `llm-evidence/tests/renamed-save-override.test.ts` and
`llm-evidence/tests/tools.test.ts` — `control: { name, kind }`. Kept.**
`domain/src/runtime/llm-evidence/target/override.ts:129` now returns
`control: repairedControl(element)` beside the resolved target (t059), so a
`deepEqual` against the whole validation result has to carry it. The values
check out against `repairedControl` / `plainControlKind` in the same file:
`element.name ?? element.text` gives "Apply changes", "Continue" and
"Place order"; each element has no `role` in the packet and `tag: "button"`, so
`kind` is "button". These edits add assertions rather than relax any.

**5. Downstream `packages/test-runner/src/bench/tests/week1-corpus.test.ts` —
W14 `modal-flows/interstitial/armed` to `unexpected_state`. Kept.** Commit
`9c70af8` (t062, "Tell a dismissible dialog apart from a challenge only a
person can answer") changed
`apps/scenario-lab/src/scenarios/modal-flows/manifest.ts:81` to
`failure: { category: "unexpected_state" }` and updated that scenario's own
test, but not the corpus table in `test-runner` that mirrors it. The commit
body states the intent explicitly: "W14's armed offer keeps its
stop-don't-dismiss contract for a model-free replay, now recorded as the
recoverable category." The table still asserts one exact category per row.

### The two edits I made

**6. Core `runtime/flow-bootstrap/tests/plan.test.ts` — schema byte guard 5,000
to 5,600.**
**7. Core `runtime/llm/tests/evidence-loop-provider.test.ts` — the same guard,
same value.**

`AUTOMATION_STUDIO_EVIDENCE_FLOW_BOOTSTRAP_COMPLETION_SCHEMA` puts the whole
`AUTOMATION_STUDIO_FLOW_SCRIPT_FORMAT` in its `description`. Commit `81482fe`
(t065, P17, "Keep every change exploration made in the Flow script the model
writes") added the replay-premise line to that format — the statement that the
Flow runs again from the page as it first was, so every change the answer
depended on is a step. That is about 470 bytes, and it took the serialized
schema from under 5,000 to 5,366. Both guards failed with
`expected 5366 to be less than 5000`.

The brief's hypothesis was a genuine conflict between "P11's budget line" and
"P17's per-change steps". It is not one, and I checked rather than assumed:
`git log -S "toBeLessThan(5_000)"` over the runtime tree names only `0271d60`,
long before either task. The 5,000 was a round tripwire on the schema growing
unwatched, not a budget anything derives from — `automationStudioFlowBootstrap`
`CatalogByteBudget` sizes itself from `AUTOMATION_STUDIO_FLOW_BOOTSTRAP_OUTPUT`
`_SCHEMA`, a different object with its own 4,700 guard that still passes. So
no task's intent had to be traded away: shortening t065's premise would have
undone what it proved live, and raising the tripwire costs nothing the tests
actually measure. The test whose title names the output budget still asserts
the built result under 1,500 bytes and under 500 tokens, and
`evidence-loop-provider.test.ts` still holds the real input bound on the line
below — `estimateAutomationStudioDeepSeekInputTokens(productionRequest)` at or
below 8,000 — which passes. Both edits carry a comment saying what grew, why,
and what the guard is and is not for. I left about 230 bytes of headroom rather
than pinning 5,366 exactly.

## Commands run and observed results

All from inside the t075 worktrees. Nothing was committed.

### Core, `F:\fxwork\t075\!FluxIQ`

`pnpm check` — exit 0.
`structure-audit: passed (173 warning(s), 361 baselined).`
`packages/contracts`, `packages/client-gateway-websocket`, `packages/fluxiq`
and `apps/web` each printed `check: Done`.

`pnpm -r --no-bail test`, first run (before edits 6 and 7 both landed):

| package | test files | tests |
| --- | --- | --- |
| packages/contracts | 9 passed (9) | 53 passed (53) |
| packages/client-gateway-websocket | 1 passed (1) | 3 passed (3) |
| packages/fluxiq | 3 failed \| 320 passed (323) | 3 failed \| 2792 passed \| 1 skipped (2796) |
| apps/web | 240 passed (240) | 1256 passed (1256) |

The three: `evidence-loop-provider.test.ts` "accepts a production-shaped
five-tool evidence context with a native node catalog" —
`expected 5366 to be less than 5000`; `run-detail-preservation.test.ts` "keeps
a repaired run's recovery annotation through apply, replay, restarts and every
session-derived re-save" — `Test timed out in 15000ms`; and
`deepseek-bootstrap-exploration.test.ts` "asks again after a decision that runs
past its deadline" — `expected { …(6) } to be undefined`, received
`code: "flow_bootstrap.provider_transport_unknown"`. The last has a comment
above it already saying the deadline is generous because "a heavily loaded
machine can take a second to get there".

`pnpm -r --no-bail test`, second run (all seven edits in place):

| package | test files | tests |
| --- | --- | --- |
| packages/contracts | 9 passed (9) | 53 passed (53) |
| packages/client-gateway-websocket | 1 passed (1) | 3 passed (3) |
| packages/fluxiq | 2 failed \| 321 passed (323) | 2 failed \| 2793 passed \| 1 skipped (2796) |
| apps/web | 240 passed (240) | 1256 passed (1256) |

Both schema-guard failures and both first-run timeouts are gone — the deadline
test passed at 15834 ms under the same load. The two that failed are different
tests and different in kind, neither a merge conflict:

- `service-flows/tests/scale-pages.test.ts` "pages and filters 10,000 Subflow
  summaries within the local directory budget" —
  `expected 1529.4845000000023 to be less than 500`, a wall-clock budget under
  parallel load.
- `service-recordings/tests/assets.test.ts` "deletes recording batches with one
  index and pipeline cleanup pass" —
  `EPERM: operation not permitted, rmdir '…\recordings\recording.batch-b\derived'`,
  a Windows filesystem transient. This test passed in the first run at 656 ms.

Each failure re-run alone, `--no-file-parallelism`, from `packages/fluxiq`:

- `plan.test.ts`, `evidence-loop-provider.test.ts`,
  `run-detail-preservation.test.ts` together —
  `Test Files 3 passed (3)`, `Tests 34 passed (34)`. The annotation test that
  timed out at 15 s took 2998 ms.
- `deepseek-bootstrap-exploration.test.ts` — `Test Files 1 passed (1)`,
  `Tests 8 passed (8)`. The deadline test took 5407 ms.
- `scale-pages.test.ts` and `assets.test.ts` together —
  `Test Files 2 passed (2)`, `Tests 10 passed (10)`. The 10,000-Subflow paging
  took 808 ms against its 500 ms budget for the measured section; the EPERM did
  not recur.

`pnpm build` — exit 0, through `@fluxiq/contracts`, `fluxiq`,
`@fluxiq/client-gateway-websocket` and the `@fluxiq/web` Next.js build.

### Downstream, `F:\fxwork\t075\!FluxIQWebExtension`

`pnpm check` — exit 0.
`structure-audit: passed (88 warning(s), 122 baselined).`
All ten projects printed `check: Done`.

`pnpm -r --no-bail test` — exit 0.

| package | tests | pass | fail |
| --- | --- | --- | --- |
| packages/test-contracts | 122 | 122 | 0 |
| packages/boundary-audit | 6 | 6 | 0 |
| packages/real-site-policy | 7 | 7 | 0 |
| domain | 724 | 724 | 0 |
| packages/test-matrix | 17 | 17 | 0 |
| packages/agent-orchestrator | 16 | 16 | 0 |
| packages/test-evidence | 17 | 17 | 0 |
| apps/extension | 714 | 714 | 0 |
| apps/scenario-lab | 570 | 570 | 0 |
| packages/test-runner | 1280 | 1280 | 0 |

The crossborder browser test is inside the scenario-lab package's suite and is
covered by that run: `ok 119 - crossborder-marketplace in a browser`, from
`apps/scenario-lab/src/scenarios/crossborder-marketplace/tests/browser-paths.test.ts`.
t067's flake fix is merged and it passed first time, with no retry.

An earlier standalone `DOMAIN_TEST_BUILD_LABEL=w2x-integration node
scripts/test-domain.mjs` from `domain/` also reported `# pass 724 / # fail 0`,
which is what confirmed edits 3 and 4 before the wider run.

`pnpm build` — exit 0, through domain, extension (popup and side panel
bundles), scenario-lab and test-runner.

Both worktrees were also scanned for leftover `<<<<<<<` / `>>>>>>>` markers:
none in either.

## Not verified

- **No live provider run.** All seven edits are test expectations; no runtime
  behaviour changed, so the brief's condition for a
  `FLUXIQ_TEST_ENV_FILES=none` lane run never triggered.
- **Browser e2e lanes were not run.** `apps/extension`'s `test:e2e` and
  `test:content`, and `apps/scenario-lab`'s `test:e2e`, are separate scripts
  that `pnpm -r test` does not invoke, and they are not in the definition of
  done. The one browser test the brief named is not in those lanes and did run.
- **Run counts.** Core `pnpm check` and `pnpm build` ran once each after all
  edits; Core tests ran twice. Downstream check, test and build each ran once,
  all with the final edits in place.
- **The two environmental Core failures are load-dependent, not eliminated.**
  They will recur on a loaded machine. The 500 ms paging budget and the
  `rmdir` are both of the kind this machine produces under parallel load; I did
  not change either assertion.
- I did not re-measure the exact serialized schema size after my edits beyond
  what the passing assertions imply; the 5,366 figure is the number both
  failures printed.

## Open questions or contradictions found

1. **The brief's diagnosis of the schema failure was wrong, and worth
   correcting in the ledger.** It is not a P11-against-P17 conflict. The 5,000
   guard predates both tasks (`0271d60`); only t065/P17 moved, and it moved
   deliberately. Nothing was given up to make both gates pass.
2. **`verify-result-grant.test.ts` was left behind by `b5030d2`'s folder
   grouping.** It now sits in `runtime/llm/tests/` and reaches down into
   `runtime/llm/tests/execution-grant/tests/` for its fixture. structure-audit
   passes, and the file's subject — the grant that lets a finished run's result
   be judged — is arguably not an execution-grant test. But if that commit
   meant to take every consumer of the fixture with it, the supervisor may want
   the file moved and the import shortened to `./execution-grant-fixture.ts`.
   I left it where it is rather than move a file the brief did not name.
3. **The 5,600 bound is a judgement, not a derived number.** I kept about 230
   bytes of headroom so a small wording change does not re-break the gate. If
   the house style is the exact-value-plus-comment form used for
   `firstLiveCatalogBytes` in the same file, pin it to 5,366 instead.
4. **`week1-corpus.test.ts` calls its table "the plan's corpus table".** The
   week 1 plan and two of its worker reports under
   `docs/working/mvp-week1-web-automation-reliability-plan/` still say
   `user_intervention_required` for W14. Those reports are historical records
   and I did not touch them, but if the plan document itself is meant to stay
   current, t062 changed what it describes.
