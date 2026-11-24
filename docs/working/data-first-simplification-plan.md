# Data-First Simplification Plan

Status: Active
Status detail: Every planned fix through t1000 is integrated and pushed (Core 0.54.4, contracts 0.23.2); both full sweeps of 11-23 pass every test. The supervised $50 paid round on the ten scoreboard tasks is running (2026-11-24); t1005 (check build order) merges after it.
Created: 2026-11-20
Last updated: 2026-11-24
Owner: Senior supervisor agent
Scope: What changes after the 2026-11-19/20 live campaign: extraction keeps every column, one simple data layer dedupes and cleans from that upstream data, the model collects broadly, the framework does the heavy lifting, one model per task, replays that keep their repairs, a cheaper judge, and no paid run before a provider-free proof.
Paired document: ../!FluxIQ/docs/working/data-first-simplification-plan.md
Related: [usable-client-plan.md](./usable-client-plan.md) (the campaign ledger, 2026-11-20 entries), [framework-heavy-lifting-plan.md](./framework-heavy-lifting-plan.md) (W7: typed fields, marks, row identity), [first-class-data-extraction-plan.md](./first-class-data-extraction-plan.md), [answer-first-plan.md](./answer-first-plan.md); campaign results `C:/Users/osrs_/FluxStuff/fxwork/t959/!FluxIQWebExtension/docs/working/mvp-launch-plan/reports/live-campaign-2026-11-19/results.md`

## Current State

**Week focus (user, 2026-11-23):** "for now we'll only focus this week on getting the core product 100% working". Hosted and cloud work stays paused until this plan's proofs and paid round show the core product working. That includes the web remote viewer the user asked for the same day, recorded as unit HC-V in [hosted-platform-launch-plan.md](./hosted-platform-launch-plan.md).

**Memory is not a reason to wait (user, 2026-11-23):** "dont worry about mem, we have pagefile". Lanes, builds and visible browser runs are dispatched without waiting for free physical memory; the heavy gate queues heavy steps (AGENTS.md).

**State at 2026-11-24 (Claude Code lead; detail per unit in the Work Ledger and "Integration History" below):**
- **Integrated and pushed in both repositories** (downstream af360c487, Core 5dfde039c; fluxiq 0.54.4, contracts 0.23.2):
  - P0: t976, t979, t981.
  - P1 t982 retained extraction; P4 t983 fixed model; P2+P6 t984/t987 data stage and smaller judge; P3 t989 collection guidance; P5 t985 (F24).
  - S1/S2/S6 t986 offline proof, scoreboard and preflights.
  - t990: recorded-read oracle acceptance. Hubs 10/10, earbuds 13/13 (processing), job board 7/7 on three runs and Netherlands 32/32, all with 0 calls. Photo-social is a recording gap.
  - t991, t992 and t994: every failure from the first full sweep of 11-23 (21 downstream, about 319 Core and web), fixed forward. t994 also fixed F23 (the run gate looks at the page for a press carried only by `heldOnRepeat`) and the read's own process under a declaration.
  - t993 and t998: a captured-but-absent cell is "not shown", in the feed and the store (migration 0041).
  - t996: the preflight meets the four sites' own person checks.
  - t997 and t999: stored labels hold no page values, and binding reads `_`/`-` as word separators.
  - t1000: `ask_person` is offered only after a change_approach, with a reason (the user's 11-19 rule; t983 had dropped the gate). A judge repeating one unreadable reply is caught as a loop, and each re-ask names the missing schema part.
- **Second full sweep of 11-23** (Down 9a29b8940 / Core fbc0356f6, before t1000): every test passes.
  - Core fluxiq: parallel 20,257 and real-sql 3,241.
  - Core packages: contracts 1,173, ui-components 881, websocket 213, sdk 103, cloud 67.
  - apps/web: 4,384.
  - Downstream: domain 3,195, extension 4,150, test-runner 2,982, scenario-lab 1,043, and the rest. Both builds exit 0.
  - Only downstream `pnpm check` failed: 35 `error TS` from missing `@fluxiq-web-extension/domain/node` and `browser-host/reaper` declarations in a fresh tree (check ran before build). The fix is t1005, merged only after the paid round, so the lanes stay at dev.
- **Paid round (P7, U8): running since 2026-11-24** under a supervisor (brief `briefs/paid-round-1124.md` in `fxwork/t1001-paid-lane-a`). The lanes are t1001-t1004 (`paid-a` to `paid-d`), at downstream af360c487 / Core 5dfde039c; the running report is `reports/paid-round-1124.md` in lane a. No code merges into dev until the round ends; docs-only commits keep the lanes admissible.
  - Tasks: the ten fixed scoreboard tasks (`scoreboard/fixed-tasks.ts`), easiest first.
  - Command: `pnpm lab attempt <scenario> --task <id> --authoring-mode answer-first --live-llm --llm-max-cost-usd 5`, with four attempts, on Haiku, in visible Chrome, on up to four dev-synced lanes, under a supervisor that watches every run, writes its debug and reports cost as it happens.
  - Money: a task starts only while billed spend, plus $5 for each task in flight, plus its own $5 is at most $50. A call with no reported usage is counted at its maximum. The round stops at the first balance error.
- **Open follow-ups, not blocking the round:**
  - narrow the P4 memory tolerance (`task-model/resolve.ts`) to store I/O errors;
  - a saved Flow carries its own data declaration;
  - the test file that leaks `chrome` before act-mark's watch test;
  - the start reading's retry on timeout (once, against 3 on network errors);
  - a DeepSeek-only workspace with no provider named gets Haiku (the stated default);
  - promote `main` after a clean full sweep;
  - recorded evidence lanes need is kept outside the repositories in `fxwork/recorded-evidence/`, because a finish removes a worktree's ignored `test-runs/`.

**User-approved rules (2026-11-20):**
- U1: no model ladder; a task keeps its starting model.
- U2: the data layer automatically dedupes and cleans using upstream data where possible, simply.
- U3: extraction keeps every column; output projection happens in processing.
- U4: collect broadly, then filter deterministically.
- U5: the framework does the heavy lifting.
- U6: the judge stays on that same model.
- U7: all L1-L9, S1-S10 and P0-P7 below are approved, including Haiku as automation default; finish the three interrupted fixes first.
- U8: paid round approved, **$50 absolute total ceiling**. Lead's conservative reading covers the round and reruns together. Only launch while billed total plus the task's $5 purse is at most $50; supervise every run and stop on a balance error. Required provider-free proofs and available Claude credit come first.

**Why this plan exists:** the recorded campaign counted 37 runs, 0 strict SUCCESS, 17 PARTIAL and 20 FAILURE, about $90. Strict SUCCESS means four correct attempts, three predecessor-Flow continuation proofs and zero model calls on attempts 2-4. The original campaign, causes and approved phased design follow; historical task diagnoses remain in the task reports and git history.

**Next:** finish the supervised paid round; merge t1005; diagnose each round failure from its recorded run before any rerun; then a full sweep and `main` promotion.

## Integration History (2026-11-22/23, superseded by Current State)

**Handover to Claude Code (2026-11-23).** The user handed the Codex session's work to a Claude Code lead. Codex stopped about 13:40 on 11-22 with no process left running.
- **Committed at handover:** Codex's final status notes on both dev branches. Its uncommitted lane work went onto each task branch as unverified checkpoints: t984 Core 4c4868428 (FluxNode fixtures, never run) and t986 Down 4e364886d (split raw/projected read parity, never compiled).
- **Recovered result Codex never recorded:** t984's 17-file Answer First compatibility batch finished with 95/104 passed and 9 failed in 7 files.
- **Branches:** t987 (both sides) and t986 Down now pass the pre-push audit and are pushed. t984 Core is still refused, and its worker owns its own violations.
- **Dispatched:** after merging dev into t984, t987 and t986 (both sides, no conflicts), three worker-heavy agents took written briefs: `briefs/finish-data-stage.md`, `briefs/finish-judge.md` and `briefs/finish-offline-proof.md` in each task tree. t986 browser commands wait for the lead's sync message.
- **P2 and P6 integrate as one unit (lead's decision, 2026-11-23):** t984 and t987 have merged each other repeatedly. They share 242 changed Core files, and t987 lacks only 8 t984 commits. The judge-file audit violations on t984 (stored-finding, checkpoint/read, the store's source-owner import) were already fixed in t987 cb1aa1d0d, so the t984 worker leaves them alone. Once t987 passes acceptance, the lead merges t987 into t984, reruns the combined narrow checks, and finishes t984 and then t987.
- **t985 (F24) integrated and pushed in both repositories.** Lead on current dev: owners 55/55 (138 s) and `pnpm --filter fluxiq check` exit 0 (95 s). Downstream finish audit passed; Core contract gate 70/70. Core is at 0.52.1. F23 diagnosis and four-attempt acceptance remain open.
- **t989 (collection guidance) integrated and pushed in both repositories.** The lead widened the Core set from Codex's 6 owners to 11, adding the five that pin the changed wording. The wider run found 2 failures Codex's set never ran. The new prose said "establishes", which contains "tab" and failed the stage registry's no-browser-noun guard, so it now says "supplies". `authored-draft.test.ts` still pinned the old site-filter sentence. Fixed in ec6d2517b, with pins and snapshot regenerated by their owners. Lead results: 11 Core owners 215/215, Down owners 24/24, both package checks exit 0 (Down after a Core library rebuild), finish audit passed, Core contract gate 70/70. Core is at 0.52.2. A live prompt smoke has not run.
- **t987 (P6) own work passes; it waits for P2.** Worker results: authority owners 77/77 (two regressions added), semantic 255/255, checkpoint 112/112, request/window 420/420, Core and domain types, both audits, downstream judge-evidence 125/125. The judge request on the harness fixture is 83,220 -> 6,874 bytes with both rows retained (fixture bytes, not billing). The composition batch got 160/196. All 36 failures are in Answer First fixtures that lack P2's processing declaration (later-attempt, saved-read-restart, flow-stage-person-stop, endings judge, saved-on-every-ending, saved-shapes). t984 fixes them; endings judge and saved-shapes were added to the t984 worker's scope. The lead reviewed the fixture changes, and no assertion was weakened.
- **t986 Company capture cause found and fixed (worker, unit-proven only).** The receipt fingerprinted the posted request, but the host compared it with the service request, to which Core's route always adds `caller`, `permittedConsequences` and `permissionAskTimeoutMs`. The host refused before the build, and an empty catch hid the refusal. The fix lives in the downstream test-runner only, with no Core edit. Every posted field must reach the service unchanged. The routed request is bound with only the caller's session id replaced. A refusal is recorded by its code. Worker results: runner owners 26/26, domain owners 15/15, checks, build and audit. The lead synced both t986 trees to dev, including t985 and t989, and re-verified: Core rebuild, domain and runner checks and the runner build all exit 0; domain owners 15/15; runner owners 26/26; audit passed.
- **t986 browser proofs (provider-free, visible Chrome; the lead read each result file):**
  - Everything Store recorded read `report-original-six-rerun2.json`: parityPassed true, gaps [], 0 model calls.
  - Fresh Company capture `t986-fresh-capture-company-v2`: complete true, gaps [], hostRefusal null. This is a stopped bootstrap prefix, not task acceptance.
  - Social preflight v2: protocolPassed true. Pairing, chat start, person answer, read and permission all passed. v1 had failed because the probe Flow lacked an active task instruction; the probe now saves a generic one (a9e601d68).
  - The other nine sites' preflights passed v1. On four sites the site-declared person checks were `not_run`, a stated gap that whole-task runs must cover.
  - The 30-file owner sweep passed 206/206.
  - Preflight external calls and cost are unobserved, written as 0.
- **Core defect found by the zero-call Company replay:** replay entered with exactly the bound entry (the before-entry check passed). Then Core's trace-replay session check refused `incomplete_capture`, because `session-references/bound-kinds.ts` counts every `artifact` event as session-bound, including the capture receipt on the control stream that the trace contract says belongs to no session. The fix is in Core (lead alerted the user that the boundary was crossed): control-stream events are neither counted as session-bound nor given `session-1`, with a Core test. Then the replay is rerun to `t986-replay-company-v2`.
- **P2+P6 integrated and pushed in both repositories (Core 0.53.0).** The lead read every raw log of the combined run on the merged tree. Totals: P2 compatibility 37 files 195/195; P2 combined 24 files 192/192; P6 authority 77/77, semantic 255/255, checkpoint 112/112, composition 196/196 (was 160/196 on t987 alone), request/window 420/420. The fluxiq and domain type logs show 0 TS errors. The Core library rebuild passed, domain judge-evidence passed 125/125, and both audits passed. The combined worker changed no source. Finishes: Down audit passed; Core contract gate 70/70. t987 was closed with `pnpm task abandon` (0 unmerged on both sides; its commits are in dev through t984). Lead decisions: the judge-test oracle change is accepted (a give-up still never ends a task, and the data stage refuses an empty give-up before any judge); the P4 and FluxNode fixes made in the P2 lane are accepted; a saved Flow should carry its own data declaration (queued follow-up).
- **Shared Core `fxwork/!FluxIQ` synced** from efaf56134 (143 behind) to cc1230032, with a full build including the web panel, via `heavy-slot run lead-sync-shared-core -- pnpm task sync-core --allow-running` from the t353 sibling worktree moved to dev.
- **t986 replay chain works to the end of a recording.** Core 869523fdb and 92cd31a39 decide session binding from each event's kind and stream (replay check, attach, walk, admission). Downstream 9685157f6 keeps the per-run `commandId` out of the model-visible read; replay must issue new command ids, so every replayed request otherwise differed. The lead accepts this live-input change; step files keep the id. Results: capture v4 complete, gaps []. Replay v5 entered with exactly the bound entry, the session ran with no normalizations, 3/3 operations matched, and request 1 matched with its recorded reply served (0 provider calls), stopping at `exhausted_stream`, the designed end of a one-exchange capture. Worker results on the synced tree: Core trace owners 66/66; fluxiq check exit 0 (the earlier 10 errors came from stale P2/P6 copies); both audits passed; domain 320/320; runner 206/206. Open: `comparison/parity-report.ts` marks only `kind === control` as outside, so a Sonnet worker is fixing it under `briefs/parity-host-stream.md` before t986 merges.
- **t986 integrated and pushed in both repositories (Core 0.53.1).** The parity report now classifies host-stream artifacts as outside replay parity (Core 0a6f692fb; worker 68/68). The lead added the header note and ran the final checks on dev-synced trees through the gate:
  - Core: trace-replay and trace-matcher 15 files 68/68; `pnpm --filter fluxiq check` recompiled, exit 0; audit passed; library rebuild exit 0.
  - Downstream: domain check exit 0; domain `node-run` and `offline-reads` 645/645; runner build and check exit 0; the 30-file runner owners 206/206; audit passed.
  - Finishes: Down audit passed; Core contract gate 70/70.
- **t990 (P1-P3 recorded-run acceptance) integrated and pushed in both repositories (Core 0.54.0).** Lead reruns through the gate:
  - hubs, Netherlands and job board each `"passed":true`, with `matchedRecords` 10/10, 32/32 and 7/7, `modelCalls` 0, `providerCalls` 0 and `externalCalls` 0;
  - read-oracle, read-parity and commands owners `# pass 64 # fail 0`;
  - runner build exit 0, and both audits passed.

  Finishes: Down audit passed; Core contract gate `Tests 70 passed (70)`. Four of five tasks reproduce the oracle's exact table from a run's own recorded reads, through today's production reader and Core's own row sink, result feed and automatic data stage, with 0 model calls:
  - hubs 10/10 (run-mwoq9g4l);
  - earbuds 13/13 (run-mwow1z18), though that run's reads were already narrowed on the page, so it proves processing, not broad collection;
  - job board 7/7 on three runs;
  - Netherlands 32/32 (the saved Flow's four page passes).

  Photo-social is a recording gap: the only surviving store never opened a post. Command: `lab recorded-read SITE --task TASK --input FILE --out FILE` (`read-oracle/`). Core gained a re-export-only subpath, `fluxiq/automation/answer-first-data`. Two admission defects were fixed: equal absent link origin, and a saved Flow's replayed pass admitted on its row labels. Lead decisions on the worker's questions:
  - stored schema labels must not carry page values, and a model alias must not hide the detected site key (t997);
  - in automatic mode, a cell the row's read captured but the item does not show is a definite "not shown", not missing evidence (t993);
  - earbuds' broad collection and photo-social are recording gaps for the paid round to cover.
- **Full sweep of dev 2026-11-23 (Down c61dbf0fa / Core 2dba34613): failures, being fixed forward.**
  - Downstream: check 803/805 (Core build list lacks `cloud`); domain 3150/3164; extension 4145/4149; test-runner 2962/2968; every other package passes; build exit 0.
  - Core: contracts, sdk, cloud, websocket and ui-components all pass. fluxiq `parallel` has 25 failures in 16 files, and `real-sql` has 292 in 69 files, concentrated in Answer First and service bootstrap: 37× a "Run again was refused: you stopped the last run part way" guard, and 19× `stopped_by_person`/`stopped` where `achieved` was expected. apps/web has 2 failures.
- **t991 and t992 integrated and pushed (downstream dev 5ca1a2cea).** All 20 downstream sweep failures are fixed. The shared Core is synced to Core dev 6318fac88.
  - **t991, domain:** one real regression (t982 made a client without the definition capability refuse ordinary reads whole; `definition-fields/admission.ts` now leaves out definition columns that are only retained). 13 tests now follow t982, t989, t968 and t983.
  - **t992:** two test-isolation leaks (a `getComputedStyle` stub and `chrome`), a split panel test, the `--recorded-model` option sentence, and `@fluxiq/cloud` in the full Core build list.
  - Open: the test file that leaks `chrome` before act-mark's watch test is not yet identified.
  - Core defect found by t991 and given to t994: `role-routing/judge-model.ts` falls back to Haiku whatever the Flow's provider, so a DeepSeek-only Flow's result check fails.
- **t993 integrated and pushed (Core 27e8fabc9, contracts 0.23.1, fluxiq 0.54.1).**
  - In automatic processing, a cell the row's own read captured but the item does not show is a definite "not shown": each row carries its batch's `captured` field list, filled by the feed from the page's stored schema. A field a read never captured is still missing evidence.
  - The four result-feed sweep failures are fixed, including `completion/check.ts`: an empty result refuses (use take) before "no retained schema".
  - Lead runs: contracts process 323/323; result-feed and completion 163/163 (parallel) and service 5/5 (real-sql); both checks and both audits pass; job-board proof without a presence test 7/7 with 0 calls.
  - Remaining: the run-dataset store's end-of-run answer still withholds. Its fix is t998 (migration 0041, per-batch captured fields), on the paid round's critical path.
- **t995 F23 diagnosed and closed; its fix moved to t994.** The control was really gone: the saved Flow's stepper Next (`main.s4`) was never pressed on replay.
  - Attempt 1's press answered with a `reads` line, so `act-record/gate/read-answer.ts` called it changed state, and `seed.ts` carried it as `heldOnRepeat` into every later attempt.
  - `run-acts/run-gate.ts` refuses such a press forever, because a replay can never look.
  - Fix, in t994's files: for a press held only by `heldOnRepeat`, the gate looks at the page using the node's recorded effect and admits only on `not_seen`. A risen cart count stays refused, keeping the never-repeat-a-lasting-act rule.
  - The reproduction and report are preserved in `fxwork/recorded-evidence/t995/`. Downstream gained an unbound-refind test (lead 68/68). The campaign note's "calendar control still there" was wrong.
- **t998 integrated and pushed (Core 143d80419, fluxiq 0.54.2).**
  - Migration 0041 stores each batch's captured field ids (`run_dataset_batches.captured_fields_json`) from that batch's own schema. The store's end-of-run answer passes them as `captured`, so it agrees with the feed on not-shown cells.
  - Batches written before 0041 still withhold; nothing is inferred.
  - Lead runs: run-dataset, answer, migration, feed-agreement and result-feed tests: parallel 102/102, real-sql 54/54. fluxiq check and audit pass.
- **t997 integrated and pushed (downstream 1485a34c1).**
  - A stored schema label is now the page's own column words, or the field key for a generated class path, never a first-item value. The model-facing packet is unchanged, and a column the model renames keeps the detected column's stored label.
  - Lead runs: domain structure and plan-resolution 442/442; domain check; read-oracle 10/10; audit. Earbuds mwocg0zw with the rewrite: ready, kept 11, matched 11/11 collected, 0 calls. It is 11/13 overall because the run never read the other 2 records' pages.
  - Remaining: a declaration naming a site key (`brightaisle_plus`) does not bind a page-worded label ("Brightaisle Plus"). Labelling renamed columns with raw keys was rejected, since class paths would become answer headers. Instead, t999 makes Core binding treat `_` and `-` as word separators, in binding only.
- **t996 integrated and pushed (downstream 7b9d9f955).** The S6 preflight now meets each site's own declared person check. The lead reran all four on the dev-synced build, in visible Chrome and provider-free, and each gave `{"protocolPassed":true,"siteChallenge":"passed","gaps":[]}`.
  - Everything-store's `site-challenge.json`: `armedCheck: type-the-characters`, `askInChat: true`, `did: cleared`, `answer: person_done`, `via: chat`, `readSucceeded: true`.
  - Bigbox's `press-and-hold` is declared to lift by itself; the product waits it out (`how: waited_out`), which the lead accepts.
  - Preflight tests 14/14, runner check, audit. Evidence is preserved in `fxwork/recorded-evidence/t996/`.
- **t999 integrated and pushed (Core b7e1de714, contracts 0.23.2).**
  - In binding only, `_` and `-` are word separators (`binding/name-key.ts`), so a declaration naming a site key binds the page-worded column. Cell comparisons are unchanged.
  - The read-oracle hands declarations to Core as written; `model-aliases.ts` is removed.
  - The lead made downstream `stored-labels.ts` fold names the same way, so labels stay unique to Core.
  - Lead runs: contracts process 335/335 (again after merging dev); fluxiq and contracts checks; domain structure and extraction 188/188; read-oracle 8/8; runner check; both audits. Earbuds as written: `ready`, kept 11, matched 11/11 collected, 0 calls (2 of 13 are on pages never read).
- **t994 integrated and pushed (Core fbc0356f6, fluxiq 0.54.3).** Every Core and apps/web failure from the first sweep is fixed.
  - Most failing tests pinned contracts that named commits changed on purpose. For example, the 37 "Run again was refused" errors came from tasks declaring no processing under t984, and t976's start reading shifted the scripted replies. Each updated test cites its commit.
  - Product fixes:
    - t981: a rerun's replaced attempt is withdrawn.
    - A read's own process survives a task declaration (05d61fea4, the t869 class), via the legacy merge rule.
    - F23: the run gate looks at the page for a press carried only by `heldOnRepeat` and admits it only on `not_seen`, including in FluxNode carried runs.
    - The judge and recovery take the Flow's provider's starting model from one `starting-model.ts`.
    - The ladder remnant is removed; the web panel CSS uses tokens.
  - Lead runs on the tree merged with dev 143d80419 + t999:
    - all 85 first-sweep failing files plus the new and neighbouring tests, parallel `Tests  774 passed (774)` and real-sql `Tests  515 passed (515)`;
    - web `Tests  36 passed (36)`;
    - fluxiq and web checks 0 `error TS`;
    - audit passed;
    - Core finish `Tests  70 passed (70)`.
  - Lead decisions on t994's questions:
    - the judged-build call limit 4→5 (the start reading now counts) and W6's column and amendment choices are accepted;
    - the `ask_person`-at-first-catch pin is a regression against the user's 2026-11-19 rule, now t1000;
    - the unthrottled unreadable-judge re-ask (2,399 calls in 90 s on one fixture) is t1000;
    - a timed-out call with no reported usage settles at $0 (`reported=false`). During the paid round the lead counts such calls conservatively in the $50 tally.
- **Running now** (the paid round waits for both; target 2026-11-24 evening):
  - **t1000** (worker-heavy, Core-paired): `ask_person` is offered only after a change_approach, with a stated reason. The judge's repeated unreadable reply goes through loop detection, and each re-ask states the parse failure.
  - **Second full sweep of the day** (worker-light): `fxwork/sweep-20261123b` at Down 9a29b8940 / Core fbc0356f6.
- **Paid round plan** (U8):
  - The ten fixed scoreboard tasks (`scoreboard/fixed-tasks.ts`), easiest first: lens hood, apprentices, Halvard roles, towels, bikes, earbuds, free hubs, Netherlands, August-over-1300, then delete stranger requests.
  - Each task runs `pnpm lab attempt <scenario> --task <id> --authoring-mode answer-first --live-llm --llm-max-cost-usd 5` (default `--attempts 4`), on Haiku, in visible Chrome, on up to four dev-synced lanes.
  - A task starts only while billed spend plus every in-flight task's $5 purse plus its own $5 is at most $50.
  - The round stops at the first balance error. A supervisor watches every run, writes its debug, and reports cost as it happens.
  - **t996** (worker, with its own Core): the preflight exercises the site-declared person checks on everything-store, crossborder, bigbox and company-website.
  - **t997** (worker-heavy): stored labels from the page's column words or the field key; a renamed column's id is the model's name and its label the detected key.
  - t990's finish removed its worktree and the ignored `test-runs/` inputs with it. Lanes that need recorded reads copy them again from the original campaign evidence.
- **Combined P2+P6 (history):** t984 Core e2b1f2635 (worker results: compatibility 195/195, combined 192/192, both checks; product fixes to the processing overlay, live page hand-off, `{process:null}`, P4 memory tolerance and FluxNode pin) was merged with t987 (clean in Core; downstream kept both post-reboot briefs) and with current dev (clean). The combined Core branch now passes the pre-push audit. A worker-heavy agent runs every owner group on the combined tree (`briefs/combined-p2-p6-acceptance.md`). Lead follow-up: the P4 memory tolerance catches any non-integrity store error; narrow it to store I/O failures. A saved Flow replayed under a task with no declaration still acts as a legacy task (P2/P6 design question).

**Post-reboot execution (2026-11-22):** the user restarted and requested tests and all remaining work. The configured 32 GiB initial / 48 GiB maximum page file is active at 32 GiB. Fresh workers processing/t984, judge/t987 and offline/t986 own written post-reboot briefs. P2 combined publication/restart fixture checkpoint 6dcd8bfa0 and P6 credential fixture bf3787ec7 are preserved locally; t987 and t986 received the shared P2/P6 baseline. Processing is adding authoritative source replacement receipts; judge is implementing exact-source recovery and action/witness correspondence; offline capture now forwards authored task-processing criteria. These new changes are not accepted yet. Root fixed the cost-reader union and contradictory metadata/request classification; independent six-owner tests and runner types pass. A stale pre-reboot gate ticket was traced to a PID reused by WebView2 and pruned using process birth/boot evidence. The isolated gate fix passed 47/47 focused tests and 99/99 full tests. Pagefile-aware admission passed 100/100 full tests before and after merge; Merit dev c8a64a1/version0.3.2 is installed and pushed. Product checks resumed normally. One isolated provider-free browser proof reached snapshot evaluation but failed snapshot_unavailable; no browser acceptance or paid run yet.

**Execution active, 2026-11-22.** User asked to assign agents, execute the approved plan, and keep durable progress. This is the plan of record; the paired Core document holds Core acceptance evidence. Worker reports are claims until lead verification.

| Unit | Current state | Next action |
| --- | --- | --- |
| P0 t979 judge recovery | Accepted, integrated and pushed to both dev branches. Lead: 125/125 tests, package check, audit; merge contract gate 70/70. Same-model unreadable recovery and paid receipt preservation. | Covered by subsequent combined checks. |
| P0 t981 repeat-safe repair | Accepted and integrated in both repositories. Lead: 281/281 tests in 16 files, package check (87,253 ms), audit; merge contract gate 70/70. Core 0.50.4. Both dev branches are pushed. | P5 can sync and continue. |
| P0 t976 start-only permission | Worker complete: 170 Core tests, 66 Lab tests, 13 catalog tests, package checks/builds and both audits pass. Lead review fixed gate closure, concurrent startup and plan-refusal abort. Source checkpointed and parent synced; Core 0.50.5; lead 161/161 Core tests, 66/66 Lab tests, 13/13 catalog tests, both package checks, dependency builds and audits passed. Integrated in both repositories; Core merge contract gate 70/70 passed. Both dev branches are pushed. | Accepted together with fixed-model combined checks. |
| P1 t982 retained extraction | Accepted and integrated in both dev branches. Lead:111 retention/storage +69 contracts,218 domain +42 content-reader tests; downstream structure audit passed; Core merge contracts70/70 passed. | Both dev branches pushed; live whole-task acceptance remains separate. |
| P4 t983 fixed task model | Accepted and integrated in both repositories. Lead 140/140 combined tests, typecheck, library build and audit; Core merge contracts 70/70. Core 0.51.0. | P1, P2 and offline-proof lanes synced to accepted permission/P4 parent. |
| P2 t984 automatic processing | Package types pass. Worker receipt owners68/68, source-proof/replay16/16; combined189/191 exposed two corruption fixtures, corrected to the actual persisted envelope. | Compatibility185 tests:77 passed/108 failed; split16 Answer First and15 FluxNode failed owners. Lead initial-write regression fixed and9/9 scope tests pass; final combined acceptance pending. |
| P3 t989 collection guidance | Lead implemented broad safe collection, automatic-processing wording and narrow action selection. Core105 unique owning tests and Down46/46 pass; Core and Down types, both audits and frozen libraries pass. | paired integration and live prompt behavior remain unverified. |
| P5 t985 replay continuity | Bounded F24 fix: lead55/55, Core types and structure audit pass again on accepted P1 parent. F23 remains unproven. | Integrate F24 after the offline snapshot is pinned and mandatory merge gates pass; retain F23 diagnosis and four-attempt proof as open. |
| S1/S2/S6 t986 offline proof | Libraries, domain/runner types, audit/build and206/206 owners passed before P1 downstream sync. Combined P1 rebuild/types and206/206-owner rerun pass (200165.7555ms); extension build passed54363ms. First isolated original-read browser command admitted historical source but returned snapshot_unavailable before parity; sequence stopped for diagnosis. | Proven cause: snapshot runtime stub never answered the production own-page-address query, so content readiness stayed held. Snapshot fix and matching E2E stub fix are written; targeted verification then original-read rerun precede company capture/social preflight. Model calls0; external-call/cost observations null, not zero. Content-harness Everything Store selection passed1/1; historical original-read remains blocked by comparing native absolute links to production-projected canonical relative links. Fresh Company capture reached browser/starting snapshot but no native request: HTTP/service normalized-entry receipt mismatch under diagnosis. No full-task acceptance. |
| P6 t987 smaller judge evidence | Semantic122/122; corrected checkpoint/witness13/13. Composition176/195 exposed missing truthful task-processing declarations and two envelope fixtures; corrected five-owner batch55/55 passed. Request/window batch417/420: three obsolete separate-judge model fixtures corrected under fixed-model policy; final five-owner recovery/window/request batch45/45 passed. Structural corrections passed90/90 plus final types107961ms and audit. Lead13-owner acceptance is queued on frozen source; judge worker now owns disjoint FluxNode fixture repairs. Complete harness request83220->6874 bytes retains both rows; not live cost evidence. Lead found receipt authority must be revalidated after later tuple reuse, including resolved findings reopened from storage. | Finish current-authority regression fix, corrected continuation/request owners, types/build and lead acceptance. Witness correspondence alone cannot clear semantic action gaps. |
| S5 t986 live cost | Reader union and metadata/request classification fixed; worker and lead independently6/6, runner types passed. | Included in combined offline checks; live billed-cost reporting not yet exercised. |
| S7 t988 plan status | Integrated and pushed in both repositories: downstream structure gate and Core 70/70 contracts pass. Older plans retain unresolved work and now point to this plan. | Maintain current state at each milestone. |
| S8 shared heavy gate | Fixed and installed: Merit dev3008788/version0.3.1. Atomic lock retirement and owner-only release; focused8/8 and full96/96 checks passed, including post-merge96/96 and native smoke. | Normal gated work resumed; no admission override. See downstream reports/s8-lock-contention.md. |

**Assignments and records:** written briefs and worker reports live under `docs/working/data-first-simplification-plan/{briefs,reports}/`, in the corresponding paired task tree until merged. Trees are `C:/Users/osrs_/FluxStuff/fxwork/t<id>/!FluxIQWebExtension` and sibling `!FluxIQ`. Lead owns integration, shared docs and git. t984 retainedRows seam 2c4099965 passed lead 25/25 tests, preserves source symbols, is backed up and merged into P1; t985's F24 subset is lead-owned.

**Contract and review decisions:** retained rows reuse JsonObject + RecordSchema/RecordBatch; The Design below fixes semanticType, mark and primaryKey. P1 retains full safe schemas through live/saved/replay paths and reconciles compatible additive schemas explicitly. Identical old-batch retries must preserve ordered rows after schema growth. P2 uses existing processing with one run clock, exact-id/unique-label binding and explicit missing evidence; no guessed filters or second DSL. P4 persists the original model atomically, preserves historical records, and must not treat an invalid stored model as a new task. Shared service/memory/interpreter edits are serialized and synced before acceptance.

**Accepted retained-data boundary (2026-11-22):** P2 exposes full qualifying `retainedRows` from the same selected array before display projection; the lead accepted and merged that minimal seam into P1. P1 internal paging distinguishes collected raw rows and qualifying full rows from public projected views. Migration `0040_run_dataset_exclusions` holds private excluded-field hashes and an answer_rows_retained marker; old projected rows are never guessed into full records. No user database migration/testing is authorized by unit tests.

**Continuation clock decision:** P2 preserves actual runtime-run start/end timestamps. One strictly validated processingReferenceTimeMs is anchored to the first actual session start of the logical attempt, persisted in internal attempt metadata and runtime summary_json, and carried into subsequent segments. Feed, tools and final storage consume that one reference; missing/invalid legacy reference is repairable/unavailable, never silently replaced with current time. No DB migration or public timing-schema change.

**Validation and environment:** no paid calls or completed full FluxIQ sweeps. Core t988's default finish unexpectedly launched pnpm check after 70 passing contracts; lead stopped only that identified owned check during script tests and reran finish with narrow validation. This interrupted sweep is not a pass. Main downstream pre-existing AGENTS.md, .clinerules/fluxiq.md and the untracked language-driven debug note are preserved. S8 is installed and agents resumed normal gated work. The user rebooted after the pagefile increase. OneDrive was measured as small, not diagnosed as leaking, and was not stopped. The earlier cache counter was not proof of a leak. Root corrected the scheduler physical-versus-commit policy as recorded below; no per-job admission override or user process termination.

**Earlier execution checkpoint (2026-11-22).**

- Both dev branches pushed: downstream 93cda7b0d and Core 4ddfe98a5. No main promotion or paid run.
- P1 source checkpointed (Core 3b85dd9d0, downstream ba64bbf1c) and both task trees merged current dev. Worker resumed public schema-parser exports and combined validation; 392 tests in loaded downstream entries passed, but 73/135 entries could not load before that export fix. This is not acceptance.
- P2 lead validation: `pnpm --filter @fluxiq/contracts exec vitest run src/record-sets/process/tests/process-rows.test.ts src/record-sets/process/tests/automatic-processing.test.ts src/record-sets/process/tests/result-operators.test.ts src/record-sets/process/binding/tests/bind.test.ts --maxWorkers=1 --minWorkers=1 --fileParallelism=false` -> 77/77 passed. Independent declaration provenance is implemented; runtime/store integration waits for P1 handoff.
- S8 shared gate on MeritPrompts branch `feat/memory-aware-heavy-gate`: `node --test tests/heavy-slot.test.mjs` through the existing gate -> 24/24 passed, 6.72 seconds. Real crash/child-lifetime fixtures now pass; an earlier fixture lost its child on parent exit and was corrected to launch an owned detached child. Full suite pending. No active-gate replacement.
- Offline proof: worker reports Core wrapper 11 tests, types, audit and library build passing on synced parent; lead acceptance pending. Historical F25 has an open/incomplete trace and missing original-start proof and remains inadmissible for whole-task success. Fresh capture architecture separates source trace archive from pre-entry snapshot.

## Evidence

From the campaign's 28 findings (F0-F27 in the results file) and its results table:

| Theme | Findings | What goes wrong |
| --- | --- | --- |
| Getting the data out of the page | F3, F9, F17, F27; result processing below | The read keeps only the asked columns. The evidence a condition needs ("Easily apply", promoted, the ad marker, the post date) is gone, so nothing can filter on it and the judge flips. Summary panels, iframes and opened-post details do not come out as rows. |
| Saving and replaying the Flow | F4, F5, F12, F18, F23, F24, F26 | The saved Flow is not what ran (a stray Next after the loop). A saved target is gone next time. Repairs are refused at save, so every attempt repairs and pays again. A replay that worked is judged anyway. |
| The judge | F10, F11, F14, F22, F25 | Huge trails of page captures. Sonnet and Opus judges at $0.20-$1.01 each. Malformed JSON-in-a-string replies. |
| Agent loop and chat plumbing | F6, F8, F13, F15, F19, F20, F21 | Mostly fixed overnight. F8 and F11 came from the ladder, F19 from turning thinking off. |
| The Lab itself | F0, F1, F2, F7, F16 | Setup and harness defects, plus a web build that crashes under concurrent load. |

**Result processing (t970), 23 runs after it landed.** 9 runs called it, 43 calls in all. It helped in 2: apprentices and bikes within Alex's price, one filter each.
- In the rest it became trial and error: 15 calls in one run that switched between keeping 3 and 7 of the same rows, and 11 calls in another that kept 2 of 77.
- 6 calls were refused because the column they needed was never kept.
- One dedupe on the wrong key left every job in twice.
- It was never called on the earbuds rerun, which answered 42 unfiltered rows.

Details are in `usable-client-plan.md`, ledger entry "How the campaign used result processing".

## The Design

**Stored-row interface frozen by lead, 2026-11-22 (P1/P2):** reuse existing JsonObject rows and RecordSchema/RecordBatch. Add optional RecordField `semanticType` (text, number, currency, count, date, datetime, url, id, flag) and `mark` (badge, flag, state); `valueType` remains the actual JSON type, and `primaryKey` holds validated identity field ids. Preserve original display values; derive typed comparisons with existing shared pure parsers, anchored to the run reference time for relative dates. W7's parsed column sample is not per-row truth. Retain metadata in live/saved extraction bindings, live-read schema and replay batches. Keep all safe discovered fields, with requested columns solely in process.columns; explicit exclusions remain authoritative. Schema overflow must be explicit, never silently sliced. Implementation is pending in t982; P2 may build against this contract once its schema change lands.

1. **Extraction keeps everything it reads (U3).** A read keeps every field it found on each item, not only the columns the answer asks for. The asked columns are a view over the stored rows, not a filter at read time. Storage is the fields' values, never raw page captures.
2. **The model collects broadly (U4).** The build's guidance tells the model to read the items and fields the task may need: more pages, nearby items, every column the page offers. It also says the data layer removes bad and repeated rows afterwards, so over-collecting is fine and under-collecting is not. The words stay generic: they never mirror a realistic scenario's site, task or answer (AGENTS.md, "Model guidance never teaches to the test").
3. **One plain data stage (U2).** It runs after every attempt and replay, without the model asking:
   - remove duplicates (L2);
   - apply the task's conditions to the stored fields (L3);
   - order the rows;
   - shape the asked table.

   It is deterministic, so a replay that read the same rows gets the same answer with zero calls. It records what it removed and why, which the judge sees (2026-11-19 rule). The model is asked only for what the data cannot answer.
4. **The framework does the heavy lifting (U5).** It does whatever can be computed exactly:
   - removing duplicates;
   - page marks (ad, sponsored, promoted);
   - parsed dates, prices and counts;
   - paging;
   - ordering;
   - table shape;
   - row identity;
   - re-finding a target by identity.

   Much of this is already designed in `framework-heavy-lifting-plan.md` W7 (CC1 typed fields, CC2 marks, CC3 row identity). Whether W7 was built has not been checked.
5. **One model per task (U1).** Build, repairs, later attempts and judge stay on the starting model, Haiku (U6, U7). Remove `escalate_model` from the loop decision, and stop offering `ask_person` only once "the ladder has climbed".

## Lead's Suggestions

These are the lead's, from the campaign evidence, approved by the user on 2026-11-20 ("yes for everything").

- **L1. Rows keep their marks, identity and typed values.** A badge or flag on an item is a field: "Sponsored", "Promoted", an ad link. So are the item's own link and the parsed form of each date, price and count. Then "leave out the ads" and "newest first" are lookups, not model work. This is W7's CC1-CC3.
- **L2. Duplicates are removed by row identity.** Identity is the item's own link, or the key columns re-find already uses. Tracking parameters are ignored. Duplicates are removed first, always, never by hand and never by a key the model guesses.
- **L3. Conditions are stated once and applied by the framework.** The task's conditions are turned into the data stage's filter once, from the instruction. The model sees the result and what each condition removed. If a condition needs a field no row has, the stage names the missing field, so the read gets fixed. The filter is never guessed again. This replaces the model iterating on `core.set_result_processing`.
- **L4. Reads that are not lists.**
  - A label/value panel (a checkout summary) becomes one row whose columns are its labels (F27).
  - A frame on the page is read like the page.
  - Details that show only on an opened item are read by the Flow's loop over items, and stored with the item's identity.
- **L5. Replays keep their repairs.**
  - A repair that worked is saved into the Flow. F26: refuse a breaking edit where it is made (t981's design). F23: find out why repairs never reached the saved step.
  - Stray steps after a loop are not saved (F4).
  - A replay whose steps succeeded, automatic retries included, and whose result held stands without a judge. This must stay within the "one judged whole run as it finally stands" rule (F24, which needs its diagnosis).
  - A replay resumes after a person-only check is cleared (F18).
- **L6. A smaller judge.** The judge reads the stored rows, what the data stage removed and why, and a short trail, not page captures. It gets one readable reply format (F25). It is asked only where the rules require one.
- **L7. Spending discipline.**
  - No paid run until a fix passes, without a provider, on the recorded run of the task that failed (the 2026-11-03 simulation rule).
  - Stop paying for a task once the same failure recurs, and fix it provider-free first.
  - Report each run's cost as it happens.
- **L8. The machine's memory gate.** `fxwork/.heavy-slots/heavy-slot.mjs` admits a heavy step whenever 2.5 GB are free at that moment. It should admit by the step's own need and the system's commit headroom: the web build crashed three times beside another heavy job (F1). OneDrive's sync service leaked to 24.8 GB on 11-17 and 11-20. Our repositories are outside its folders, so the cause is OneDrive itself. When it leaks, agents kill it fully, without asking and without restarting it (user, 2026-11-20: "regarding onedrive, next time just fully kill it").
- **L9. Settle the work left in flight.** For each of t976, t979 and t981, the user decides whether to finish it or set it aside. t979's judge climb (`judgeRungsUp`) comes out under U1 either way.

## Phases

Each phase is proven without a provider before the next. The acceptance for P1-P3 is the campaign's own recorded reads: earbuds, free-shipping hubs, Netherlands data engineers, remote jobs and photo-social. Run with the same inputs and zero model calls, the stored rows must give the oracle's exact table.

- **P0. Finish the three fixes in flight** (U7): t981, t979 without its climb, and t976. Merge each as it passes.
- **P1. Extraction keeps every column, mark, identity and typed value (U3, L1).** First find exactly where a read drops undeclared columns (F3 says Core notes it). Then check W7's state, and build what is missing. Domain and extension: the read. Core: the stored rows.
- **P2. The data stage (U2, L2, L3).** Automatic removal of duplicates, conditions from the instruction applied to stored fields, order and shape, plus what was removed and why. Replace the model-iterated processing tool, or reduce it to stating the conditions once.
- **P3. Guidance to collect broadly (U4).** Generic words, checked against the "never teaches to the test" rule.
- **P4. Remove the ladder (U1).** Core's role routing (t962 `laddered`), the loop decision's `escalate_model` (t962, t969), the `ask_person` condition, and t979's climb.
- **P5. Replays keep their repairs (L5).** F26, then F23, F4, F18 and F24, each diagnosed first from its recorded run.
- **P6. A smaller judge (L6).**
- **P7. A small supervised live round**, approved up to $50 absolute max (U8). Only tasks whose fix passed provider-free, with each run's cost reported as it happens.

## Systemic Changes For The Week

These are the lead's, 2026-11-20. The user's bottom line: "we seriously NEED this to be working well by next week", so that the rest of the month goes to deploying and other fixes. Each item names the waste it removes.

- **S1. Prove every fix without paying.** Re-run a failed live run offline: its recorded pages, and its recorded model replies up to the first point the fix changes behaviour. That re-run is the fix's acceptance.
  - Waste removed: the campaign paid to learn whether each fix worked, rerunning photo-social 3 times ($11.82) and saturday-certificate twice ($10).
  - Builds on the trace and offline-trial work in `trace-offline-trials-plan.md` (paused 10-19; tier 1 offline trials exist, offline trials inside builds do not) and on the step logs, which already hold every provider request and reply.
  - This is the user's 2026-11-03 rule ("simulation ... with EXACTLY same inputs as real exploration calls recorded") made the standard path.
- **S2. One fixed scoreboard of ten tasks, easiest that nearly works first.** One task per site. The six that already got 4/4 right reach SUCCESS first: Mk II sellers, lens hood, apprentices, Halvard roles, towels, bikes within Alex's price. They need only the replay and judge fixes. The hard tasks follow.
  - Waste removed: hardest-first put most of the spend on runs that could not pass yet.
  - The scoreboard runs provider-free every day and shows each task's SUCCESS, calls and cost per attempt.
- **S3. The campaign's recorded runs become a regression gate.** A merge that touches the build, replay, data or judge re-runs the affected recorded runs offline (narrow, by import graph).
  - Three of the night's findings came from its own changes (F8 and F11 from the ladder, F19 from turning thinking off), and F26 may have come from t975.
  - Any change to prompts or model settings also gets a one-cent live smoke: the chat starting each site's task on the starting model. F19 would have shown on the first chat.
- **S4. Fewer, larger changes, merged in rounds.** Last night merged about 20 tasks one by one. Each merge moved `dev`, and the lanes waited to resync and rebuild. Merge twice a day, with the lanes rebuilt once per round. This reasserts the existing rule that live lanes merge in rounds.
- **S5. Cost visible as it happens, by stage.** Each attempt reports its decisions, repairs and judge calls in dollars as it runs, not only in interim reports. The campaign supervisor does not launch a task whose known blocker is still open.
- **S6. A provider-free preflight per site before any paid round:** pairing, the chat starting the task, a person check answered, a permission answered, one read. 10 campaign failures were plumbing, and 4 runs were lost to the Lab's own watchdog.
- **S7. One plan of record, with a current Current State.** This session spent its first hour rebuilding the state. `usable-client-plan.md`'s Current State dates from 11-18, and the real state sat in the ledger of a 540-line document; the index lists 22 Active documents. This document is the plan of record for the week. The lead rewrites its Current State at every milestone, and pauses the Active documents that are not this week's work.
- **S8. The machine** (L8): the heavy gate admits by need and commit headroom, OneDrive is killed when it leaks, and parallel agents stay within what two heavy slots can serve.
- **S9. The starting model is Haiku, for build and judge** (approved, U7). With no ladder, the starting model sets both cost and capability.
  - The campaign's runs that stayed on Haiku and got going cost $0.24-$0.76 each. Lens hood was right 4/4 for $0.58, on Haiku apart from one climb on its last attempt.
  - The lead recommends Haiku for build and judge, measured on the scoreboard.
- **S10. `main` catches up.** `main` has not moved since 11-11: 460 extension and 356 Core commits behind `dev`. Run a full sweep once the week's changes land, then promote.

## Next Session

Read Current State first; every unit it lists as integrated is done and verified, so do not reopen it. Check the heavy-slot holders and queue (`heavy-slot.mjs status`) before scheduling checks, and never disturb another lane's validation tree.

1. If t1000 is still running or unmerged: verify its report by rerunning its tests, then finish it in both repositories (downstream first, then Core with `--skip-checks`), merging Core dev first when the finish says it is behind.
2. Read sweep 2's report (`scratchpad/sweep2/` of the 11-23 session, or rerun it). Fix any failure forward on a task branch before paying.
3. The paid round: sync four lane trees to dev (both repositories), rebuild them, and dispatch one supervisor with the brief in "Paid round" above. Track spend against the $50 ceiling yourself, from the ledger.
4. After the round: diagnose each failure from its recorded run (S1), prove its fix offline, then rerun only what changed. Then a full sweep, and promote `main` by fast-forward (AGENTS.md).

Lead owns shared-state updates, exact observed acceptance, commits, pushes and paired integration.

## Work Ledger

### 2026-11-24 - t1000 integrated (fluxiq 0.54.4); sweep 2 clean of test failures; paid round started
- Changed:
  - t1000 finished in both repositories. The lead also aligned `refused-words.ts` (ask_person only once offered), `failure-control.md` and a stale ladder comment.
  - The shared Core was synced to 5dfde039c.
  - Paid lanes t1001-t1004 were created at af360c487.
  - The paid round supervisor was dispatched.
  - t1005 (check build order) was started; it merges after the round.
- Validation: lead runs through the gate on t1000:
  - parallel `Test Files  343 passed (343)`, `Tests  3011 passed (3011)`;
  - real-sql `Tests  107 passed (107)`;
  - fluxiq check 0 `error TS`; audit passed; Core finish `Tests  70 passed (70)`.
- Sweep 2 (worker, logs `scratchpad/sweep2/`): Core fluxiq parallel `Tests 20257 passed | 6 skipped` and real-sql `Tests 3241 passed | 1 skipped`; apps/web `4384 passed`; downstream every package `# fail 0`; builds exit 0. Down `pnpm check` exit 1 with 35 `error TS` (missing subpath declarations in a fresh tree).
- Follow-up: the round's per-task results; t1005 after the round.

### 2026-11-23 - t994 integrated (fluxiq 0.54.3); t1000 and the second sweep started
- Changed:
  - t994 finished in both repositories, after the lead committed its team's work (113 files), merged Core dev and kept 0.54.3 over dev's 0.54.2.
  - t1000 started with a brief.
  - Sweep worktrees `fxwork/sweep-20261123b` were created at current dev.
- Validation: lead runs through the gate on the merged t994 tree:
  - vitest-groups parallel `Test Files  61 passed (61)`, `Tests  774 passed (774)`;
  - real-sql `Test Files  76 passed (76)`, `Tests  515 passed (515)`;
  - web `Tests  36 passed (36)`;
  - fluxiq and web checks 0 `error TS`;
  - audit `passed (570 warning(s), 903 baselined)`;
  - finishes: Down audit passed; Core `Tests  70 passed (70)`.
- Follow-up: t1000; sweep 2; then the paid round.

### 2026-11-23 - t996 and t999 (contracts 0.23.2) integrated
- Changed:
  - t996 finished downstream, the preflight's site challenge. Its empty Core branch was abandoned with 0 unmerged.
  - t999 finished in both repositories. Its Core branch was merged with dev 143d80419 first, after a finish refused it as behind.
  - The lead added the downstream `stored-labels.ts` fold and its test on t999.
- Validation: lead runs through the gate:
  - t996: preflight `# tests 14 # pass 14 # fail 0`; runner check `0` `error TS`; audit passed; four `offline-preflight` runs each `{"protocolPassed":true,"siteChallenge":"passed","gaps":[]}`.
  - t999: contracts `Tests  335 passed (335)` (before and after the dev merge); contracts, fluxiq, domain and runner checks exit 0; domain `# tests 188 # pass 188 # fail 0`; read-oracle `# pass 8 # fail 0`; Core and Down audits passed; earbuds `"state": "ready"`, `matchedRecords` 11, `modelCalls` 0.
  - Finishes: Down audits passed; Core `Tests  70 passed (70)`.
- Follow-up: t994; then the paid round.

### 2026-11-23 - t998 (fluxiq 0.54.2) and t997 integrated; t999 started
- Changed:
  - t998 finished in both repositories: migration 0041 and the store's captured fields.
  - t997 finished downstream: stored labels without page values.
  - The shared Core was synced to 143d80419 when t997's finish refused on the lagging Core.
  - t999 was started and handed to the t997 worker. Its downstream tree got dev 1485a34c1.
  - Both t996 trees got dev.
- Validation: lead runs through the gate:
  - t998: vitest-groups parallel `Tests  102 passed (102)` and real-sql `Tests  54 passed (54)`; fluxiq check exit 0; audit passed; Core finish `Tests  70 passed (70)`.
  - t997: domain `# tests 442 # pass 442 # fail 0`; domain check exit 0; read-oracle `# pass 10 # fail 0`; audit `passed (259 warning(s), 551 baselined)`.
  - t997 earbuds proof (runterms): `"state": "ready"`, `kept` 11, `matchedRecords` 11, `expectedInCollected` 11, `modelCalls` 0. It exits 1 only because 2 of the 13 expected records are on pages the recording never read.
- Follow-up: t996 lead preflights; t999; t994; then the paid round.

### 2026-11-23 - t993 integrated (fluxiq 0.54.1); F23 diagnosed; t998 started
- Changed:
  - t993 finished in both repositories.
  - t995 finished downstream (test and report). Its empty Core branch was abandoned with 0 unmerged.
  - F23's fix was given to t994.
  - t998 started with a brief and handed to the t993 worker.
  - Evidence that later lanes need is preserved outside the repositories in `fxwork/recorded-evidence/{t993,t995}/`, because a finish removes the worktree's ignored `test-runs/`.
- Validation: lead runs through the gate:
  - t993: contracts `Tests  323 passed (323)`; feed and completion parallel `Tests  163 passed (163)`; service real-sql `Tests  5 passed (5)`; contracts and fluxiq checks exit 0; Core and Down audits passed; libraries exit 0; job-board proof `"passed": true`, `matchedRecords` 7, `modelCalls` 0.
  - t995: domain target-reacquire `# tests 68 # pass 68 # fail 0`; audit passed.
  - Finishes: Down audits passed; Core t993 contract gate `Tests  70 passed (70)`.
- Follow-up: t994 (including F23), t996, t997 and t998; then the paid round.

### 2026-11-23 - t991 and t992 integrated; t995-t997 started
- Changed: t991 (domain sweep failures, old-client definition admission, retained-extraction doc) and t992 (extension, test-runner, Core build list) finished into dev and were pushed. The shared Core was synced to 6318fac88. t995 F23, t996 person-check preflight and t997 schema labels were started with written briefs.
- Validation: lead runs through the gate:
  - t991: affected `# tests 65 # pass 65 # fail 0`; importers `# tests 200 # pass 200 # fail 0`; domain check exit 0; audit passed.
  - t992: scripts `# pass 12 # fail 0`; extension `# tests 101 # pass 101 # fail 0`; runner build exit 0; lab-attempt-command `# pass 6 # fail 0`; extension check exit 0; audit passed.
  - Finishes: both `"validation":{"passed":true}`.
- Follow-up: t993-t997 results; the paid round after all of them land.

### 2026-11-23 - t990 integrated as Core 0.54.0
- Changed: t990 finished in both repositories. The downstream branch carries the `lab recorded-read --task` oracle mode and two admission fixes. Core adds the re-export-only subpath `fluxiq/automation/answer-first-data`, plus the version. Both t993 trees were moved to the new dev for its proof step.
- Validation: lead runs through the gate:
  - `node scripts/lab/run-lab.mjs recorded-read crossborder-marketplace --task crossborder-marketplace-free-hubs-under-ten …` → `{"passed":true,"phase":"done","gap":null}`, `matchedRecords` 10, `modelCalls` 0;
  - the same for professional-network Netherlands (from44) → 32/32 and job-board remote (mwov5v61) → 7/7;
  - owners `# tests 64 # pass 64 # fail 0`;
  - Down audit `passed (258 warning(s), 551 baselined)` and Core audit `passed (569 warning(s), 903 baselined)`;
  - finishes: Down audit passed; Core `Tests 70 passed (70)`.
- Follow-up: earbuds' broad collection and photo-social are recording gaps for the paid round; t995 schema labels; t993 absent-cell semantics.

### 2026-11-23 - Full sweep results; t990 worker result; four fix lanes dispatched
- Changed: the shared Core `fxwork/!FluxIQ` was synced from cc1230032 to 2dba34613 via `pnpm task sync-core --allow-running` from the t353 sibling, moved to origin/dev. Tasks started: t991 sweep-fix-domain, t992 sweep-fix-extension-runner, t993 absent-cell-semantics (Core-paired) and t994 sweep-fix-core (Core-paired). Each has a written brief in its own tree.
- Validation: sweep step logs read by the lead from `scratchpad/sweep/`:
  - downstream check `# fail 1` (core-build.test.mjs:122);
  - domain `# pass 3150 # fail 14`;
  - extension 4 "not ok";
  - test-runner 1 "not ok";
  - Down build exit 0;
  - Core fluxiq `Tests  25 failed | 20207 passed` (parallel) and `Tests  292 failed | 2944 passed` (real-sql);
  - apps/web `Tests  2 failed | 4382 passed`.
- Worker claims, not yet lead-run: t990's four passes and photo-social's recording gap (report `reports/t990-recorded-oracle.md` in the t990 tree).
- Follow-up: lead verification of t990, then its finish; the four lanes' results; t995 after t991.

### 2026-11-23 - t986 integrated as Core 0.53.1; t990 and full sweep started
- Changed: t986 finished in both repositories (offline proof harness, trace-replay host-stream fixes, commandId hidden from the model, probe instruction). t990 started with `pnpm task start recorded-oracle-acceptance --worktree --core --skip-workspace-build`. Sweep worktrees `fxwork/sweep-20261123` were created at dev. A first attempt created them inside each repository through a relative `git -C` path; the lead removed them with `git worktree remove`, removed the empty folders and recreated them with absolute paths.
- Validation: lead runs through the gate on dev-synced t986: Core trace 15 files `Tests 68 passed (68)`; fluxiq:check `inputs changed` exit 0; Core audit exit 0; Core libraries exit 0; domain check exit 0; domain owners `# pass 645 # fail 0`; runner build and check exit 0; runner owners `# pass 206 # fail 0`; Down audit `passed (258 warning(s), 551 baselined)`. Finishes: Down audit passed; Core `Tests 70 passed (70)`.
- Follow-up: t990 results; sweep results, fixed forward; then the paid round's readiness.

### 2026-11-23 - P2+P6 integrated as Core 0.53.0; shared Core synced; t986 zero-call replay
- Changed: t984 (with t987 merged in) was finished in both repositories, and t987 was abandoned with 0 unmerged. Core was bumped to 0.53.0. The shared fxwork Core moved to cc1230032. t986 commits: Core 869523fdb and 92cd31a39 (session binding by event kind and stream), Down 9685157f6 (commandId hidden from the model) and a9e601d68 (probe instruction, visible sandbox).
- Validation: lead read the raw Vitest logs in `t984/!FluxIQ/node_modules/.cache/t984-combined/`. p2-compat 37 files 195/195; p2-combined 24/192; p6-authority 7/77; semantic 25/255; checkpoint 14/112; composition 20/196; requests 46/420. The type logs have 0 `error TS`. Domain judge-evidence `# pass 125 # fail 0`. Down audit `passed (258 warning(s), 551 baselined)`. `pnpm task finish t984` (Down) audit passed; `pnpm task finish t984 --skip-checks` (Core) `Tests 70 passed (70)`. `pnpm task sync-core --allow-running` reports behind 143 -> shared Core at cc1230032, 0 behind. The lead read result files: `report-original-six-rerun2.json` parityPassed true, gaps []; capture-company-v2 complete true, hostRefusal null; preflight-social-v2 protocolPassed true; replay-company-v5 status ran, gaps [], normalizations [].
- Follow-up: the parity-report host-stream fix, then finish t986. A recorded-run oracle acceptance tool for the campaign tasks. The P4 memory tolerance should be narrowed to store I/O. Saved Flows should carry their declaration. Site-declared person checks are `not_run` on four sites. F23 diagnosis remains open.

### 2026-11-23 - Handover, t985 and t989 integrated, P6 own work accepted pending P2
- Changed: Codex's notes and lane work were committed (dev and task-branch checkpoints). t985 and t989 were finished in both repositories. t989 fix ec6d2517b removes the "tab" substring from Core prose and pins the new site-filter sentence. Core is at 0.52.2. t987 worker commits are Core 0c11fe752 and Down be6a5b08f. t986 worker commit is e5ed50e0e.
- Validation: lead runs. t985 `vitest run` with 5 owners -> 55/55. `pnpm --filter fluxiq check` -> exit 0. t989 `vitest run` with 11 owners -> 215/215 after the fix (2 failures before it). `node scripts/test-domain.mjs extract-list/tests/catalog-text system-instructions/tests/instructions` -> 24/24. Core check -> exit 0. The Down domain check refused a stale Core build until `scripts/build-cache/cli.mjs ... fluxiq:build ...` ran, then exit 0. Finishes: Down audit passed, Core contract gate 70/70 for each.
- Worker claims, not yet lead-run (the lead reviewed the diffs): t987 owner groups 77/77, 255/255, 112/112, 420/420. Composition 160/196, failing only on missing P2 declarations. Downstream 125/125. t986 runner owners 26/26, domain owners 15/15. Both branches pass the pre-push audit.
- Follow-up: t984 acceptance, then merge t987 into t984 for combined checks. Lead re-verification of t986 on synced dev, then its browser proofs. Sync the shared `fxwork/!FluxIQ`, 76+ commits behind Core dev.

### 2026-11-22 - Combined checks and isolated browser startup diagnosis
- Changed: current status reconciled; P3 guidance scoped checks pass and paired task branches are pushed. Bounded F24 source/types/audit pass and paired task branches are pushed; neither is integrated yet while the offline lane holds its parent snapshot.
- Validation: `pnpm --filter @fluxiq-web-extension/domain check` on t989 -> exit0, current Core guard passed,41619ms. `node scripts/structure-audit.mjs` on t985 Core -> exit0,564 warnings/904 baseline. Exact owning commands and earlier results remain in task reports.
- Validation: t986 combined30-owner command ->206/206,200165.7555ms; extension build ->exit0,54363ms. `node scripts/lab/run-lab.mjs recorded-read everything-store --input test-runs/t986-read-parity/input.json --out test-runs/t986-read-parity/report-original-six.json` ->sourceVerified:true, then snapshot_unavailable before parity. Model calls0; external calls/cost null, not zero. Company/social commands were not launched.
- Cause and fix: sandbox stub omitted the production own-page-address reply, so own-document readiness remained unconfirmed. Worker owns snapshot stub/tests; lead owns matching content E2E stub. Guard unchanged; both return truthful empty application addresses for isolated harnesses. Targeted verification/rerun pending; failed report preserved.
- Validation: P6 worker final five-owner batch ->45/45,79.05s; package types ->exit0,91522ms; structure audit ->33 violations, scoped corrections required. Lead13-owner job was withdrawn normally while still FIFO queued, exit1 with no tests run, to avoid testing an obsolete snapshot. Worker full request fixture measures83220->6874 bytes with both rows retained; not live billing evidence.
- Follow-up: finish P2 compatibility/root-cause fixes, P6 structure corrections and lead acceptance, then browser proofs and paired integration. No paid call or completed full FluxIQ sweep.

### 2026-11-22 ? source recovery checks and collection guidance
- Changed: retained extraction plus working records pushed to Down dev dad71ce84 and Core dev eea5c80bc. P2 sourceProof checkpoint5187c81bc merged into P6; semantic checkpoints read current producer authority without re-evaluating data processing. Minimal Core compilation fixes bd431f6e4/c17d0ea19 synced into offline lane.
- Validation (worker, lead combined verification pending): P2 receipt owners68/68; corrected replay/sourceProof owners16/16,72.78s; P6 projector8/8; recovery batch34/35 then corrected checkpoint/witness13/13,63.92s. Replay fixtures had invalid missing reset/effect facts; supported historical omission remains separately tested. P6's failed fixture used sent rather than read packet; no action-success assertion was weakened.
- Validation: offline corrected dependency build passed, including fluxiq149,741ms, gateway6,680ms, UI18,065ms. Down domain build38,904ms and runner types36,961ms passed. Audit then found only statement-packing in the cost reader; root formatting correction bb9f896ae is refrozen for audit rerun.
- Changed: lead owns paired t989 broad-collection-guidance with written brief/report. Core answer-first.3 and conditional automatic-processing prose; Down web-14 requires live paging now and preserves build-only behavior; catalog explains retained fields versus answer view. Core/down owning tests queued; explicit producer-based prompt-pin regeneration added. Preparation's fluxiq build detected overlapping source edits and refused its stamp, so it is not accepted compilation; frozen validation follows final source.
- Not verified: P2/P6 full affected types/owner batches, P3 prompt checks, offline browser commands, four-attempt live task acceptance. No paid calls.

### 2026-11-22 ? retained extraction integrated; product checks resumed
- Validation: first downstream finish refused before mutation because task Core lacked newer dev documentation. Root merged only those docs and `node scripts/structure-audit.mjs --rule working-docs` passed (12 baselined); no product change required repeated source suites.
- Validation: `pnpm task finish t982` -> downstream structure audit passed, merged25300d3ea and removed downstream task worktree. `pnpm task finish t982 --skip-checks` in Core -> mandatory contract gate70/70 passed,17.48s, merged to dev; full sweep deliberately not repeated. Prior narrow package acceptance is recorded above.
- Validation: lead `node --test --test-concurrency=1 test-runs/t986-post-reboot-validation/cost-observer/tests/progress.test.js` ->6/6 passed,185.8699ms. Source was compiled independently with strict exact-optional TypeScript by offline worker.
- Findings: offline combined dependency build passed contracts/SDK then failed four Core type boundaries. Minimal alias/optional-privacy/screen-input corrections checkpointed and synced; rerun active. Processing worker receipt owners68/68 passed; judge projector8/8 passed (claims pending lead combined verification). Processing's four replay-observation tests failed because target observations were absent; cause investigation active, not presumed fixture-only.

### 2026-11-22 ? pagefile-aware scheduler correction
- Cause: after reboot about 35 GiB of Windows commit capacity remained free, but the scheduler required every estimated job peak plus its reserve to fit free physical RAM. The larger pagefile could not help admission. This is an agent-authored scheduler restriction, not evidence of Windows allocation failure or a user requirement to preserve that restriction.
- Decision: under the user's request to resume tests using the larger pagefile, lead revised admission to reserve full estimated peaks against system commit capacity while retaining the 1 GiB available-RAM floor, two slots, FIFO, fresh telemetry, process containment and conservative active reservations. No job-specific override, process kill or runtime state reset.
- Validation: pure policy probe `node --test --test-name-pattern "pagefile|commit pressure|non-atomic|concurrent admissions|two holders|empty machine" tests/heavy-slot.test.mjs` -> 6/6 passed. Candidate full `npm test` ->99/100; a real-process serialization fixture used physical pressure, so the fixture was changed to commit pressure while preserving its exact no-overlap assertion. Corrected full `npm test` ->100/100 passed,47,677 ms, exit0; integration rechecks ->100/100 on branch (50,276 ms) and100/100 on dev (56,281 ms). Merit dev c8a64a1 pushed; installer reported nothing to change, shared wrapper imports updated source directly. Previous ticket-only fix passed99/99.
- Changed: P2 producer receipt checkpoint7c0080394 plus current-only sourceRefs correction61a978799 merged into judge task. P6 incomplete helpers checkpointed before this merge; run-attempt composition ownership handed to judge. These checkpoints are not acceptance.

### 2026-11-22 ? resume after user reboot
- Changed: refreshed worker assignments and task checkpoints above; machine-local queue recovery uses proven process identity rather than killing the unrelated browser process. Memory thresholds and user applications are unchanged.
- Validation: `heavy-slot.mjs run gate-process-reuse-verify -- node --test tests/heavy-slot.test.mjs` -> 47 passed, 0 failed, 21,859 ms. Durable log is machine-local `.heavy-slots/gate-process-reuse-verify.log`. The prior focused run was 46/47 because missing boot telemetry in an existing mock caused a conversion failure; optional telemetry handling was corrected. A subsequent result was lost, so acceptance was rerun with a durable log.
- Not verified: new processing/judge/capture work, browser behavior, paid campaign and full Flux sweeps. Earlier pre-reboot queued sessions are not results. Source checkpoints and new documentation remain local pending gated backup.

### 2026-11-22 - Execution resumed with three workers
- Assignments: task-local briefs resume-processing.md (t984), resume-judge.md (t987), resume-offline.md (t986). Existing workers explicitly restarted; lead owns git and cost observer. No paid or browser launch authorized by the briefs before required checks and coordination.
- Changed: t986 Receipt now has separate pending and unreadable variants; behavior unchanged, validation pending. P2 frozen60-file source checkpointbc49b850f; P6 merge6faae9260 resolves record/store/keep/carry conflicts additively, preserving both publication tracking and judge checkpoint/recovery metadata. Shared ending/run-attempt paths inspected too.
- Validation: P2 pre-merge and resolved-tree `git diff --check` -> exit0. No combined runtime pass inferred from merge. Recovered worker audit21451 -> exit1, six remaining violations (five test-placement, two existing as-never occurrences under one file finding); full original stdout not archived, exact failure excerpt recorded in worker report.
- Next: P2 layout/typed-fixture correction and combined compatibility/store tests; P6 corrected projector test then exact producer-backed source/action recovery; t986 corrected runner check and named owners, then isolated browser proof. Main documents and task branches require final gated backup/integration after observed checks.

### 2026-11-22 - Full status reconciliation after worker handoffs
- Validation: `heavy-slot.mjs status` -> holders=[], queue=[]; physical available3,539,939,328 bytes at inspection. `write_stdin` for former audit21451 -> Unknown process id; no audit pass inferred. Agent states are completed/Partial.
- P2 worker observed33-file baseline214/216; targeted corrections34/34; contracts50/50+typecheck; publication restart2/2 and keep1/1. A real saved-writer precedence defect caused repeated unproven Flow digests/judge calls; canonical recordOutput now follows actual step.settings precedence while preserving ranWith. Final targeted writer/chat/FluxNode8/8 passed, including first+3 provider-free zero-call replays/full safe retained cells. Lead has not independently accepted latest source. Package types failed11 diagnostics: ten fixture fixes written, P6 optional-privacy interface sync still required. Structure initially failed31 violations; corrections written, later result unknown.35 compatibility owners and final builds remain.
- P6 first batch98/100; both failures were new all-letter credential fixtures outside the existing mixed-letter/digit screen contract. Only fixtures corrected; rerun pending. Historical projection gaps can still remain required forever after repair: exact authoritative source replacement receipts and action witness associations are required before acceptance. Synthetic summary size measurements are not live cost or complete provider-request proof.
- t986 runner types failed on four lead-owned reader.ts diagnostics (pending/unreadable union not narrowed before stage/usd access). No browser/capture/preflight followed. Historical F25 remains an open/incomplete trace, not full-task proof.
- Repository state: main dev working plan was stale and is corrected by this entry. Both main dev branches have local documentation commits not pushed; latest P2 source and P6 fixture/report changes are uncommitted in task worktrees. Earlier P0/P4 integration remains pushed. No full FluxIQ sweep completed, main promotion, live browser test or paid call in this execution.

### 2026-11-22 - Provenance and judge checkpoint review
- Frozen validation checkpoint: P6 Core607deb863 records durable issue receipts, actual verified recoveredAtRevision, immediate/reopened resolution facts, restored-owner refusal and presence/window/cache-prefix tests. Root merged P20706d1d97 as4c7f57661; shared run-attempt change preserves both metadata paths and adds restored.evidence forwarding. `git diff --check` -> exit0; runtime checks unrun. Down reports checkpointed P2b11b08900, t986f6968a290 and P68271a2263. These and latest main documentation commits remain local pending gated backup.
- Required next corrections after first owner tests: P6 historical projection-gap resolution by exact source/proof; P2 pending publication retirement across shutdown/restart. P2 traced ending.ts catching retirement failure then saving missing-readiness/no rows; carry may lose tracked publication IDs. Proposed narrow seam persists exact private pending IDs and remaps via actual copy receipts, never scans dataset prefixes. This is an open acceptance gap, not accepted behavior. No more dependent source changes until current owner baseline is observed.
- Update: P2 confirmed crossed-pair matching and vacuous missing-identity matching; corrected both in local 0706d1d97, with exact-source, unknown-source and checkpoint/reopen regression cases. `git diff --check` -> exit 0; runtime tests remain unrun. Truly opaque old dataset refs lack persisted original graph/locator provenance and stay explicitly unknown; no guessed mapping or new terminal condition. P6 recovery is approved only for exact original-source reprojection or authoritative P2 replacement proof; actions require actual Core-owned witness/step association. Lead also caught restored checkpoints incorrectly receiving source-owner authority; worker is correcting issuance to new uninterrupted journals and testing the actual reopen path.
- Validation: direct raw working-doc rule probe reported pre-existing size findings (exit 1, baseline not applied); canonical `node scripts/structure-audit.mjs --rule working-docs` -> passed, 0 warnings/2 baselined. Generated index refreshed through its owning update function.
- Changed: P2 local checkpoint 8c50dc21c carries actual invalid-row counts, dataset association, replay completion receipts and shared input-identifier parity. P6 local cb8f0419a makes checkpoint revisions monotonic and compares full semantic metadata on equal revision. These are source checkpoints, not acceptance.
- Review: independent old listKey/where set checks may admit crossed collection pairs. Assigned an exact tuple/source-association regression and diagnosis to P2 before acceptance; no speculative opaque dataset-id restriction.
- Decision: P6 records rejected checkpoint coverage as a private factual issue with a Core-issued opaque receipt. Only the same uninterrupted complete-source owner may clear that exact issue after a successful newer complete snapshot. Restart, higher revision or an unrelated read is insufficient. Each rejection rotates the receipt; no model reset flag. Metadata-only rejection may persist only this issue while preserving prior evidence and task/P2 fields.
- Remaining: historical projection gaps currently aggregate permanently. P6 must propose and test exact source/current-proof resolution without hiding history or treating uncertain actions as successful. Own-property invalid-version handling and request-window fixtures are written but unrun.
- Validation: `heavy-slot.mjs status` -> no holders; t986 types then t984 runtime tests queued; physical available 1,976,164,352 bytes. No admission override, browser run or paid call. Latest local source and documentation commits await gated remote backup.

### 2026-11-22 - Source checkpoints and remaining acceptance gaps
- Validation: read-only `Get-Process` ->svchost PID13904 working3582MiB/private3588MiB; `Get-CimInstance Win32_Service -Filter 'ProcessId = 13904'` ->defragsvc, Optimize drives, Running/Manual. This is a new instance of the earlier memory-heavy service. User asked asynchronously to pause it with administrator PowerShell or let it finish; no new service stop/override attempted. Fresh gate status succeeded; isolated stale telemetry was not established as another gate defect.
- t986 corrected fixture boundary/discovery checkpointef07032e5 is local, unvalidated/unpushed. P2 restart correction additionally preserves actual optional datasetId on result pages; copied chunk keys cannot replace original source identity. Verification reads existing batch invalid_count/node_id; contradictory or unrepresented aggregate failures retain dataset-scoped holds. Fresh replacement must update actual dataset mapping. Two successive copy/checkpoint/reopen cycles and partial reread tests required. No new database column or guessed association.
- P6 coherent source checkpoint Core284eb77ba then mode sync303f7d75f; Downd63bdae78. Root review found same-length stale save could regress witnesses: approved required monotonic internal revision for unreleased checkpointv1, exact equal-revision semantic equality, preserve actual task/P2 fields on metadata conflict. Correction/tests underway; no P6 validation.
- Input-name discovery confirmed public goal identifiers allow uppercase/underscore and >32 chars, while draft/processing bindings wrongly narrow them. Approved shared neutral contracts identifier rule and owning parser/refusal/tests, preserving case/current own-input membership/item context reservation. Existing secret policy and arbitrary schema keys remain unchanged. Report is t986 reports/input-name-boundary-intake.md; P2 implements the bounded common correction.
- Invalid-source recovery implementation approved: optional exact invalidCount on existing read/page evidence, strict persisted parsing and existing dataset count/answer readiness; actual forward-walk callIds bind a fresh collection receipt. Whole supersession requires known genuine start/end coverage and safe current schemas/count0 for every contributing group; unrelated/partial/prior-invocation rows cannot clear a hold. Existing first-page producer was traced to page1/offset0, opaque starts stay unknown. P2 cancelled only its unstarted test ticket (exit1,no validators) to apply these confirmed corrections; no limit shortcut without proof.
- New P2 read-only integrity finding: row validation drops invalid originals and reports invalidCount, but automatic feed ignores the count and can accept the remaining subset. Lead requires exact persisted source-validation provenance and repairable readiness until that source is actually replaced; no fabricated rejected rows/schema weakening. Minimal seam proposal/regressions pending, no acceptance claim. Mode response seam now checkpointc1f42f283;35 existing compatibility owners are queued after first22 new/runtime owners.
- P2 corrected Core source checkpoint05d61fea4 contains current-input/schema/dispatch guards and automatic runtime; acceptance pending. P6 Core checkpointcf5160993 then merged P2 cleanly as81d96341c; lead confirmed shared replay files preserve both metadata and input-validation hunks. Next P6 fixes: explicit judgeEvidenceVersion:1 capability (legacy untagged behavior preserved), mixed action+data witnesses, unmatched-look source coverage, actual production/restart tests. New-format missing projector/current privacy policy must fail closed, never raw-fallback.
- P3 emitted-context gap: approved core.result processingMode automatic/legacy from existing declaration presence, preserving result text. Missing-first and action-only N/A are automatic; tool/stamp absence is not a mode detector. P2 owns this minimal response seam/test before P3 generic prose changes.
- Validation: lead extraction domain owners ->218/218, reader owners ->42/42; post-sync Core `node scripts/structure-audit.mjs` ->passed,564 warnings/904 baseline. Both task branches synced latest documentation-only dev changes. Down final correction731b2b601 remains unmerged pending finish; main working records committed Downfb1ef2d45/Coreb3e399a3d.
- P6 Down WIP449434406 checkpointed and accepted P1 branch synced. Review then removed unrelated hidden-leaf notices and container text masquerading as control names; actual alert/status/output messages and named hidden controls remain. New regressions not yet run.
- t986 Down WIP4acb250fe plus EOFe3b5b9d3e checkpointed. Exact/slash-descendant fixture URL fix now written after review caught sibling-prefix acceptance; corrected types waiting. Historical traces remain unchanged and open F25 is not whole-task evidence.
- P2 confirmed/fixed missing-schema validation and caller-object binding injection; saved-flow preflight moved into existing best-effort before dispatch. Saved draft routing is flat, so later routed reads are preflighted before earlier lasting acts; no invented nested representation. Corrected explicit owner tests waiting, no runtime acceptance yet.
- Validation: shared gate status ->no holders; corrected t986 types first, P2 tests second, insufficient physical headroom. Root withdrew only its3 unstarted backup/finish sessions by normal Ctrl+C (each exit1, no git/validator started), reducing idle footprint. No queue override, user process stop, browser or paid run. New task checkpoints above are local pending backups; previous pushes remain intact.
- S3 follow-up accepted as design only: pre/post import reach union including paired exports/assets; proof classes raw transport, original read, recorded build, four-attempt task; missing applicable capture blocks; --skip-checks cannot bypass; unaffected receipt requires complete zero-impact graph. Implementation remains after t986 acceptance.

### 2026-11-22 - Gate installed, extraction acceptance and real FluxNode bindings
- Validation: `node apps/extension/scripts/test-extension.mjs content/extraction/tests/list-reader/tests` ->42/42 passed,29,138.4118ms, exit0; domain focused command ->218/218, exit0. Initial working-document audit refused this entry for missing a dedicated Validation bullet; corrected here before retry.
- S8 lock fix installed/pushed Merit dev3008788. Validation: `npm test` ->96/96 isolated,96/96 finish branch,96/96 merged parent; native git smoke exit0. Full details in downstream reports/s8-lock-contention.md. Earlier service question no longer blocks work; no service stopped or memory override used.
- Lead extraction output was lost at context compaction, so closed sessions were not treated as observed passes. Repeated with durable ignored logs. Validation: domain owning suite (extract-list, record-schema, extraction, detect and record filters) ->218/218 passed,7,477.9219ms. Reader suite also passed42/42,29,138.4118ms, exit0.
- P2 real FluxNode dynamic conditions must retain explicit caller-input bindings across attempts. A common neutral validator must reject missing/current-invalid inputs before engine and forward replay resolution can use first-run fallback examples. Constants remain constants; no literal-equality lifting. Same-spec changed-date continuation is required.
- P6 flow-stage/span metadata edits are frozen for serial P2 guard integration. Full retained safe schema stays distinct from display columns; unknown current privacy policy never becomes an empty policy. Semantic control facts must survive actual publisher/declared-state/end-witness composition.
- t986 refreshed Core libraries, types and audit pass; wrapper owners and downstream combined checks pending. No browser or paid run launched.

### 2026-11-22 - Memory admission recovered and lock regression passed
- Validation: gated `node --test --test-name-pattern 'lock|ownership|concurrent admissions' tests/heavy-slot.test.mjs` in isolated Merit fix ->8/8 passed,8,458.7401ms, including open prior reader and400 increments across four processes. No override; actual memory recovered enough for admission. Fix branchdc731ce pushed as backup; active source not yet replaced.
- Validation: gated `node scripts/structure-audit.mjs --rule working-docs --update` ->passed in both main checkouts; downstream551/Core907 baseline entries unchanged, indexes refreshed. Current implementation decisions/briefs remain distinct from runtime acceptance.
- Follow-up: shared-tool full/merge checks and quiet installation, then restart final P1 and t986 dependency checks. P2/P6 and fresh scripted declarations continue independently.

### 2026-11-22 - Quiet gate diagnosis and independent source corrections
- Coordination: workers cancelled four P1 and one P2 owned pre-admission sessions normally; each exited1 without validator output. Gate status then showed holders[]/queue[]. No active command or paid run interrupted; no lock/ticket manually removed.
- Changed: isolated Merit worktree .claude/worktrees/fix-heavy-lock-contention, branch fix/heavy-lock-contention, prepares rename-before-delete lock retirement and removes contender cleanup reads. New tests keep a prior reader open across ownership transfer and exercise400 increments in four independent processes. Active launcher/source are unchanged; tests have not run.
- Validation: `git diff --check` in that isolated worktree -> exit0. Gated `node --test --test-name-pattern 'lock|ownership|concurrent admissions' tests/heavy-slot.test.mjs` -> queued, insufficient physical headroom; root exec99191. Microsoft DeleteFile documentation confirms pending deletion can deny new opens; reproducing the observed race remains required.
- Decision: P2 runtime freeze lifted to fix acknowledged missing-page and strict metadata defects before checks; only model-input stamp refusal in evidence-loop-decision.ts is handed to P2, not P3 prose. Framework-issued persisted stamps remain allowed.
- Decision: real FluxNode entry calls generation directly and has no chat interpretation. P2 may resolve only its still-missing first semantic declaration through the existing evidence loop: explicit process:null plus why for genuinely action-only work, or schema-backed data criteria after capture. Existing declared conditions cannot be erased; no extra interpretation call, heuristic N/A or blanket fixture default. Real FluxNode completion/persistence/replay tests are required.
- Decision: P6 cannot use ephemeral symbols as its only semantic source: spread/clone/persistence lose them. Worker proposes versioned screened semantic checkpoint/source references and final current-policy rescreening. Disjoint call-chain/flow-stage/flow-run helpers approved; attempt-store/keep/ending/carry-on/run-attempt remain P2-owned until serial handoff.
- Checkpoint: t987 Core helpers committedc0244a44d, then accepted P1/current dev synced cleanly to5eb0e2975. Staged diff check passed; no P6 behavior/types/build validation. Root review also requires unknown current privacy policy to stay explicit on reopening durable findings, never default to no exclusions.
- Checkpoint: isolated Merit fix commitdc731ce (version0.3.1) remains unverified/uninstalled; its backup push exec63800 queues behind owning regression exec99191. All thresholds/FIFO remain unchanged.
- Assignment: t986 worker updates only fresh scripted model replies/owning tests with truthful per-task process declarations under briefs/t986-processing-fixtures.md; historical replies, task wording, oracles and generic guidance stay unchanged.
- Follow-up: gate regression/correction, requeue final P1 checks and t986 libraries, corrected P2 acceptance; no paid call, browser launch, full-sweep pass or main promotion.

### 2026-11-22 - Shared gate contention failure before build admission
- Failure: t986-synced-core-libraries exited1 with EPERM opening .heavy-slots/v2/admission.lock before obtaining a slot. No library build ran, so this is not a Core product test failure or acceptance. Its ticket was removed; five other tickets remained and holders were empty.
- Investigation: tools/heavy-slot/state.mjs readJson tolerates disappearance (ENOENT) but propagates EPERM; the mutex repeatedly links, reads and unlinks admission.lock across processes. Windows read/delete contention is a hypothesis, not yet reproduced or fixed. Do not remove a live lock, alter reservations or claim a passing rerun.
- Validation: `node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs status` -> no holders, five queued checks, physical available1,831,096,320 bytes. Source inspection only; no gate source changed.
- Coordination: all three workers hold new heavy submissions; existing five tickets remain untouched and independent source work continues. Actual drive-optimization process still holds about3.7GB; prior normal stop denied and asynchronous user question remains pending.
- Follow-up: reproduce/correct the mutex error safely, validate its owner/collision behavior, then requeue the failed build without overriding FIFO or memory requirements.

### 2026-11-22 - Exact evidence contracts and remaining regression gate
- Decision: read parity binds the original producer's exact metadata.callId/source/domain/project, the hashed canonical run entry and the scenario/task/snapshot origin. A recursive matching string or self-declared synthetic flag is insufficient. Valid current record schema is required for contract parity; raw row equality is reported separately. Network leakage or unavailable observation is explicit, never reported as zero external activity.
- Decision: P6 semantic projection occurs before legacy trail bookkeeping stripping, preserving actual UUID/date/number values. Actual semantic gaps use existing unsure/model_unconfirmed and meaningful-read continuation; deliberate capture omission with complete rows/effects remains eligible for acceptance. No invented Flow-failure verdict or terminal outcome.
- Finding: S3 discovery found no existing affected-recording merge gate. Generic pre/post import reach belongs in Core, while admitted recording registry, artifact proofs and replay dispatch stay downstream. Open F25 trace proves at most its exact read boundary; no full-task fixture is invented from it. Implementation and complete captures remain pending.
- Review: P2 clears missing-original restoration state on any added read and its new persistence reader relies on a helper that validates only part of the evidence bundle. Worker acknowledged both; new disjoint regressions will require exact missing-page resolution and full typed metadata validation before source corrections after the frozen snapshot. These are open findings, not fixed/tested claims.
- Preparation: P3 collection-guidance brief records obsolete optional-processing and deferred-paging prose, preserves narrow action-row selection, and names disjoint Core/web owners. No P3 source edited or task dispatched yet.
- Validation: `node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs status` -> no holders, six queued checks, physical available 1,900,220,416 bytes; no check admitted or bypassed. Source review only for these decisions; no browser/model execution.
- Follow-up: P1 final checks, P2 runtime and retained-schema regression, P6 independent helpers, t986 exact reader proof and S5 owning tests; persist final acceptance before integration.

### 2026-11-22 - Offline unit checkpoint and processing/judge ownership decisions
- Changed: t986 Core wrapper checkpointd3954767d, accepted P1 source and current dev synced; downstream offline/preflight/scoreboard/capture/read-parity and root cost observer checkpoint14a645262, EOF normalizationb649e9536. Task-branch work is not merged/accepted; combined checks queue behind physical headroom.
- Validation: git diff --cached --check surfaced seven new-file EOF blank-line issues after staging; subsequent targeted EOF cleanup and git diff --check passed. No tests/types/audit run on the new combined snapshot yet. Earlier worker checks remain explicitly historical.
- Decision: P6 exact domain-neutral projector and caller paths approved; shared service.ts/run-attempt.ts remain P2-owned. Separate semantic-gap verdict hold uses existing unsure/repair semantics; intentional raw-capture omission alone must not block complete rows/proven effects. Protect original evidence from callback mutation and preserve real UUID/date/number row values through privacy screening.
- Decision: P2 may persist exact validated pending resultEvidence/provenance in the latest internal attempt row (not checkpoint history), retain validated empty source schemas, and retire only tracked same-attempt publications on missing readiness. No guessed preview/source, no raw-capture deletion, no second selection pass or new terminal failure.
- Follow-up: P2/P6 implementation and focused acceptance, S3 import-graph regression intake, t986 combined validation. No paid run or browser acceptance.

### 2026-11-22 - Gate installed and exact-read replay briefed
- Changed: S8 integrated in MeritPrompts and quiet compatibility launcher installed; detailed exact checks and limitations in reports/s8-lead-acceptance.md. Paired S7/current-state pushes completed (Core4966e2aed, downstream4e36d4531); newer briefs/reports are checkpointed locally pending gated backup.
- Validation: old gate status ->holders[]/queue[] immediately before atomic replacement; installed native git-version run ->exit0; following status ->holders[]/queue[] with physical and commit telemetry. No active reservations migrated. User's existing edits preserved.
- Changed: t986-read-parity.md directs original action89/result96/artifact90 replay and exact canonical read0012 row comparison. Original callId, commandId and artifact digest are directly correlated; full open trace remains inadmissible. t986 Core wrapper checkpointd3954767d then synced accepted P1 source/current dev; dependency rebuild and lead combined checks pending.
- Decision: P2 new-task omission is missing processing, not legacy/N/A; explicit null is N/A, process:{} is a valid empty declaration. Preserve real runtime timestamps and one persisted processing reference across continuation; exact additional attempt-store/carry-on ownership approved and recorded by worker.
- Outcome: S8 done; P1 final metadata fixture assertion and extension checks pending; P2/P6/offline implementation continues. Actual memory pressure can delay validators; no paid calls or browser acceptance.

### 2026-11-22 - Shared gate independently accepted; documentation reconciled
- Validation: MeritPrompts `npm test` through unchanged machine gate -> 94/94 passed, no skips/failures, 50.03 seconds. Final lead correction removes unproven arbitrary batch forwarding (which loses empty arguments); known package-manager native entries remain supported. `node install.mjs --apply` -> nothing to change. Source committed 59341fc; active gate not replaced.
- Validation: downstream `node scripts/structure-audit.mjs --rule working-docs --update` -> exit 0, baseline unchanged 551. Core t988 narrow finish -> mandatory 70/70 contracts passed, merge completed. Initial default finish started pnpm check; lead terminated its verified owned process tree during script tests, observed exit 1/no merge, verified all named check/launcher processes gone, then used --skip-checks with prior working-doc audit and contract acceptance. No full-suite pass claimed.
- Outcome: S7 integrated in both repositories; S8 source accepted, deployment pending. P1 actual-reader tests 2/2 passed; focused domain tests 104/105, remaining mark fixture uses an unsupported text-read flag and needs an attribute fixture correction. Domain test helper also needs a wider field-spec annotation; extension typecheck needs missing private declaration builds. Product source remains frozen.
- Follow-up: paired dev backup and S8 branch integration; P1 corrections/acceptance, P2 runtime, P6 intake, exact historical source correlation.

### 2026-11-22 - Retained-data acceptance and refreshed lane handoffs
- Agent: Senior supervisor.
- Changed: current state and next-session handoff; P1 versions contracts 0.23.0 / fluxiq 0.52.0; P2 synced to accepted Core retention source. p0_permission returns to automatic runtime after its S8 source endpoint; p0_repair has P6 intake available while downstream validators run.
- Validation: P1 `pnpm --filter fluxiq exec vitest run` on the 14 named retention/store/rows/public-export owners -> 111/111 passed, 148.97 seconds; contracts nine schema/record owners -> 69/69 passed, 4.89 seconds. Exact paths remain in t982 report and paired acceptance record. Versioned five-library `pnpm --workspace-concurrency=1 --filter @fluxiq/contracts --filter @fluxiq/sdk --filter fluxiq --filter @fluxiq/client-gateway-websocket --filter @fluxiq/ui-components build` -> exit 0.
- Validation: `pnpm task finish t988` downstream -> structure gate passed and merge completed; Core finish queued. Archive preservation check -> all five archived originals differ only by rebased relative links; angle/reference-relative link scan -> zero unhandled matches in all five.
- Outcome: Core retained-data interface accepted; downstream task not yet accepted. Broad downstream 930/954 passing result and its 24 failures remain recorded, not replaced with an all-pass claim. New actual-reader tests compare absent/present/negated row membership and selected-key dedupe against the prior narrow read.
- Follow-up: downstream focused acceptance, Core S7 integration, independent S8 suite and quiet deployment, P2 runtime and P6 implementation. No paid runs or full FluxIQ sweeps.

### 2026-11-22 - Repeat repair integrated after lead acceptance
- Agent: Senior supervisor.
- Changed: t981 merged in both repositories; Current State rewritten around current assignments and accepted results, removing superseded intake snapshots.
- Validation: `pnpm task finish t981` downstream -> audit passed, merged and worktree removed. Core `pnpm task finish t981 --skip-checks` -> mandatory contract gate 70/70 passed, merged and branch detached/deleted. Independent 281 tests/typecheck/audit recorded in paired Core ledger.
- Outcome: Accepted for t981; whole plan remains active. No paid/full-sweep claim.
- Follow-up: paired dev push, t976 acceptance, P1/P4/P2/P5 and offline proof.


### 2026-11-22 - Judge integrated; extraction and fixed-model lanes active
- Agent: Senior supervisor.
- Changed: t979 integrated in both repositories; t982 extraction and t983 fixed-model implementation assigned. t981 repair source/report checkpointed and parent-synced for lead acceptance.
- Validation: `pnpm task finish t979` downstream -> structure audit passed, merged, worktree removed. `pnpm task finish t979 --skip-checks` in Core -> mandatory contract gate 70/70 passed, merged; focused lead tests/typecheck/audit are recorded in the paired Core ledger. No full suite skipped as acceptance: narrow gates are repository policy.
- Outcome: Partial: judge unit accepted; complete data-first plan still in progress.
- Follow-up: independently validate repair, resolve permission review, complete P1/P4 and provider-free acceptance infrastructure before paid proof.


### 2026-11-22 — P0 workers resumed with written briefs
- Agent: Senior supervisor.
- Changed: Current State, paired Core record and briefs for t976, t979 and t981.
- Why: the user requested agents and durable progress; interrupted changes must be verified before the later lanes.
- Validation: `git status --short` in all three paired task trees -> interrupted Core changes present in all three, Lab changes in t976; prior reports read. No new product acceptance yet.
- Outcome: Partial.
- Follow-up: workers complete scoped fixes; lead verifies and integrates, then establishes the stored-row contract.

### 2026-11-20 — Plan written from the campaign and the user's decisions

- Agent: Senior supervisor.
- Changed: this document (new).
- Why: the user asked for their suggestions and the lead's to be written down after the campaign ended with 0 SUCCESS.
- Validation: not validated: a written plan. Its figures come from the campaign's results table (cost, model and note columns read with awk) and from the step logs' result-processing calls (`processing-calls.mjs`; usable-client-plan.md, 2026-11-20 entries). No code ran.
- Outcome: Accepted.
- Follow-up: P0 with the user.

### 2026-11-20 — Systemic changes and the next session laid out

- Agent: Senior supervisor.
- Changed: this document: "Systemic Changes For The Week" (S1-S10), "Next Session" (lanes and the week), Current State, Open Questions.
- Why: the user asked for anything else that would make everything run smoother, with this working well by next week, and for the next session's systemic changes laid out.
- Validation: not validated: a plan. Checked while writing:
  - `trace-offline-trials-plan.md` is Paused, with tier-1 offline trials built and offline trials inside builds not built;
  - the Lab has a scripted provider (`packages/test-runner/src/demo-llm-*.ts`);
  - `main` is 460 (extension) and 356 (Core) commits behind `dev` (`git rev-list --count origin/main..origin/dev`);
  - the Haiku run costs come from the results table.
- Outcome: Accepted.
- Follow-up: the user's answers to the Open Questions, then "Next Session".

### 2026-11-20 — The user approves the plan; the three fixes go first

- Agent: Senior supervisor.
- Changed:
  - this document: Status, Current State (U6-U8, the three fixes in plain words), Design 5, the suggestions' approval, P0, P7, S9, Next Session step 1, days 1 and 4, Open Questions;
  - AGENTS.md: "No model ladder" now records the judge on the same model and Haiku as the starting model;
  - `usable-client-plan.md`: Current State points here.
- Why: the user said "yes for everything", "if they are important then obviously fix them first", "YES judge stays on same model so we dont burn credits", and, of the day-4 round, "and on any budget". They also asked what the day-4 question meant: it asked whether a paid round could run and on what budget, because the credits are spent.
- Validation: not validated: plan and rule text only.
- Outcome: Accepted.
- Follow-up: next session, "Next Session" step 1.

### 2026-11-20 — The day-4 round is limited to $50

- Agent: Senior supervisor.
- Changed: this document: Status detail, U8, P7, day 4, Open Questions.
- Why: the user: "Lets try and limit budget to $50 absolute max though for that". This replaces "any budget" for the day-4 round. Lead's reading, the safer one: the $50 covers the week's paid runs together, day 4 and the day-5 rerun. The lead's enforcement is to start a task only while spend so far plus its $5 purse is at most $50.
- Validation: not validated: plan text only.
- Outcome: Accepted.
- Follow-up: none.

## Open Questions

- Answered by the user, 2026-11-20:
  - finish the three fixes first (U7);
  - the judge stays on the same model (U6);
  - the day-4 round runs up to $50 absolute max (U8);
  - Haiku is the starting model (U7).

  Nothing is open for the user.
- **Lead:** how much of S1 (re-running a recorded run offline with its recorded model replies) the paused trace and offline-trial work already gives. Answer on day 1 in lane 5.
- **Lead:** what does keeping every column cost per run? Fields only, never page captures. Measure it on the recorded campaign reads in P1.
- **Lead:** is `framework-heavy-lifting-plan.md` W7 built, and if so, why did the campaign's rows lack marks and dates? Answer in P1.

### 2026-11-22: provenance accepted; retained-data handoff and gate lifetime checks

- Changed: P1 public schema exports checkpointed as Core d5cccca16; P1 frozen source merged into both P2 task trees. P2 provenance checkpoint 8c86122d0; downstream report 453389dc3. Shared gate ownership correction brief committed; worker p0_permission owns containment/telemetry lifecycle temporarily, without changing active machine gate.
- Validation: `pnpm --filter @fluxiq/contracts exec vitest run src/record-sets/process/tests/processing-declaration.test.ts src/record-sets/process/tests/automatic-processing.test.ts src/record-sets/process/binding/tests/bind.test.ts --maxWorkers=1 --minWorkers=1 --fileParallelism=false` -> 79/79 passed, 2.10 s. `npm test` in MeritPrompts -> initial 75/76; diagnostic rerun after synchronous-launch cleanup 77/77, 53.97 s. Initial failure detail was truncated and its cause is not asserted. `node --test tests/heavy-slot.test.mjs` after npm/npx native launcher fixes -> 27/27 passed, 8.54 s. All used the existing heavy gate.
- Review: queued telemetry could still block child completion, and unsampled surviving grandchildren require owned process-tree containment. Worker is correcting those before deployment. No active gate replacement or threshold bypass.
- Pending: lead P1 retention validation and downstream checks; P2 runtime readiness/clock/feed integration; P5 F24 typecheck passed (100,501 ms), audit queued, broader F23 proof gap remains. No paid calls or full FluxIQ sweep.
