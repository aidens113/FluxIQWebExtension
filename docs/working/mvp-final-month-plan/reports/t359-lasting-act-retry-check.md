# t359 a lasting act is never repeated by an automatic retry when its effect is uncertain

Worker: t359-lasting-act (worker-high). Worktree `C:\Users\osrs_\FluxStuff\fxwork\t359\` (Core-paired, branch `task/t359-lasting-act-retry-check` on both sides). Nothing committed.

## Outcome

Done for the code and tests on all four paths. The Lab run was provider-free, on the playback path only. It shows no regression, and it shows the new "nothing was pressed" statement arriving on press records. A press with an uncertain outcome could not be triggered there, because the scenario never produces one.

**The rule has one owner, Core's `automationStudioAssessAttemptFault` in `runtime/executor/defensive/assess.ts`.** A node's act lasts when either source says so:

- **The node:** it is already marked as acting on the world (`automationStudioNodeMutates`), or the step it was built from declared a lasting consequence. A declared consequence means `metadata.declaredConsequences` holds any class. `[]` means "none" and does not count.
- **The producer:** the failure record states `effect: "ambiguous"`, meaning "the act was made and only its answer is missing". The web domain states this for its committing actions: click, keypress, dialog, and type with `submit`. That is the same set `webPlanStepMustDeclare` uses.

What happens to a lasting act after a failure:

- **The failure shows the act did not happen** (`effect: "unacted"`, or the fault was found while resolving the target). It keeps the first attempt plus 3 retries.
- **Otherwise** the retry is refused and marked `actUncertain`. Then:
  - a graph run that stops on it says `Outcome uncertain: ...`;
  - a Flow does not walk past it;
  - the ladder's wait and clear-interference rungs do not re-press it.
- **An effect check shows the act landed.** It counts as done. On the graph path this is the existing `skip_satisfied_node` rung (the expected state already holds). Outside a graph it is a new optional `checkEffect` hook on the outside-graph helper.

Nodes whose act does not last keep t355's retries unchanged.

## What changed and why

**Core (`C:\Users\osrs_\FluxStuff\fxwork\t359\!FluxIQ`)**, under `packages/fluxiq/src/programs/automation-studio/runtime/`:

- `executor/defensive/lasting-act.ts` (new):
  - `automationStudioNodeActLasts(node)`.
  - `AUTOMATION_STUDIO_DECLARED_CONSEQUENCES_METADATA_KEY`, now the one definition of the `declaredConsequences` key.
  - `automationStudioStopMessage(fault, message)`.
- `executor/defensive/assess.ts`:
  - New gate 3: a lasting act whose fault is not `unacted` is refused with `actUncertain` and `effect: "ambiguous"`.
  - Gate 2 (a node marked as acting, with an ambiguous fault) and gate 1 (failure found after acting, on a lasting node, not unacted) now also carry `actUncertain`.
  - The docstring now describes all three gates.
- `executor/defensive/contracts.ts`: `AutomationStudioFaultAssessment.actUncertain?: true`.
- `executor/defensive/continuation.ts`: a fault marked `actUncertain` never continues past the step. A choice the author wrote down still wins.
- `executor/defensive/index.ts`: exports the new file.
- `executor/ladder-run.ts`: `mayRepeat` is false when this attempt's fault is `actUncertain`, so a wait or a cleared layer does not re-press.
- `executor/graph-run.ts`: the stop message goes through `automationStudioStopMessage(fault, ...)`. The file is still exactly 800 lines; I joined an import line to stay there.
- `executor/outside-graph/retries.ts`, `outside-graph/index.ts`, `executor/index.ts`:
  - New optional `checkEffect: AutomationStudioLastingActCheck<T>`, which answers `landed`, `not_landed` or `unknown`.
  - The outcome gains `lastingAct: "landed" | "uncertain"`.
  - `not_landed` turns the fault into a retry with `effect: "unacted"`.
- `flow-bootstrap/adaptation.ts`: imports the metadata key from the executor instead of a private copy. The "no run reads it yet" comment now names the reader. This is the file that stamps declared consequences on nodes, which matches the brief's "node effect metadata from declared consequences".
- `docs/reference/framework-reference.md` and `packages/fluxiq/docs/reference/framework-reference.md`: regenerated with `pnpm docs:reference`, because new public exports made them stale (54+/46-).
- Tests:
  - `executor/defensive/tests/lasting-act.test.ts` (new, 6 tests).
  - `executor/outside-graph/tests/retries.test.ts` (+6 tests).
  - `executor/tests/defensive-policy.test.ts` (+5 graph-run tests in a new block). They were first a new file, but `executor/tests/` would then hold 26 files against the audit's limit of 25.

**Downstream (`C:\Users\osrs_\FluxStuff\fxwork\t359\!FluxIQWebExtension`):**

- `domain/src/runtime/adapter.ts`: `lastingActChecked` is replaced by `lastingActStated`.
  - For a committing action, the record states `effect: "unacted"` when nothing was dispatched. That covers: the row says unacted, the client said unacted, or the stage is `target_resolution` or `dispatch`.
  - Otherwise it states `effect: "ambiguous"`, and `retryable` stays as the code's row has it, so Core decides.
  - Every other action that changes the page keeps t355's rule: a failure found after it acted is set to `retryable: false`.
  - A client-stated `effect: "unacted"` now survives the rebuild for every action. Only the extension knows whether it dispatched: an actionability refusal states it.
  - The committing set comes from importing `webPlanStepMustDeclare` from `llm-evidence/plan-resolution`. That is a read-only import; I made no edit in t358's directory.
- `domain/src/runtime/llm-evidence/node-run/retries/dispatch.ts`:
  - An optional 5th parameter, `checkEffect`, is passed through to Core.
  - `WebNodeRetriedDispatch` gains `lastingAct`, written through `present<T>()` to satisfy the `contract-spread` rule.
- Tests:
  - `domain/src/runtime/tests/adapter.test.ts`: two expectations updated for presses (`effect: "ambiguous"` and `effect: "unacted"` instead of `retryable: false` and no effect). One new test covers the committing statement.
  - `domain/src/runtime/llm-evidence/node-run/retries/tests/lasting-act.test.ts` (new, 8 tests): exploration, replay and the direct seam.

No extension source changed (`apps/extension/src/content/actions/**` untouched). No new `as never` casts.

## Commands run and observed results

**Core fail-first.** I copied the HEAD versions of the 11 changed source files back in, kept the new tests, and moved `lasting-act.ts` aside. Then I ran vitest on the graph, outside-graph and lasting-act tests.
- Graph and defensive-unit tests: `7 failed | 13 passed`. The failures were "ends uncertain without a second press", "takes the producer's word…", and 5 lasting-act unit tests.
- A second run with HEAD source and my outside-graph test file: `4 failed | 11 passed`. The failures were the landed, not_landed, uncertain and producer-word cases.
- I then restored my versions.
- These pass on HEAD too, as expected, because they pin behaviour that should not change: pressing again before dispatch, non-lasting nodes keeping 3 retries, and landed-via-`skip_satisfied_node`, which already existed.

**Core after the fix:**
- `npx vitest run .../runtime/executor .../runtime/flow-bootstrap .../runtime/service .../runtime/tests/executor.test.ts .../runtime/recovery` printed `Test Files 268 passed | 1 skipped (269)`, `Tests 3253 passed | 3 skipped (3256)`.
- `pnpm check` (packages/fluxiq) passed. `pnpm build` (packages/fluxiq) passed, rebuilt after the last source edit.
- `node scripts/structure-audit.mjs` printed `structure-audit: passed (288 warning(s), 508 baselined)` and "1 baseline entries can be lowered", which was already there at t355. It first failed on the 26 files in `executor/tests/` and on `graph-run.ts` at 801 lines; I fixed both as described above.
- `pnpm docs:check` printed "Deterministic framework reference is current", after `pnpm docs:reference`.

**Domain fail-first.** With HEAD `adapter.ts` and `retries/dispatch.ts` and my tests, a narrow runner bundled the named entries exactly as `scripts/test-domain.mjs` does, into `domain/.test-build-scratch/t359`. Running the adapter and lasting-act tests printed `# tests 32 # pass 26 # fail 6`. The failures were the three checkEffect cases and three adapter statement cases. I then restored.

**Domain after the fix:**
- The same runner on every test entry under `node-run/**`, `runtime/tests`, `llm-evidence/tests`, `action-failure`, `runtime/failure` and `io` (83 entries) printed `# tests 638 # pass 638 # fail 0`.
- After the `present()` change, adapter, lasting-act and dispatch printed `# tests 40 # pass 40 # fail 0`.
- `pnpm check` (domain) passed.
- `node scripts/structure-audit.mjs` (downstream) printed `structure-audit: passed (176 warning(s), 182 baselined)`, with no FAIL lines. It first failed on `contract-spread` in `retries/dispatch.ts`, which I fixed with `present()`.
- I deleted the scratch runner and its output.

**Lab, provider-free.** `FLUXIQ_LAB_INSTANCE=t359-lasting FLUXIQ_TEST_ENV_FILES=none node scripts/lab/run-lab.mjs run crossborder-marketplace --flow` produced `run-muyv4y5m-1bee7e07` with `llm.mode: disabled, calls: 0`. The verdict was failed, `target_not_found`, which is the same cause as t355's `run-muyta37c-a9368bca`: t347's recorded second coupon press. From `snapshots/flow-lane.json`:
- The busy "Get coupons" press (`web.action.rate_limited`, `effect: "unacted"`) was retried and succeeded on attempt 2 of 4. It is listed in `recoveredFailures`.
- The recorded second coupon press failed `web.target.not_found` with `effect: "unacted"` at attempts 2, 3 and 4 (backoff 250, 1000 and 2000 ms), then `recovery.exhausted`.
- `"effect":"unacted"` appears 7 times, `"effect":"ambiguous"` 0 times, and "Outcome uncertain" 0 times. No press was refused as uncertain, because no fault after a dispatch occurred.

**Cleanup.** `Get-CimInstance Win32_Process` filtered to node or chrome processes with `t359` in the command line printed "no t359 node/chrome processes".

**Not run:** the extension build or check, because no extension source changed. The Lab prelude did rebuild the extension bundles. The full suites were not run, per the twice-a-day rule.

## Not verified

- **An uncertain press in a live browser.** No realistic scenario produces a failure after a dispatch on demand, so the uncertain and landed outcomes are covered by unit tests only, on every path.
- **Exploration and candidate trials live.** Both need a model. Trials run through the same `runAutomationStudioGraph` and the same adapter as playback, but I wrote no trial-specific test. `flow-bootstrap/verification/tests` is not my path, though it passed in the 268-file run.
- **What the model is told.** On exploration and replay, the model still sees the plain failure, not "outcome uncertain". `retries/dispatch.ts` now returns `lastingAct`, but `node-run/run.ts` and `replay.ts`, which are not my files, do not read it and pass no `checkEffect`. Until they do, an uncertain press there is simply not repeated, which matches t355's behaviour, and nothing says it is uncertain.

## Open questions or contradictions found

1. **Transport faults on a committing press now end uncertain on the graph path.** This covers `web.transport.transient`, including "Receiving end does not exist" (content script not injected yet), when the client sends no `unacted` statement. That is the conservative reading, but it removes a retry t355 called the commonest one right after a navigation.
   - The structural fix is in the background (`apps/extension/src/runtime/action-runner.ts` and `background/tabs`), not my files: state `effect: "unacted"` on a send the browser never delivered. The adapter already honours a client-stated `unacted`.
   - "Message port closed" with no committed navigation would correctly stay ambiguous.
2. **A timeout with no answer from the domain carries no statement.** When Core's runtime times out before the adapter answers, `failureForCommandStatus` builds the record and states nothing. An undeclared press is then still retried; a press whose step declared consequences is not.
3. **A desired-state node with declared consequences ends uncertain on an ambiguous fault.** Example: a select or check that declared `modify_existing`. Its own verb re-reads the state before acting, so a retry would be safe. Neither the record nor the node can say "repeat-safe" today; the domain could set `metadata.idempotent` on such nodes when the Flow is written.
4. **Docs.** `docs/architecture/web-capabilities.md` (downstream) and Core's `docs/architecture/automation-studio.md` describe the lasting-act rule in t355's terms. They should mention declared consequences, the domain's committing statement, `actUncertain` and "Outcome uncertain". I did not edit them: they are not my paths.
