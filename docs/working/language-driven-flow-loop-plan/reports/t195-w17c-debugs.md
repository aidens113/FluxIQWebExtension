# t195-w17c — debugs of seven overnight bigbox pickup-order runs

## Outcome

Done. Seven debug files written under `docs/working/language-driven-flow-loop-plan/debugs/`, one per run, from each
run's own bundle in `test-runs/instances/t195-slot-4/`. Total spend of the seven: **$0.6588**. None created a Flow;
every run reached Stage 2 only.

| Run | Cost | Stage | Verdict | Causes |
| --- | --- | --- | --- | --- |
| `run-muo0zggr-442f9107` | $0.1121 | 2 | `stopped_for_permission` at "Place order" (button), `flowCreated: false` | 120 s ask (L1); Place order pressed with names/phone empty and card payment selected; refused press claimed as act; 3 dry runs from reset (t196); draft cap (t200); ~12 s per successful `dom-extract_list`; UI "Build failed" for a stop (t191) |
| `run-muo1ch23-3de731fb` | $0.1210 | 2 | `stopped_for_permission` at "Place order", `flowCreated: false` | 120 s ask (L1); refused Place order re-pressed twice; slot 3pm–4pm over open 2pm–3pm; answer read re-sent 7× then `list_never_appeared`; 4 dry runs (t196); cap (t200); UI (t191) |
| `run-muo1ni63-3e0aa746` | $0.0702 | 2 | **failed** (`flow_bootstrap.evidence_repeat_without_progress`), no ask raised | model dropped 8 proved steps leaving only the navigate; same `dom-type` sent 6× after `target_not_a_handle`; stall with budget left and no correction path; dry runs (t196); cap (t200); UI failure without reason (t191) |
| `run-muo1rxmv-0c617136` | $0.0719 | 2 | `stopped_for_permission` at "Place order", `flowCreated: false` | 120 s ask (L1); `31:rerun` of refused Place order twice; slot 3pm–4pm; answer listing never ran; dry run (t196); cap (t200); UI two "Worked for" summaries (t191) |
| `run-muo1z05y-ad79d4c3` | $0.1198 | 2 | **failed — stop elsewhere: "Continue to checkout" (button), class `move_money`** (`control_differs`) | Core classified Continue to checkout as money; 120 s ask; towels added twice; 64/64 calls spent; dry runs (t196); cap (t200); false money sentence shown in the UI |
| `run-muo2825e-5f295f24` | $0.0822 | 2 | `stopped_for_permission` at "Place order", `flowCreated: false` | 120 s ask (L1); Place order pressed with phone empty; refused press re-run and claimed 7×; instructed consequences differ run to run (no `move_money` quote here); dry runs (t196); cap (t200); UI (t191) |
| `run-muo2fscr-7055485a` | $0.0816 | 2 | **failed — stop elsewhere: unnamed control (kind "step"), class `move_money`, on the home page**; Lab wrongly `passed` on `control: unnamed` | ask raised for a click with no named control; Lab counts `unnamed` as the declared point; worked on a towels-slug URL serving Dinner Napkins; 7 proved steps dropped; 120 s ask; 5 dry runs (t196); cap (t200); UI raw "(step)" |

## What changed and why

Wrote the seven debug files from `run-debug-template.md`, matching the depth of `run-munzrj6r-6f754710.md` and
`run-munyqgjr-473ac9b8.md` (Stage 2 summarised by iteration range; repeated causes cite the earlier debug). Stage 1
cites `run-munovwp3-d898de74.md` (same instruction sha256 `231af963…`). The old `passed` Lab verdicts are replaced by
the honest verdict (dev `f2f80024`); runs 5 and 7 are failures because the stop was not at "Place order".

## Commands run and observed results

- A read-only node summariser (scratchpad `w17c-sum.js`) over each bundle's `run.json`, `evaluation.json`,
  `snapshots/flow-lane.json`, `live-llm.json`, `decision-trace.json`, `person-hand-offs.json`, `events.ndjson` and the
  `[FluxIQ build-trace]` lines of `logs/core.log`. Costs are `observed.totalEstimatedCostUsd` as printed.
- Opened screenshots: first, the ask (middle) and last of each run, plus run 7's 00007 and 00010.
- No Lab, browser or build command; nothing committed.

## Not verified

- Why each loop ended (time bound for run 1, call budget for run 5 are evidenced; the no-progress guard for runs
  2, 4, 6, 7 is inferred — the trace publishes no end reason).
- Click targets and navigate URLs (the trace is content-free); which classifier rule named Continue to checkout money;
  the target of run 7's unnamed click.
- Whether the Continue-to-checkout classification and the unnamed-control ask were recorded in earlier debugs.

## Open questions or contradictions found

- The Lab verdict `at_declared_point` with `control: "unnamed"` (run 7) reports `passed`; it should fail.
- In runs 1 and 6 Place order was pressed while instructed fields were still empty (run 1 also on card payment): the
  stop was a probe, so even a granted permission (L1) would not have produced a correct order. Runs 2 and 4 chose
  the later 3pm–4pm slot. So L1 alone does not make these runs pass.
