# t234 W4: Flow creation spend record, build-wide purse wiring, decision reply allowance

## Outcome

Done, with two failures in the brief's validation run. Neither is in a W4 file (details below). Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t234/!FluxIQ`, package `packages/fluxiq`. All paths below are under `src/programs/automation-studio/runtime/`. Nothing was committed.

## What changed and why

- `flow-bootstrap/creation-spend/` (new): `record.ts` holds the type `AutomationStudioFlowBootstrapCreationSpend` `{ kind: "flow_creation_spend", projectId, flowId, spentUsd, builds, createdAt, updatedAt }`. `parse.ts` holds `parseAutomationStudioFlowBootstrapCreationSpend(value, owner)`, which returns `null` for any record that is damaged or belongs to another owner. Both follow the incomplete-draft files. The directory also has a barrel and `tests/parse.test.ts`.
- `flow-bootstrap/index.ts`: added the barrel line `export * from "./creation-spend/index.ts";`.
- `service/creation-spend.ts` (new): `AutomationStudioFlowBootstrapCreationSpendStore`, which keeps `creation-spend.json` beside the Flow and also holds the record in memory. It is modelled on `service/incomplete-drafts.ts`.
- `llm/harness/token-limits.ts`: added `AUTOMATION_STUDIO_LLM_DECISION_REPLY_TOKENS = 2_000`. Its doc comment gives the derivation: at least 3 times 593, rounded up to the thousand, with p99 469, median 101 and none truncated, and it names the corpus. It also says why the hold stays a true upper bound: `max_tokens` is the same figure. `llm/harness/index.ts` now exports it.
- `service.ts`:
  - Added the `creationSpends` field and its construction in the constructor.
  - In `generateFlowBootstrapAdaptationInternal`, after `bootstrapLoopLimits`:
    - A build that is not a repair (no `repairBrief`) reads the record.
    - It opens `new AutomationStudioLlmBuildPurse({ ceilingUsd: bootstrapLoopLimits.loop.budget.maxCostUsd, carriedUsd: record?.spentUsd ?? 0 })`.
    - The rest of the body runs inside `automationStudioLlmBuildPurseScope(purse, …)` with try/finally. The finally deletes the record when a Flow was proposed (`creationEnded` is set after `createFlowBootstrapAdaptation`) or the ending is `not_doable` (`built.kind === "unfinished" && built.ending.kind === "not_doable"`). Otherwise it saves `spentUsd = purse.spentUsd()` and `builds + 1`.
    - A repair build gets `carriedUsd` 0 and the same ceiling as before (it still includes `repairCostLeftUsd`). It never touches the record.
    - The purse is passed to the loop (`purse` in the round's loop input) and to the phases (`purse` in the `runAutomationStudioFlowBootstrapBuildPhases` input), using W2's and W3's field names.
    - The body is not re-indented, to keep the diff small next to t235: the scope opens with `{ try {` and closes with `} finally {…} });`. The supervisor may reformat.
  - The decision call now uses `tokenLimits = { ...resolved, maxOutputTokens: min(resolved.maxOutputTokens, 2_000) }`, with input and total left as resolved. If resolving the limits produced diagnostics, it passes the provider's limits unchanged. This is the only call changed.
  - When the purse refuses a decision, `decide` now throws `AutomationStudioLlmBuildPurseRefused`, so the refusal reads as the cost ending and never as a harness failure. A refusal is recognised as `not_attempted` plus the purse's own `llm_budget.run_cost_limit` code.
- Requirement 3, traced. The first call of an evidence build is the first decision; the first look is free. A refusal there is now the loop's `budget` exhaustion, which the phases turn into the cost ending. The instruction reading (`service/instruction-authority.ts`) works differently: a purse refusal gave `answer.ok === false`, and `derive` returned `[]` as "the instruction permits nothing". The gate then refused the lasting step and opened a permission question. That question parks for up to `permissionAskTimeoutMs`, and the build ended as `flow_bootstrap.permission_required`; if the reading was first needed inside the completion check, it aborted the loop on a plan refusal. Without the fix, test (f) times out because the person is asked and the build waits. The fix, all in `service.ts`:
  - The authority's `run` wrapper records `readingRefused`.
  - The permission ask port refuses to open once that is set, so the gate reads the question as `unanswered` and nobody is asked.
  - A plan refusal that only the refused reading caused no longer aborts the loop signal.
  - The next `decide` sets `purse.refusal` and throws `AutomationStudioLlmBuildPurseRefused`, giving the cost ending with the refusal's figures.
  - `callerEnding` ignores the request the refused reading raised.
  - The post-loop `askedPermission` and the `unusableDecisions.stalled` paths are unchanged, because neither is reached in this case.
- `tests/service-bootstrap/tests/creation-spend.test.ts` (new): tests (a) to (e) as briefed, plus (f) for the refused instruction reading. The ceiling is always `AUTOMATION_STUDIO_LLM_RUN_COST_CEILING_USD`. The store is read through the service's private `creationSpends` field, so the tests do not import a non-barrel path.

## Commands run and observed results

All commands were run from `packages/fluxiq`.

- `npx vitest run src/programs/automation-studio/runtime/flow-bootstrap/creation-spend src/programs/automation-studio/runtime/tests/service-bootstrap` printed `Test Files 2 failed | 22 passed (24)`, `Tests 2 failed | 130 passed (132)`. All 13 parse tests and all 6 creation-spend tests passed. The two failures:
  - `cost-ceiling.test.ts:69` failed with `expected 0.108 to be less than or equal to 0.1`. It fails the same way with the pre-W4 `service.ts`: I ran the test against a temporary copy of `git show HEAD:.../service.ts` and observed the same 0.108. The cause is the loop no longer stopping on its count (W2): the test's mock provider has no `estimateCostUsd`, so the purse holds each call at 0 and refuses only once the build has spent the ceiling, and the ninth call at $0.096 spent goes through. Not W4.
  - `generation.test.ts:279` failed with `expected 0.25 to be close to 0.0445`. The test asserts the judge's per-call cap of half of what is left. W3's `judge.ts` deliberately drops that cap when a purse is present, and W4 makes every build run under a purse, so the test's expectation is obsolete. The same test passes against the pre-W4 `service.ts`. It needs updating by whoever owns `generation.test.ts`.
- Checked that each new test fails on the old source. I ran a temporary copy of the test against a temporary `service.w4old.ts` taken from `git show HEAD`; both copies were deleted afterwards.
  - (a) failed with `expected [...] to have a length of 3 but got 6`: the second build sent three more calls.
  - (b), (c) and (e) failed because the old service has no record or store.
  - (d) failed: `tokenLimits` was not 2,000.
  - (f) timed out after 30 s: the person was asked and the build waited.
  - I also ran (f) against a variant with only the `readingRefused` capture removed. It timed out the same way, which shows the reading-refusal handling is what (f) exercises.

## Not verified

- No typecheck. Whole-package tsc is barred by the brief. VS Code diagnostics for `service.ts` came back empty, which may only mean the file was not analysed.
- No structure audit run, and no live run.
- The behaviour of extend-mode and one-shot (non-evidence) builds with the record. Following the brief literally, both read and write it.

## Open questions or contradictions found

1. **Barrel.** `service.ts` imports `./service/creation-spend.ts` directly because `service/index.ts` is not mine. The structure audit's barrel ratchet will count this. Fix: add `export * from "./creation-spend.ts";` to `service/index.ts` and import the store from `./service/index.ts`.
2. **A spent creation cannot recover.** Once a creation's record reaches the ceiling, every later build of that Flow ends at once on cost, and only a proposed Flow or a not-doable ending clears it. Changing the instruction does not reset it, unlike the incomplete draft. Is that intended?
3. **Mid-build instruction reading.** A reading the purse refuses mid-build now ends the build on cost. A decision with the 2,000-token allowance can sometimes fit where the reading, still on the 8,000-token default reply, does not. That is consistent with the brief, which keeps the authority unchanged.
4. **Write failures in the finally.** A store write that fails in the finally replaces the build's own ending. I chose not to swallow it, because losing the spend would reset the ceiling.
