# Historical Current State before Codex live continuation

Archived verbatim on 2026-10-03. Superseded by the live-loop Current State and mvp-live-continuation-2026-10-03.md; historical Pro comparison/authorization statements are not current instructions.

## Current State

**Session 2026-10-03 (resumed after the night handoff). Read this first.** The user held live runs until general Flow
authoring (t252) landed; it landed 2026-10-03, so round 1003 is being released. Round 1002-M gave the first honest pass: lane A crossborder
`run-murwd8le-79e735a8` ($0.0579, built from the chat, judged yes on the Flow as it stood, 4 of 4 facts).

**Dev heads.** Core `d89877d3` and downstream `622eccf8` or later, both pushed (the downstream push the night
handoff left to the user went through from the supervisor: `04a5e3ce..3b1655b8`).

**Landed this session, each verified by the supervisor on the merged tree (ledger below):**
- **Lane B (t193) round 1002-M** (Core `8b952335`, downstream `db9260c8`). Combination decisions:
  `reports/t193-lead-1002M.md`, "Merge of dev, 2026-10-03"; verification: `reports/t193-w-merge-verify.md`. On dev:
  Core check 0, domain check 0, audit passed; the extension check gave 10 false TS errors against a Core dist older
  than the merge, rc 0 after `pnpm --filter fluxiq build`. Closed mechanically (`c14e3560`): the domain and extension
  `check` scripts run `scripts/check/core-build.mjs` first, which refuses a stale Core build by name.
- **t255 run records** (Core `d89877d3`, downstream `622eccf8`): the Lab writes FluxIQ's whole ending;
  `live-llm.json` books the judge and the consequence read apart from the build (murzln6g: build 30 calls $0.086255,
  judge 2 $0.001936, read 1 $0.000380); Core's step log writes `NNNN-answer-<toolId>` folders for amendments and
  refused repeats (later step numbers shift by them). Left open: `flow-lane.json`'s `instructedConsequences` stays
  null; Core's `judgeAccounting` gives no judge call count.
- **t256** (Core `75e66057`): the web Adaptations view and inbox rows say applied, held back (plain reason), or
  waiting for a judged run; summaries carry `judgedApplication`. Rows indexed before it show it once re-saved.
- **t257** (downstream `702c7dbc`): the Lab's UI review counts every document change as a page load (old count kept
  as `pageLoadGaps`; murzln6g moment 6: 0 -> 1); samples carry a screened `pageUrl`; pictures carry `takenAt`.
- **t252 general Flow authoring** (Core `6beae684`, downstream `ed2a317b`; design and report in
  `docs/working/general-flow-authoring-plan.md` and its `reports/t252-lead.md`): the build may write steps and bind
  them to `$row`, a Flow input or an earlier output; its test runs a repeat once per row, lasting acts checked and never
  pressed; the judge sees one line per row; stored nodes keep declared consequences. Proven by a parity test and a
  scripted confirm-requests build (both fail with per-row expansion off). On the merged tree: Core 375 files / 4,075
  tests (a recovery test that pinned a 4,000-token input limit now derives it from the budget), domain 1,410/1,410,
  all checks 0. Abandon `fxwork/t251`.
- **t254 purse at true cost** (Core `e6290d80`, downstream `15b9c4ea`; `reports/t254-purse-holds-true-cost.md`):
  billed price (off-peak, cached input), only what is sent; no `max_tokens` anywhere (chat panel included); the
  round gate measures the next round (murzln6g: need $0.0187 -> $0.0077); judge overshoot in the build total; a
  round stopped by the judging reserve tests and judges the Flow so far (yes finishes; else ends at cost, kept as a
  draft, never not doable), but an unchanged Flow already judged no runs no test or judge; recovery priced per call
  at the rate in force. On the merged tree: Core check 0, 195 files / 2,259 tests, build 0, domain/extension 0.
  Left open: `maxEstimatedCostUsdPerCall` survives only for `R/tests/recovery-default-limits.test.ts`; an extend or
  continued build whose Flow an earlier build's judge refuted is re-judged (needs `service.ts` to pass the verdict).
- **t258** (Core `f044b596`): a run whose project store is gone ends failed with its own reason, never by throwing.
  Cause: t249 made every judged end read the run record; now only a run that may promote reads it, and the pool's
  closing refusal is a typed `AutomationStudioProjectStoreUnavailableError`. 92 files / 588 tests, check 0.
  Left open: a store that goes away right after the pre-apply `applied: true` record leaves the adaptation saying
  applied; a database file that fails to open still throws.
- **t259** (downstream `955630de`): `flow-lane.json` and `live-llm.json` carry the same settled build and
  `instructedConsequencesFrom` in every ending, a throwing settlement included (235/235, check 0).
- Core `880577fc`: the `$0.25` comments in `refuted-result-port.ts` and `repair-authority.ts` name the run ceiling.
- Session 8d (2026-10-02/03): t244, t246-t250, t253 and lanes A (t174), C (t194), D (t195); see the ledger.

**Round 1002-M (step logs under `C:/Users/osrs_/FluxStuff/lab-runs/2026-10-02/<run>/`).**
| Lane | Runs | Ending | Fixed since |
| --- | --- | --- | --- |
| A crossborder | `murwd8le` $0.058 | pass | 14 of 16 causes: tests no longer re-press lasting acts, judges see the end page, cards |
| B bigbox | `murwdp4f` $0.087, `murzln6g` $0.089 | no Flow: purse; judged no with $0.011 left | 10 causes (landed); purse at true cost (t254) |
| C earbuds | `murwcmx2` $0.098 | built, playback refuted (10 of 13), re-author `not_doable` untested | rerun from start pages, unmeasured round never not_doable, confirming judge call |
| D confirm-requests | `murwcaj0` $0.089, `murz83zy` $0.088 | no Flow: loop clicked one hard-coded row; purse | reorder hint, single-row twin, column `at` per item; row-general Flows (t252) |

**In flight (each agent's state is in its report).**
- **Round 1003, dispatched 2026-10-03:** the four lane trees were fast-forwarded to dev (Core `6beae684`, downstream
  `45bd6232`) and rebuilt as `pnpm task start` builds a tree (Core `buildCore` 48-102 s, then `pnpm build` 61-144 s,
  all rc 0). Leads t174/t193/t194/t195-lead-1003 (`lead-xhigh`) run slots 1-4 from the briefs below; reports
  `reports/<lead>.md` in each lane tree.
- **Sweep 2, green** (full suites on dev after t252, Core `6beae684`, downstream `45bd6232`): Core `pnpm test` rc 0
  (contracts 55/55, gateway 10/10, fluxiq 720 files / 6,733 passed + 1 skipped, apps/web 354 files / 2,904); downstream
  `pnpm check` rc 0 (scripts 556 passed, 1 skipped; audit passed), `pnpm test` rc 0 (test-runner 1,862/1,862 among
  others), `pnpm build` rc 0. The second and last full sweep allowed today.

**Binding rules (user, all in force).**
- **Shorter start, unless the person names the route (2026-10-03):** a Flow may start at the stable address where the
  work begins and drop the steps that only travelled there; "if the user explicitly instructs bot to go the long way
  to achieve goal that is respected". An instruction that names how to get there keeps those steps.
- **General Flow authoring before any more live runs (2026-10-02 night):** "The model should be ABLE to explore &
  'record'/test different node configurations, but it should also be able/encouraged to build dynamic & smart flows
  from what its gathered without going through every iteration"; "implement that feature first before any mroe live
  runs". Recorded steps stay valid; the model may also lift a recorded step into a row/input/output binding or write
  one, and is encouraged to generalise repetitive work.
- **Billed dollars, no output cap (2026-10-03):** "It should be billed at how much it actually costs, and i never told
  you to add any cap on output. Remove that." Never add a reply cap to save purse.
- **Cost ceiling $0.10 per Flow, one variable (2026-10-01):** `FLUXIQ_LLM_RUN_COST_CEILING_USD` (default 0.10, max 10,
  invalid stops Core); the Lab passes `--llm-cost-ceiling-usd`, then its env, then `.env`/`.env.local`; the product's
  spending limit is separate.
- **Live builds start from the real extension chat (2026-10-01):** a direct API request is never a pass.
- **The compact page view (2026-09-30):** visible-text and interactive elements only, least format, `find_on_page`
  over text and every attribute, `describe` for one element; every visible control gets a line. No caps or ranking
  among qualifying elements; a request too big for the window fails loudly.
- **No action restrictions beyond permissions (2026-10-01):** only money, delete and send/publish ask the person;
  secret screening stays; covered marks, layers and unknown addresses are information, never refusals.
- **No repeated failing actions (2026-10-01):** one general guard refuses an identical retry on an unchanged page.
- **Every run step logged as files (2026-10-01)** under `test-runs/<run-id>/steps/NNNN-*/`.
- **A build has three phases (2026-09-30):** exploration authors the draft; test and judge once the model says ready;
  repair, finish, or "not doable" only if there is absolutely no way, with the reason.
- **A Flow run routes by page state, not build order, globally in Core (2026-10-01/02);** looping back to one step
  without progress enough times fails.
- **Partial test runs, one full judged run (2026-10-02):** a build or repair finishes only after a whole-Flow run from
  its start was judged successful on the Flow as it finally stands (t244 for builds, t249 for runtime patches).
- **Live runs:** four slots, one per lane; headed only; only the ten realistic scenarios; started by a live agent for a
  reason; stop at the first balance failure; a permission stop is never a pass; a failure is a product or Lab defect,
  never machine load; every debug reviews the UI from screenshots. A live round waits for every agreed change, and lane
  trees are synced to dev and rebuilt first (the Lab's behind-dev guard enforces it).
- **Validation cadence (2026-10-01):** merges take narrow checks; full suites at most twice a day, in the background.
- **Chat cards are never generic (2026-10-01):** each card says what it inspects or does, on what.
- **Process.** Lanes iterate on their own branches; the supervisor merges in rounds and alone commits, merges or
  pushes; leads and workers cannot run git history commands (hook), so the supervisor checkpoints and merges for them.
  Heavy commands go through `build-slots/heavy.sh`. No LLM call grants.

**Decisions made (supervisor; the user may override).**
- Robot checks are never pressed or solved (t197). Money, delete and send/publish ask every time (F10).
- D1, extended by lanes B and D: the build's test and its reruns check a lasting act instead of doing it again.
- `recovery-default-limits` is superseded: with no output cap the purse cannot be a strict bound before a call; holds
  reserve twice the observed maximum reply and an overshoot (part of one reply) is recorded (t254).
- A build-finishing judge yes is confirmed by a second call; a silent or refused confirming call leaves the yes
  standing (lane C, `yesStood`).
- The web domain declares the keys a step carries its row under (`rowContextKeys`); Core names no web key (lane D).
- A Flow's creation has one $0.10 purse; each run's recovery has its own ceiling (offered to merge; unchanged).

**Waiting on the user.**
- Removing 41 landed task worktrees (t184-t238 except the lanes, t224 and t251; each has no commit off dev in either
  repository) with `pnpm task abandon <id>`: the auto-mode classifier refused it as interfering with workloads.
  `abandon` refuses any branch with unlanded commits and never touches the remote.
- t252: stored Flow nodes now keep their declared consequences, but a plain stored run does not check them; turning
  that check on changes what every stored Flow does at run time.
- Removing the remaining pre-action refusals (the classifier refused the edit as a security weakening).
- Workers committing on their own task branches (needs the brain's `hooks/worker-git-guard.mjs`).
- `fxwork/t187-bench` and `fxwork/t192-bench`: delete only on a yes.

**Next, in order.**
1. ~~Lane B: land.~~ Done 2026-10-03.
2. ~~t252: land.~~ Done 2026-10-03. 3. ~~t254: land.~~ Done 2026-10-03.
4. ~~Sweep 2.~~ Green 2026-10-03; no more full sweeps today.
5. Lane trees synced and rebuilt; dispatch round 1003 (briefs below), lane A's run then the `deepseek-v4-pro`
   comparison. Debug every run; merge the lanes' fixes in rounds.

**Open follow-ups (not assigned).** A decision refused for its input limit ends exploration as
`llm_evidence_loop.invalid_decision`, which reads as a bad reply (t254 stage 4). Unify `control` and `does`; signatures for recorded Flows (t243 item 4); a dropped
column on a rerun needs the domain's denied keys (t195 R3); a recovery-stage part-run tool on `stopAfterNodeId`; the
reroute edge mismatch (trial `success` vs durable `failed`); `$0.25` left in `refuted-result-port.ts` and
`repair-authority.ts`; the web Adaptations view shows no `applied`/`notAppliedReason`; scripted judges that run out of
answers should fail the test, not stand in for a confirmation; a step's `replay.from` is the screened address, so a
reset can go to a "(withheld)" URL (lane C); a not-finished build keeps the creation purse open (lane D,
`built-loop.ts:30`); a stored Flow node drops `consequences` (t252); lane A's open causes 2, 6, 10, 11, 15 and UI D6,
D9; load-flaky Core tests (`subflow`, `service-recordings/proposals`, `cancel-runtime-session`, `runs`) and the Lab's
`unbuilt.test.mjs`; a click landing on a 429 page is `navigation_unexpected`.

Older history: rung 1 is in `archive/rung1-history-to-2026-09-26.md`; the ledger to 2026-10-01 is in `archive/` and
the Work Ledger below.

---

