# t274 Legacy Harness Seam Review

Date: 2026-09-26
Repository reviewed: `F:\!FluxIQ` (read-only)
Outcome: **NO-GO until the barrel violation is removed.** Behavior and API compatibility are otherwise GO.

## Verdict

| Area | Verdict | Evidence |
| --- | --- | --- |
| Harness behavior compatibility | GO | `AutomationStudioService.runFlowBootstrapLlmHarness` retains its private name, parameter type, return type, and denied-evidence-key adapter. Both ordinary generation and evidence-guided decision calls now pass through the scoped `runHarness` wrapper, which still dispatches through the patchable private seam. |
| Harness test compatibility | GO | `accounting.test.ts` patches the same instance property and covers pre-seam setup, raw `Error`, `TypeError`, `DOMException`, evidence-guided escape, structured failure preservation, and successful-result/post-call failures. Removing or bypassing the seam would make these cases take the real harness path and fail. |
| Target-validation behavior | GO | The extracted function preserves the old order and inputs: fetch the parent, derive its persisted representation and node/edge counts, await router existence and Subflow count, call `automationStudioBootstrapTargetRefusal`, throw its exact refusal, otherwise return the same parent artifact. |
| Public API / encapsulation | GO in the current tree | The helper is not re-exported by `flow-bootstrap/index.ts`, so it has not entered `runtime/index.ts` or the package public surface. The harness method remains TypeScript-private; test access is still an explicit `(instance as any)` seam. Public service signatures are unchanged. |
| Repository structure | **NO-GO** | Read-only `node scripts/structure-audit.mjs` exits nonzero with one violation: `runtime/service.ts:97` imports `./flow-bootstrap/bootstrap-target.ts` past the directory barrel. |

## Compatibility trace

The old private `assertBootstrapTarget(projectId, flowId, mode = "create")` has four replacements, all with explicit mode normalization:

- generation uses the validated request's `mode`;
- adaptation creation uses `input.mode ?? "create"`;
- instruction preparation uses literal `"create"`;
- adaptation application uses `adaptation.mode ?? "create"`.

The callback adapters preserve service binding (`this.getFlow`, persisted representation, router lookup, and one-item Subflow summary). The extracted function still evaluates both topology lookups before asking the pure refusal function, matching the old object-literal argument evaluation. Existing tests cover create-mode refusal on a nonblank Flow, extend-mode generation on an existing Flow, create refusal against that Flow, in-place extend application, and the pure create/extend/representation refusal matrix.

The restored harness seam is semantically narrower only in the intended way: raw throws are classified immediately around the actual top-level harness call. A structured `AutomationStudioFlowBootstrapGenerationError` remains structured, while an untyped escape records unknown provider provenance. Setup before the seam remains `not_attempted`. The wrapper is used by instruction-authority calls, evidence-loop decisions, and the direct non-evidence build.

## Structure impact and required correction

- `service.ts` currently has 4,559 physical lines, against a ratcheted baseline of 4,568: only **9 lines of margin**.
- `AutomationStudioService` has **222 counted methods**, exactly its ratcheted baseline: **zero method-count margin**. Extracting the target validator removed one private method while the new private generation arrow restored one, so the count did not improve.
- `bootstrap-target.ts` is a cohesive 24-line, one-export module.
- `accounting.test.ts` is 411 lines and now receives the ordinary over-400 advisory warning; this is not a failing gate.
- The direct cross-directory import is a new failing `imports` finding and is not present in the baseline.

Do not fix that finding by adding `bootstrap-target.ts` to `flow-bootstrap/index.ts`: that barrel is re-exported by `runtime/index.ts`, so doing so would unnecessarily add this service collaborator to Core's public layer surface. The narrow correction is to place the target assertion under the internal `service/flow-bootstrap-commands/` ownership group, export it through that group's barrel, and add it to `service.ts`'s existing consolidated import from `./service/flow-bootstrap-commands/index.ts`. Then rerun the structure audit without increasing either ratchet.

## Exact missing tests

These are coverage gaps, not observed behavior regressions:

1. Add a direct collaborator test for the extracted target assertion. It should prove that a successful call returns the identical parent object, forwards the exact project/Flow ids, invokes `getFlow`, representation, router, and Subflow-count ports once, and preserves the current lookup order. It should also prove an exact refusal and propagation of a collaborator rejection. Existing tests exercise the pure refusal policy and several service paths, but not this extracted orchestration boundary itself.
2. Add one seam-level denied-key forwarding regression. With a nonempty bound `deniedEvidenceKeys`, drive a real service generation far enough to inspect the packed provider request and prove the private seam supplied the binding's list for both direct bootstrap and evidence-guided decision calls. Lower-level packing tests prove denied keys are enforced, and the binding type requires the field, but no current service-bootstrap test directly pins this seam's adapter.

The first test should live beside the helper under its owning directory's `tests/` folder after the structure correction. The second belongs in `runtime/tests/service-bootstrap/tests/`, preferably a focused file rather than further growing `accounting.test.ts`.

## Validation performed

- Inspected current `service.ts` hunks, `bootstrap-target.ts`, all seam-patching accounting tests, the pure refusal tests, and nearest create/extend/apply callers and tests.
- Counted the current facade with TypeScript's AST: 222 methods, 59 import declarations.
- Ran `node scripts/structure-audit.mjs`: **exit 1**, exactly one failure (`imports` at `service.ts:97`), plus existing advisory warnings and one lowerable baseline entry.
- Ran no builds, generated-output commands, package tests, source edits, live commands, or provider/browser operations.
