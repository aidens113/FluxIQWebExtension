# Classifieds seller-read diagnosis and generic repair guidance

Status: Ready for supervisor integration; live correction not yet verified

## Outcome

The failed candidate combined navigation to one item with a seller identity observed on another item. The extension correctly refused the missing seller target. The bounded fix changes generic Core trial feedback to trace preceding steps and context before changing the failed step. Identity matching, retry policy, scenario instructions and oracles remain unchanged.

Only these authorized Core files changed:
- packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/candidate/trial-stop.ts
- packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/candidate/tests/trial-stop.test.ts

The supervisor owns integration. This worker has not committed, merged or pushed. Successful live authoring, permission handoff, exact oracle and zero-call replay remain required.

## Actual run evidence

Run: run-mvd9nlx5-1373850d, local-classifieds-test-ride-question. Artifacts were inspected locally under C:/Users/osrs_/FluxStuff/lab-runs/2026-10-17/run-mvd9nlx5-1373850d/steps. Findings below omit copied page content, seller names and message text.

- 0085-tool-core.run_node/result.json: extraction returned three rows. Target t932 names an observed item link on this page.
- 0131-tool-core.run_node/result.json: the same t932 link is still shown. Its final item identifier differs from the exact detail URL used at 0135.
- 0135-tool-core.run_node/call.json and result.json: direct navigation successfully opened another item's detail page.
- 0139-tool-web.find_on_page/result.json: target t1317 was obtained on that latter detail page.
- 0141-tool-core.submit_subflow/call.json: final script opens t932, optionally closes chat, then reads seller t1317. The candidate contains no radius-setting or sort-control step.
- 0143-tool-core.test_subflow/result.json: trial step 11 clicks t932 successfully; step 12 closes chat if present; step 14 fails reading t1317 after four attempts (web.target.not_found).

Cross-checking item IDs against the three extracted rows at 0085: t932 belongs to row index 2; successful detail navigation at 0135 belongs to row index 0. Ascending-price order is indices [2, 0, 1]. Prior trial feedback had identified the distance condition as unsatisfied. The final candidate still omits radius-setting and combines different item identities.

This establishes an authoring/navigation mismatch before replay. There is no evidence that reloading lost the intended seller identity. Accepting another seller or guessing from the same DOM position would hide the error.

## Guidance change

Old failed-step feedback told the builder to correct that step. New feedback asks it to trace preceding steps and compare the context they reached with what the failed step needs, because the cause may be earlier. It then directs correction of the step that caused the failure. The failed step remains named, and existing retry eligibility remains intact.

The regression uses generic document selection followed by revision lookup, covers both retestable and non-retestable feedback, and checks that the failure is still attributed accurately. No example mirrors a realistic scenario.

## Observed validation

- Fail-first: candidate/tests/trial-stop.test.ts, 1 failed / 8 passed. New case failed because old guidance omitted preceding-context diagnosis. Total 50.85 s, mostly collection.
- After fix: `pnpm.cmd exec vitest run src/programs/automation-studio/runtime/flow-bootstrap/candidate/tests/trial-stop.test.ts src/programs/automation-studio/runtime/flow-bootstrap/subflow-candidate/tests/subflow-trial-stop.test.ts --maxWorkers=2 --minWorkers=1` from Core packages/fluxiq: 2 files / 12 tests passed, exit 0, 97.50 s.
- `pnpm.cmd --filter fluxiq check`: actual compiler ran, exit 0, 51.306 s.
- `node scripts/structure-audit.mjs`: passed, 401 warnings / 1154 baselined, exit 0.
- `git diff --check`: exit 0.

No full suite or browser test was run for this guidance-only change. Existing runtime traces already show correct refusal; only a live rerun can prove improved authoring behavior.

## Lane 1 preparation

Supervisor assigned t563 lane 1: bigbox-retail-rated-delivery-towels, then local-classifieds-test-ride-question; auction-marketplace-cheap-accessory-auctions if both finish. Paid launch remains gated on supervisor release after integration.

Read current live-lane-1 report and A8 Run Plan. Slot C:/Users/osrs_/FluxStuff/lab-slots/slot-1/owner assigns t563 / bf-live-lane-1 / bf-slot-1, pid null. Existing provider-key discovery helper reports a key present in this tree's .env.local; no value was printed. No other t563 build lock or live run was found. Supervisor's t563 process was a focused test, not a build.

Authorized cache-off three-library Core build started, session 1934, on frozen source. Contracts and gateway reused matching stamps; fluxiq rebuilding. No paid launch made.
