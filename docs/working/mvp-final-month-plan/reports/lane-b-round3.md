# Lane B round 3: bigbox pickup cart, candidate mode (first candidate run on the recovery dev)

## Fix log

| # | File | Exposed by | Validation | Status |
| --- | --- | --- | --- | --- |
| (none yet) | | | | |

## Current State

Round 3 paid run completed: run-mv4jqkko-bc9a05c6 failed at candidate building, 24 calls, $0.091923204. Three accepted drafts, zero trials; final decision withdrew test/submission and forced an untested completion. Gate refused candidate.trial_required, then purse refused the next request. Recording practice failure is separate. See ../../live-testing-handoff-audit-2026-10-11/reports/b-debug.md and the full run debug. No follow-up run launched during recovery.

Lead: lane B live lead (Claude, `lead`). Tree `fxwork/t262`, both repos on `task/t262-mvp-live-continuation`
(downstream `049b0386`, Core `01621c94`; synced to dev and rebuilt by the supervisor). Slot 3, instance
`t262-slot-3`, workspace `t262-b`. Task, instruction (sha256 `8da0b9f6...43d3`) and oracle are unchanged from rounds
1-2: [lane-b-candidate.md](./lane-b-candidate.md), "Expectations".

Goal: the candidate build passes (oracle on the armed `store-remembered` variant, judged run, zero-call replay).
At most 3 paid runs this round, one per launch, each debugged before the next.

## Preflight (zero calls)

| UTC | Step | Result |
| --- | --- | --- |
| 00:52 | Slot 3 claim refreshed; no `STOP-balance` or `OVERRIDE-*` in `lab-slots` | `lab-slots/slot-3/owner` t262 lane B, `claimedAt` 00:52:01 |
| 00:52 | Campaign dry run (`node scripts/lab/live-campaign.mjs bigbox-retail-pickup-cart-store-remembered-after-creation --max-attempts 1 --authoring-mode candidate --dry-run -- --target persistent-isolated --workspace t262-b`) | one command, identical to rounds 1-2 (`--llm-max-calls 48`, flash, candidate) |
| 00:53-00:54 | Lab dry run of it (`node scripts/lab/run-lab.mjs run ... --dry-run`) | `EXIT 0`, `status ready`, `providerCallCount 0`, `buildEntry chat`, `coreAuthoringMode candidate`, `candidateTrial {trialRunner: true, startReset: true, source: lab-plan}`, 48 calls, $0.10, `permittedConsequences []`, instruction sha256 `8da0b9f6...43d3`; prelude rebuilt scenario-lab, domain host, extension; `coreWeb {key: 7f20175947467f13b1c11bab, cached: false}`. Log `fxwork/t262/dryrun-r3-1012.log` |
| 00:54-00:59 | Free practice run (provider-free Flow lane, unguarded, not filed): `FLUXIQ_LAB_INSTANCE=t262-slot-3 FLUXIQ_TEST_ENV_FILES=none node scripts/lab/run-lab.mjs run bigbox-retail --flow`, run `run-mv4jgt1w-d3c5237f` | Purpose: build the Core panel and prove running identities before paying. All four `snapshots/running-{build,core,host,server-adapter}-identity.json` `verified: true`. The run itself failed `recording.persistence` again (R2 of round 2, recurring; see "Zero-call finding R3") |
| 01:00 | Second Lab dry run | `EXIT 0`, `status ready`, 0 calls, prelude rebuilt nothing, `coreWeb {key: 7f20175947467f13b1c11bab, cached: true}`. Both trees contain their `dev` (`git merge-base --is-ancestor dev HEAD`: downstream dev `6e07993f`, Core dev `01621c94`); no `STOP-balance` or `OVERRIDE-*` |

### Zero-call finding R3 (recording lane, recurring; does not block this probe)

Same as round 2's R2: the practice run recorded the manifest workflow; the Lab then waited 90 s for Core to finish
writing the recording and Core was still appending (`events.ndjson` sequence 68: `entryCount 106`,
`entriesAppendedWhileWaiting 81`, `waitedMs 91386`, `polls 130`, `endedAt null`). About one entry per second. t435's
one-connection-per-session fix covers `runRuntimeSession` only (state-aware plan follow-up "only `runRuntimeSession`
keeps storage connections"); the recording append path is still the likely cause (t381 not merged). A chat-started
candidate build waits for no recording, so the paid probe is unaffected. Evidence:
`test-runs/instances/t262-slot-3/run-mv4jgt1w-d3c5237f/`, log `fxwork/t262/rehearsal-r3-1012.log`.

