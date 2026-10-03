# Report: t252-lead

## Outcome

Partial, stopped at a safe point for the night (supervisor, 2026-10-03). Both trees compile and pass their narrow
checks. P1, P2 and P3 (walker, judge view, stored consequences, wiring) are done and verified. Not started: w7 (the
parity test and the scripted confirm-requests proof) and P4 docs. Nothing is half-done: no worker was mid-edit
when work stopped.

## State of the trees (uncommitted work since the supervisor's checkpoints)

- **Core** `C:/Users/osrs_/FluxStuff/fxwork/t252/!FluxIQ`, branch `task/t252-general-flow-authoring-impl`, HEAD
  `0d7d3071` (P1 checkpoint `e4854d20` plus lanes A and C). Uncommitted: P3, 44 paths. R =
  `packages/fluxiq/src/programs/automation-studio/runtime`.
  - w5: `R/llm/node-tools/replay-span.ts` (new), `replay-draft.ts`, `dry-run-gate.ts`, `run-flow-part.ts`,
    `R/flow-draft/dry-run.ts`. New tests `replay-draft-loop.test.ts`, `dry-run-gate-loop.test.ts`; `run-flow-part`
    and `dry-run` tests extended.
  - w6: `R/result-verification/build-test/pass-lines.ts`, `span-rows.ts`, `test-inputs.ts` (new), `summary.ts`,
    `index.ts`, `R/result-verification/contracts.ts`, `R/llm/diagnosis-instructions.ts`, `R/llm/step-log/field-names.ts`
    (new), `tool-step.ts`, `index.ts`, `R/llm/deepseek/tests/system-prompt-pins.json`.
  - w8: `R/flow-bootstrap/adaptation.ts` (`metadata.declaredConsequences`), `R/llm/evidence-loop/rerun-request.ts`,
    `R/flow-draft/amendment.ts` (`rerun_holds_binding`), `R/llm/draft-amendment-feedback.ts`,
    `R/flow-bootstrap/evidence-loop-steps.ts`, `R/activity/wording/draft-edit-refused.ts`.
  - w9: `R/llm/loop-configuration.ts`, `R/llm/evidence-loop.ts`, `R/llm/node-tools/run-flow.ts`, `R/service.ts` (two
    call sites: `nodeOf: nodeDescriptions.definition`), `R/llm/node-tools/dry-run-gate.ts`,
    `R/flow-draft/full-run-required.ts`, `R/llm/harness/request-evidence-check.ts`; new test
    `run-flow-rows-in-loop.test.ts`.
- **Downstream** `C:/Users/osrs_/FluxStuff/fxwork/t252/!FluxIQWebExtension`, same branch, HEAD `3ca6194b` (P2
  checkpoint `c62900cb` plus lanes A and C). Uncommitted: `domain/src/runtime/llm-evidence/node-run/written-step.ts`
  (lane A's `choice: undefined`, the only merge break), the design doc (Current State, briefs w4-w9, two ledger
  entries), `docs/working/README.md` (regenerated), reports w5, w6, w8, w9 and this report.

## What changed and why (P3)

The build's test now runs a loop as a loop: a `repeat` over a list runs each span member once per row the list
returned in the test, with that row as `item` and `$state` bindings resolved by the executor's resolver. A lasting
act becomes one verify call per row, never a press. The judge sees one line per pass, named by the row's screened
label. Stored nodes keep their declared consequences. The walker is fed node definitions at all three places it runs
in a build.

## Commands run and observed results

- Core libraries: `node scripts/build-cache/cli.mjs contracts:build fluxiq:build client-gateway-websocket:build` ->
  all three "reuse" (current). `pnpm build` -> the web app step fails on dev's `recall` kind (not t252, below).
- Downstream against the merged Core: `pnpm --filter @fluxiq-web-extension/domain check`, `.../extension check`,
  `.../test-runner check` -> first run 1 error, `written-step.ts(115)` missing `choice`; fixed; re-run rc 0, 0, 0.
- Domain tests beside t252 (81 files, `DOMAIN_TEST_BUILD_LABEL=t252-lead`) -> "# tests 621 # pass 621 # fail 0".
- Core after the merge, before P3: 9 test directories -> 148 files, 1529 passed, including recorded-windows.
- Core after w5, w6, w8: 11 directories -> "Test Files 229 passed", "Tests 2717 passed".
- Core after w9: `npx vitest run` runtime/llm, runtime/flow-draft, runtime/result-verification -> "Test Files 183
  passed", "Tests 1721 passed". `tests/service-bootstrap/tests/adaptation.test.ts` alone -> 9 passed (it timed out
  once under w9's parallel load; it is a known load-flaky test).
- `pnpm --filter fluxiq check` -> clean (stamp reuse). Core `node scripts/structure-audit.mjs` -> "passed (231
  warning(s), 349 baselined)". Downstream audit -> "passed (162 warning(s), 118 baselined)".

## Not verified

- No test yet runs the assembled Flow and the walker side by side (parity), and no scripted build proves the
  confirm-requests shape end to end. That is w7.
- The domain's real `outputs.records` and `item` handling against the walker: each side is unit-tested on its own.
- The domain tests were not re-run after P3. P3 changed only Core, and the downstream typechecks ran before P3, so
  re-run them after the lane D merge.
- Full suites and live runs: not run, by rule.

## What is next, in order

1. Supervisor: checkpoint P3, then merge lane D (Core `2da9ce41`, downstream `9fed3b76`). Expect contact in
   `R/flow-draft/amendment.ts` (single-row twin drop vs `bind` and `rerun_holds_binding`),
   `R/llm/draft-amendment-feedback.ts`, `R/result-verification/build-test/summary.ts` (rowContextKeys vs w6's pass
   lines), `R/llm/harness-options/binding.ts`, and downstream `domain/src/runtime/llm-evidence/plan-resolution/*` and
   `structure/first-item` (vs w3's `state-binding.ts` and the `row-scope.ts` move). `R/llm/evidence-loop.ts` is at
   the 800-line limit: if lane D adds lines there, it needs a split.
2. Rebuild Core libraries, re-run the three downstream typechecks, the domain tests beside t252 and the Core
   directories above.
3. w7 (brief in the design doc): the parity test and the scripted proof, with its variants (written Confirm,
   non-lasting act, zero rows refused `not_reached`, declared consequences kept on the stored node).
4. P4: Core architecture docs for the draft, the test and bindings; the downstream build-loop page;
   `docs-reference --check` in Core.

## Open questions or contradictions found

- **Stored-run permission gate (user).** Stored nodes now keep `metadata.declaredConsequences`, but no plain run
  reads it. Gating stored runs on it would change what every stored Flow does when it runs, so that is the user's
  call.
- **Core web app build broken on dev** (not t252): `apps/web/src/features/automation-studio/conversation/components/action-card/action-icons.ts`
  lacks the `recall` `ActivityActionKind` that lane C added (`383d529a`).
- Decisions taken (the supervisor may override): a while span whose body is a lasting act runs one pass; a written
  member excused because an earlier lasting act was withheld stays excused; zero rows give recorded members
  `passes: []` and refuse only written members.
- `R/flow-draft/amendment.ts` is large (`bind` could move to its own module). Downstream `node-run/` and
  `node-run/tests/` are at 25 files, Core `R/llm/evidence-loop/` at 25, and `R/llm/evidence-loop.ts` at 800 lines.
- P5 must add earlier steps' outputs to the walker's resolution state, for `$step` bindings.
