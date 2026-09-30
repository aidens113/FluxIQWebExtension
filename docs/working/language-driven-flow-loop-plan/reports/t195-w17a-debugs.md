# t195-w17a — debug files for seven bigbox pickup-order runs

## Outcome

Done. Seven debug files written from each run's own bundle (`test-runs/instances/t195-slot-4/<run-id>/`).

## Runs (one line each: run id, cost, stage reached, verdict, causes)

- `run-munuxns5-833f4313` (11): $0.1220, 64 calls; stage 2; failed (iteration limit, no Flow). First-press trip loop 17–57 (but two presses in a row at 52–53 put the towels in the cart, 00029: corrects the lead's row 11); checkout blocked by an unnamed layer; 3 dry runs × ~64 s from a reset (t196); 40-step transcript draft (t196); draft cap, instruction 177 B, 9 unlisted (t200).
- `run-munvmg0n-12e4a3ce` (13): $0.1205, 64; stage 2; failed (limit). Trip loop 15–53; amend at 31 dropped Save for later with 10 trip steps; reached checkout at 59, guest press `action_failed` with page changed; dry runs from reset (t196); transcript (t196); cap (t200).
- `run-munvz5x0-84fa6177` (14): $0.1234, 64; stage 2; failed (check ok at 64, dry run refused). Trip loop 14–50; guest checkout, names, a slot, email reached; Pay at pickup `target_not_a_handle`; check accepted `a2>d55` (email typing) as an instructed act; 3 dry runs from reset (t196); transcript (t196); 28 unlisted steps (t200).
- `run-munwmfrs-b81bbc65` (15): $0.1206, 64; stage 2; failed (limit). F19 changed nothing (8 single presses); **the model dropped its whole draft twice and restarted from the start location mid-build** (t196); cart empty at end; dry runs from reset (t196); cap (t200).
- `run-muny5y17-a927214b` (16): $0.1197, 64; stage 2; **stopped_for_permission** (old `passed`), flowCreated false. Ask at Place order unanswered 120,814 ms (L1); 8 decisions after the denial; clicks `action_failed` with page changed; dry runs from reset (t196); cap (t200); UI shows the stop as "Build failed".
- `run-munyqgjr-473ac9b8` (17): $0.0987, 55; stage 2; **stopped_for_permission** (old `passed`), flowCreated false. Ask unanswered 120,233 ms; model re-pressed the refused Place order 3 times and sent 12 completions claiming it; slot 3pm–4pm while 2pm–3pm open (as run 5 cause 6); 7 clicks `action_failed`; dry runs from reset (t196); cap (t200).
- `run-munz227o-5119fa06` (18): $0.1134, 64; stage 2; failed (limit). Nine clicks `action_failed` with page changed; order act claimed on a failed click; 18 decisions amending steps already out; `handle_not_in_packet` ×4 (t200 if a cap: NO EVIDENCE); reached checkout, contact half-typed; 3 dry runs from reset ending on the listing (t196); cap (t200).

Total spend over the seven: $0.8183.

## What changed and why

Created `docs/working/language-driven-flow-loop-plan/debugs/run-munuxns5-833f4313.md`, `run-munvmg0n-12e4a3ce.md`,
`run-munvz5x0-84fa6177.md`, `run-munwmfrs-b81bbc65.md`, `run-muny5y17-a927214b.md`, `run-munyqgjr-473ac9b8.md`,
`run-munz227o-5119fa06.md` (92–113 lines each), from the template, as the brief asked. No other file edited.

## Commands run and observed results

Read-only: `node` scripts in my scratchpad (`w17a-digest.js`, `w17a-view.sh`, `w17a-ref.js`, `w17a-ids.js`) summarised
`flow-lane.json`, `live-llm.json`, `events.ndjson` and the `[FluxIQ build-trace]` lines; opened 3–5 screenshots per
run with the image reader. No Lab, browser or build command; nothing committed.

## Not verified

- Which fixes each build carried (extension hashes: 06e9b6b0 runs 11–14, 90560f83 run 15, f61e1186 run 16,
  340ef24d runs 17–18); whether F17 reached the model in run 13.
- Stage 1 is referenced to `run-munovwp3-d898de74.md` (same instruction sha256) rather than re-read from `live-tasks.ts`.
- Draft contents for runs 16–18 (call ids are `-`; no `incompleteDraft` node list).
- Dry-run position → step mapping for runs 16–18 (positions only).

## Open questions or contradictions found

- Lead's row 11 says the model never pressed twice in a row; it did once (iterations 52–53) and the towels reached the
  cart (screenshot 00029).
- Runs 16–18 trace every model call id as `-` (runs 11–15 had them): a new instrumentation gap with facility
  `46076bba` / Core `f4feb028`.
- Runs 16–18 show many clicks `action_failed` with `pageState: changed` from the first search submit on, a pattern
  absent in 11–15; worth tracing against extension `f61e1186`/`340ef24d` (possibly the F20 press watch).
- Run 17 ended at 55 of 64 decisions with no end reason in the trace.
