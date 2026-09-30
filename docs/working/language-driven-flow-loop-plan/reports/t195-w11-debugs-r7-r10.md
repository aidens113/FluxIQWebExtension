# t195-w11 — full debugs of lane D runs 7-10

Worker t195-w11, brief "full debugs of four live runs (lane D)". Read-only on everything except the four debug files
and this report.

## Outcome

Done. Four debug files written from the template, every field filled or marked `NO EVIDENCE:` / "not reached":

- `debugs/run-munsxchc-15523952.md` (r7, confirm-requests)
- `debugs/run-muntfume-7f7d97fb.md` (r8, confirm-requests)
- `debugs/run-muntu7in-e3dd1972.md` (r9, confirm-requests)
- `debugs/run-munuj2os-c205ee3a.md` (r10, withdraw-stale-requests)

Each carries a per-turn Stage 2 table (29, 24, 52 and 25 rows) generated from the build trace joined to
`flow-lane.json` steps, the stopping guard with Core file:line, the page listed, whether `where` / `repeat` were stated,
permission requests, and a UI review from the bundle screenshots, the Lab UI-review pictures and the lane shots.

## What changed and why

Only the five files above. Stage 1 in each is copied verbatim from `S/t195-stage1-confirm-requests.md` or
`S/t195-stage1-withdraw.md`. Evidence sources per run: `snapshots/flow-lane.json`, `live-llm.json`, `events.ndjson`,
`logs/core.log` `[FluxIQ build-trace]`, `screenshots/*.jpg`, `provider-failures.local.json` (refusal codes only, no
provider bodies), `<run>.ui-review.local.json` and its pictures, the Lab stdout logs `S/t195-lab-*-{074148,075608,080725,082839}.log`,
lane shots `S/t195-shots/*-r7-*`, `*-r8-*`, `*-q0828-*` (no lane shots exist for r9). Core guards were read in
`C:/Users/osrs_/FluxStuff/fxwork/t195/!FluxIQ`; where that tree changed after a run (F13, F15, F16 are uncommitted edits
written 08:00Z-08:40Z), the run-time line is cited from `git show HEAD:` and the new one named beside it.

## Corrections to the lead's rows 7-10 (`reports/t195-live-control-flow.md` ## Runs)

- **Row 7:** 16 amendments, not 13 (9 listing reruns, 2 `already_in_flow` no-ops, 1 half-applied, and 4 refused
  `16:no_such_position` on the Confirm, which at run time also covered a misplaced `repeat`, `flow-draft/amendment.ts:228`).
  Missed: exploration press `confirm.first` (iteration 17) accepted **Tom Becker (1 mutual)**, a wrong act; two presses
  named `confirm.repeat.25` / `confirm.anchor.28` pressed nothing. The stop is the no-progress guard (8) at the 4th
  refused completion (`llm/evidence-loop.ts:357-367` -> `service.ts:1555` -> `evidence_unusable_decision`). Also: the
  Lab ran against an extension build one minute older than its source (`stale-allowed`). Dry runs 58 s of 142 s.
- **Row 8:** confirmed (right page; Tom Becker and Amara Osei accepted; `where` rerun kept nothing; six refused
  amendments; no-progress end at `llm/decision-handlers/amendment.ts:95-97`). Added: the second press was a `rerun` of
  the click; the seven `11:not_a_kept_step` refusals can only come from routing changes (`flow-draft/amendment.ts:215`,
  `:220`, `:227`), so the model was attempting `repeat` / `only_if` / `on_failed` on the Confirm; no completion was ever
  attempted.
- **Row 9:** 14 completions, not 8: `d21` was claimed 8 times (the first with no act id), then `d28` 6 times, all
  `act_needs_repeat`; both are the two exploration Confirm presses (`check.ts:124-130` reaches that reason only for a
  kept applied mutating step). The build ended on the **540 s build deadline** (`loop-limits/flow-bootstrap-evidence-loop.ts:64`,
  `loop-budget.ts:111-115`, `evidence-loop.ts:527`) at 52 of 64 calls, reported under the generic
  `evidence_iteration_limit` code; **dry runs took 401 s of the 537 s loop**. Missed: exploration accepted Tom Becker
  (wrong) and Amara Osei; the model named presses `confirm.repeat.31` / `amend.repeat.48`; the draft had no record store.
- **Row 10:** confirmed (`repeat(over=15)` refused; permission 122 s; `no_point_declared`; contract conflict). Added:
  a second repeat attempt `16:repeat(over=16)` at 17; the claims were the listing **and the held Withdraw (d17)**
  (`a1>d16,a1>d17`, `a1>d17`), both `step_changed_nothing` because the gate stopped the press; the stall was reported
  as the permission request by `service.ts:1555` (`permissions.endedOnRequest` first). The listing was All (36), first
  page, no People filter, no Show more. **The ask was visible in the side panel** (Allow / Don't allow, 08:35:40Z-08:37:42Z)
  but the status line under it and the on-page overlay both said "Building your Flow / Using core.run_node" the whole
  time, and nothing showed the 120 s limit.

## Commands run and observed results

- `python S/t195w11-trace.py <run>` (compacts `[FluxIQ build-trace]` lines): 149 / 81 / 407 / 98 trace lines ->
  29 / 24 / 52 / 25 decisions.
- `python S/t195w11-steps.py <run>` and `S/t195w11-table.py <run>` (join trace to `evidenceLoop.steps`): 39 / 27 / 60 /
  31 step rows; tables injected into the debug files.
- Kind recount (script): r7 `{tool_call 9, amend_draft 16, complete 4}`; r8 `{13, 11, 0}`; r9 `{22, 16, 14}`;
  r10 `{12, 8, 5}`.
- Time split (script): loop / dry run / decide / tools = r7 142/58/44/39 s; r8 61/0/34/27; r9 537/401/77/58;
  r10 186/6/40/140 (122.8 s of it the permission wait).
- `grep` of `provider-failures.local.json` for `<n>:<reason>` codes: r7 `already_in_flow` 3, `no_such_position` 4;
  r8 `not_a_kept_step` 7, `already_in_flow` 1, `already_out` 1; r9 `already_in_flow` 9, `already_out` 9; r10
  `already_in_flow` 3, `already_out` 1, `no_such_position` 2.
- Privacy scan `grep -i -E "https?://|127\.0\.0|localhost|<r10 page names>|selector"` over the four files: hits only in
  the verbatim Stage 1 text. No `{{TABLE}}` marker left.
- No build, test, Lab or browser command was run (none named; the brief forbids Lab and browser runs).

## Not verified

- Which card each Confirm press accepted in r8 (both landed between screenshots); in r7 and r9 it is from screenshot
  timing.
- The no-progress count at each decision: reconstructed from the code, not recorded.
- r9's binding allowance (`duration`) is inferred from times; `exhaustion.bound` is not in the bundle.
- The content of every `where`, listing input and draft parameter (not traced anywhere).
- The node at each dry-run position (callIds carry positions only).

## Open questions or contradictions found

- **Refusal reasons missing from flow-lane rows** in all four runs: at run time the downstream publisher
  `packages/test-runner/src/existing-fluxiq-control/publishable-step-value.ts:51` (HEAD) allowed only six reasons, and
  `:206` / `:218` drop a row's whole list on one unlisted reason. The working tree already carries an uncommitted fix
  adding `over_not_before`, `did_not_work`, `already_in_flow`, `already_out`; its owner is not named in any file I read.
- The dry run runs after an act-check refusal whatever it said (`llm/evidence-loop/completion-attempt.ts:61`) but was
  skipped for 3 of r9's 14 completions and 4 of r10's 5; the skip rule was not traced.
- The panel's "Worked for" duration and step counts disagree with the build in every run (r7 62 s vs 142 s; r9 84 s vs
  537 s; r10 three separate blocks).
- `repeat-suggestion.ts:5-6` (F15's header) says r9 "claimed that Confirm ... eight times": true of d21, but the run made
  14 claims across two Confirms.
