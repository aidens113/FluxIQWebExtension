# t1037 worker `carried-undeclared`: the carried-undeclared test under framework drafting

## Outcome

Done. The new behaviour is right, so I rewrote the test and changed no source. The rewritten file has two cases, and both pass. The answer-first folder passes in both groups. The typecheck and the structure audit pass.

## Cause, with evidence

On dev, the scripted press carried `add: true`, so the model put it in attempt 1's Flow. The press names its control as `target: { handle: "t7" }`. The library's card node declares no parameters (`fake-library.ts:42`, `parameters: []`). Because of that, attempt 2 could not assemble the saved steps. The route went to `repair`, and attempt 2 explored in rounds, where the carried act appears in the decisions' context. I inferred this for dev; I did not run dev itself (see Not verified). I reproduced it in this tree by having the model `keep` the press, which gave the same saved Flow. A temporary probe at `attempt/opening.ts` routeOf, since removed, printed:

`{"ok":false,"codes":["flow_bootstrap.evidence_completion_plan_invalid"],"issues":["bootstrap.unknown_parameter at plan.subflows.0.nodes.1.parameters.target"]}`

That attempt 2 had `startedFrom.route = "repair"`, `path = "explore"` and 2 decisions. Its context held `"carried":true`. The judge was shown `witnesses.before = { role: "observation", evidence: { note: notHeld } }` with no gaps. Those are the original assertions, and they passed.

Under framework drafting with no `keep`, the framework leaves the press out of attempt 1's Flow. A probe of the saved steps showed:
- step 1 `library.look`: taken / `look`
- step 2 `read_loans`: kept / `in`
- step 3 `renew_card`: taken / `dead_end`

The reason is `compose/after-result.ts`. The press comes after the result's last read. Its `stateBefore` equals its `stateAfter`, it carries no `changed` entry, and it declares no consequences, so `lasting.ts` finds nothing lasting. The saved Flow is therefore the read alone. It assembles, so the route is `use`, the path is `run_flow`, and attempt 2 makes 0 decisions.

The act record still holds the press, marked `undeclared` and `changedState`, so it is carried. The judge was handed `witnesses.before` as Core's note; a probe in `completion/check.ts` summaryOf, since removed, showed it in the `judgeEvidence` form. `runtime/result-verification/judge-evidence/summary.ts` then leaves witnesses out of the request. It sets `stateRequired` false because:
- the summary's acts are `[]`;
- no trail step is an action;
- no trail step had consequences.

This is why the request had no `witnesses.before`. A read-only replay needs no before side, and it named no gap.

## Decision

The new behaviour is right under each rule:
- **The later attempt runs the saved Flow with no decisions.** This is the deterministic-runs rule in AGENTS.md.
- **The press is not done twice.** It is not in the Flow, and by-hand presses stay at 1 across both attempts.
- **The carried act is not lost.** Attempt 2's record holds it with `carried: true`.
- **The press is not credited with what the page changed by itself (t1043).** Core saw no state change, so the press drops out as a dead end.

I did not weaken any assertion; every original one is still in case 1.

## Change

One file: `packages/fluxiq/src/framework/automation-service/service/answer-first/witnesses/tests/carried-undeclared.test.ts`.

- **Case 1 (t1043's point).** This is the run's own shape.
  - Attempt 1's model keeps the press with `keep` step 3, so the press is in its Flow. The press's control is named by a handle that meant something only while attempt 1 authored, and the card node takes no such parameter. The saved steps therefore do not assemble.
  - The test asserts that attempt 2 has `route = repair`, explores in rounds and carries the act (`"carried":true`).
  - It asserts that the press is not pressed again.
  - It keeps the original judge assertions unchanged: every judge call is shown Core's note as `witnesses.before`, names no `witnesses.before` gap, and is confirmed.
- **Case 2 (the default under drafting).** This case is new.
  - With no `keep`, the press is saved as taken / `dead_end`, and the act record holds it as `undeclared` and `changedState`.
  - Attempt 2 runs with `path = run_flow` and `route = use`, makes 0 decisions, and still holds the act with `carried: true`.
  - The press is not pressed again (count stays 1), no `witnesses.before` gap is named, and the result is achieved and confirmed.
- **Fault helper.** The fault now counts by-hand card presses.
- **Header.** The file header explains both cases.

I added all probes in source temporarily and removed them. `git status` shows no change to `attempt/opening.ts` or `completion/check.ts`.

## Commands run and observed results

All runs were in `packages/fluxiq` with `NODE_OPTIONS=--max-old-space-size=3072`, through `heavy-slot.mjs run t1037-cu`.

- **The test file alone (real-sql)**, `vitest-groups.mjs --groups=real-sql .../carried-undeclared.test.ts`: 2 tests passed, exit 0.
- **Acceptance**, `node ../../scripts/vitest-groups.mjs --groups=parallel,real-sql src/framework/automation-service/service/answer-first`:
  - parallel: 121 files and 832 tests passed;
  - real-sql: 74 files and 506 tests passed;
  - `[vitest-groups] all groups passed: parallel, real-sql`, exit 0.
- **Typecheck**, `pnpm --filter fluxiq check`: exit 0 with 0 `error TS`. The brief did not require it because no source changed; I ran it to typecheck the test.
- **Structure audit**, `node scripts/structure-audit.mjs` at Core's root: `structure-audit: passed (576 warning(s), 902 baselined)`. None of the warnings names this file.

## Not verified

- I did not run dev's tree. That dev's attempt 2 explored because of the same `bootstrap.unknown_parameter` repair is inferred: dev's `add: true` put the press in the Flow, the same assembly refuses it, and the `keep` reproduction in this tree shows the refusal and the repair route.
- Flow-run (engine) presses are not counted, only by-hand ones. In neither case does the saved press reach the engine: in case 1 the saved steps did not assemble, and in case 2 the Flow has no press.

## Open questions or contradictions found

- The judge summary's `acts` is `[]` in attempt 2 in both cases. The carried act is shown to the model, but it is not listed among the judge's acts. This was already true before t1037 (the `keep` path shows it too). Whether a carried act should count toward `stateRequired` is a question for the judge-evidence owner. It does not affect this task's correctness.
- In case 1, attempt 2 reaches repair only because the press names a parameter the node does not take. This mirrors how dev's run got there; it is not a separate design choice.
