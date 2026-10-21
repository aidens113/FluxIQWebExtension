# Forty-Task Breadth Round And Install Proof

Status: Active
Status detail: Paused 2026-10-19 for traces and the boundary move plan; 12 tasks accepted across 9 sites, photo-social has no pass; reset redesign L1 (t724) in flight. Office checkout, photo newest-likes and job saving failed on 2026-10-18 and are being diagnosed (briefs R2-R4). Reset r6 held.
Created: 2026-10-17
Last updated: 2026-10-20
Owner: Senior supervisor agent
Scope: Forty new tasks across ten realistic sites, all provider-free audited, selective full live acceptance per site and repaired failure, plus installed-extension creation and replay proof.
Paired document: `breadth-forty-tasks-plan.md` in FluxIQ Core
Related: [adaptation-and-breadth-plan.md](./adaptation-and-breadth-plan.md), [automation-project-agents-plan.md](./automation-project-agents-plan.md) (A8 launch shape), [release-packaging.md](../architecture/release-packaging.md)

---

## Current State

**What the user asked (2026-10-17 onward):** forty new tasks on the ten realistic sites (four each), run live,
debugged and fixed, fast; an installed-extension proof; only about one task per site run fully end to end, plus
reruns of repaired failures; every task possible and unambiguous; every scraping task with real data to verify
(AGENTS.md, Automated Testing Facility Boundary). Claude ran it to 2026-10-17 21:10, Codex continued until
2026-10-18 15:04, Claude resumed on 2026-10-19.

**Done:**
- 40 new tasks (t696-t705, table under "The Forty Tasks"); the corpus is 108 tasks, 82 workflows.
- All 108 tasks audited provider-free (`reports/audit-<site>.md`): about 40 reworded so the instruction alone
  gives the oracle's answer; three fixture additions; no oracle weakened.
- All 87 scraping tasks have nonempty record-by-record expectations; five formerly empty ones were revised and
  browser-proven; the launch guard refuses empty, count-only or inconsistent expectations.
- Installed proof: Chrome 155 and Edge 155 load the packaged 0.1.0 extension through the real Load-unpacked
  steps, pair, build a Flow from the real chat with an exact ordered 4-record / 12-value answer, pass a paid
  whole run (about $0.0021 each) and a separate zero-call replay. 13 first-run defects fixed. Firefox is not
  installed on this machine.

**Accepted: 12 tasks across 9 sites.** Each has an exact oracle match, a reported pass and a zero-call replay.

| Site | Accepted | Failed or owed |
| --- | --- | --- |
| everything-store | coupon-earbuds-rated-four, batteries-and-descaler, sage-small-kettle-if-in-stock | office-checkout-review failed 3 times (latest run-mved5pro-91998cc2, R2); canonical reset r6 held |
| job-board | remote-easy-apply, halvard-careers-roles | save-quillmark-remote failed again (run-mvectfld-c2f5d958, R4); halvard-labs-office-jobs rerun owed |
| social-network-feed | delete-stranger-requests | recent-group-posts failed 3 times (latest run-mveaaqxn-d0be9888, R6); hide-suggested-posts rerun owed |
| bigbox-retail | rated-delivery-towels | - |
| crossborder-marketplace | free-hubs-under-ten | - |
| auction-marketplace | lens-hood-seller-shop (2026-10-19) | cheap-accessory-auctions and buy-it-now-quote failed; page-read navigation refused (R5) |
| local-classifieds | nearby-furniture | test-ride and price-check failed (price-check's unconditional send was correctly blocked) |
| company-website | apprentices | - |
| professional-network | kade-lead-contact | - |
| photo-social | none | priya-tags failed (90 calls, no full answer); newest-likes failed (run-mvecxeci-1c2cc227, R3) |

Every failed run has a debug note at `docs/working/language-driven-flow-loop-plan/debugs/<runId>.md` (in its
lane tree until merged); the Lab refuses a lane's next launch without one.

**Spend:** the continuation up to the afternoon of 2026-10-18: 23 runs, 1,391 raw calls, $1.208560434 reported
estimate (three known duplicate judge charges, 4 calls / $0.003966408, stay in the raw telemetry). The four
evening runs of 2026-10-18 added $0.167710428. The install proof is counted separately. No balance error.

**Reset (canonical everything-store reset task):** r5 failed because the model claimed a failed act instead of
its successful retry; a generic hint fixed that, proven through the installed gateway and published (downstream
42de21f6 / Core a62d3330). r6 then produced the exact data and a passing zero-call replay, but the paid jury
judged the whole run unverified, so acceptance is held. No unchanged retry.

**Handoff (2026-10-20 evening):** the user handed this work to Codex; the in-flight units, gate, lane sync and the
exact round-6 launch command are in
[trace-offline-trials-plan/reports/handoff-2026-10-20.md](./trace-offline-trials-plan/reports/handoff-2026-10-20.md).

**Now (2026-10-20):** the four repaired tasks (office checkout, job save, photo newest likes, social group posts)
were rerun in rounds 1-5 and passed none; every debug found the task and fixture sound and the build doing the task.
Three of round 5's failures are the site-reset bookkeeping (the class behind most of rounds 2-4), one is judge
consistency and read speed. Structural units t751 (reset by observed state), t752 (judge consistency, read speed) and
t753 (chat and overlay polish) run in parallel; ledgers in [trace-offline-trials-plan.md](./trace-offline-trials-plan.md).

**Next, in order:** t751 and t752 merge with headed provider-free reproductions of every round 2-5 shape passing;
sync the lane trees; round 6 on fresh workspaces, supervised at $0.25 each via both settings; debug every failure;
then the owed reruns (job halvard-labs-office-jobs, social hide-suggested-posts). No unchanged retries.

**Elsewhere:** the hosted-production plan (Core `docs/working/hosted-production-plan.md`, paired here) opens with
the user's later directions still to fold in: the website repository https://github.com/aidens113/FluxIQWebsite,
simulate the website side locally in a test repository first, tenancy as an enterprise feature with permissions
modelled on AWS IAM, and a faster schedule. Planning only; nothing implemented.

**Blocked:** nothing needs the user. Lab: up to four lanes, one per `lab-slots/slot-N`, lane trees t563, t719,
t566 and t567 under `C:/Users/osrs_/FluxStuff/fxwork/`; launch shape in `automation-project-agents-plan.md`
("A8 Run Plan"). Held and untouched: the storage-pooling change on t707 (482 pass / 2 fail versus a 484 / 0
baseline), an old instance 6404 and a shared-Core lease e58.

## The Forty Tasks

Merged to `dev` 2026-10-17 (t696-t705); the corpus is 108 tasks. Permission points and hand-offs are declared in
each site's `live-tasks.ts` and pinned in `scenarios/tests/live-instructions.test.ts`; each site's report under
`breadth-forty-tasks-plan/reports/tasks-<site>.md` says what a correct run does.

| Site | Tasks |
| --- | --- |
| everything-store | `coupon-earbuds-rated-four`, `batteries-and-descaler`, `sage-small-kettle-if-in-stock`, `office-checkout-review` |
| bigbox-retail | `rated-delivery-towels`, `napkins-for-delivery`, `checkout-quote-without-ordering`, `new-store-cheapest-towels` |
| local-classifieds | `nearby-furniture`, `test-ride-question` (send), `carbon-price-check`, `bikes-within-alex-price` |
| crossborder-marketplace | `free-hubs-under-ten`, `follow-official-store`, `mint-hub-fallback`, `uk-express-quote` |
| auction-marketplace | `cheap-accessory-auctions`, `save-mark-ii-sellers`, `buy-it-now-quote`, `lens-hood-seller-shop` |
| social-network-feed | `recent-group-posts`, `hide-suggested-posts`, `delete-stranger-requests` (delete), `claim-found-key` (send) |
| photo-social | `priya-tags`, `newest-likes`, `august-over-1300`, `kiln-notes` |
| job-board | `remote-easy-apply`, `save-quillmark-remote`, `halvard-labs-office-jobs`, `halvard-careers-roles` |
| company-website | `apprentices`, `newsletter-signup`, `saturday-certificate`, `heat-pump-quote` (send, hand-off) |
| professional-network | `netherlands-data-engineers`, `connect-kade-senior-engineer` (send), `accept-messaged-invitations`, `kade-lead-contact` |

Each id is `<site>-<task>`. Risks the authors named: a guard that asks at Like, Accept or Buy it now (no permission
point is declared there, so asking fails the run and is a product defect). The former empty-result allowance is retired: every scraping task now requires actual matching nonempty data.

## Worker Briefs

The 2026-10-19 briefs (integration and sweep, F1-F7, S1, R1-R6) are complete and archived in
[archive/2026-10-20-briefs-and-oct18-ledger.md](breadth-forty-tasks-plan/archive/2026-10-20-briefs-and-oct18-ledger.md);
later briefs live in [trace-offline-trials-plan.md](./trace-offline-trials-plan.md) under "Worker Briefs".

## Work Ledger

The 2026-10-18 entries are archived in
[archive/2026-10-20-briefs-and-oct18-ledger.md](breadth-forty-tasks-plan/archive/2026-10-20-briefs-and-oct18-ledger.md).

### 2026-10-19 - Claude resumed; four unrecorded terminal runs found

- Finding: Codex's session ended after its four releases finished; no Lab or browser process was running on
  resume (process list 2026-10-19). The spend ledger's last events are the four `finish` records:
  job `run-mvectfld-c2f5d958` exit 1 failed $0.069212346; auction `run-mvecxd6w-ed72a1ca` exit 0 passed
  $0.031570014; office `run-mved5pro-91998cc2` exit 1 failed $0.020767056; photo `run-mvecxeci-1c2cc227`
  exit 1 failed $0.046161012. Four runs, $0.167710428.
- Validation: auction `evaluation.json` read directly: `verdict passed`, `flowCreated true`,
  `oracleVerdict passed`, `reportedVerdict passed`, extraction `expectedRecords 8, matchedRecords 8,
  expectedFields 16, presentFields 16, unexpectedFields 0`, `harnessActivations 2` (diagnosis +
  runtime patch, applied revision 1 -> 2), `adaptationValidation ... replays 0`. Not accepted until the
  separate zero-call replay passes.
- Lane trees left uncommitted by Codex: t563, t719 and t567 reports modified, t566 auction report and t719 job
  debug untracked. Workers R1-R4 own those files now.
- Dispatched R1 (worker), R2-R4 (worker-high), all read-only on source and unpaid.

### 2026-10-19 - Auction seller-shop accepted

- Validation: supervisor read the replay record in
  `fxwork/t566/!FluxIQWebExtension/node_modules/codex-auction-shop-r1-replay.log` (result file
  `test-runs/instances/bf-slot-3/replays/replay-mvfllkon-e7a35190.json`): `verdict passed`, `reasons []`,
  `flowContentHash.before` = `after` = `e831225d...0facc`, `coreProviderCallCount 0`, `accountedCalls 0`,
  `harnessActivations 0`, `llmGate.invoked false`, `run.status succeeded`, extraction 8/8 records,
  `playbackGoalHeld true`. Accepted: 12 tasks across 9 sites.
- Finding (R1): the run's two harness activations were the after-run check ("nothing to change") and a
  revision bump with unchanged Flow hashes, not a repair. The Flow opens the seller shop at a fixed address
  because every navigation to the page-read address was refused `web.browser.permission_denied`; R5
  diagnoses that refusal. Merged as c6d8748a.

### 2026-10-19 - Diagnoses R2-R5 and fix dispatch

- R2 office checkout r1 (`debugs/run-mved5pro-91998cc2.md`, t563 8c6580a1): the reworded task worked (Buy Now,
  checkout, cart unchanged at 2). Core defect: the model declared Buy Now `create_new` into the cart; fresh
  cart reads at 0049/0053 equalled the original, yet `site-reset/ledger.ts` `beforeTrial` answered
  `candidate.trial_reset_unproved` (0051/0055). Second Core defect: the reset brief's first request was refused
  in preflight `provider_evidence_loop_context_invalid` before any call, and the build threw
  `post_provider_validation_failed`.
- R3 photo newest-likes r1 (`debugs/run-mvecxeci-1c2cc227.md`, t567 90680516): judge correct (24 like presses,
  all on one pinned post; no link column). Defects: the read cannot offer an item's own href
  (`infer-fields.ts`); Core refused `repeat most: N` beside `repeat over` (`draft-routing.ts` `scriptSpan`), so
  the loop became unbounded; the open press was not moved to each pass's row (`pass-row/resolved-for-pass.ts`
  via `identity/record.ts` `sitsInRepeatedRow`). Model mistake: took the pinned post as newest. The build ran
  at $0.10, not $0.25, and ended `run_budget_cost_exhausted`.
- R4 job save r1 (`debugs/run-mvectfld-c2f5d958.md`, t719 072c2468): the target was found but the For Each row
  gate (`identity/record.ts` `holdsRowValues`) refused it because a " · "-joined `lines` value is not on the
  page as one string; and the ledger could not settle site-failed saves although My jobs was unchanged before
  and after. Earlier icon-visibility hypothesis refuted.
- R5 navigation refusal (t566 7456338a): not a permission rule. A root-relative page-read address went
  unresolved to `chrome.tabs.update`, landed on `chrome-extension://.../scenarios/...` (ERR_FILE_NOT_FOUND), and
  `browser-api.ts` labelled it `permission_denied`. The model read the right link.
- Validation: budget finding from `spend-ledger.jsonl` finish events by day and `buildCeilingUsd`: 2026-10-12 to
  2026-10-17 all launches at 0.25 (except nine at 0.1 on 2026-10-12 before the change); 2026-10-18: 12 at 0.1,
  20 at 0.25. Codex's later launch commands set the flag but not `FLUXIQ_LLM_RUN_COST_CEILING_USD`, which the
  A8 launch shape (`automation-project-agents-plan.md`) requires.
- Dispatched fix briefs F1-F7 (see Worker Briefs), partitioned by lane tree and file.
- R6 judged-no feedback (t567 5b8e6dd8): the judges' own reasons do reach the build model in full ("saw 5 items
  on 1 page and never paged"); the gap is that nothing in the read result says the list continues, the bare
  `result.counts_look_right` code misleads, and a targeted scroll without a mode reported success at the
  list's end. Dispatched F8 (list-continues fact, t566 pair) and F9 (targeted scroll, t563 domain).

### 2026-10-19 - Fixes F4, F6, F7, F9 verified and committed on lane branches

- Validation: supervisor reran each worker's tests in its tree. F7 (t566 f8f59955):
  `EXTENSION_TEST_BUILD_LABEL=f7-verify node scripts/test-extension.mjs src/runtime/navigation/tests/address.test.ts
  src/runtime/tests/action-runner.test.ts src/runtime/tests/navigate-action.test.ts` -> tests 76, pass 76, fail 0.
  F6 (t567 d1d5823b): `EXTENSION_TEST_BUILD_LABEL=f6-verify node scripts/test-extension.mjs
  content/extraction/tests/infer-fields` -> tests 25, pass 25, fail 0. F4 (t563 42be3e24): `node --test` on
  `dist/live-llm/tests/{max-cost-within-ceiling,cost-ceiling-env,cost-ceiling-reach,live-llm-run,live-llm-plan}.test.js`
  -> tests 66, pass 66, fail 0. F9 (t563 b9c008eb): `DOMAIN_TEST_BUILD_LABEL=f9-verify node scripts/test-domain.mjs
  src/client/tests` -> tests 44, pass 44, fail 0. Workers also reported typecheck exit 0 and structure audit passed.
- Finding: `content/extraction/tests/pagination` fails 3 of 34 on `dev` itself (hidden load-more cases 28-30;
  `EXTENSION_TEST_BUILD_LABEL=dev-pagination ...` in the main checkout), so it predates F6. Queued as a fix-forward
  after F8, which works in the same folder.
- Note on F4: the refusal sits in `beginLiveLlmRun`, after `run-lab.mjs` has taken its Core lease and build phase
  but before any credential, topology or provider call ($0).

### 2026-10-19 - F2 verified; F2 and F5 extended

- Validation: F2 (t719 12b910ca) rerun by the supervisor: `EXTENSION_TEST_BUILD_LABEL=f2-verify node
  scripts/test-extension.mjs content/identity/tests content/action-runtime/tests` -> tests 300, pass 300, fail 0.
  Worker: 6 of 15 new tests failed before the fix; both tsc passes exit 0; structure audit passed.
- Finding (F2): the job loop would still fail on pass 2, because per-row title links carry their own id and
  name and the scorer refuses the pass card's link; nested records (a control in an `article` in an `li`)
  are missed. F2 resumed to fix both (discount row-varying signals only inside a resolved pass row).
- Finding (F5, partial): `repeat over` + `repeat most: N` now builds a For Each with `stopAfter` (t567 Core,
  uncommitted; worker: 551 tests across candidate/authoring/script-statements/control-flow passed), but the
  photo r1 script wrote the bound on each of three merged steps and `script-statements/repeat-bound.ts` still
  refuses that. F5 resumed with that file, the drafted path (`flow-draft/routing.ts`) and a replay test.
  Core plan tests `extraction-vocabulary` (4394 > 4000) and `issue-feedback` fail on the lane HEAD without F5
  (worker check); expected in the sweep.

### 2026-10-19 - F1 and F3 verified; F1 narrowed

- Validation: F3 (t563 Core e3a6ea5c) rerun by the supervisor: `npx vitest run .../project-build-reset.test.ts
  .../project-agents/dispatch/tests .../project-build-brief-ports.test.ts` -> 20 files, 121 tests passed. F1
  (t719 Core 133c9ebe): `npx vitest run .../flow-bootstrap/site-reset/tests .../flow-bootstrap/tests/action-permissions.test.ts`
  -> 11 files, 217 tests passed. Workers: F3's new test failed before the fix with the live code
  `provider_evidence_loop_context_invalid`, calls 0; F1's 4 positive cases failed before; package checks and
  structure audits passed.
- Finding (F3): the reset loop built its decision schema from its own copy of the completion schema while the
  request carried `brief-ports.ts`' copy; 4bb74570 (2026-10-17) reworded only one, so every reset brief since
  then was refused before the wire. One shared `reset-completion.ts` now. The build's blocked ending was
  already honest (`post_provider_validation_failed` is how `run.ts` names a blocked ending without a candidate).
- Decision: F1's fallback for a control in no list ("every group read complete before the act") could pass an
  act whose effect lands somewhere never read, letting a trial run on leftovers. F1 resumed to require a
  model-named destination (`resetDestination`) instead, and to make a whole trial refuse while a reversible act
  is neither undone nor settled (F3 saw one run with two acts left after a blocked reset).

### 2026-10-19 - F2 continuation verified; lane t719 build restored

- Validation: t719 66ceefeb rerun by the supervisor: `EXTENSION_TEST_BUILD_LABEL=f2b-verify node
  scripts/test-extension.mjs content/identity/tests content/action-runtime/tests content/actions/tests
  content/action-runtime/pass-row/tests` -> tests 498, pass 498, fail 0; `npx tsc -p tsconfig.json --noEmit`
  -> exit 0. Worker: both new cases failed on 12b910ca first (card title refused "in another record"; nested
  record opened card 1).
- Finding: commit 01f72745 (supervisor's F1 report commit on t719) also carried a worker's staged deletion of
  `pass-row/run-member.ts`, so that commit alone did not compile; 66ceefeb restores it. Supervisor report
  commits now commit by explicit path only.
- Risk noted: a control is now in a row when any record within 12 levels above it has a same-tag sibling, so
  inside a pass it must match the row's values (fails closed). The live reruns will show whether a page-level
  control inside a loop body is ever caught by it.

### 2026-10-19 - F5 verified; drafted paths extended

- Validation: t567 Core 9b6b5b1b rerun by the supervisor: `npx vitest run` over `flow-bootstrap/candidate/tests`,
  `authoring/tests`, `script-statements/tests`, `nodes/control-flow/tests`, `flow-draft/tests` and
  `executor/tests/graph-run.test.ts` -> 83 files, 813 tests passed. Worker: repeat-bound tests 5 failed before
  the fix, drafted tests 2 failed before; package check exit 0; structure audit passed. The format clause's
  example is a recipe site's bookmarks (generic).
- Finding: photo r1's exact script (the bound on each of three merged steps) now builds For Each `stopAfter: 3`.
  Still dropping the bound: drafted amendments (`amendment/route.ts`, `schema.ts`), the evidence-loop decision,
  `entry.ts` `routingLine`, the dry run and `draft-from-flow.ts`. F5 resumed to close them, splitting
  `draft-routing.ts` (798/800) first if it must change.

### 2026-10-19 - F8 verified; ended-feed case extended

- Validation: t566 4f405f3d / Core 9009a53c rerun by the supervisor: extension `EXTENSION_TEST_BUILD_LABEL=f8-verify
  node scripts/test-extension.mjs content/extraction/tests/list-reader read-coverage/tests
  content/actions/tests/extract-list content/extraction/tests/detect-pagination content/extraction/tests/feed-signal`
  -> tests 106, pass 106, fail 0; domain `DOMAIN_TEST_BUILD_LABEL=f8-verify node scripts/test-domain.mjs
  actions/extraction/tests` -> tests 91, pass 91, fail 0; Core `npx vitest run` over read-account/tests,
  repair-directive, candidate-trial/tests and the extraction-summary test -> 43 files, 328 tests passed. Worker:
  7 new Core tests failed before; typechecks exit 0; both audits passed.
- Decision: accepted the four pass-through edits outside the brief (extension `actions/extract-list.ts`, domain
  `extraction/summary.ts`, Core `extraction-summary.ts`, `contracts/read-account.ts`); each only carries the field.
- Finding: a declared feed that really ended can still report "continues" (the reveal/growth signal in
  `list-wait.ts` is unused), and the judges' read sentence does not state the fact. F8 resumed to fix both and
  the 3 `pagination` test failures on `dev`.

### 2026-10-19 - F5 complete

- Validation: t567 Core 944942b2 rerun by the supervisor: `npx vitest run` over `llm/tests/evidence-loop.test.ts`,
  `flow-draft`, `llm/node-tools/tests`, `flow-bootstrap/authoring/tests`, `script-statements/tests`,
  `nodes/control-flow/tests`, `executor/tests/graph-run.test.ts` -> 94 files, 1095 tests passed. Worker: 6 of the
  new cases failed before; package check exit 0; audit passed. Supervisor corrected the stale `most` comment in
  `flow-draft/amendment/types.ts` in the same commit.
- Finding: `llm/deepseek/tests/system-prompt.test.ts` fails 4 pinned-prompt checks on the lane base 903ebb58
  without F5 (worker check); expected in the sweep, not caused here.

### 2026-10-19 - First daily sweep; t722 integration; t723 sweep fixes

- Validation: sweep S1 (`reports/sweep-1019.md`, Core a22b3a0f, downstream bb92ad17): Core `pnpm build` 0,
  `pnpm check` 0, `pnpm test` 1 (fluxiq 29 failed / 12741 passed; web 56 failed / 3067 passed); downstream
  `pnpm check` 1 (2 TS7006), `pnpm test` 1 (domain 1 failed / 2165 passed; extension tests not reached),
  `pnpm build` 0. All predate today's lane fixes (dev had none of them merged).
- Validation: t722 downstream on the merged tree, Core libraries rebuilt (`core-build` current):
  `EXTENSION_TEST_BUILD_LABEL=t722 node scripts/test-extension.mjs content/identity/tests
  content/action-runtime/tests content/actions/tests content/action-runtime/pass-row/tests
  content/extraction/tests/infer-fields runtime/navigation/tests runtime/tests/action-runner.test.ts
  runtime/tests/navigate-action.test.ts` -> tests 606, pass 606, fail 0; `DOMAIN_TEST_BUILD_LABEL=t722 node
  scripts/test-domain.mjs src/client/tests` -> tests 44, pass 44, fail 0. Lane merges were clean in both repos.
- F10 stopped once on an API 522 (server side) and was resumed. Briefs F10, F11, S2-S4 under Worker Briefs.

### 2026-10-19 - F8 and F11 done; all four lanes in t722

- Validation: F8 continuation (t566 d02e068d / Core 1e2accc3) rerun by the supervisor: extension
  `EXTENSION_TEST_BUILD_LABEL=f8b-verify node scripts/test-extension.mjs content/extraction/tests
  content/extraction/read-coverage content/extraction/page-advance content/actions/tests/extract-list` -> tests 361,
  pass 361, fail 0; domain `actions/extraction/tests` -> 91/91; Core `npx vitest run` over `result-verification`,
  `candidate-trial/tests`, `summaries/tests` -> 1406 passed, 2 failed, both in `kept-condition-advice.test.ts`,
  which the dev sweep already lists (S3 owns it).
- Decision: accepted F8's `pagination.test` update. 2c529c60 (t567, "Continue hybrid lists before their
  load-more control appears") gives a hidden load-more one scroll and ends truncated at the page bound, which is
  the honest answer; no production code changed for it.
- Validation: F11 (t722 Core c79027bd), worker: `npx vitest run` over `flow-bootstrap/plan/tests`,
  `llm/deepseek/tests`, `llm/tests` -> 61 files, 862 passed; check exit 0; audit passed. All six were tests behind
  deliberate changes (5a652d4a judge sentences; aa04a943 `purpose` key); the vocabulary bound moved 4,000 -> 4,400
  with commit and bytes in the test.
- Finding (structural): prompt-text changes have twice broken pins/budgets in other folders because only the
  changed folder's tests ran. Follow-up after this round: make the narrow gate run the prompt pin and budget
  tests whenever model-facing text owners change.
- t566 merged into t722 in both repos (Core c453fda9, downstream 7152a58d). F10 still running in t722 Core.

### 2026-10-19 - t722 integrated and published; rerun round 1 launched

- Validation: t722 Core broad run, supervisor, on the merged tree: `npx vitest run` over `runtime/flow-bootstrap`,
  `flow-draft`, `llm`, `project-agents`, `service/project-build/tests`, `service/candidate-trial/tests`,
  `service/summaries/tests`, `result-verification`, `nodes/control-flow/tests`, `executor/tests` -> 740 files,
  7202 passed, 8 failed, 2 skipped; the 8 are `ask-activity` (6) and `kept-condition-advice` (2), both failing on
  Core dev a22b3a0f already (sweep S1) and owned by S3. `pnpm --filter ./packages/fluxiq check` exit 0; audit passed.
  Supervisor applied F10's one-line `reset-repeated.test.ts` fix (name act-1 under cannotUndo before the whole test).
- Validation: t722 downstream after a Core library rebuild (`core-build` current): extension
  `EXTENSION_TEST_BUILD_LABEL=t722b` over identity, action-runtime, actions, pass-row, extraction, read-coverage,
  page-advance, runtime navigation and action-runner tests -> 913/913; domain client, extraction and adapter tests
  -> 160/161, the one being the adapter `sessionId` test that fails on dev and is fixed in t723 (S4); test-runner
  `node --test dist/live-llm/tests/*.test.js` -> 159/159; extension and domain `check` exit 0; audit passed.
- Published: `pnpm task finish t722` downstream (structure audit passed) -> 79fbbb7a; in Core (`pnpm check`
  passed) -> e11549a8. Both `dev` branches pushed. All four lane trees merged `dev` in both repos (0 behind).
- Launched round 1 at 2026-10-19, process `FLUXIQ_LLM_RUN_COST_CEILING_USD=0.25` plus `--llm-max-cost-usd 0.25`,
  headed, `--model-reset-only`, fresh workspaces: slot-1 office-checkout-review (`claude-office-checkout-t563-20261019-r2`),
  slot-2 job save-quillmark-remote (`claude-job-save-t719-20261019-r2`), slot-3 social recent-group-posts
  (`claude-social-groups-t566-20261019-r4`), slot-4 photo newest-likes (`claude-photo-likes-t567-20261019-r2`).
  Live guard admitted slots 1-3 (`"state":"admitted"`); slot 4 still in its prelude at the first check.

### 2026-10-19 - Rerun round 1: 0 of 4; site reset is the common blocker

- Validation: first launch refused at $0 in the prelude on all four slots (`"state":"stale"`: lane Core builds
  behind source after the dev merge; no ledger entries written). Rebuilt Core libraries per lane
  (`core-build` current x4) and relaunched. Spend-ledger finish records: photo `run-mvfq959u-b7afdf80` failed
  $0.039545478; office `run-mvfq94ff-c8c21493` failed $0.06946167; job `run-mvfq94fg-64e82826` failed
  $0.059999844; social `run-mvfq957o-40103539` failed $0.064833378; all `buildCeilingUsd 0.25`, none over.
  Round total $0.233840370; no balance error. No Flow in any run.
- Findings: R7 photo (t567 876a3af8): F6/F2/F5 behaved at read and submit, but an Unlike undoing an exploration
  Like was refused `undo_unproved` at 0067, so no trial ran. R8 office (t563 ef1c07dd): F3 held (the reset
  brief ran), F1 settled exploration presses, but the trial's own Buy Now got no destination (`ledger.ts
  trialRan`), a retest after a settling look was answered `already_answered` 7 times, and the reset wording is
  wrong for trial acts. R9 job (t719 3fa223dc): settlement needs a complete-list record that the domain only
  grants with aria-setsize/posinset (`control-spot/collection.ts webResetCollections`), which 8 of 10 realistic
  sites lack; F2's joined value worked live. R10 (social) running.
- Decision: reset failures have now recurred in seven shapes; stop patching instances. Lead L1 (t724, paired,
  lead-xhigh) redesigns settlement on observed state (control state plus generically complete destination,
  inverse undo on the same page, trial acts inheriting the explored act's destination, a retest reaching the
  ledger), keeps every invariant, and turns all seven shapes into a provider-free regression corpus.
- Validation: t723 sweep fixes finished in both repos (downstream audit passed; Core `pnpm check` passed) and
  pushed. Before finishing, supervisor checks on merged t723: Core `npx vitest run` over the three contract tests,
  executor, result-verification, refuted-result, authoring-mode, handlers and conversations -> 228 files, 1980
  passed; S5 `node --test scripts/task/tests/*.test.mjs` -> 32/32; web capabilities/tests/authoring/instructions
  -> 245/245, web tsc exit 0; downstream adapter + client tests 70/70, pagination 34/34, `pnpm check` exit 0.

### 2026-10-19 - Social r4 diagnosed (R10); t725 fixes dispatched

- Finding (R10, t566 e91de996): not a reset failure. Revision 9 (trial 0083) stored exactly the three expected
  records (a comparison against `expected.ts` printed True for every value). Judge call 1 said no (0.6) without
  naming any wrong row; call 2 said yes. Core made it unsure, the gate said a retest would "likely be judged the
  same way", the builder broke the answer (revision 10, correctly judged no), reverted, and the deadline cancelled
  the retest (last test 337 s, about 150 s left). The ending then said "never tested from its start" and a
  "Your Flow is ready" toast showed with no Flow. F8 fired accurately; F9 was not exercised. An `untilStable`
  scroll without `maxScrolls` passed submit and failed at run time with "it names mode".
- Dispatched t725 (paired, from dev): G1 re-ask a split's no once for a named defect, else it counts as yes with
  advice; no "likely judged the same" for a split (Core `result-verification/agreement`, trial-gate wording). G2
  no trial the remaining time cannot cover; truthful time-limit ending; no success toast for a draft (Core
  project-build run, conversation build command, activity). G3 `untilStable` needs `maxScrolls` at submit, and a
  run-time message naming the key (domain schemas, extension scroll). G4 reword the social task so posts not in a
  group are plainly left out, keeping intent and oracle (catalog and baseline).
- Validation: not validated yet; workers running. L1 (reset redesign, t724) running in parallel; G1's trial-gate
  edit is wording only to keep the overlap with L1 small.

### 2026-10-19 - t725 (judge split, time honesty, scroll schema, social wording) published

- Validation: supervisor on t725 Core after G1+G2: `npx vitest run` over result-verification, flow-bootstrap
  candidate and subflow-candidate, candidate-trial, project-agents, project-build, activity, conversations and the
  three prompt contract tests -> 363 files, 2822 passed; `pnpm --filter ./packages/fluxiq check` exit 0; audit
  passed. Downstream after merging dev and rebuilding Core: domain actions/output-nodes/client -> 332/332;
  extension `content/actions/tests` -> 185/185; scenario-lab live-task tests -> 33/33; `pnpm check` exit 0.
- Published: `pnpm task finish t725` downstream (audit passed) -> bda526b4; Core (`pnpm check` plus the new
  contract gate, `"contracts":{"ran":true}`) -> 762372b1. Both pushed.
- Changes: G1 a split's no is re-asked once and must name a wrongly kept or left-out row or a wrong value, else it
  counts as yes with advice (every split now costs a third judge call; seven tests updated); G2 a whole trial is
  refused (`project.trial_out_of_time`) when the time left is below the last comparable test plus 20%, a draft
  reports its latest finished test, and a draft ends "Build ended: no Flow was built"; G3 `untilStable` without
  `maxScrolls` refused at submit through the scroll node's parameter contract, and the run-time refusal names the
  key; G4 the social task says plainly that posts outside a group and from unjoined groups are left out.
- Not covered: G2's time check in candidate (non-project) mode; an end-to-end test from a cut test to the chat.

### 2026-10-19 - Handoff: breadth round paused for traces and the boundary move plan

- Validation: `git status --short` and `git rev-list --left-right --count origin/dev...dev` in both main checkouts
  -> clean and 0/0 (only the user's `.clinerules/fluxiq.md` edit, not ours, is uncommitted downstream). t724 (L1)
  worktrees -> Core 52 and downstream 34 uncommitted files; lead running; sub-reports l1-c1, c2, c3, c5, c6, d1, d2
  present, C4 and D3 not yet.
- Decision: the user paused the breadth round; the next session runs the lanes in `trace-offline-trials-plan.md`
  and finishes L1 first.

### 2026-10-19 - L1 browser proof found two defects; supervisor decisions
- Agent: supervisor (L1 worker l1-d3-browser-proof)
- Changed: nothing on `dev`; decisions sent to the L1 lead.
- Why: D3 (`fxwork/t724/.../reports/l1-d3-browser-proof.md`), headed and provider-free on the installed extension:
  both existing cases, job D+F and office C pass; office E fails on a Core defect (a builder's whole-run act lands in
  the supervisor's ledger, whose repeat matching has no explored acts, so act-2 never links to its explored press);
  photo G fails because icon-only buttons capture `accessibleName: null`, so Like and Unlike share one state token.
- Validation: not validated by the supervisor; the worker's diagnosis rests on saved diagnostics (`d3-run11`).
- Decisions: fix both inside L1 before merge (two of the four breadth reruns depend on them); repeat matching spans
  every ledger of the build; accessible-name capture takes a descendant `svg[aria-label]`/`title`, the state digest
  falls back to the printed words; a navigation with no lasting effect is a look, never an undo attempt (settles
  `unchanged`); `NODE_OPTIONS=--no-experimental-strip-types` in the extension's Playwright config (L1 owns it).
- Outcome: Partial
- Follow-up: L1 reruns D3's five cases green, then integration.

### 2026-10-20 - Rerun round 2 launched after L1 and the boundary lanes merged
- Agent: supervisor
- Changed: nothing in the repositories; four lane trees fast-forwarded to `dev` (downstream ddf41bf4, Core ca23a8ba)
  and rebuilt (lane-sync-1020).
- Why: every agreed change is merged: L1 reset settlement (both browser-proof defects fixed), lanes G/H/S/T, t730,
  t731, t732, t733 (identity capture back to seconds; in-place busy race), t734, t735, and lane S's fix for the chat
  defect that folded earlier turns into a build's instruction.
- Validation: `git rev-list --count HEAD..dev` -> 0 in both repositories of t563, t719, t566, t567; each tree's
  `node scripts/check/core-build.mjs` -> current; the four launches' live guard -> `"state":"admitted"` (instances
  rr2-slot-1 to 4).
- Launch: process `FLUXIQ_LLM_RUN_COST_CEILING_USD=0.25` plus `--llm-max-cost-usd 0.25`, headed, `--model-reset-only`,
  `--replays 1`, `--llm-max-calls 250`, fresh workspaces: slot-1 office-checkout-review
  (`claude-office-checkout-t563-20261020-r3`), slot-2 job save-quillmark-remote (`claude-job-save-t719-20261020-r3`),
  slot-3 social recent-group-posts (`claude-social-groups-t566-20261020-r5`), slot-4 photo newest-likes
  (`claude-photo-likes-t567-20261020-r3`).
- Outcome: Partial (running)
- Follow-up: read each run's verdict, spend and steps; debug every failure before any rerun.

### 2026-10-20 - Rerun round 2: 0 of 4; no Flow in any run
- Agent: supervisor (debuggers debug-rr2-job, -office, -social, -photo)
- Changed: nothing in the repositories; debug notes in each lane tree.
- Validation: spend-ledger records (live guard `"state":"recorded"`): office run-mvgf04kw-310fc169 failed $0.169056852
  (250 steps, the call cap; ends on `candidate.undo_unproved` then `web.action.rejected.action_failed`); job
  run-mvgf4pk5-55343613 failed $0.080696568 (153 steps; `candidate.undo_unproved`, completion refused
  `project.reset_acts_in_place`); social run-mvgf7ij5-a9747575 failed $0.180737856 (153 steps;
  `core.submit_subflow` -> `flow_bootstrap.evidence_completion_plan_invalid` twice, then `repeat_refused` x3);
  photo run-mvgf801u-cc23575e failed $0.136744896 (224 steps; `web.action.rejected.page_changed`, then the same
  `core.run_node` refused `repeat_refused` x3). All under the $0.25 ceiling; round total $0.567236172; no balance
  error.
- Job cause (debug-rr2-job): in exploration the builder pressed save (`modify_existing`, step 0033) before it had read
  My jobs (0035); Core checks for a baseline only on `create_new`, so the press ran and sealed the reset baselines with
  no witness, no reference was ever issued, the trial was refused `candidate.trial_reset_required` and the reset could
  never settle. Fix: before the seal, refuse without running any reversible press that has no witness (no complete
  list it sits in, no stated control state, no issued reference), as `create_new` already is; secondary: settle words
  that ask for an impossible reference, an invented `resetDestination` ignored silently, the chat's "one more change".
- Office cause (debug-rr2-office, one step from a pass): the judged whole run (0208) did every checkout act right, but
  no Core node the script format can feed stores single reads as a one-row table: `builtin.data.write-records` takes
  rows only through an input port the script cannot connect; a `records` synonym produced an output with no schema
  (`not_derivable`); the unconnected-port refusal pointed at the wrong line (`locate-issue.ts` matches node paths by
  number); `repeat-guard/candidate-feedback.ts` said "submit again" for an unchanged submission, ending two briefs; a
  refused test moved the tab without saying where; every later brief's opening call was refused
  `unexpected_input_keys` (untraced); the final chat message said the checkout part never passed its own test. All
  three R8 causes are gone; a trial act in no list (confirming the address) has the job run's witness gap.
- Social cause (debug-rr2-social): a downstream "text cut short" hint (`rejection-next/next-sentence.ts`) told the
  model to click each row's See more after every Next page move, a loop inside a loop that Core refuses; Core's
  refusal (`draft-routing.ts` `scriptSpan`) pointed at the outer loop and left out the alternative it already has
  (`NO_ROW_LOOP_IN_PAGE_LOOP`), so the model resent a byte-identical script three times. The first brief failed on a
  `scroll` parameter with no description or example (`output-nodes/definitions.ts`) and a refusal that drops the bad
  key names. None of L1, lane S or lane T touched this path.
- Photo cause (debug-rr2-photo, furthest yet: R7 is gone, four trials ran, revision 5 liked all 24 posts): Core
  `service/candidate-trial/landed-acts.ts` `controlsOf` took each trial act's page address from the withheld trace, so
  every reset instruction said "at [withheld]", no undo could be tied to its post, and the reset brief looped until
  the repeat guard stopped it (0219-0223); `core.test_subflow` answers carry no page, which caused brief 1's
  stale-handle loop.
- Outcome: Partial
- Follow-up: t738 fixes all four causes (brief in trace-offline-trials-plan.md); rerun the four after it merges.

### 2026-10-20 - Rerun round 3 launched after t738 fixed round 2's causes
- Agent: supervisor
- Changed: nothing in the repositories; lane trees t563, t719, t566, t567 fast-forwarded to dev (downstream e1363c31,
  Core e74e0890), installed and rebuilt, untracked copies of tracked debug notes removed first.
- Why: t738 merged (reset witnesses, real trial-act addresses, write-records rows, truthful feedback, one lifecycle
  store per process, the load-every-row-first hint) and t739 fixed the photo-social optimistic heart; no other agreed
  change that affects live behaviour is in flight (t736 capture runs only in tracing mode; t740 is test config).
- Validation: each tree `git rev-list --count HEAD..dev` -> 0 in both repositories; `core-build.mjs` -> current x4;
  live guard -> `"state":"admitted"` for rr3-slot-1 to 4.
- Launch: as round 2 ($0.25 via both settings, headed, `--model-reset-only`), fresh workspaces
  `claude-office-checkout-t563-20261020-r4`, `claude-job-save-t719-20261020-r4`,
  `claude-social-groups-t566-20261020-r6`, `claude-photo-likes-t567-20261020-r4`.
- Outcome: Partial (running)
- Follow-up: verdicts, spend and debugs.

### 2026-10-20 - Rerun round 3: 0 of 4, each further than round 2
- Agent: supervisor (debuggers debug-rr3-office, -job, -social, -photo)
- Changed: nothing in the repositories; debug notes in each lane tree.
- Validation: spend-ledger records: office run-mvgo5xft-25460ba2 failed $0.049308276 (140 steps); job
  run-mvgo9wzn-fad4e050 failed $0.034347282 (127 steps); social run-mvgoawg4-ed85dd5a failed $0.194274486 (244 steps;
  ends on `web.action.rejected.output_not_observed` x3); photo run-mvgobp8h-b99ede98 failed $0.141608127 (421 steps;
  reached a repair brief; ends on `repeat_refused (same_result)` x3). All under $0.25; round total $0.419538171; no
  balance error.
- Office cause (debug-rr3-office): the plan accepted an output named `item` that the script rules ban, so the
  checkout-reading part could never be built; leftover trial and entry-preparation acts that sit in no list (confirm the
  office address) each needed their own look under `undoes`, a successful look reports nothing back, and the
  `reset_acts_in_place` refusal listed no open acts, so the builder gave up one look short; t738's witness rule never
  fired (it covers exploration presses only). Progress: row saving accepted, the opening-call refusal gone, the checkout
  part passed in two revisions.
- Job cause (debug-rr3-job): the Remote only filter's first attempt hit the site's every-sixth-results-page rate limit;
  the extension went back, which closed the menu, and three retries failed on the hidden link; the retry wrapper
  (`domain node-run/retries/dispatch.ts`) reports only the last attempt, so the builder saw `target_not_actionable`
  instead of `page_busy_try_later` and the repeat guard refused the right retry; `find_on_page` found no wordless save
  icon. Progress: My jobs read complete and returned a destination reference (R9's fix holds live).
- Social cause (debug-rr3-social): brief 3 wrote the right structure (0164), but a false "page was reloaded" refusal on
  its See more press threw it away: domain `plan-resolution/target-packets.ts` `markRenumbered()` marks a control the
  build's own press removed as renumbered, because every view of a reloaded document reports a reload; the
  `incomplete_text` refusal names no field and its hint does not say to read the list again; the judge took the
  feed's continuation past its end marker as rows missing. Trials 0141 and 0214 kept exactly the oracle's 3 posts,
  lacking only the text column. Round-2 causes gone.
- Photo cause (debug-rr3-photo, furthest yet: 7 trials, 4 judged, every "no" correct): revision 8 stored exactly the
  oracle's three links but liked the first three posts in page order (the pinned ones): the script format teaches only
  the saved table's sort, not `extractList.sort`, which the domain already supports; the supervisor's recording
  excerpt never reaches the builder; the candidate wrap-up refuses the undo calls a trial demands. Round-2 causes gone.
- Outcome: Partial
- Follow-up: t741 fixes all four causes; reset settlement has failed in a new shape for a third round, so t741 makes Core
  settle no-list trial and entry acts itself instead of patching the shape.

### 2026-10-20 - Rerun round 4 launched after t741 fixed round 3's causes (first traced live runs)
- Agent: supervisor
- Changed: nothing in the repositories; lane trees fast-forwarded to dev (downstream 0cada957, Core 3b13e394),
  installed and rebuilt.
- Why: t741 merged (Core settles witnessless trial and entry acts, one port-name rule, listing sort guidance, the
  recording excerpt reaches the builder, judge continuation rule, rate-limited retries reported first, reload marks by
  time origin, named incomplete fields, wordless icons named); t736 makes the Lab trace every live run; no other agreed
  change that affects live behaviour is in flight (t742 P3 is a harness).
- Validation: each tree `git rev-list --count HEAD..dev` -> 0 in both repositories; `core-build.mjs` -> current x4;
  live guard -> `"state":"admitted"` for rr4-slot-1 to 4.
- Launch: as before ($0.25 via both settings, headed, `--model-reset-only`), fresh workspaces
  `claude-office-checkout-t563-20261020-r5`, `claude-job-save-t719-20261020-r5`,
  `claude-social-groups-t566-20261020-r7`, `claude-photo-likes-t567-20261020-r5`.
- Outcome: Partial (running)
- Follow-up: verdicts, spend, debugs; hand the four traces to lane T for P3.

### 2026-10-20 - Rerun round 4: 0 of 3 so far; three shared weaknesses named
- Agent: supervisor (debuggers debug-rr4-office, -job, -photo; social still running at this entry)
- Changed: nothing in the repositories; debug notes in each lane tree (copied to dev).
- Validation: spend-ledger records: office run-mvgvyaip-d856e135 failed $0.046426512 (128 steps); job
  run-mvgw1854-5d10955b failed $0.05910921 (229 steps; furthest yet: save found, one judged trial, then three briefs
  failing to reset); photo run-mvgw7320-de416190 failed $0.058458126 (158 steps). All under $0.25; no balance error.
  These are the first traced live runs.
- Office cause: t741's A1 adopted every issued list as an act's witness, including another brief's search page; a
  fresh brief's address memory forgets earlier briefs' pages, so Core's own look and the model's navigation to the
  printed address were refused `address_not_shown`; a read target's identity kept the text it reads, so reads broke
  once the Flow changed it.
- Job cause: every pass of a looped save was recorded on the template row, so the undo check never matched the row a
  pass saved; the refusal named no failed condition and kept listing the act as undoable.
- Photo cause: a Like in a post dialog named a list whose address opens a different document, so Core kept demanding a
  re-read it could never get and refused all 8 trials, though the undo had landed.
- Shared weaknesses (the debugs' conclusion): build-wide site facts held per brief; refusals that do not say which
  condition failed or whether any call can meet it (builders repeat until the repeat guard ends the brief); the
  supervisor ending the build after one failed brief with money left. t743 makes all three structural.
- Social (debug-rr4-social): run-mvgw3ve5-294881b5 failed $0.153415092 (196 steps, reached repair; round total
  $0.317408940 for 0 of 4). The last step's `threw non_error` was the build's own 25-minute limit (a TimeoutError) that
  a step-log bug labels non_error; the real cause is the extension's `list-reader.ts` checking every row for
  disclosed text before the `where` filter, so posts the filter rejects block the honest read (0129 kept 0 of 30 rows
  and still failed `incomplete_text`); trial feedback lists only 40 steps and hid the loop trial's stopping step; the
  judge still advises adding the text field to the refused read. Round 3's reload mark and unnamed field are gone.
- Outcome: Partial
- Follow-up: t743 (units S1-S4 plus S5 for social).

### 2026-10-20 - t743 merged; rerun round 5 held for t748
- Agent: supervisor
- Changed: nothing in this plan's scope beyond this entry; t743 (round 4's three shared weaknesses and each site's
  causes) is merged and pushed in both repositories (ledger in `trace-offline-trials-plan.md`).
- Why held: t743's open items, now brief t748, bear on round 5's tasks: trial feedback labels a read with the words
  captured before a change (office reads a value its own step changed), office debug points C5/C6, a dialog and a
  standalone page sharing one view (photo), an undo reason no call can meet (job). The standing rule is that a live
  round never launches with a known fix in flight; round 5 launches when t748 merges and the lane trees are synced.
- Validation: lane trees checked clean (each has only its round-4 debug note, tracked on dev); launcher ready
  (`launch-rerun5.sh`, instance `rr5-slot-N`, fresh workspaces `...-20261020-r6`, social `-r8`).
- Outcome: Partial (held)
- Follow-up: t748, then sync and round 5.

### 2026-10-20 - Rerun round 5 launched after t743 and t748
- Agent: supervisor
- Changed: nothing in the repositories; lane trees t563, t719, t566, t567 fast-forwarded to dev (downstream e04711f0,
  Core 3caf1ff0), installed and rebuilt.
- Why: every change agreed for this round is merged: t743 (build-scoped site memory, actionable answers with
  `gate_unsatisfiable`, repair before ending, each site's round-4 cause) and t748 (dialog view from preceding steps,
  `no_admissible_undo`, reads named by what they read, office C5/C6, the size window). Still in flight and not live
  fixes: t749 (trace P5, offline reads) and t750 (a behaviour-neutral refactor).
- Validation: `sync-lanes.sh` -> each tree `behind=0`, `core_behind=0`, `install=0/0 corebuild=0 extbuild=0`,
  `core-build ... is current with its source`; no Lab process running before launch; the four launches' live guard ->
  `"state":"admitted"` for rr5-slot-1 to 4.
- Launch: as before ($0.25 via both settings, headed, `--model-reset-only`, `--replays 1`), fresh workspaces
  `claude-office-checkout-t563-20261020-r6`, `claude-job-save-t719-20261020-r6`,
  `claude-social-groups-t566-20261020-r8`, `claude-photo-likes-t567-20261020-r6`.
- Outcome: Partial (running)
- Follow-up: verdicts, spend, a debug of every failure with a UI review from screenshots.

### 2026-10-20 - Rerun round 5: 0 of 4; the failures are framework defects in two subsystems
- Agent: supervisor (debuggers debug-rr5-job, -office, -photo, -social)
- Changed: nothing in the repositories; four debug notes copied to dev
  (`language-driven-flow-loop-plan/debugs/run-mvhib*.md`).
- Validation: spend-ledger records: job run-mvhibk0z-1950493f failed $0.078887292 (117 steps); office
  run-mvhibit5-e1d3a4f3 failed $0.143394936 (214 steps); photo run-mvhibis0-b536958b failed $0.116124336 (168 steps);
  social run-mvhibis1-d570b37d failed $0.160457652. Round total $0.498864216, every build under $0.25, no balance
  error. Every debug found the task and fixture sound.
- Job (furthest yet: the save subflow's trial saved exactly the oracle's three rows, judged yes 4 times): the
  witness check runs only for exploration presses (`create-baselines.ts`/`reset-witness.ts` via
  `action-permissions.ts`); a save written into the Flow without an exploration press reached its trial unchecked, its
  saves sealed the baselines and every later trial was refused (`gate_unsatisfiable`); the setup rerun
  (`phase-start.ts`) repeated the save on a site still holding it, which toggled the saves off.
- Office (every fact explored live, one subflow judged yes): the checkout reverted a checkbox itself; the tracker
  (`control-tracker.ts` `standing`) still counted it as the build's change while `undo-admission.ts` `alreadyBack`
  refused the press back, a deadlock; Buy Now presses that navigate away had nothing to settle against.
- Photo (reached a judged whole run, correctly judged no): t741's listing-order rule cannot be met in the web domain
  (the domain moves `extractList.sort`/`maxItems` into run-end processing, which the rule refuses), so the brief
  cycled to the repeat guard; and a like recorded without an address let the reset take a control's starting state
  from after the build's own act and re-like a post the build should not have touched (inferred from code).
- Social (no lasting acts; the second whole-run test returned exactly the oracle's three rows): the judge said no,
  contradicting the previous judge's followed advice and misreading a condition; an unconditioned "See more" loop made
  each test about 7.5 minutes; repair seeded from the worse test; the 25-minute limit ended it.
- UI (all four): internal names and a CSS class shown to the person, an untick worded as a tick, a reset's undo shown
  as a user act, contradictory and repeated endings without a composer, a false model-key notice, and an overlay that
  jumps position, covers headers and repeats its failure text.
- Conclusion: three failures are the reset bookkeeping (the same class as rounds 2-4, each round's fixes exposing the
  next hole), one is judge consistency and read speed (judge errors also recur). Structural units: t751 reset by
  observed state, t752 judge consistency and read speed, t753 chat and overlay polish. No paid run until t751's and
  t752's headed provider-free reproductions pass.
- Outcome: Failed (0 of 4)
- Follow-up: t751, t753, t752; then round 6.

## Open Questions

None requiring user input.
