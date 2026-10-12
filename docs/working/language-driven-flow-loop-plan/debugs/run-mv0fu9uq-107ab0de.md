# Run debug — run-mv0fu9uq-107ab0de (lane A round 8, qualifying run 1 of a new streak in candidate mode, t342-slot-2)

Written as `run-pending-t342-slot-2-a-r8.md` before launch; renamed to the run id when the Lab assigns it.
Everything in "Expectations" was written before launch (2026-10-09 ~03:30 UTC; DeepSeek peak until 04:00 UTC, no
paid launch after 05:45 UTC).

## Header

Lane A, t342 round 8: qualifying run 1 of a new two-pass streak in candidate mode. The product pair is new since
round 7: Core t368 (trial check feedback, same-failure re-test stop, guidance against an invented final check), t370
(chat ready words), t371 (playback optional budget), t373 (candidate tool cards), t374 (llm-generation cycle). The
streak therefore starts at zero.

Tree `fxwork/t342/!FluxIQWebExtension` at ed65545f on `task/t342-lane-a-baseline` (contains dev 1d04a11a; local dev
128d907e is one documentation-only commit ahead, which `behind-dev` allows). Core `fxwork/t342/!FluxIQ` at 52d7ac3a
(= Core dev), both clean. No `STOP-balance`, no override files.

Previous live run on this instance: round 7 run 2 `run-muz3jyz8-1d363a69` (failed on a model-invented
`wait_for_text "Cart (3)"`; debug exists).

## Preflight (0 provider calls), 03:06-03:21 UTC

- Core libraries: `node scripts/build-cache/cli.mjs contracts:build fluxiq:build client-gateway-websocket:build` in
  the Core tree: contracts and client-gateway-websocket restored from the store, fluxiq built (181.8 s).
- Downstream `pnpm build`: exit 0 (extension and test-runner built, the rest reused or restored).
- Campaign `--dry-run` printed one command (below). The Lab `--dry-run` of it exited 0: `status ready`,
  `providerCallCount 0`, created-flow, chat entry, persistent-isolated, deepseek-flash, `coreAuthoringMode
  candidate`, `candidateTrial {trialRunner: true, startReset: true, source: lab-plan}`, maxCalls 48, $0.10,
  `permittedConsequences []`, instruction 219 chars sha256 `2e6f5e7d...a405`, `coreWeb` key `972850d2...` not cached.
- Free rehearsal (no `--live-llm`, so neither guarded nor ledgered), realistic scenario only:
  `FLUXIQ_LAB_INSTANCE=t342-slot-2 FLUXIQ_TEST_ENV_FILES=none node scripts/lab/run-lab.mjs run crossborder-marketplace
  --flow` -> `run-mv0e7y85-70073a70`, 0 calls, 03:15-03:20. It built the Core panel (`core-web-build.log` exit 0) and
  verified all four running identities (`running-{build,core,host,server-adapter}-identity.json` `verified: true`).
  Its recorded Flow (the manifest workflow's recording, not lane A) failed: `web.target.not_found` on the store coupon
  inside the `fb-store-coupon` shadow root after 5 attempts. Recording-lane finding only; it does not touch the
  created-Flow lane.
- Browser headed: the rehearsal's `snapshots/live-panel.json` is `side-panel`.

## Expectations (written before launch)

Instruction, verbatim (219 characters, sha256 `2e6f5e7d...a405`):

> On Farbazaar, put three of the Voltbay USB-C hub sold by Voltbay Official Store in my cart: Space Grey, the
> 7-in-1 version, shipped from Spain. Collect that store's coupon while you are on the item. Do not buy anything.

Command (`--max-attempts 1`, so no second paid attempt):

```text
FLUXIQ_LAB_INSTANCE=t342-slot-2 FLUXIQ_TEST_ENV_FILES=none
pnpm lab:campaign crossborder-marketplace-hub-to-cart --max-attempts 1 --authoring-mode candidate -- --target persistent-isolated --workspace t342-a
```

What a correct candidate does: navigate; optional dismissals of the welcome popup and consent layer; open the
Voltbay Official Store item; leave Space Grey alone (preselected) or set it by desired state; choose 7-in-1 and Spain;
collect the store coupon (retry when busy); quantity 3; Add to cart once; never Buy now; no invented final check.

Exact oracle facts: cart line Voltbay Official Store, Space Grey, 7-in-1, ships from Spain, x 3; Voltbay coupon
collected; `Cart (3)`; `Orders to be shipped (0)`; nothing bought.

To check (new on this pair):

- N1 (t368 guidance): does the submitted script still end with a confirmation `wait_for_text`/assert? The format no
  longer ends its example with one and says the judge reads the end page.
- N2 (t368 feedback): if a wait or check fails, does the trial feedback name what it waited for, hidden versus absent,
  the nearest visible text, and that a check confirming the act before it is not needed? What did the model do next?
- N3 (t368 same failure): a revision failing at the same step and code twice is not re-tested
  (`candidate.trial_same_failure`).
- N4 (t371): optional steps in playback skipped without spending budget.
- N5 (t373): the chat shows the candidate's save and test steps as cards; (t370) the ready words.
- Round 7 U1: choice steps shown as "Click" while the overlay says "Ticking"; Type and Wait cards naming nothing.
- Trials (start reset, each step and attempts), judge verdicts against the private oracle, promotion, chat apply, the
  Lab's playback and oracle, cost and calls.

Cost: under $0.10 for the build, at most 48 calls.

On a Lab oracle pass with product acceptance: one zero-call `lab replay`, then run 9 on the same pair with its own
debug and replay. On any failure: debug fully and stop; no further paid run.

## Result (written by the t342 lane lead, 2026-10-09 ~04:15 UTC)

**Failed before the chat send. $0, 0 provider calls. The instruction was never typed, so no build, trial, judge,
promotion, playback or oracle happened.**

- Guard admitted at 04:00:08 (fingerprint `sha256:fbe04996...`). Prelude reused everything (21.9 s); the Core panel
  was the rehearsal's cached build. Run `run-mv0fu9uq-107ab0de` started 04:01:09.
- Core ready in 4.5 s (the rehearsal: 1.4 s). The extension's worker came up 36.3 s after launch (round 7: 9.5-11.3
  s). Lanes B, C and D launched at 04:01:09, 04:01:28 and 04:01:35, so all four lanes were starting at once.
- 04:01:48.5 dispatch. The chat stage's first act is the Lab's read of the run's (new, empty) project's Flows,
  `list-flows`, bounded at 10 s with no retry. At 04:01:59.6 it had not answered: `facilityFailure {stage:
  scenario.execute, reason: http.timeout, operationStage: control.request, timeoutMs: 10000, endpoint:
  /api/programs/automation-studio/list-flows}`, category `environment.missing`.
- Evidence: `steps/` empty, `costUsd: null`, no `live-llm.json`, no provider-failures file. Panel at the failure:
  connected, empty chat (UI review `02-failure-panel.png`). Core did not crash (it ends with `code=1` in every run,
  passes included).
- Ledger `finish`: verdict failed, cost null. The `unchanged` guard now refuses this instance and task on this pair.

### Cause, traced (three links)

1. **A cold `list-flows` reads and parses the whole workspace state four times.** `service.listFlows`
   (Core `runtime/service.ts:1281`) calls `legacy.readLegacyProjectArtifacts`, which reads `tasks`, `routines`,
   `configs` and `flows` in parallel (`runtime/service/legacy/store.ts:93-110`). Each goes through
   `ProgramJsonStore.listDirectoryDocuments` (`programs/_shared/storage.ts:179-188`), which calls
   `repository.list()` (`programs/database-manager/storage/sqlite-repository.ts:41`): `select ... from
   "automation.state"` with no `where`, `JSON.parse` of every row (`rowToRecord`, line 376), then a prefix filter in
   JavaScript. `deletePath` (same file, 191-201) does the same.
2. **The table grows by about 25 MB per candidate run.** Workspace `t342-a`'s `global.sqlite` is 193 MB:
   `automation.state` has 120 rows and 192.2 MB, almost all `projects/*/runtime/sessions/trial.*` rows of 10-15 MB
   each. In one 15.2 MB trial session, 14.1 MB is `trace.attempts`, of which 10.9 MB is `attempts[].inputs`: each
   attempt carries every earlier step's full result, page snapshot and `interactiveElements` included, so the trace is
   quadratic in steps (per-attempt inputs grow 0, 2, 199, 299 ... 1,136 KB over 19 attempts). The copy is made where
   attempt inputs are assembled (`runtime/executor/node-execution/attempt.ts:120`) and is persisted with the session.
3. **The Lab's read has one 10 s attempt.** `READ_BOUNDS = { timeoutMs: 10_000 }`
   (`packages/test-runner/src/flow-lane/creation/chat/chat-thread.ts:26`), used by `projectFlowIds` before the send
   (`build-from-chat.ts:111`). A timeout ends the run; the read is idempotent and could be retried.

Measured (free, on a copy of this workspace's database, after the launches, with the other lanes running): one
whole-table read costs 3.1-3.9 s (about 1 s SQLite read, 2.2-2.8 s `JSON.parse`) to find 4 rows. The four reads
run in parallel (`Promise.all`), but their `JSON.parse` alone puts about 9-11 s of work on Core's one thread, at or
over the bound even without the launch-time load. The same window (dispatch to first chat step, which holds this
read, the thread reads and the send) grew run by run in this workspace: round 6 1.9 s, round 7 run 1 7.2 s, round 7
run 2 10.6 s. Lanes B, C and D got past this read in the same minute (their workspaces were not measured).

So the failure is a product defect (O(workspace) reads on every Flow listing, fed by quadratic trace copies) that a
Lab defect (one unretried 10 s read) turned into a failed run. Simultaneous launches made it worse but did not cause
it: the trend crossed 10 s in round 7 run 2 with one lane running.

### Reproduction

- Free: copy `test-runs/instances/t342-slot-2/persistent-isolated/t342-a/fluxiq-root/.fluxiq/global.sqlite`, then
  `select id, kind, data from "automation.state" order by id` and `JSON.parse` each `data`: 3-4 s per pass on this
  machine. Any Core started on this workspace pays four of those on the first `list-flows` of a project (the panel's
  Automations tab and the Lab's chat stage both call it).
- Paid (refused now by `unchanged`): the command above on workspace `t342-a`.

### Files to change

- Core `programs/_shared/storage.ts:179-201` with a prefix query in `database-manager/storage/sqlite-repository.ts`
  (`where id >= ? and id < ?` or `like ? escape`, on the primary key), so a listing or delete reads only its
  directory's rows. Test: a listing over a table holding a large unrelated row must not parse it.
- Core `runtime/executor/node-execution/attempt.ts:120` (and the trace record in `executor/attempt-trace.ts`): record
  references or bounded summaries of upstream results in a persisted attempt, not copies of their page snapshots.
- Lab `packages/test-runner/src/flow-lane/creation/chat/chat-thread.ts:26`: retry an idempotent control read that
  timed out (first attempt plus 3, per the retry rule), and name the endpoint and elapsed time in the failure.
- The `unchanged` guard (`scripts/lab/live-guards/`) again treated a run that never reached the product as a product
  failure (round 6's L2, still queued).

### UI

Nothing to review beyond the start: the panel was connected and idle with an empty chat. Round 7's U1 (choice steps
shown as "Click") was not exercised. Located for the record: `fluxiq/src/ui/activity-action/verb.ts:20-21` maps the
`select` and `check` verbs to kind `click`, and `names.ts` labels a card by its kind.
