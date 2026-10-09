# t375 adaptation unblock: lead report

Status: Done in source, uncommitted, and verified by the lead. A live proof is still owed (see the end of this report).
Tree: `C:/Users/osrs_/FluxStuff/fxwork/t375/!FluxIQWebExtension` (branch `task/t375-adaptation-unblock`), with its Core sibling `fxwork/t375/!FluxIQ` on the same branch. Nothing is committed.
Brief: `t375 adaptation unblock (lead)` in `../mvp-final-month-plan.md`. Source: [adaptation loop audit](./adaptation-loop-audit.md) (2026-10-05), blockers 1-6.
`R/` below means Core `packages/fluxiq/src/programs/automation-studio/runtime/`.

## Re-verification against current dev (2026-10-08)

The audit is out of date. t267 (merged 2026-10-05, [report](./t267-adaptation-unblock.md)) and t273 S3 fixed blockers 1-5 in source. This pass checked each fix against this tree and against candidate mode, which landed later (t339-t373).

Three read-only workers did the first pass. Their reports are [d1](./t375/d1-core-reverify.md), [d2](./t375/d2-lab-reverify.md) and [d3](./t375/d3-candidate-flow-basis.md). The lead then checked each load-bearing claim in the source, at the lines cited below.

| Unit | Audit blocker | State on this tree | Evidence (lead-checked) |
| --- | --- | --- | --- |
| 1 Product runs can repair | 1 | **Holds for the extension.** The chat's "run it" sends `explore_and_adapt`. The Automations Run sends it too, and its paired actor is mapped to the person's unlocked session. Both paired paths pay only for the checks that judge a repair. **Gap:** a non-paired chat "run it" (web panel conversation) pays for a result check on every succeeded run, even one the schedule would not sample. | `R/conversations/commands/run-flow.ts:51` (`repair_checks` only when `context.paired`); `api/handlers/runtime-execution.ts:61-92`; `R/service/runtime-adaptation/result-check.ts:189`; `R/tests/service-adaptation/tests/caller-paid-result-check.test.ts:268-277` enshrines the every-check path. Paired zero-call tests: same file, lines 195, 205 and 248. |
| 2 Lab playback lets a repair promote | 2 | **Holds, candidate mode included.** Playback is `runLiveFlow`. It sends `adaptiveMode` only for `manual_approval` intents, and `repairAuthorizer` stores `fully_adaptive` on the Flow after promotion. | ext `packages/test-runner/src/flow-lane/persisted-flow-run.ts:76-78`, `:496-499`; d2 report Q1. |
| 3 Repair lane counts only replayed repairs | 3 | **Gap.** A re-author that was tried and not kept, or is still held, is dropped by `applied !== true`. The lane then sees `no_proposal`, replays 0 times and passes. The Lab's `RunHarnessResultReauthor` carries no `held` or `notAppliedReason`. | `packages/test-runner/src/flow-lane/repair/run-repair-lane.ts:176-179`; `prove-repair.ts:83`; d2 report Q2. |
| 4 A candidate-built Flow can verify | 4 | **The S2 marker covers it, but retries break it.** Lane A's 12-node candidate Flow (run `run-muz3cqdh-927fd2f1`) declares no trial evidence, so a target-override trial is `unverifiable` with `no_evidence`. S2's judged-whole-run path applies to that. **New defect:** an automatic retry is a separate failed attempt, and the verdict counts it, so a changed node that fails once and then passes on its retry reads `contradicted`. That blocks the resume and the promotion. Lane A's `s6` needed a retry in all four stored runs. | `R/flow-change/verdict.ts:131-135` (`changedNodeCheck`) and `:188-197` (downstream assertions); `R/executor/graph-run.ts:459`, `:638` (`retry.previousAttemptId`); `R/flow-change/trial.ts:157-191` (`verdictAttempt` drops `retry`); d3 report. |
| 5 Re-author applied only after its judged re-run | 5 | **Holds.** The edit is approved with `hold: true`. It is applied only on a succeeded run with a performed `answers` verdict. `appliedBeforeJudged` no longer exists in source. A candidate becomes a proposal only after a whole-run yes. A re-author's build still runs in legacy extend mode (no `authoringMode`); see Follow-ups. | `R/service/runtime-adaptation/reauthor-build.ts:127-145`; `judged-promotion.ts:117-127`; d1 report Q3. |
| 6 Item 24 | 6 | **Gaps.** (a) The chat's success sentence is ``The run${runId} ended ${status}${reason}.``, which shows a raw run id, a status word and the trace message. (b) The Automations row says nothing for an applied re-author. Core's `automationStudioRunChangedDurableBehavior` reads only runtime-patch decisions, so the reply's `durableBehaviorChanged` is false even when the re-author was kept. | `R/conversations/commands/run-flow.ts:67`; `R/durable-behavior/durable-behavior-changed.ts:12-21`; ext `apps/extension/src/panel/automations/facts.ts:50-52`; d2 report Q3. |

Item 23 on the extension's own paths is already proven by tests. A paired chat "run it" or Automations Run whose steps all succeed makes no result-check call on the person's key, and leaves routine sampling to the standing authorization.

## Implementation units (dispatched in parallel, partitioned by file)

The units are listed below. Worker reports are in `./t375/`.

- **W1** (Core, worker-high): a retry that succeeded supersedes the failed attempt it retried, in the trial verdict and in replay confidence (unit 4).
- **W2** (Core, worker): the chat's "run it" always asks for `repair_checks`, with service-level zero-call proof (unit 1). Its success sentence is plain words that name the Flow (unit 6a). The durable-change reading counts an applied re-author (unit 6b, Core side).
- **W3** (downstream test-runner and test-contracts, worker): the repair lane fails a re-author that was not kept, and the Lab record carries `held` and `notAppliedReason` (unit 3).
- **W4** (extension, worker): the Automations row counts an applied change that Core reports as a durable change, even when no adaptation id names it (unit 6b, extension side).

## What changed (lead-reviewed diffs)

| Unit | Result | Files |
| --- | --- | --- |
| 1 | The chat's "run it" asks for `repair_checks` from any client. A non-paired run whose steps all succeed now makes no model call on the person's key, and a repaired run is still judged with it. | Core `R/conversations/commands/run-flow.ts`; tests `run-flow.test.ts`, `R/tests/service-adaptation/tests/caller-paid-result-check.test.ts` (a new non-paired describe block), `api/handlers/tests/conversations.test.ts` (the lead updated the end-to-end "run it" expectation and registered `get-flow`) |
| 2 | No change needed (holds). | None |
| 3 | A re-author that was made but not kept fails the repair lane with its closed reason, after `snapshots/repair-lane.json` is written and published. The Lab record carries `held` and `notAppliedReason`, closed codes only. | ext `packages/test-contracts/src/harness-recovery.ts`, `harness-recovery-validation.ts`, `tests/harness-recovery-result-route.test.mjs`; `packages/test-runner/src/flow-lane/harness-recovery.ts`, `repair/run-repair-lane.ts`, `repair/prove-repair.ts` (comment only), and their tests |
| 4 | An attempt that an automatic retry replaced (`retry.previousAttemptId`) is marked `retried`. The trial verdict and replay confidence pass over it in every per-node and downstream-assertion check. A changed step that missed once and then held now resumes, auto-promotes and is applied after a judged `answers`. | Core `R/flow-change/{contracts,attempt-projection,trial,verdict}.ts`, `R/adaptation-confidence/replay.ts`, their tests, and `R/tests/service-adaptation/tests/judged-run-evidence.test.ts` (new end-to-end case) |
| 5 | No change needed (holds). | None |
| 6a | The chat names what ran in plain words, for example `"Kettle price checker" ran all the way through.` A `waiting` run says it stopped to wait for you, with a plain cause. Any other unfinished run says it stopped before the end. No run id, status word or trace message is shown. | Core `run-flow.ts` |
| 6b | Core's durable-change reading counts a kept re-author. The Automations row then reads "Learned 1 new page variation" and "Future runs updated" for it, and an applied patch is still counted once. | Core `R/durable-behavior/durable-behavior-changed.ts` and its test; ext `apps/extension/src/panel/automations/facts.ts`, `tests/facts.test.ts`, `tests/summary-copy.test.ts` |
| Docs | Updated: Core `docs/architecture/package-boundaries.md` (new migration note), `automation-studio.md` (retried attempts in the verdict), `automation-studio/client-gateway.md` ("run it" payer and words, durable change); ext `docs/architecture/testing-facility.md` (a re-author not kept fails the lane). Both framework references were regenerated for the new export. | As listed |

Worker reports: [w1](./t375/w1-retry-aware-verdict.md), [w2](./t375/w2-run-it.md), [w3](./t375/w3-repair-lane.md), [w4](./t375/w4-row-learned.md).

## Validation (lead-run, t375 trees, final state)

- Core `packages/fluxiq`, `npx vitest run` on 35 files: every changed test file, `flow-change/tests`, `adaptation-confidence/tests`, `durable-behavior/tests`, `service/runtime-adaptation/tests`, `service/adaptations/tests/adaptive-retry`, `tests/live-patch*`, `tests/training-modes`, the service-adaptation files (`caller-paid-*`, `judged-*`, `promotion-tier`, `adaptive-loop`), and the `runtime-execution` and `conversations` handler tests. Result: `Test Files 35 passed (35)`, `Tests 507 passed (507)`.
- Fail-first, checked by the lead: with only `verdict.ts` reverted to HEAD, `verdict.test.ts` and `judged-run-evidence.test.ts` gave `7 failed | 58 passed`. The new end-to-end case "carries on and is applied when the re-aimed press needs one automatic retry in its trial" was among the failures. The fix was then restored.
- Core: `node scripts/build-cache/cli.mjs fluxiq:check` exit 0. `node scripts/structure-audit.mjs` gave `passed (290 warning(s), 710 baselined)`. `pnpm.cmd docs:check` reported "Deterministic framework reference is current." `pnpm.cmd build` exit 0.
- Downstream, against the rebuilt Core:
  - `pnpm --filter test-contracts test`: `# tests 170 # pass 170 # fail 0`.
  - `pnpm --filter test-runner build` exit 0. Then `node --test` on `flow-lane/repair/tests/*`, `flow-lane/tests/harness-recovery`, `persisted-flow-run*`: `# tests 97 # pass 97 # fail 0`. On `live-llm/tests/{reauthor-record,live-llm-run,flow-settings}`: `# tests 35 # pass 35 # fail 0`.
  - `check` exit 0 for `domain`, `test-runner` and `extension`.
  - The 14 `panel/automations/tests` files, bundled with `scripts/test-extension.mjs`'s esbuild options into an ignored scratch label (now removed): `# tests 105 # pass 105 # fail 0`.
- Downstream `node scripts/structure-audit.mjs` has 1 failure: `[working-docs] docs/working/README.md is out of date`. This was already true at the branch's base commit `128d907e`. The index lists `mvp-final-month-plan.md` at 429 lines, the file has 435, and no tracked working document changed here. `reports/` files are not indexed. Regenerate the index (`pnpm structure:baseline`) when integrating. The index is a shared document, so it was left alone.
- Not run: full suites, any Lab, browser or provider run.

## Live proof still owed

These checks run after lane A's streak, in an off-peak window, provider-paid and supervised:
- **Target override (units 2 and 4).** Run `bigbox-retail-pickup-cart-redesigned-after-creation` with `--authoring-mode candidate --replays 1` (the command is in the audit, "Recommended live proof tasks"). The run detail must show `verification.awaitsJudgedRun: true`, `retryOriginalAction: true`, `approvalDecision.evidence: "judged_whole_run"`, and, after `answers`, the adaptation `applied`. The replay must make 0 calls.
- **Re-author (units 3 and 5).** Run the social-feed regrouped task with `--llm-permit send_or_publish`. The marker must show `held: true`, then `applied: true` only after `answers`. If not kept, the lane must fail with its reason.
- **Product path (units 1 and 6).** On a saved Flow, type "run it" in the extension chat and press Run in Automations. The answer must name the Flow, and a routine run must make 0 provider calls.

## Follow-ups (not in this brief)

- The ladder's `satisfied` rung keeps the attempt `failed` with nothing linked to it (Core `R/executor/graph-run.ts:645-651`, owned by t376). That rung is reached when a lasting act's uncertain effect is found already done. A trial whose re-aimed press reaches it still reads `contradicted`. The cleanest fix is a marker on the attempt in `graph-run.ts`, which `attempt-projection.ts` would then read.
- Readers outside this unit that do not know about retries were checked and judged harmless: `R/recovery/refuted-result/step-failure-target.ts:58` reads the last failed attempt of a run that failed, and `R/result-verification/read-account/loop-passes.ts:86-94` returns at the bound or exit first.
- W3: a re-author route taken that built no adaptation still reads as `no_proposal` in the repair lane. The playback oracle normally fails that run first.
- The Automations row counts a kept re-author only from a reply to a Run pressed in this panel session. A listed run's `durableBehaviorChanged` (on `list-flow-runs` summaries) is not passed to `runFacts`. That wiring is in `controller.ts`, `replies.ts` and `types.ts`, which t376 owns.
- `harness-recovery.ts` (test-contracts) now exports 9 values against an advisory threshold of 8. This is a warning, not a failure.

- A re-author's build runs in legacy extend mode even once candidate mode becomes the product default (`reauthor-build.ts:127-131`). Decide whether it should author a candidate.
- The web panel's model-assisted run modes (`apps/web/.../FlowRunView.tsx:209-214`) still pay for every check, as designed ("as before"). They also pay when the Flow's checking is off, because `result-check.ts:189` never reads `check.checked` for an `every_run` caller.
- d3 recommendation (B): give the graph options a definition-metadata lookup (`R/executor/contracts.ts:464`), so that a domain's `verifiesState` (for example `wait_for_text`) counts as a downstream assertion. A trial could then be `verified` rather than relying on the judged whole run.
