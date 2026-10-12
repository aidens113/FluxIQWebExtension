# t452 candidate cache/stall/control feedback

Status: Complete; supervisor current-source/output gates verified, ready for integration.
Owner: candidate-recovery-feedback-b worker.

## Current State

Supervisor final verification: reviewed diffs; independently ran runtime 50 and final relocated wiring/receipt
17, UI 114 and domain 15. Actual fresh owning Core build after final prefix correction passed (45.249 s,
7218 outputs), cache-free Core typecheck exit 0, actual domain freshness/source/test check (9.577 s) and
both audits passed after dev sync. Architecture updated. No live proof of these changes yet.

The following worker handoff predates that final output verification:

Generic candidate cache/stall guidance now preserves the latest valid accepted revision/digest and names the exact candidate trial before completion. Wrong-control advice distinguishes a control's existence/type from its intended purpose. Actual cached-request and stall wiring is tested; legacy behavior, exact-trial gates, purse, retry bounds and public API semantics are preserved. Final owned source snapshot is `7d21adf8341af485a00c750b26c97ea9c0b8a22dfd39cfd188623cb4388a54f9`. Source is frozen; no further worker edits planned. Current 107 narrow tests, actual Core typecheck and both structure audits passed. Latest built output still predates the final prefix correction; the supervisor owns its rebuild and downstream verification. No live/provider run performed in this brief.

## Initial approved ownership expansion (historical; final paths below)

New Core source `packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-loop/candidate-receipt.ts`, owner `evidence-loop/tests/candidate-receipt.test.ts`, existing barrel. Existing `evidence-loop/answered-request.ts`, `decision-handlers/answered-request.ts`, minimal `llm/evidence-loop.ts` facts wiring, `evidence-progress/stall-redirect.ts`, `flow-bootstrap/candidate/submission-refusal.ts`; owning test files `decision-handlers/tests/decision-context-wiring.test.ts`, `evidence-progress/tests/stall-redirect.test.ts`, `candidate/tests/submission-refusal.test.ts`. No candidate gates/purse/provider/model examples or C-owned source edits.

### Fail-first observed and implementation

Direct candidate stall2/wrong-control2 failures reproduced; cache integration test corrected test stub value/input mismatch, then fails precisely because actual cache note lacks candidate receipt. No fixture failure counted as product evidence. New helper copies only validated latest submission revision/digest; no trial status/acceptance inferred. Cache/stall candidate notes now name exact trial path without legacy draft/amendment/illegal completion, preserve dedupe/no-progress bounds. Wrong-control advice offers intended-control node correction or observed target correction without declaring handle semantically right. Source edits complete pending owning tests; actual typecheck/audit coordinate with C.

### Strict typing and module budgets corrected

First actual check/build identified explicit-undefined candidate optional fields and incomplete new test refusal shape; corrected (issueCodes preserved). First Core audit reproduced directory26>25 at source/tests and coordinator802>800. Supervisor approved relocation to evidence-loop/candidate-receipt/{receipt.ts,index.ts,tests/receipt.test.ts} and extracted existing coordinator fact snapshot to evidence-progress/redirect-facts.ts (+existingbarrel), no limit/baseline expansion. Receipt selection has one owner, exported once through its feature barrel; new facts module uses feature owner and erased type imports, no barrel cycle. Existing actual-loop test covers wiring. Refreezing after new owner tests.

### Intermediate source snapshot refrozen (superseded)

Approved feature paths now final: evidence-loop/candidate-receipt/{receipt.ts,index.ts,tests/receipt.test.ts}; evidence-progress/redirect-facts.ts and existing barrel. Actual coordinator line count 795, reduced by moving fact assembly to its responsibility owner, no limits/baselines expanded. Updated optional candidate contracts and test issueCodes shape. Latest owner run 50/50 passed; final actual typecheck/audits/compatibility tests in flight with C source stable, C owns current library/domain build/check. Owned source/test snapshot SHA256 `e6f4bed034e065f6c4e1a5aab0587c2b3da56707f015e59fe3c8264676cc4bab` (ordered 14 listed paths).

### Final depth/barrel correction

Actual typecheck and 54 compatibility tests passed, but audit proved nested receipt source depth10>9 and direct type import outside owner barrel. Supervisor approved final feature path runtime/llm/candidate-receipt/{receipt.ts,index.ts,tests/receipt.test.ts}. Moved only new owned feature (resolved source/destination verified within t452 Core workspace), changed narrow imports and type-only answerability import to parent evidence-loop barrel; erased type import introduces no runtime edge. No behavior/limits/baseline change. Waited for C library/domain checks to finish before mutation. Final current library rebuild and check/audit follow this relocation; prior stamped output is not claimed current now.

### Final owned source paths and snapshot

All paths relative to Core packages/fluxiq/src/programs/automation-studio/runtime:

- `llm/evidence-loop.ts`
- `llm/evidence-loop/index.ts`
- `llm/evidence-loop/answered-request.ts`
- `llm/candidate-receipt/receipt.ts`
- `llm/candidate-receipt/index.ts`
- `llm/candidate-receipt/tests/receipt.test.ts`
- `llm/decision-handlers/answered-request.ts`
- `llm/decision-handlers/tests/decision-context-wiring.test.ts`
- `llm/evidence-progress/stall-redirect.ts`
- `llm/evidence-progress/redirect-facts.ts`
- `llm/evidence-progress/index.ts`
- `llm/evidence-progress/tests/stall-redirect.test.ts`
- `flow-bootstrap/candidate/submission-refusal.ts`
- `flow-bootstrap/candidate/tests/submission-refusal.test.ts`

Pre-prefix owned snapshot SHA256 `4c30f49da3925c03725811f7c5ad2ce5c52bf8fe680a2efc5173325ec94ee46f` is superseded. Final snapshot is `7d21adf8341af485a00c750b26c97ea9c0b8a22dfd39cfd188623cb4388a54f9`; calculated by SHA256 over each listed relative filename followed by its raw file bytes in the order above. Owner-check pre-supervisor-sync Core HEAD `1dbb1081a59db60799455a9f56555a5b30ea6efc`; downstream HEAD `b6f7565f02b3733acd7c2f562508c64451dc080d`. C source remained stable throughout final owner checks.


### Final prefix review and current source verification

Final review found candidate-mode request text incorrectly described unoffered calls and fresh unchanged observations as cached calls. Prefixes now describe the actual execution outcome: unoffered/not run, looked again/unchanged, or cached/not rerun. Three neutral regression cases cover these channels. Removed a model-facing aside about the unchanged stopping guard. This last bounded edit invalidated prior built-output freshness claims; supervisor and C peer were notified before integration. No source edits followed the final refreeze.

Final observed source gates:

| Gate | Current result |
| --- | --- |
| Eight named narrow Core test files | 107/107 passed, 8 files, exit 0, 13.77s |
| Actual Core TypeScript command | exit 0; actual tsc, not a build-cache hit |
| Core structure audit | exit 0; 330 warnings / 1159 baselined |
| Downstream structure audit | exit 0; 184 warnings / 646 baselined |
| Git diff whitespace check | clean |

Commands were run in the respective t452 paired tree, after both workers froze source:

```powershell
pnpm.cmd --filter fluxiq exec vitest run src/programs/automation-studio/runtime/llm/decision-handlers/tests/decision-context-wiring.test.ts src/programs/automation-studio/runtime/llm/evidence-progress/tests/stall-redirect.test.ts src/programs/automation-studio/runtime/llm/candidate-receipt/tests/receipt.test.ts src/programs/automation-studio/runtime/flow-bootstrap/candidate/tests/submission-refusal.test.ts src/programs/automation-studio/runtime/llm/evidence-loop/tests/stall-guard.test.ts src/programs/automation-studio/runtime/flow-bootstrap/candidate/tests/authoring-loop.test.ts src/programs/automation-studio/runtime/flow-bootstrap/candidate/tests/trial-gate.test.ts src/programs/automation-studio/runtime/llm/repeat-guard/tests/candidate-feedback.test.ts
pnpm.cmd --filter fluxiq exec tsc --noEmit --incremental --tsBuildInfoFile node_modules/.cache/fluxiq-build/t452-candidate-feedback.tsbuildinfo
node scripts/structure-audit.mjs
# Same narrow structure-audit command in downstream paired tree.
git diff --check
```

Test counts in the named order are 12, 9, 8, 24, 14, 10, 25 and 5. This includes compatibility coverage for unchanged authoring/trial/stall/repeat guards. Receipt unit tests reject malformed/refused latest submissions instead of silently using an older receipt; accepted receipt fields are copied. First cache regression fixture used the wrong callback field; corrected before the precise product failure was counted.

### Built-output boundary and handoff

C's prior owning library build (73.2s, 7218 files), domain freshness/typecheck (21.5s) and 15 instruction tests passed before the last prefix edit, and are historical evidence. C was reassigned; supervisor owns the post-prefix rebuild/check. Independent current runtime manifest inspection found artifact digest `9432f4064b2a7d09b726a788ea04f433b7534464e61ef6cd9a19d125a1011b0b`: 8 of 10 owned production file hashes match current source, while `llm/evidence-loop/answered-request.ts` and `llm/evidence-progress/stall-redirect.ts` do not. Current-output validation is therefore explicitly outstanding, not inferred from earlier build success.

No whole suite, live browser/provider launch, baseline expansion, source merge, commit or push occurred. The supervisor owns authored architecture updates and integration. Tests prove deterministic receipt/guidance routing and preserved gates, not future model behavior or live lane success. Future live launches use the separately authorized $0.25 whole-Flow process ceiling; this brief changes no purse implementation and preserves the historical B $0.10 result.

Supervisor handoff update: both trees have now been synced with current dev by the supervisor. Current-source owning Core library build is in flight, supervisor log `fxwork/t452/t452-supervisor-final-build.log` / session 64622; supervisor will run actual downstream freshness/typecheck after build success. No duplicate worker build or transient-output claim. Worker source remains frozen.
