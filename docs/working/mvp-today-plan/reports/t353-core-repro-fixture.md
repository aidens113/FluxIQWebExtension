# t353 — deterministic Core Stage-2 reproduction fixture

## Result

Implemented the bounded service-level reproduction in the single assigned Core test file. No production file, provider, browser, live artifact, shared plan, commit, or push was touched.

The fixture drives the real `AutomationStudioService.generateFlowBootstrapAdaptation` path through the real grant service and DeepSeek adapter with a local endpoint, real web-domain node definitions, real answerability checking, proposal persistence, and terminal grant revocation.

## Changed files

- `F:/!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime/tests/deepseek-bootstrap-exploration.test.ts`
- `F:/!FluxIQWebExtension/docs/working/mvp-today-plan/reports/t353-core-repro-fixture.md`

## Added behavior and assertions

The failure branch deterministically performs 26 paid decisions and 22 successful tool executions:

- six opening tool calls;
- a rerun at decision 7, producing amendment and tool rows at the same iteration;
- one applied `optional` amendment at 8 and the same refused as `already_so` at 9;
- a records-request completion refused with `bootstrap.cannot_answer_instruction` at 10;
- fourteen further unique successful calls;
- a late rerun at 25;
- the same answerability refusal at 26 and exhaustion under that exact issue.

Assertions pin the decision/tool counts, exact 31,200/3,900/35,100 token accounting, feedback delivery on the next request, amendment/refusal rows, shared rerun iterations, positive evidence bytes, first-observed then unchanged answerability progress, no result or stored proposal, zero adaptations, and one terminal revoke with no active grant.

The companion branch shares decisions 1–10 and returns a corrected plan with `web.output.dom-extract_list` at decision 11. It pins successful proposal persistence, one adaptation, the extraction node, refusal-then-completion trace, exact 13,200/1,650/14,850 accounting, and the same one-time grant release.

The endpoint retains only iteration numbers, offered decision kinds, tool ids, and closed issue/refusal codes. It does not retain instruction text, provider text, selectors, tool arguments, or results.

## Design correction found while implementing

Against the current real grant seam, `maxCalls: 27` yields 27 decision calls. The fixture therefore uses `maxCalls: 26` to reproduce the measured 26-decision boundary. The design report's assumption that a separate reserved call reduces 27 to 26 is not true for this service path. The 48,000/8,000/56,000 per-call limits match the live-shaped request capacity and prevent the deterministic request body from reaching the smaller legacy input ceiling.

## Validation

Final post-integration command, run after the coordinator's progress/revision changes settled:

```powershell
pnpm --filter fluxiq exec vitest run src/programs/automation-studio/runtime/tests/deepseek-bootstrap-exploration.test.ts -t "reproduces|converges"
```

Result: PASS — one file passed; 2 named tests passed and 8 tests were skipped by the name filter. Duration 28.99 seconds (23.94 seconds test time).

No repository-wide check, test, or build was run, per the brief and because parallel edits were active.

## Remaining risk

This is a privacy-safe service reproduction, not a browser reproduction. Its deterministic tool reports applied synthetic draft steps so rerun/amendment behavior is exercised, but it does not claim the live page's provider content or browser state was identical. The supervisor still needs to review the fixture against the final integrated production diff and include it in broader Core validation.
