# t195-w31a — debug of live run 38 (`run-muqilf9s-c3211328`)

## Outcome

Done. The full debug is `docs/working/language-driven-flow-loop-plan/debugs/run-muqilf9s-c3211328.md`.

## What changed and why

- I added `debugs/run-muqilf9s-c3211328.md`, filled from `run-debug-template.md`. It answers Q1–Q6 with file:line and
  includes the UI review and the per-call costs.
- I changed no code.

Main findings:

1. **C1, new and top priority: every successful list read is refused by Core as `evidence_not_json`.**
   - F42's `firstRows` (`domain/.../node-run/shown-rows/account.ts:53`) shares row objects with `extracted`.
   - Core's `isJsonValue` (`R/llm/evidence-loop-decision.ts:506-513`) never removes a visited object from `seen`, so it
     reads a shared row as a cycle. The refusal is at `:122`.
   - In this run all 12 successful reads were refused. The model was told each "failed and returned no evidence", no
     listing was ever kept, and every `repeat` amendment was refused.
   - Reproduced: Core's function body returns `false` with shared rows and `true` with cloned rows.
2. **Q1: the navigation did not fail.**
   - `s6` succeeded with `matched`. The "failed navigate" is the synthetic refuted-result attempt
     (`R/recovery/refuted-result/attempt.ts:80-128`), which is filed under the last succeeded node (`:155-158`).
   - The Lab lists that attempt as an action (`packages/test-runner/src/flow-lane/persisted-flow-run.ts:592-596`).
   - `s6` should not exist. It is repair round 1's free opening navigation, added with `add: true`
     (`R/llm/evidence-loop.ts:534`).
3. **Q4: the repair round was not judged.**
   - The purse had about $0.009 left, and the judge is held at $0.011 because its reply allowance is the 8,000-token
     default (`token-limits.ts:43`). Each real judge call costs $0.0005–$0.0009.
   - The refusal is at `judge.ts:117-118` and 147-151; the chat text comes from `build-judge.ts:98`. The lead's belief
     is verified.

## Commands run and observed results

- Python over `steps/*/meta.json`, `decision.json`, `call.json` and `result.json` produced the per-step table.
  - Cost sums: build 37 calls $0.091435; run recovery 12 calls $0.024996; all 49 calls $0.116431.
  - Core's build figure is $0.091164, which is the step-log total minus the chat call's $0.000271.
- The decision dumps and the 0066, 0087, 0091, 0097 and 0099 request bodies showed what the model saw. The decision
  dump shows the domain's evidence with `firstRows` for `extract-requests-1`, while the model's entry is
  `evidence_not_json`.
- I reproduced Core's check with `node -e` (the body of `isJsonValue` copied from `evidence-loop-decision.ts:506-513`):
  ```
  shared rows: false
  cloned rows: true
  ```
- `logs/core.log`: no judge between `dryrun.1.6` (05:27:13) and the run (05:27:38). The re-author's iterations 2–4 in
  each round have no `tool start`, because the repeat guard refused them.
- I read the screenshots 00003, 00005, 00008, 00011, 00012, 00014, 00015, 00016, 00019, 00021 and 00023.

## Not verified

- I ran no tests and changed no code. The C1 fix is specified, not tried. Nothing here proves that other recent live
  runs hit C1. It follows by construction for any read that returns at least one row.
- What `s2` and `s4` actually pressed in playback (host-scored at 0.703 and 0.737): there is no per-step playback
  screenshot.
- Whether the site state (Tom, Amara and Priya accepted during the build) was reset before playback.
- The exact projected-cost arithmetic of the $0.011 hold. I only confirmed `max_tokens: 8000` in the judge request and
  the $0.011 quoted in the chat.
- The reason `0065`'s refusal names step 14 as `not_a_kept_step`. I quoted it as recorded.

## Open questions or contradictions found

- **The ceiling.** The Flow's creation through its first run spent $0.1164. The run's recovery draws on a second
  $0.10 purse (re-author `limitUsd 0.1`; `policyGates.maxEstimatedCostUsdPerRun 0.1`). `phases.ts:67-75` says the
  ceiling is "a Flow creation's". Is the first run's repair inside "$0.10 per Flow"? This needs the supervisor's ruling.
- **Round 1's instruction contradicts the loop.** It says "The page is where the test left it: look first", but the
  loop navigates to the start and appends that step (C3).
- **The chat contradicts the model's evidence.** It shows refused reads as "Read list · Done" (00011), and shows
  `core.replay.remembered` as red "Didn't work" (00016).
- **The repeat guard and C1.** The guard refused nothing among the 12 reads, because each was recorded as a failure,
  not as an answered call. Once C1 is fixed, lane B's guard on observations that change nothing will see these
  repeats.
