# t252-merge-w1: combination rules of the t252 + lane B merge, pinned by tests

## Outcome

Done. All three rules match what the source does; no source file was edited.
Tree: `C:/Users/osrs_/FluxStuff/fxwork/t252/!FluxIQ` (Core, mid-merge, uncommitted; nothing staged by me).

## What changed and why

R = `packages/fluxiq/src/programs/automation-studio/runtime`. One describe block appended at the end of each file.

### R/llm/node-tools/tests/replay-draft-loop.test.ts — "why the test passes over a step, merged with the per-row repeat"

A `recording` wrapper around the file's existing `host` keeps the `excusable` each call reached `executeTool` with.

1. *Withheld span member*: draft = press `#save` with `modify_existing` (checked, `core.replay.verified`), list, repeat press over the list. Pass 1 of the member answers `core.replay.failed`. Asserts the member's outcome is `{ status: "failed", withheldBy: 1, excused: "withheld", passes: [pass 1 failed, pass 2 replayed] }`, and both `dryrun.1.3.pass.1` and `.pass.2` reached executeTool with `excusable: "withheld"`.
2. *Span member failing with no withheld act*: the file's `loopDraft`, pass 2 of step 2 fails. Asserts outcome has `passes`, status failed, and no `excused` / no `withheldBy`; all four pass calls carry `excusable` undefined; no call anywhere carried `"repeat"`; verdict not ok.
3. *Straight optional step (lane B)*: optional press fails (`dryrun.1.1` failed). Asserts outcome `excused: "optional"`, no `passes`, its call `excusable: "optional"`, the next step's call none, verdict ok.

### R/result-verification/build-test/tests/excused.test.ts — "an excused step of a repeat in the judge's account"

Reuses the file's `add`, `plus`, `failed`, `PICKUP` and draft-steps helpers; step 15 is routed `repeat` over d12 through d15.

1. Failed with `passes` (pass 2 failed): outcome `failed`, line has no `excused`.
2. Same step, no `passes`: `excused` matches `/^repeated: /`.
3. `passes` + `withheldBy: 12` (no `excused` on the outcome): `excused` contains "it needed what step 12 would have done" and does not start with "repeated"; identical when the outcome also carries `excused: "withheld"`.

### R/llm/node-tools/tests/dry-run-gate-loop.test.ts — "the unchanged line over a repeat the test walked"

Draft = list, repeat press (d2) over it, optional straight press (d3); both presses `effectApplied: true` so the test proposes them (the file's `step` helper makes presses unapplied by default, which drops them from the test). Host: two rows, every press answers `core.replay.failed`.

- First gate call refuses (issueCodes present); step 2 `replayed` has `passes` both failed and no `withheldBy`; step 3 `replayed` has `excused: "optional"`; no shown value carries `unchanged` yet.
- Second gate call (same Flow, unchanged): exactly one shown value carries `unchanged`; it contains "Change step 2 (failed) before you say the Flow is ready" and does not contain "step 3".

## Commands run and observed results

From `C:/Users/osrs_/FluxStuff/fxwork/t252/!FluxIQ/packages/fluxiq`:

1. `npx vitest run src/programs/automation-studio/runtime/llm/node-tools/tests/replay-draft-loop.test.ts src/programs/automation-studio/runtime/result-verification/build-test/tests/excused.test.ts src/programs/automation-studio/runtime/llm/node-tools/tests/dry-run-gate-loop.test.ts`
   - First run: `Test Files  1 failed | 2 passed (3)`, `Tests  1 failed | 33 passed (34)` — my gate test: first `gate()` returned `undefined`. Cause (from a temporary log, since removed): only the list step was proposed, because the file's `step` helper sets `effectApplied` false for presses. Fixed in the test by setting `effectApplied: true` on the two presses; not a source discrepancy.
   - Final run: `Test Files  3 passed (3)`, `Tests  34 passed (34)`.
2. `npx vitest run src/programs/automation-studio/runtime/llm/node-tools src/programs/automation-studio/runtime/result-verification/build-test`
   - `Test Files  31 passed (31)`, `Tests  275 passed (275)`.

## Not verified

- No typecheck (`tsc`) of the edited test files; vitest strips types. The new code uses only types already imported in each file plus `Parameters<typeof host>[0]`.
- No mutation check (source must not be edited), so I did not prove each new assertion fails against a broken rule; the assertions are on the exact fields the rules name.

## Open questions or contradictions found

None. Each rule is what the source implements: `replay-span.ts` `memberOutcome` sets `excused: "withheld"` only with `withheldBy`; `replay-draft.ts` passes `passExcusable` (`"withheld"` or nothing) to span calls; `summary.ts` `excusedWords` drops the routed reason when `passes` is present; `dry-run-gate.ts` `unchangedLine` treats an outcome as passed over only without `passes` or with `withheldBy`.
