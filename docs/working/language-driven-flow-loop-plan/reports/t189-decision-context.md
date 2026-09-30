# t189 — decision context (what the model is sent, and why it repeats)

Lane lead t189, 2026-09-29/30. **Status: Ready to commit.** Phase 1 done with record-level evidence; Phase 2 built,
tested on the rebuilt windows and validated (section Validation). No live or Lab run (t174 owns slot-1).

Trees: Core `C:/Users/osrs_/FluxStuff/fxwork/t189/!FluxIQ` and extension
`C:/Users/osrs_/FluxStuff/fxwork/t189/!FluxIQWebExtension`, both `task/t189-decision-context`, Core at `e85a02a`.
Paths below are relative to `packages/fluxiq/src/programs/automation-studio/runtime/` unless absolute.
Evidence: the t174 bundles under `C:/Users/osrs_/FluxStuff/fxwork/t174/!FluxIQWebExtension/test-runs/instances/`
(`t174-slot-2/run-munaiz76-7026748c` = run 4, `t174-slot-1/run-muncqlr0-3348202b` = run 6,
`t174-slot-1/run-munda7ub-d9214e3b` = crossborder, which logs completion issue codes), their debugs and the t174 reports.

Baseline before any edit: `npx vitest run src/programs/automation-studio/runtime/llm --maxWorkers=2` in
`packages/fluxiq`: `Test Files 67 passed (67)`, `Tests 676 passed (676)`, 48.6 s.

## Phase 1 — what one build decision is sent

Each decision is one **stateless** provider request of two messages (`llm/deepseek/request-body.ts:43-44`):

- **System** (`llm/deepseek/system-prompt.ts:43-50`): the JSON-only rule, the schema rule,
  `AUTOMATION_STUDIO_LLM_EVIDENCE_DECISION_INSTRUCTION` (`llm/evidence-loop-decision.ts:44`, added because the
  bootstrap call sets no `stage`) and the compact-output rule ("keep summary under 240 characters").
- **User**: the context packet (`llm/harness/context-packet.ts:246-297`), built fresh by `runHarness` at
  `service.ts:1613-1625` on every decision: the Flow's instructions (resent every decision, with a repair brief
  when there is one), the node catalog and start location (`flowBootstrap`, 16,000 input tokens), routing
  context, and `evidenceLoop: { iteration, tools, evidence, decisionSchema, completionSchema, canComplete }`.
- `evidence` is `[...window, draftEntry, budgetEntry]` (`llm/evidence-loop.ts:548-569`), where
  - `window` = `automationStudioLlmEvidenceContextWindow(evidence, 24,000 − besideBytes, 64 − 2)`
    (`llm/context-window.ts:82`; 24,000 is `AUTOMATION_STUDIO_EVIDENCE_CONTEXT_BYTES`,
    `loop-limits/flow-bootstrap-evidence-loop.ts:94`);
  - `draftEntry` = `automationStudioFlowDraftEntry({ steps, maxBytes: 4,000 })` (`flow-draft/entry.ts:96`), listing
    only `automationStudioFlowDraftStepIsAction` steps (`proposes ?? effect === "mutate"`, `flow-draft/step.ts:200`);
  - `budgetEntry` from the second decision on (`llm/loop-budget.ts`).
- **Never sent**: the model's own earlier decisions. The reply's `summary` is discarded
  (`service.ts:1628` returns only `decision.response.decision`), there is no conversation history, and
  observation calls, answered requests, amendments and completions have no row anywhere except Core's notes.

So everything the model knows about its own past is the window, the draft and the in-window history entry.

## Phase 1 — why it repeats (gaps, with the code that causes each)

**G1. Core's feedback leaves the window with no trace, and only the newest of each kind is protected.**
- Refused completions (`core.completion_check.N`, `evidence-loop.ts:609-612`), dry-run refusals (`core.dry_run.N`,
  pushed by `node-tools/dry-run-gate.ts:106-110` through `showEvidence`), amendment refusals (`:681-688`),
  answered-repeat notes (`:433`), no-progress redirects (`:323-326`) and unusable-decision feedback (`:578-580`)
  are pushed without a `call` summary, so `historyLine` (`context-window.ts:167-170`) never lists them.
- `priorityOrder` (`context-window.ts:122-135`) keeps only the newest entry per `toolId` as current. Every
  completion refusal is `core.completion_check`, every answered note `core.request_check`, and — the larger
  point — **every node call of a web build is `core.run_node`**, so exactly one page is "current" and every
  other page and every earlier refusal competes newest-first for what is left.
- `noProgress.outstanding` (`evidence-loop/no-progress.ts:151`) keeps only the latest refusal's codes.
- Record-level proof: the rebuilt windows (section below, pending worker A).

**G2. The answered-repeat note does not say what was asked, how often, or that nothing ran.**
- The note (`evidence-loop/answered-request.ts:34-48`) carries `toolId` and `answeredByCallId` only. With one
  tool for every node, `toolId` is always `core.run_node` and says nothing.
- An answered request is recorded `proposes: false` (`evidence-loop.ts:425`), so the draft never lists it.
- It claims "nothing has changed since", which Core has not checked: `captureStateDigest` is available
  (`service.ts:1599`, web `domain/src/runtime/llm-evidence/tools.ts:350`) and is not consulted.
- The redirect comes only from the third step without progress (`loop-limits/evidence-loop.ts:109`).
- Record-level proof from run 6: iterations 6–9 and 14–20 have `decide end kind=tool_call` and no `tool start`
  (`core.log`). By `repeat-policy.ts:47-60` a `core.run_node` request is keyed on `attemptEpoch`, which only an
  executed action moves; the only request registered in the epoch after `open-store-picker` (it. 4) is `snap3`
  (it. 5), and after `pick-millbrook` (it. 12) only `snap-store-list` (it. 13). So all eleven were the exact
  request of the latest look, re-asked 4 and then 7 times, each answered `llm_evidence_loop.already_answered`.

**G3 (supervisor's cause 1, Core half). `pick-millbrook` did take effect; the model withdrew it.**
- The web node-run success path returns `effectApplied: true` unconditionally for a command that succeeded, with
  `proposes: node.proposes` (`domain/src/runtime/llm-evidence/node-run/run.ts:321-356`). The log shows
  `pick-millbrook` `web.action.succeeded` in 1,526 ms, so it was recorded kept and proposable at position 12.
- Dry run 1 (it. 22) replayed only positions 4 and 11. Between 12 and 22 the only decision that can withdraw a
  step is the amendment at 21 (no `tool start` follows it, so not a rerun; a reorder would not un-propose it).
  **So the model itself dropped or marked exploratory the store switch** — by elimination; the amendment's
  content is not logged. It then re-ran the act at 33 and 37 (`pick-millbrook-2`, `-3`), and opened the chip six times.
- Core's recording was not the cause for this run. What Core lacks is showing the model, durably, that step 12
  worked and changed the page, that it withdrew it itself, and that later picks repeat it.

**G4. The draft trims arguments oldest first** (`flow-draft/entry.ts:155-181`, 512-byte per-argument bound at
`:77`). Measured on the rebuild: run 4 decision 47 `draftShown` is
`{bytes:3953,budget:4000,steps:20,instructionBytes:154,withoutInput:3}` — the telling cut to its minimal form and the
3 oldest arguments withheld. Not changed here (the history now carries what each call returned); a candidate for a
later lane if live runs show the lost arguments matter.

**G5. Instrumentation** (`progress-trace.ts`, t174's): unchanged by this lane.

**G6. The missing-act check** (`flow-bootstrap/instructed-acts/check.ts:130-138`): t188's area; reported only.

## Rebuilt windows (worker A, verified by me)

Fixture `llm/decision-context/tests/recorded-runs.ts` drives the real `runAutomationStudioLlmEvidenceLoop` with
scripted callbacks built from each `core.log`; `recorded-windows.test.ts` holds the rebuild to the log.
I re-ran it: `Tests 11 passed | 1 failed (12)`, the failure being the pinned defect below flipping after I
applied the fix. Worker report: `reports/t189-wA-recorded-windows.md` (all fidelity assumptions listed there;
pages fixed at 5,800 bytes, detections 2,000; amendment content chosen where the log is silent).

- **The replays match the logs exactly**: every decision kind, call id, result code and dry-run call id, for run 6
  (37 decisions), crossborder (22) and run 4 (47); the eleven run-6 repeats are recorded `already_answered`.
- **Run 6's unexplained end is a Core defect, already fixed in t174's tree.** By decision 38 the draft no longer
  fits as objects, `flow-draft/entry.ts` packs it into rows and shows a refused press as `did_not_work`, which
  `evidence-loop/draft-shown.ts` `isDraftStepRow` rejected, throwing `Cannot measure malformed or unknown packed
  draft shape` inside the decision's try block; `propagateDecisionErrors` carried it out and the service filed it
  under the pre-set `flow_bootstrap.pre_provider_validation_failed` (`service.ts:1554`). The live log ends exactly
  there (no `decide start iteration=38`). t174's `e8d3bfc` carries the fix; I applied the byte-identical hunk
  (`diff --strip-trailing-cr` against t174's file: identical) so the replays run to their end and the merge is clean.
- **Run 6 decision 22**: 18 entries, 23,919 bytes, of which 8,398 are seven `core.request_check` and six
  `core.no_progress` notes saying the same thing.
- **Run 6 decision 37**: 16 of 22 earlier Core notes gone with no trace; the stale dry-run-1 page (5,861 bytes)
  and its refusal still take a quarter of the window, although both steps it refused were dropped at 23.
- **Run 4 decision 47**: completion refusals 40 and 44 gone with no trace, only `.46` shown; dry run 1's refusal
  and page still shown although dry runs 2–4 replayed clean (a refusal that is no longer true stays because it is
  the newest of its tool id); `core.evidence_history` lists 11 calls and counts 25 `unlisted`; the draft is cut to
  its 154-byte minimal instruction with the 3 oldest arguments withheld (`draftShown` bytes 3,953 of 4,000).
- **Crossborder decisions 13–14**: nothing was evicted. Decision 13 was shown refusal 12 in full and sent the
  identical completion again; 14 shows both identical refusals side by side and nothing says they are the same.
  So the model repeats a refused decision **while seeing the refusal**: eviction is not the only gap, the loop
  never tells it that a decision is one it already made and what that returned.

## Phase 2 — design

1. **One durable record of every decision** (`core.evidence_history`, beside the window like the draft): each
   decision, oldest first, and what Core answered — call result codes, requests answered from memory, amendment
   refusals and withdrawals of steps that changed the page, completion and dry-run refusals with their closed
   codes, unusable decisions, redirects. Identical decisions are grouped with their iterations and marked
   `sameAs`. Closed codes, ids and integers only (no model input, no page text). Compressed under its own cap;
   plain successes fold first, a refusal or repeat never loses its row.
2. The window's own history lines are retired (1 lists every call), and **superseded Core notes leave the window**:
   only the newest note of each Core kind stays whole, and a dry-run refusal and page leave once a later attempt
   supersedes them. Their trace is the row in 1: compressed, not dropped.
3. **A repeat is caught and shown**: the answered note says what it repeats, how many times (iterations), that no
   action ran since, and (by state digest, when the domain supplies one) that the page is unchanged; a look whose
   page moved by itself is run once instead of answered. A completion identical to an earlier refused one over the
   same draft is marked as such on its feedback. The second identical answered request is redirected at once.
4. The decision instruction says what the history entry is (`evidence-loop-decision.ts:44` says every `core.` entry
   answers "your previous decision", which a durable record does not).
5. `evidence-loop.ts` (800 lines) is split by responsibility before any of this is added.

Work: wB1 history modules (`llm/decision-context/`), wB2 split of the loop — in parallel, disjoint files; then wB3
wiring, window policy, notes, instruction, docs; then wC before/after tests on the recorded runs; then wD suites.

## Phase 2 — what was built (Core only)

All paths under `packages/fluxiq/src/programs/automation-studio/runtime/llm/`.

- **Split first** (wB2): `evidence-loop.ts` 800 → 636 lines; the four places the loop answers the model moved whole
  into `decision-handlers/` (`completion.ts`, `amendment.ts`, `failed-call.ts`, `answered-request.ts`, and `types.ts`
  holding the one context object they share). Same suite counts before and after (llm 67/676, flow-bootstrap 34/691,
  recovery 34/456). 668 lines with the wiring.
- **The decision history** (wB1, `decision-context/`): `recorder.ts` (one row per decision and Core's answer),
  `signature.ts`, `closed-code.ts` and `closed-detail.ts` (only closed codes and integers of a refusal's feedback
  survive: no sentence, no page text, no model input), and `group.ts`, `compression.ts`, `entry.ts` (the
  `core.evidence_history` entry, `decision_rows_v1`; consecutive identical decisions are one row with every iteration
  and `sameAs`; ladder: full, codes, plain calls folded, identical refusals joined, least form — which lists every
  refusal, answer, failure and unusable decision and is sent even over its cap). A distinct refusal never loses its row.
- **Wiring** (wB3, corrected by me): `decision-context/shown.ts` composes `[...window, history, draft, budget]`, with
  the history capped at `min(4000, floor(context/6))` (4,000 in production). The in-window history is retired
  (`context-window.ts` returns whole entries only). `decision-context/supersede.ts` removes Core notes whose moment has
  passed: an older note of the same kind; every earlier check refusal, dry-run refusal and dry-run page at each
  completion attempt (**my fix**: wB3 left a check refusal that later passed in the window); answered-repeat and
  unusable notes once a call runs, and the redirect once the build makes progress (**mine**, after wC saw notes from
  decision 20 still shown at 37).
- **Repeats caught and shown**: the answered note carries `timesAsked`, `askedAt`, `answeredAt`, `lastActionBefore`,
  and `pageUnchanged: true` when the digest check saw the page unchanged; it says "no action has run since" and "this
  is the Nth time". `decision-handlers/answer-check.ts` takes one fresh state digest before answering a look and runs
  it instead when the page moved by itself (once per request and epoch). The second answer from one result redirects
  at once (`evidence-loop/no-progress.ts`, `redirect(iteration, now)`). A completion refused for the same codes over
  the same draft revision gets `sameAsIteration` and `timesSent` on its `core.completion_check`.
  **My fixes after wC**: calls are keyed on the repeat-policy request signature, which carries the epoch, so a
  snapshot asked again after an action is not "the 8th time"; a completion's repeat key is draft revision plus answer,
  not the result, whose summary the model rewords (the fixture now rewords it every decision and the repeat is still
  caught); a refused initial look is a `look_refused` row that is never folded.
- **Prompt**: `evidence-loop-decision.ts:44` no longer says every `core.` entry answers "your previous decision"; it
  says what `core.evidence_history` is and not to resend what it shows refused or answered.
- **Cause 1, Core half** (supervisor): the amendment row records `withdrewChanged` (run 6: `[12]` at 21), so the model
  keeps seeing that it withdrew a step that worked. Core's recording already keeps a succeeded, applied click proposable.
- `evidence-loop/draft-shown.ts`: t174's `did_not_work` fix, byte-identical.
- Docs: `docs/architecture/automation-studio/llm-flow-bootstrap.md` (history entry, supersede rule, answered-repeat
  verification, early redirect, repeated-refusal marks). `docs/reference/framework-reference.md` and
  `packages/fluxiq/docs/reference/framework-reference.md` regenerated (`node scripts/docs-reference.mjs`, 2,668
  declarations; the committed copy was already stale at 2,530, so the diff also carries earlier tasks' drift).

## Phase 2 — before and after on the rebuilt windows

`decision-context/tests/recorded-windows.test.ts`, 20 tests, same replays, 5,800-byte pages. "Before" is wA's numbers
on the old code; "after" is what is shown now.

| run, decision | before | after |
| --- | --- | --- |
| run 6, 14–20 (7 answered repeats) | 7 notes, each "already answered", no count; first redirect at 16 | one history row `at [14..20]`, `sameAs 13`; notes carry `timesAsked`/`askedAt [13,14,…]`, `answeredAt 13`, `lastActionBefore pick-millbrook@12`, `pageUnchanged`; first redirect at 15 |
| run 6, 22 | 13 notes, 8,398 B; 2 pages | 2 notes, 1,642 B; 3 pages |
| run 6, 37 | 16 of 22 notes gone with no trace; stale dry-run-1 page and refusal (7.5 KB) shown | completions 22 and 26 distinct rows with codes and dry-run refusals `[[4,unreproducible],[11,unreproducible]]`; `withdrewChanged [12]` at 21; stale dry run and old notes gone |
| crossborder, 13–14 | both identical refusals shown; nothing marks them the same | `.13` carries `sameAsIteration 12, timesSent 2`; only `.13` in the window; one history row `at [12,13]` |
| run 4, 47 | refusals 40, 44 gone with no trace; stale dry run 1 shown; history "11 calls + 15 unlisted" | 40, 44, 46 all rows; stale dry run gone; newest page shown; history 3,963 B (codes rung, 13 plain calls folded) |

At every chosen decision: shown total ≤ 23,873 bytes (limit 24,000), history value ≤ 3,963 bytes, every refusal so
far has a row.

## What t190 must provide (domain half of cause 1)

For a click whose command succeeded and caused a navigation or reload (`pick-millbrook`):

- `effectApplied: true` and `resultCode: web.action.succeeded`, never a failure because the document went away
  mid-command (Core records a thrown call `did_not_work`, which only `rerun` changes);
- evidence = the settled post-navigation page (`pageChanged: true`), so the model sees the chip read the new store;
- a draft statement with `effect: mutate`, `proposes: true` and a replay statement whose location is where the click
  was made;
- optionally a closed `resultReason` such as `web.action.navigated`, which Core already carries;
- the after-digest taken of the settled page, so the answered-look check compares like with like.

Core needs no further change for such a step to be kept and proposed.

## Validation

All in the t189 trees, on the final code:

- Core `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t189-wD core check" pnpm check` → exit 0,
  `structure-audit: passed (198 warning(s), 355 baselined)`, tsc passed for contracts, fluxiq,
  client-gateway-websocket and apps/web (wD, `reports/t189-wD-validation.md`).
- `npx vitest run src/programs/automation-studio/runtime/llm --maxWorkers=2 --minWorkers=1` (run by me) →
  `Test Files 74 passed (74)`, `Tests 730 passed (730)` (baseline 67/676).
- Same for `runtime/flow-bootstrap` → `34 passed (34)`, `691 passed (691)`; `runtime/recovery` → 34, 456;
  `runtime/tests` → 76, 513 (wD, through heavy.sh).
- `npx vitest run .../llm/decision-context/tests/recorded-windows.test.ts` (me, after my last edit) →
  `Tests 20 passed (20)`.
- Core `pnpm docs:check` (me, after regenerating) → `structure-audit: passed (0 warning(s), 0 baselined).` and
  `Deterministic framework reference is current.`
- Extension `bash .../heavy.sh "t189 ext tsc" pnpm -r check` (me) → exit 0, every package `Done`: downstream compiles
  against this Core.
- Extension `pnpm check` stops at two **pre-existing** working-docs findings in shared documents I neither own nor
  modified: the plan's ledger entry "2026-09-30 — Checkpoint before a machine restart…" has no `- Validation:` bullet,
  and `docs/working/README.md` needs `pnpm structure:baseline`.

## Not verified

- No live run: whether the model stops repeating is t174's live measurement. Byte figures are replay figures.
- The digest check against a real page: `webLlmStateDigest` excludes volatile fields and sorts elements (read, not run).
- Small contexts: under about 4 KB the history's least form (576–737 B) exceeds its cap and squeezes the window; no
  production loop runs that small (Flow Bootstrap 24,000; recovery defaults to 64,000).
- A completion whose dry run the gate skipped (already replayed clean) is recorded `dryRun: "not_run"`, not `clean`;
  an answer from the initial look is never digest-verified (its step records no digests).

## Notes for integration

- t174 merge: its 3-line progress-trace patch still applies. The function opening (`evidence-loop.ts:169-172`) and the
  `  automationStudioLlmEvidenceUnusedCallId,` import line (`:51`) are unchanged; the import lines around it moved.
  `evidence-loop/` has 23 files, so t174's `progress-trace.ts` makes 24 of the 25 allowed. `draft-shown.ts` is
  identical to t174's.
- The regenerated reference docs will conflict with any other lane that regenerates them; regenerate after merging.
- `.structure-baseline.json` is untouched; the audit's "1 baseline entries can be lowered" predates this lane.
