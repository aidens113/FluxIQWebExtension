# Ledger history: round four to round ten

Historical evidence moved from the parent ledger on 2026-10-13 when it passed 800 lines; the parent
Current State and newer ledger entries supersede it.

## Work Ledger

### 2026-10-12 - t471-t474 merged; correction on B round 9; round 10 prepared

- Agent: Claude senior supervisor; t471-t474 workers.
- Changed: t471 the model's reset is sound (undo counted only when its effect is gone at the act's own page; an
  undo's delete allowance used only by a landed undo; acts the site cannot reverse kept as `startedWith.cannotUndo`
  and told to the judge; permission-refused calls not retried; the trace prints the diagnostic's code); t472 the
  Lab's between-trial fixture reset back on by default, `--model-reset-only` to prove the model's reset; t473 the
  build judge gets the build's timeout, temporary judge failures are re-asked, `not_judged` is never a no, a
  not_judged trial is re-judged on its evidence; t474 checked-rows advice, zero-pass on compiled graphs (value
  ports), reads in execution-failed feedback, resubmission compared with the last accepted revision.
- Correction (supervisor, to the user): in B round 9 the gate was right. The napkins undo was admitted (0048); the
  refused press (0052) removed the pre-existing dish soap under a misattributed `undoes`; the real defect was a
  navigation using up act-2's delete allowance, and the ending did carry a code (only the trace printed `code=-`).
- Validation: supervisor, each on its branch after merging dev: t472 runner 337/337 and the dry-run receipt
  `"fixtureResetBetweenTrials":true` by default; t474 Core "168 files, 1514 tests"; t473 Core "110 files, 885
  tests" after resolving t474's import conflict in `candidate-trial/run.ts`; t471 Core "413 files, 4609 tests",
  domain 212/212; every typecheck exit 0; Core merges gated by `pnpm check`. Pushed: Core `93949d68`, downstream
  `4ed544f2`.
- Outcome: Accepted.
- Follow-up: round 10 for B, C, D (two builds each, fixture reset on); the executor still fails a step on a row
  already done when a trial starts with an irreversible act (D on a real site), and near-identical reads past the
  repeat guard (C); prove the model's own reset in a dedicated `--model-reset-only` run once round 10 qualifies.

### 2026-10-12 - t468-t470 merged; round 9 build 1 failed in B, C and D; t471-t474 dispatched

- Agent: Claude senior supervisor; debug workers; t468-t470 workers.
- Changed: t468 dev's failing tests (candidate-verification migration id `0029`, the Lab's own `legacy` default,
  flow-scoped-keys order assertion, extraction-vocabulary limit); t469 dialog-bound identity end to end; t470 the trial
  feedback names an interruption's way-out handle, live builds dropped the Lab's between-trial reset. Pushed: Core
  `b31142ce`, downstream `9a41e384`.
- Round 9 (pair downstream 9a41e384 / Core b31142ce; matrix all 14 cases passed; dry runs ready, $0.25,
  `fixtureResetBetweenTrials:false`): B `run-mv5q4j33-d04ac463` failed $0.0503: t462's reset gate asked for three
  undos, the model undid one, the second (remove the napkins line, `consequences:["delete"]`, `undoes:"act-3"`) was
  refused `permission_required`, the repeat guard refused it three times and the build threw with no code. D
  `run-mv5q4j2n-25784472` failed $0.1098 (passed in round 8): with the fixture reset off, t462's reset judged a dirty
  site clean (an undo counted on a click of "Request accepted", the start check compared only the start page),
  confirmed requests cannot be un-confirmed, and t466's zero-pass exemption fails on compiled graphs with `item` data
  edges. C `run-mv5q4j5c-49bfb5e2` failed $0.0903, not a regression: the build judge gets the 20 s default timeout
  (not the build's 45 s) and a timed-out judge call is never retried, wasting a correct trial; the build hit its 540 s
  limit one revision short; plus "not supported" advice for correct advice.
- Validation: supervisor read each run's step index and core log; worker debugs in the lane trees
  (`debugs/run-mv5q4j33-d04ac463.md` pending in t471's report, `run-mv5q4j2n-25784472.md`, `run-mv5q4j5c-49bfb5e2.md`).
- Outcome: Revised. Supervisor decision: the Lab's between-trial fixture reset comes back on by default for
  qualification (t472) until the model's reset is sound (t471); a switch keeps runs that prove the model's reset.
- Follow-up: t471 undo admission + sound reset (each act's page, undo counted only when its effect is gone, acts the
  site cannot reverse recorded as `startedWith`) + named endings; t472 fixture reset back on by default; t473 judge
  timeout and retry; t474 checked-rows advice, zero-pass on compiled graphs, reads in execution-failed feedback, the
  t464 resubmit gap. Near-identical reads slipping past the repeat guard (C, ~71 s) is a follow-up.

### 2026-10-12 - t462-t467 merged; correction on B trial 2; t468-t470 dispatched

- Agent: Claude senior supervisor; t462 lead; t463-t467 workers.
- Changed: t462 the build undoes its own lasting acts before every trial (Core `flow-bootstrap/site-reset/`, domain
  `start-state`); t463 row-bound identity for controls repeated per row; t464 quoted script values, non-retryable
  `web.validation.option_not_offered`, unchanged resubmits refused (after a failed trial and after a refutation);
  t465 a press that started a request is never pressed again (page-world request starts); t466 zero-pass loops are
  valid runs, read accounts in trial feedback, per-record-set row counts, the Lab counts candidate build calls; t467
  the judge sees what a filter-only column read and each pass's own page.
- Correction (supervisor, to the user): B round 8 trial 2 did not start on leftovers. The Lab's fixture reset put the
  cart back to its seed (dish soap x1) before every trial; the soap's quantity 2 was the trial's own "set the paper
  towels quantity to 2" step resolving the ambiguous "Qty" to the first row (soap): a silent wrong-row act, fixed by
  t463. The user's reset rule still stands for real sites, where no fixture reset exists (t462), and the Lab's
  between-trial reset is being turned off for live builds so the model's reset is what runs are measured on (t470).
- Validation: supervisor, each on its branch after merging the other repo's dev: t463 extension 238/238, headed 38
  passed; t465 extension 189/189, headed 25 passed; t464 Core "54 files, 463 tests", domain 47/47, extension
  263/263; t466 Core "163 files, 1462 tests", runner 43/43; t467 Core "82 files, 711 tests", extension 222/222; t462
  Core "227 passed, 2730 passed" with 11 failures identical on Core dev without t462 (extraction-vocabulary 1,
  durable-session 10), domain 291/291; every typecheck exit 0; Core merges gated by `pnpm check`. Pushed: Core
  `2aedbc1b`, downstream `7cf74ef7`.
- Outcome: Accepted.
- Follow-up: t468 the tests failing on dev since the Codex merges (Core extraction-vocabulary, durable-session;
  downstream authoring-mode-env); t469 a control is never accepted on a look-alike in another dialog; t470 the
  trial feedback names an interruption's way-out handle, and live builds keep the seed but drop the Lab's
  between-trial reset. Then round 9: B, C, D two builds each on a new frozen pair.

### 2026-10-12 - Claude resumed; round 8 build 1 for B/C/D; reset rule; t462-t466 dispatched

- Agent: Claude senior supervisor (resumed after Codex); debug workers; t462 lead; t463-t466 workers.
- Changed: `AGENTS.md` (user rule 2026-10-12: a build resets the site before it re-runs its Flow); debugs
  `run-mv5jnc5m-a47c3e59` (D), `run-mv5jnc62-01c3609a` (B) in their lane trees; no product change yet.
- Why: user, watching B: "the model itself needs to reset the cart before trying to run the flow again", and "why it
  failed the first time". B trial 1 failed only on its last step: two cart "Qty" selects, the saved step named its
  control "Qty" alone (`web.target.ambiguous`); later trials ran on the previous trials' cart; revisions 4, 5, 8
  failed because Core `authoring/values.ts` keeps `value: "2"` with its quote marks (supervisor-verified line);
  unchanged resubmits counted as revisions until the 64-call budget ended the build. D passed but pressed Confirm
  twice on one request in playback, its "slow-down notice" step targets the chat close, and a zero-row filter was
  reported as a wiring failure.
- Validation: three provider-free dry runs on the frozen pair (downstream 0fc8d0ae, Core aca9f088) -> each
  `"status":"ready","providerCallCount":0`, `"maxEstimatedCostUsd":0.25`, candidate trial with start reset; paid
  builds: D `run-mv5jnc5m-a47c3e59` passed $0.0501 (ceiling 0.25 in the ledger); C `run-mv5jnc51-9eac63f2` failed
  $0.0912; B `run-mv5jnc62-01c3609a` failed $0.1268 (no Flow). D separate disabled replay
  `replay-mv5k0lge-6ec27e17` passed: hash before = after `ea92a22a…`, coreProviderCallCount/accountedCalls/calls/
  interventions/harnessActivations all 0, modelProvidersEnabled false, gate not invoked.
- Outcome: Revised. D's second build is held: live runs wait for every agreed fix (t465 double press), so D
  re-qualifies with two builds on the fixed pair.
- Follow-up: t462 build resets site before rerun (lead, Core-paired); t463 row-bound control identity; t464 quoted
  values, non-retryable no-option match, unchanged resubmits refused (Core-paired); t465 a committing press lands
  once and interruption steps target the interruption; t466 zero-row filter feedback, chat row counts, Lab call
  count (Core-paired); C's debug in progress.

### 2026-10-12 - t461 independently accepted on combined dev

- Agent: Codex senior supervisor; A/B/C workers.
- Changed: optional passive rejection witnesses through extension/domain/Core, original predicate indices,
  repeated-pass/privacy handling and authored column order; current dev merged in both task branches.
- Validation: root independent72Core/78domain/83extension +cache-free types/native audits0; headed Chrome134
  T2 retained packets/hash/DOM/20rows/order/3absent+4present/Core/sparse indices verified. Combined146Core/
  78domain/83extension/7replay tests/types/native audits0; current owner inventories/reached110 rootverified.
- Limits: no full background transport, model verdict, live continuation/withholding or paid semantic pass.
- Outcome: owning downstreamfirst/Coresecond integration completed493b1749/1f6580bb; bothdev push next; original driver failures preserved.
- Follow-up: freeze new pair, zero-call .25 readiness and one paid creation per open lane before replay gates.


### 2026-10-11 — Round-seven results independently checked; t460 repairs assigned

- Supervisor read B/D evaluation and runtime oracles: B ten facts held; D4records/8fields/no extras/nonstring,
  records+finalstate held. Both confirmed; C no promoted Flow. Whole costs B0.177387264/C0.212390292/D0.113476884.
- Both separate replay receipts failed solely missing accounting; hashes equal, disabled wiring/credentials[],
  stored keys preserved, interventions/harness0. No second creation, balance error or automatic retry.
- Independent read-only immutable reconstruction: B6chunks/29events, D6chunks/36events; exact paths/hashes/
  bytes/schema/ranges/contiguous sequences/header-last checked. Latest both succeeded/fullzero gate with
  provider rows0/omitted0/pending0 and settled unverified/no_model_available. Original failed receipts preserved.
- D annotation lands380ms after first success; original capture time unlogged. No permanent Core publication
  loss: earlier B omission hypothesis superseded. t460 fixes downstream bounded settlement and Core final-slot
  offer/execute contract in disjoint files; no budget/time increase. Existing owning lifecycle bootstrap0 reused
  most builds and regenerated extension; do not run another full build sweep. A audits C provenance read-only.
- Round-seven frozen-pair streak released; changed-source qualification needs a new pair. Retained lane reports
  and profiles remain; main .clinerules edit untouched. No user-panel management or generated state edits.
- Validation: supervisor Node read-only descriptor reconstruction exited0 for B6chunks29events/D6chunks36events;
  all hash/range/header assertions passed, latest both zero ledger. Actual evaluation projection exited0:
  B10heldfacts/D4matchedrecords8presentfields0extras0nonstring; both raw replay verdicts failed missing accounting.

### 2026-10-11 — Round-seven preparation frozen; D dry-run omission contained
- Agent: Codex senior supervisor; A/B/C workers.
- Changed: all six clean retained lane trees fast-forwarded to Core5036fb8c/downstreamd19a8d50; B/C/D rebuild and actual zero-call ready preparation assigned, no paid clearance yet.
- Why: qualify integrated processing help/passive result view/recording persistence on unchanged original tasks with the authorized$0.25 and existing64build-call ceiling.
- Validation: supervisor inspected D omitted-dry-run prelude log: stopped at domain cleanup/build before Lab run entry/host/browser/chat/provider dispatch; no staging directory. Worker owned stop reported no open live run. Corrected explicit dry-run regenerates interrupted owner artifacts; ready/artifact review still pending.
- Outcome: command error contained before admitted attempt or model spend; preserved logs/profile/data, no source/override change. No product pass/failure inferred from that preparation.
- Follow-up: inspect actual ready64/48million/bothpurses0.25, current artifact validators and original task hashes before one paid attempt per lane; actual four identities before chat, then full debug/oracle/replay gates.

### 2026-10-11 — Passive result view and recording persistence independently accepted
- Agent: Codex senior supervisor; A/B/C workers.
- Changed: t459 passive result seam/architecture and t454 durable recording identity/read/removal/claim/normalization owners integrated downstream first/Core second and pushed both dev branches.
- Why: final result checks omitted hidden current state; recording zero cursor split history and later identity/cache/crash defects lost or conflicted with durable entries.
- Validation: t459 supervisor24Core/17domain tests, fresh types/built adapter/audits; corrected actual headed content-harness proof independently parsed/hashes checked. t454 supervisor107tests/14files including14actual process, fresh Core51.174s/domain types and native audits; original32state exact FIFO/restart probe typed32/file0/chunkreads32. Staging caught three new-test trailing blank lines; removed without behavioral change, staged whitespace passed. No full suites or model calls in these fix gates.
- Outcome: accepted source heads downstream3b40d762/Core4fcb0940. Core legacy full-check finish bypassed only after observed narrow gates; evidence/profiles retained outside owning cleanup.
- Follow-up: new frozen-pair B/C/D qualification at$0.25/64build calls/explicit48millionrun tokens, all per-request limits unchanged; browser/gateway recording backlog still unverified.

### 2026-10-11 ? Settled worker briefs archived
- Agent: Codex senior supervisor.
- Changed: moved superseded worker briefs, preserving their original budgets and validation requirements, into the linked archive.
- Why: keep active repair and next-round gates readable as the execution document approached its line budget.
- Validation: exact extracted historical text retained; current source, receipts and authorization unchanged; working index regenerated and whitespace checked.
- Outcome: accepted memory compaction; current repair briefs and latest state remain in the parent.
- Follow-up: finish independent source/browser/process gates before paid qualification.

### 2026-10-11 — Processing help integrated; final recording review reproduces two new failures
- Agent: Codex senior supervisor; A/B/C workers.
- Changed: t458 help/tests/architecture integrated downstream first/Core second; both dev branches pushed. t459 optional passive result view remains isolated; t454 follow-up brief adds actual public-writer and killed-child claim gates.
- Why: supported processing was missing from model help; strict recording identity proofs exposed hydrated mirror publication and a durable orphan claim.
- Validation: supervisor t45852focused tests, cache-free Core types, actual compiled help/parser parity, domain freshness/types and native audits passed; owning finishes exited0. Worker fail-first reproduced three public-writer conflicts and one killed-child claim conflict; repairs not yet accepted.
- Outcome: t458 accepted at downstreamf191802a/Core0cfb4f45; no new paid test or claim of live semantic success.
- Follow-up: independent t459 content-browser/type/test gates; t454 strict public/body/restart fencing review and checks; prepare $0.25/64call changed-source round with preserved token bounds.

- October 11: Round-six Core190d7bda/downstream921f0296 ended allthreefailed. Supervisor independently inspected
  zero-call ready ceilings0.25/original tasks and all12actual identity receipts. C startup passed; sealed C
  build48calls/36decisions/12judges ends evidence_iteration_limit, six trialsno, latestrev16; total49calls0.09098706.
  D build48calls/38decisions/10judges same limit, five no/unconfirmed trials, total49calls0.068919444. B savedoracle
 4of10factsunheld despite runtimesucceeded/finaljudgeyes,25calls0.044999439. Trial yes correctness not disproved:
  two trial add confirmations differ from saved first no-effect. Budget ceiling remains0.25; future ready plans
  may use existing64call upper bound after relevant source repair, without raising financial/output limits.
- October 11: Root t454 synced both idletrees to integrated dev190/921; actual fresh owning build64.854s/7250outputs,
  cache-free currenttypes and independent48tests/6owner files passed. New compatibility comparison proves supported
  fresh no-packet-ID append after captured undo still regresses; acceptance withheld pending private capture proof.
  Existing six fresh-process cases/32state measurement remain worker claims until final source independent rerun.
- October 11: t458 paired provision started for exact Core record-output-contract help omission; no parser changes.
  A read-only freshness report identifies domain result observation coverage, not Core cache/timing; optional opaque
  passive result-view proposal needs neutral fail-first validation and preserves legacy fallback/hidden-control rules.

- October 11: Supervisor accepted t455 after current owner build, cache-free types, independent36test lifecycle/
  containment/wiring pass, actual injected browser proof (fresh strict worker/guard identity, forbidden traffic0,
  provider0), final audit and baseline31to28 only. Normal task integration audit passed; merge9c62a57a. Original
  natural race remains unreproduced. Owning task cleanup reclaimed disposable probe worktree; stdout proof and
  gate logs remain outside it under fxwork/t455-supervisor-*.log; original C live profile/run evidence untouched.
- October 11: t457 supervisor22tests plus actual compiled refusal/privacy/repeat proof, fresh Core build/cache-free
  types and current domain19.896s check passed. Both audits passed. Downstream normal finish then Core own
  finish used --skip-checks only to avoid its legacy full-suite wrapper after observed narrow gates; see retained
  reports and finish logs. Exact trusted handler_invalid messages admitted, invalid scripts still refused; no
  arbitrary page/provider feedback admitted. New source pair needs fresh live qualification, not yet claimed.
- October 11: Independent t454 source review completed all21owner paths. Four concrete cached-removal,
  removal-retry, finalize/append and delayed-counter interleavings remain unverified; worker now owns bounded
  fail-first reproduction/fixes. Repair remains isolated/unmerged despite earlier sequential restart passes.

### 2026-10-11 — Combined feedback/judge pair integrated; recording failure supervisor-verified
- Agent: Codex senior supervisor; feedback/judgement/recording workers.
- Changed: t452 integrated Core135da138/downstreambec8639b; t453 integrated Core3291fb25/downstream2fa74682; all unit reports/architecture preserved. Recording repair brief expanded to exact adapter/load/strict-write/removal owners without touching pool WIP.
- Why: restore consistent candidate guidance and reject semantic counterexamples before new paid tests; preserve actual recording histories across restart.
- Validation: root t453 delivery/pins52/52, cache-free Core typecheck exit0, actual domain freshness/typecheck22.221s and both audits pass; worker four subjects111/111/fresh47.392s build. Core finish whole-suite bypass only after real narrow gates. Root reran configured32-entry probe: exit1 at reopen, typed31/file1/reopen1. User$0.25 accepted by actual zero-call budget resolver; next actual ready preflight still required.
- Outcome: Accepted combined product pair, live proof pending. Recording loss independently confirmed; t454 has fail-first reproduction and begins scoped repair.
- Follow-up: sync/rebuild headed B/C/D, freeze Core3291fb25 during qualification, full debug plus separate zero-model replays; t454 integration after streaks. No unchanged relaunch or model output cap.

### 2026-10-11 — Feedback unit passes; recording restart defect reproduced
- Agent: Codex senior supervisor; B/C feedback and recording-measurement workers.
- Changed: t452 source and architecture committed in both task branches, integration underway. t453 generic judge prose and delivery/pin tests ready for t452 sync. Recording source remains untouched.
- Why: complete current-output gates and investigate provider-free recording backlog without adopting conflicting storage WIP.
- Validation: root actual final Core build passed 45.249 s/7218 outputs; cache-free Core typecheck exit 0, actual downstream freshness/source/test check 9.577 s, both audits pass. Root runtime 50 + final wiring/receipt 17, UI 114, domain 15; final worker source tests 107/8 pass. t381 probe worker reproduced unique-identity 32-entry timeline: in-process 32, typed SQL 31, fallback file 1, restart loader returns 1; only first append fell back to file, later appends used SQL. Root reproduction review still owed.
- Outcome: Feedback unit accepted for integration. Recording has a persistence/read-owner split hypothesis supported by source and counts, not merely slow connections; no browser backlog resolution claimed.
- Follow-up: finish t452, sync t453 and independently gate; preserve measured restart evidence, write bounded recording-owner fix brief. Next paid tests retain $0.25 preflight and unchanged task/oracle gates.

### 2026-10-11 — Supervisor confirms D's visible false success
- Agent: Codex senior supervisor.
- Changed: t453 generic verification brief and t452 modularity ownership; no new paid run.
- Why: D's real ending panel says Passed although its independent oracle failed; shared feedback source must obey existing depth/directory/file budgets.
- Validation: root visually inspected D ending and mid-build actual side-panel images. Ending states six rows passed (aggregate before/after) and Run finished; saved flow-lane independently says candidate revision 4 yes/two judge calls, runtime succeeded/reported passed/oracle failed. Mid-build repeats a Read list card and exposes a camelCase field key in its prose; tracked UX follow-up. Root t452 runtime four owning files 50/50 passed in addition to UI 114/114/domain 15/15; fresh combined build/domain check passed before final receipt-path relocation, so final relocated build/check/audit still owed.
- Outcome: False-positive UI is confirmed from pixels, not just metadata. D prompt-only fix tests delivery and does not establish deterministic quantity interpretation.
- Follow-up: final current-source package gates; t453 inclusion/exclusion/quantity prompt, regenerated owning pins; changed-source $0.25 live proof. Defer unrelated UI labels/cards to planned UX phase.

### 2026-10-11 — Generic fixes underway; D false acceptance evidenced
- Agent: Codex senior supervisor; t452 B/C workers and D-debug worker.
- Changed: C's domain web-7 category/type evidence sentence and Core bare-count failure-card fallback; B fail-first candidate cache/stall/wrong-control regressions. Full B/C reports/debugs committed and merged with retained workspaces; both source/evidence devs pushed.
- Why: repeated accepted submissions received conflicting legacy advice; wrong-control advice assumed semantic intent; C failure card displayed identical counts as a contradiction.
- Validation: supervisor independently reviewed C diffs and ran UI 114/114 plus domain instructions 15/15; full combined source checks pending stable B edits. D worker inspected actual three judge requests: original instruction, omitted row and exclusion accounts present; both candidate judges and runtime judge still answered yes. No evidence omission/confirmation leakage established; supervisor request-level review owed.
- Outcome: Partial feedback unit; generic semantic judge follow-up must not embed task/oracle answers. No new paid launch.
- Follow-up: actual combined typechecks/build/audits and root owning tests; D generic acceptance proposal; ready preflight must show configured $0.25 before changed-source runs.

### 2026-10-11 — User raises future testing purse; round four ends
- Agent: Codex senior supervisor.
- Changed: future per-test ceiling authorized at $0.25 via launch environment; historical $0.10 run evidence unchanged. t380 verified fixture task integrated downstream/Core after all active runs ended.
- Why: user saw near-passes and authorized more room for correction/judging. Semantic and playback failures still require diagnosis and fixes.
- Validation: B sealed entry/summary/evaluation independently failed, $0.096883188, 27 calls, no Flow; D independently failed $0.088619448/29 calls, flowCreated true but oracle failed. A remains fully qualified; no round-four B/C/D end-to-end pass. Budget owner code accepts configured test environment 0.25 and threads test scope to isolated Core; dry-run confirmation required at next launch. t380 finish downstream audit passed; Core finish used --skip-checks only after actual supervisor 45 tests/typecheck/build/audit under newer narrow-gate rule.
- Outcome: No active paid streak; no unchanged relaunch. New paired t452 prepared for bounded generic feedback fixes.
- Follow-up: finish B/C/D full debugs; t452 feedback work, sync/rebuild and verify $0.25 preflight before changed-source qualification.

### 2026-10-11 — B/C first attempts failed; no unchanged relaunch
- Agent: Codex senior supervisor; live-b/live-c workers.
- Changed: lane-owned failure debugs in progress; source pair remains frozen for D.
- Why: qualify actual build behavior, not compilation or accepted submission alone.
- Validation: C sealed bundle entry/summary/evaluation independently agree failed, cost $0.088334076, flowCreated false, no oracle verdict. Worker observed 17 calls and accepted revision 2 trial. B worker reports failed $0.096883188/27 calls: revision 3 reset trial executed successfully but not_judged and no promotion after purse stop; supervisor full receipt review owed. No balance error reported.
- Outcome: B/C do not qualify; no separate replay or second paid creation is authorized on unchanged failed source. D remains active.
- Follow-up: complete every-step/UI debugs, isolate generic feedback/unchanged-resubmission/purse cause; prepare bounded fail-first fixes and requalify on changed source after active D streak ends. Do not cap provider reply length or alter tasks/oracles/purse.

### 2026-10-11 — Fixture task independently verified; all live identities confirmed
- Agent: Codex senior supervisor.
- Changed: t380 supervisor report and baseline regenerated through owning command, lowering only two counts; live source unchanged.
- Why: independently validate recovered test-fixture work without invalidating active paid streaks.
- Validation: t380 merged current Core dev; actual fresh owner library build (181.800 s), cache-free typecheck exit 0, structure audit exit 0; 45/45 tests in five owner/consumer files (115.26 s), including 16 rebuilt child-process race/crash probes. B/D four running identity receipts independently read: all verified true and observed payloads equal expected, as already confirmed for C.
- Outcome: Fixture unit ready for local commit/integration after streaks. Live run outcomes still pending; no balance stop observed.
- Follow-up: preserve frozen live pair; inspect each completed run and separate replay before signing a gate.

### 2026-10-11 — Round-four attempts admitted
- Agent: Codex senior supervisor; live-b/live-c/live-d workers.
- Changed: lane-owned expectations, preflight reports and new run debugs; runtime evidence through owning Lab.
- Why: verify integrated fixes in real headed extension chat against unchanged tasks/oracles.
- Validation: all three owning build/dry-run preflights exited ready with zero calls. Single launches: C run-mv4mhz5r-7ad281b1, B run-mv4mj8ef-1d0b141f, D run-mv4mjpig-fa4a3f4f. Supervisor independently inspected C's four running identity receipts: actual Core/host/server and extension background/content match expected, all verified true.
- Outcome: Partial; live outcomes and separate replay gates pending. No source changes, overrides or user-panel management.
- Follow-up: debug before another launch; failure requires changed source, balance error stops all paid work. t380 supervisor fresh build/typecheck/audit pass; 45 owning fixture/process tests running in isolated tree, integration held.

### 2026-10-11 — D completion/default integrated; live pair frozen
- Agent: Codex senior supervisor; b-debug/a-review/c-validation workers.
- Changed: t449 optional-path accounting and safe terminal feedback; t450 configured candidate default; preserved explicit legacy and omitted-mode raw API compatibility. Both dev branches pushed: downstream d1e516e6, Core b27c0d64. Slot 1 transferred from inactive t274 to t451/C after confirming no old process.
- Why: D's legitimate conditional bypass falsely failed completion; A's signed qualification enabled the planned default change.
- Validation: supervisor D owning tests 110/110, then 47/47 after integration; default tests 96/96, then combined owner checks 26/26; actual fresh Core typechecks/library builds, downstream freshness/typecheck and both structure audits passed. No full-suite merge gate run.
- Outcome: Accepted source pair; B/C/D isolated headed runs preparing with current library builds and zero-call preflights. Core dev remains frozen during their streaks.
- Follow-up: independently inspect live identity/oracle/accounting/replay receipts. t380 worker checks pass but supervisor verification/integration waits; t381 conflicting storage WIP remains unmerged.

### 2026-10-11 — A qualified; recovered C/B source integrated
- Agent: Codex senior supervisor; a-review/c-validation/b-debug workers.
- Changed: recovered A/B lane evidence merged with task boundaries and retained workspaces; t274 source integrated in both repositories; stale main/recovery Current State reconciled, 64 prior MVP ledger entries archived.
- Why: A lacked two separate replays and C's existing fixes were still dirty; B's final counted turn wrongly withdrew trial tools.
- Validation: supervisor Core six owning files 80/80, nonincremental Core typecheck exit 0, domain instructions 14/14, domain freshness/check matching successful stamp; final Core audit exit 0 and downstream task-finish audit passed. Both A replay receipts independently passed exact unchanged hashes, disabled model wiring, five zero counters and independent goal. Core finish's whole-suite invocation bypassed only after actual narrow checks under the current user rule.
- Outcome: Accepted bounded source/evidence unit; fixed-source B/C/D live behavior still owed.
- Follow-up: finish t449/t450 verification/integration, then live qualification; t380/t381 remain tracked follow-ups.

### 2026-10-11 — Continuation started and failures traced
- Agent: Codex senior supervisor; workers a-review, b-debug, c-validation.
- Changed: execution briefs and Current State; t449 paired worktree provisioned; owned lane reports/debugs recovered.
- Why: user authorized execution; qualification requires missing replays and fixes for actual failed build paths.
- Validation: supervisor read both A running identity receipt sets (`verified: true`) and 4/4 held task facts; inspected D trial results/run-summary metadata: trials 2-4 failed at a terminal node with unvisited nodes and all displayed steps successful. `pnpm.cmd task start trial-completion-feedback --worktree --core` -> t449 created successfully.
- Outcome: Partial; A replays and narrow C/B/D fixes in flight.
- Follow-up: independently verify workers' source/test results, integrate downstream before Core, then requalify failed lanes.

### 2026-10-11 — Saved evidence and unfinished lane work reconciled
- Agent: Codex senior supervisor.
- Changed: this audit and the generated working index.
- Why: recover Claude's actual stopping point and order continuation without repeating passing proofs.
- Validation: `git status --short`, `git rev-list --left-right --count origin/dev...dev` -> dev refs 0/0 in both repos; PowerShell saved JSON projections -> R4a/R4b/A1/A2 passed, B/D failed at build; FluxIQ-related node process query -> none; `node scripts/structure-audit.mjs` -> passed (184 warnings, 646 baselined); `git diff --check` -> exit 0.
- Outcome: Accepted audit; implementation and live qualification review remain future work.
- Follow-up: Phase 0, then A qualification review and C integration; debug B/D before paid reruns.

