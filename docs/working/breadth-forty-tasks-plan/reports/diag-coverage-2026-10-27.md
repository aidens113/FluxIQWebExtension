# diag-coverage, 2026-10-27

## Outcome
Done (read-only). Map of all 40 breadth tasks, owed reruns, round 6, per-site next candidates and the MVP items still unproven.

## How to read the table
Run ids come from `C:/Users/osrs_/FluxStuff/lab-slots/spend-ledger.jsonl` `finish` events (latest per task), cross-read with
the hub (`docs/working/breadth-forty-tasks-plan.md`). "Ledger passed" is not "accepted": the hub accepts a task only with an exact oracle match,
reported pass AND a zero-call replay. Evidence for a pass is `C:/Users/osrs_/FluxStuff/lab-runs/<date>/<runId>/` (`evaluation.json`);
for a failure it is `docs/working/language-driven-flow-loop-plan/debugs/<runId>.md` (abbreviated `debugs/` below). Per-site task
descriptions: `docs/working/breadth-forty-tasks-plan/reports/tasks-<site>.md`; provider-free audits: `reports/audit-<site>.md`
(every one of the 40 was audited; "audited only" below means no live run exists).

Hub is stale in two places: its table names older latest-failed run ids for office, job-save, photo-newest-likes and
recent-group-posts. The ledger's latest are round 5 (2026-10-21 03:01-03:18 UTC): office `run-mvhibit5-e1d3a4f3`, job-save `run-mvhibk0z-1950493f`,
photo-newest-likes `run-mvhibis0-b536958b`, social recent-group-posts `run-mvhibis1-d570b37d`. All four have debugs/ notes.

## The 40 tasks (site | task | status | latest evidence)

| Site | Task | Status | Latest evidence |
| --- | --- | --- | --- |
| everything-store | coupon-earbuds-rated-four | accepted | run-mvcvzwd3-32f53329 (2026-10-17), lab-runs/2026-10-17 |
| everything-store | batteries-and-descaler | accepted | run-mvcws1l9-f43e197f (2026-10-17) |
| everything-store | sage-small-kettle-if-in-stock | accepted | run-mvcx106k-2c9e375d (2026-10-17) |
| everything-store | office-checkout-review | failed, 5 live rounds | run-mvhibit5-e1d3a4f3, debugs/run-mvhibit5-e1d3a4f3.md |
| bigbox-retail | rated-delivery-towels | accepted | run-mvdf5nlp-4878758e (2026-10-18; two earlier fails mvd8ypsv, mvddx6wf) |
| bigbox-retail | napkins-for-delivery | audited only | audit-bigbox-retail.md |
| bigbox-retail | checkout-quote-without-ordering | audited only | audit-bigbox-retail.md |
| bigbox-retail | new-store-cheapest-towels | audited only | audit-bigbox-retail.md |
| local-classifieds | nearby-furniture | accepted | run-mvebbnwm-47169b0d (2026-10-18) |
| local-classifieds | test-ride-question (send) | failed (once) | run-mvd9nlx5-1373850d, debugs/ same name; hub: price-check's unconditional send correctly blocked |
| local-classifieds | carbon-price-check | failed (once) | run-mveaglx4-22f23baf, debugs/ same name |
| local-classifieds | bikes-within-alex-price | audited only | audit-local-classifieds.md |
| crossborder-marketplace | free-hubs-under-ten | accepted | run-mvdism0y-ba67f226 (2026-10-18; ledger passed; replay was initially silently skipped, hub lists as accepted) |
| crossborder-marketplace | follow-official-store | audited only | audit-crossborder-marketplace.md |
| crossborder-marketplace | mint-hub-fallback | audited only | same |
| crossborder-marketplace | uk-express-quote | audited only | same |
| auction-marketplace | lens-hood-seller-shop | accepted 2026-10-19 | run-mvecxd6w-ed72a1ca; zero-call replay replay-mvfllkon-e7a35190 (hub ledger) |
| auction-marketplace | cheap-accessory-auctions | failed 3x | run-mvdi0946-d897f3cb, debugs/ same name |
| auction-marketplace | buy-it-now-quote | failed (once) | run-mveba82m-fd0616dc (reported pass, own-record oracle failed), debugs/ same name |
| auction-marketplace | save-mark-ii-sellers | audited only | audit-auction-marketplace.md |
| social-network-feed | delete-stranger-requests (delete) | accepted | run-mvd1j7jt-0c12a50c (2026-10-17) |
| social-network-feed | recent-group-posts | failed 5 live rounds (+3 earlier) | run-mvhibis1-d570b37d, debugs/ same name |
| social-network-feed | hide-suggested-posts | failed once; OWED rerun | run-mvd0qwhi-5f7dbf80, debugs/ same name |
| social-network-feed | claim-found-key (send) | audited only | audit-social-network-feed.md |
| photo-social | priya-tags | failed (90 calls) | run-mvebbeom-a60886e1, debugs/ same name |
| photo-social | newest-likes | failed 5 live rounds | run-mvhibis0-b536958b, debugs/ same name |
| photo-social | august-over-1300 | failed (once) | run-mvdi88yz-e444d594, debugs/ same name. Audit calls its right answer an empty table; the 2026-10-17 positive-data rule retires that, so the task needs revision before another run (see photo below) |
| photo-social | kiln-notes | audited only | audit-photo-social.md (creates a private collection, then reads collection tiles; expected dataset nonempty) |
| job-board | remote-easy-apply | accepted | run-mvcw0qct-0f4257a5 (2026-10-17) |
| job-board | halvard-careers-roles | accepted | run-mvczav2x-b9c5dafc (2026-10-17) |
| job-board | save-quillmark-remote | failed 4 live rounds | run-mvhibk0z-1950493f, debugs/ same name |
| job-board | halvard-labs-office-jobs | OWED rerun | run-mvdgaz8z-27ff3d1b (ledger "passed" exit 0 but NOT accepted), debugs/ same name; earlier fail run-mvcwqwec-0aa4f98b |
| company-website | apprentices | accepted | run-mvdes30x-65848f60 (2026-10-18; goal replay 0 provider calls) |
| company-website | newsletter-signup | audited only | audit-company-website.md |
| company-website | saturday-certificate | audited only | same |
| company-website | heat-pump-quote (send, hand-off) | audited only | same |
| professional-network | kade-lead-contact | accepted | run-mvdi9e8u-678c35df (2026-10-18; 1 record / 2 fields; zero-call replay ran) |
| professional-network | netherlands-data-engineers | audited only | audit-professional-network.md |
| professional-network | connect-kade-senior-engineer (send) | audited only | same |
| professional-network | accept-messaged-invitations | audited only | same |

Counts: 12 accepted (matches the hub) + 10 failed (office, test-ride, carbon, cheap-accessory, buy-it-now, recent-group, priya, newest-likes, august, save-quillmark; four of them are round-6 tasks) + 2 owed reruns (halvard-labs, hide-suggested) + 16 audited only (bigbox 3, local 1, crossborder 3, auction 1, social 1, photo 1, company 3, professional 3) = 40. Note hide-suggested is also a failed live run, so "owed" and "failed" overlap in the table.

## Owed reruns named in the plan

1. job-board `halvard-labs-office-jobs`. Run `run-mvdgaz8z-27ff3d1b` (2026-10-18 06:47) ended launcher exit 1: the oracle matched the then-expected EMPTY table, but the reported verdict and result verification were unverified (final judges answersRequest unknown/no, confidence 0.4/0.6), and the requested replay never ran (empty `snapshots/repair-lane.json` replays). The user's 2026-10-17 positive-data rule retired the empty-result allowance. The task's expected dataset has since been revised: `apps/scenario-lab/src/scenarios/job-board/breadth/halvard-labs-office-jobs/expected.ts` now expects exactly 1 record (Workplace Systems Engineer, Halvard Labs, Hybrid (Manchester)) and a saved-jobs final state. So the old run proves nothing about the revised task; a fresh e2e run is owed. A separate structural cause (selected-card-only field paths chosen over stable full-coverage ones) was fixed after the run. Caveat: I did not diff the instruction text itself.
2. social-network-feed `hide-suggested-posts`. Only run `run-mvd0qwhi-5f7dbf80` (2026-10-17) failed, no Flow created: a row-bound "Hide post" click resolved on pass 1 and was `web.target.ambiguous` on pass 2, because hiding replaces the article's children with an Undo bar (`scenarios/social-network-feed/client/unit-script.ts:100-105`). Owed because the row-bound identity fixes (t719 F2 and later) were meant to cure exactly this shape and the archived plan says the rerun "must prove prior row-bound fix"; it was queued behind recent-group-posts and never launched. Not run since.

## Round 6 (the four tasks, launch shape)
Source: `docs/working/trace-offline-trials-plan/reports/handoff-2026-10-20.md` "Running the next live round (round 6)" and A8 Run Plan, `automation-project-agents-plan.md` line 282 onward.

| Slot | Lane tree | Scenario | Task | Prior state |
| --- | --- | --- | --- | --- |
| 1 | t563 | everything-store | everything-store-office-checkout-review | failed rounds 1-5; last run-mvhibit5-e1d3a4f3 |
| 2 | t719 | job-board | job-board-save-quillmark-remote | last run-mvhibk0z-1950493f; round 5 was furthest yet |
| 3 | t566 | social-network-feed | social-network-feed-recent-group-posts | last run-mvhibis1-d570b37d |
| 4 | t567 | photo-social | photo-social-newest-likes | last run-mvhibis0-b536958b |

Command shape (from the downstream tree of each lane, headed, supervised, one attempt each, stop at first balance error, fresh workspace names; the log's live-guard line must read `"state":"admitted"`):

```
export FLUXIQ_TEST_TARGET=persistent-isolated FLUXIQ_DEMO_HEADLESS=false FLUXIQ_LAB_INSTANCE=rr6-slot-<N>
export FLUXIQ_LAB_CORE_BRANCH="$(git -C ../!FluxIQ branch --show-current)" FLUXIQ_LLM_RUN_COST_CEILING_USD=0.25
pnpm lab run <scenario> --live-llm --llm-profile lab-create-flow --llm-provider deepseek --llm-model deepseek-flash \
  --authoring-mode project --llm-task create-flow --instruction-task <task> --target persistent-isolated \
  --workspace <fresh workspace> --model-reset-only --replays 1 --llm-max-cost-usd 0.25 --llm-max-calls 250 \
  --llm-max-run-tokens 48000000
```
Round-5 workspaces were `claude-office-checkout-t563-20261020-r6`, `claude-job-save-t719-20261020-r6`, `claude-social-groups-t566-20261020-r8`, `claude-photo-likes-t567-20261020-r6`; pick unused names. Both ceilings must be set (the env var and the flag); the cost round that set only one was refused at $0.

Preconditions as of 2026-10-27 (trace-offline-trials-plan.md Current State): t752, t753, t754 merged and published; t751 (reset by observed state) NOT yet finished - steps 4-5 (final acceptance, headed site-reset specs) dispatched to worker-heavy; P6 gated on t751. "Live rounds have not started." Before launch: sync all four lane trees (`git merge --ff-only dev` in downstream and in `!FluxIQ`, `pnpm install --frozen-lockfile`, rebuild Core, `node scripts/check/core-build.mjs`, build extension); each tree 0 behind dev in both repos. The 2026-10-20 handoff predates t751's resolution, so re-read `trace-offline-trials-plan/reports/handoff-2026-10-21-codex.md` steps 2-7 for any change of launch order. Per the user's rule, no live round while a known fix (t751) is in flight.

## Best candidate for the next end-to-end run, per site
(Rule: about one task per site per round, plus repaired failures. Sites with an accepted task need no new run unless a repair is owed.)
- everything-store (3 accepted): office-checkout-review is the repair rerun (round 6, slot 1). Nothing else needed.
- job-board (2 accepted): save-quillmark-remote (round 6) and halvard-labs-office-jobs (owed).
- social-network-feed (1 accepted): recent-group-posts (round 6) and hide-suggested-posts (owed). claim-found-key is never run and is a send, so keep it for later.
- photo-social (NO accepted task, highest priority): newest-likes (round 6) is the repair. If it fails again, the next best are `kiln-notes` (never run; light, about 3-8 pages and 4-12 acts, nonempty expected dataset, creates a private collection, no list loop or ordering logic that has defeated newest-likes) and then `priya-tags` (90 calls with a 1-of-5 row answer, a harder tag-read). `august-over-1300` is the worst candidate: its answer was an empty table, which the positive-data rule forbids, so the task or fixture must be revised first. Recommend kiln-notes as the second photo run.
- bigbox-retail, crossborder-marketplace, company-website, professional-network (1 accepted each, no failures): no run needed under the one-per-site rule. If one more is wanted: bigbox `napkins-for-delivery`, crossborder `uk-express-quote`, company `newsletter-signup`, professional `netherlands-data-engineers` (scrape tasks with record oracles; avoid sends and quotes first). These are my picks from the task names and the audits' scraping/send labels; I did not run or verify them.
- local-classifieds (1 accepted): failures are test-ride (a send, correctly blocked) and carbon-price-check; the sibling diag report `diag-auction-classifieds-2026-10-27.md` owns the cause and the repair choice.
- auction-marketplace (1 accepted): cheap-accessory-auctions (3 fails) and buy-it-now-quote: see the same sibling diag report.

## MVP items still unproven besides breadth
`docs/working/mvp-final-month-plan.md` Current State "Next order" is the 2026-10-13 text (stale; its first paragraph defers to the hub). Together with `adaptation-and-breadth-plan.md` and the hub it lists:
1. Adaptation gate (MVP acceptance items 12-20; create, drift, diagnose, repair, verify, persist, resume, reuse; three sites twice each, later run zero-call). Status per the 2026-10-20 handoff: 1 of 6 qualified (crossborder once on 2026-10-13, `run-mv79nr9o-89a70c81`); the everything-store attempt `run-mv79nrcx-112c5ed7` failed; nothing run since; the supervisor recommended running it in parallel with round 6. The schedule's own deadline for it was 2026-10-23 and it required an explicit scope proposal if not green. Owner: `adaptation-and-breadth-plan.md` (Current State) and `mvp-final-month-plan.md` Schedule.
2. Installed-browser proof. Chrome 155 and Edge 155 passed the packaged 0.1.0 extension (load-unpacked, pair, chat build, paid whole run, separate zero-call replay; 13 first-run defects fixed). Firefox is not installed on this machine, so Firefox install proof is unproven (the schedule's hardening line requires "Installed Chrome/Edge and Firefox proof"). Hosted sign-in for the Chrome release is planned only: `hosted-production-plan.md` (planning only, nothing implemented). Packaging owner: `docs/architecture/release-packaging.md`; hub carries the proof record.
3. Recording plus mandatory instructions (Phase 1b: "correct reusable outcome despite recording detours"). Standing rule: new recording+language tests only after A-D live pass; standalone recorded-Flow construction is retired (instruction-led-automation-plan.md). No evidence found of a qualification run. Owner: `mvp-final-month-plan.md` Schedule row "Phase 1b" and `instruction-led-automation-plan.md`.
4. Also open: P6 (offline trials in builds), gated on t751 (`trace-offline-trials-plan.md`); the canonical everything-store reset task `kettle-to-cart` r6 `run-mvebqbm4-b3f3b742` is HELD (exact data and zero-call replay passed, paid jury `model_disagreed`); freeze/hardening and the RC clean-profile 13-step script with 26 acceptance items (Nov 5-10, deadline Nov 10; the freeze is dropped per user 2026-10-27); the restart/uncertain-write matrix is partly proven (cases 9-11 provider-free passed). Daily full sweeps resumed 2026-10-21 per the handoff; I did not check their current results.

## Commands run and observed results
Only reads: Grep/Read of the hub, handoff, plan files, debugs, `expected.ts`; a Python read of `lab-slots/spend-ledger.jsonl` (830 lines, `finish` events grouped by task); `git log`. No builds, tests, runs or model calls; no fxwork tree touched (only `ls` of `fxwork` directory names).

## Not verified
- Accepted run ids are the ledger's latest `passed` finish per task, matched to the hub's accepted list; I did not open each `evaluation.json` or confirm each zero-call replay file (only the hub/archives say they passed).
- Whether `hide-suggested-posts` has been touched since 2026-10-17 beyond the ledger (no later finish event).
- The wording of the halvard-labs instruction against its new expected record, and current sweep status.
- The "best candidate" picks for the four no-failure sites are inferred from task names and audit labels.

## Open questions or contradictions found
- Hub table cites outdated latest-failed run ids (see top); hub header still says "Reset r6 held" and "paused".
- `mvp-final-month-plan.md` Next-order block is the Oct 13 text and still lists the schedule's missed Oct 23 adaptation date.
- Ledger shows halvard-labs `run-mvdgaz8z` as verdict passed, exit 0 in the finish event, while the debug says launcher exit 1 and not accepted; trust the debug and the hub.
- The 2026-10-20 handoff's round-6 sequence precedes t751's late resolution; confirm against handoff-2026-10-21-codex.md before launching.
