# t243-w2: the build records route signatures

- Worker: t243-w2-build-records-route-signatures, 2026-10-02
- Tree: Core `fxwork/t243/!FluxIQ`, branch `task/t243-state-routing-runtime`. R/ = `packages/fluxiq/src/programs/automation-studio/runtime/`
- No commits, no Lab run, no provider call, no Core library build.

## Outcome

Partial. The whole path works and is tested: build routing records signatures, they ride the draft step, script
step, plan node and validated build plan into Flow node metadata, and they survive apply's re-validation round trip.
The structure audit fails, though. The two value imports from flow-bootstrap into the shared contract have to skip
the `route-state` barrel. Going through the barrel creates a module-evaluation cycle that breaks at run time. The
lead's file placement has to change to fix this (see Open questions 1).

## What changed and why

- `R/route-state/build-routing.ts`
  - Keeps a `Map<digest, signature>`.
  - In `recording`, after each call whose result is an `llm_evidence_tool_execution` with a non-empty string
    `stateDigests.after`, it stores `automationStudioSignRouteState(hostRuntime, ran.state)` under that digest. It
    stores nothing when the host does not sign.
  - `ran.state` is the call's carried `routeState`. For the free first look that carried none, it is the state
    observed right after the look, which the existing code already treats as the state the look left (see Open
    questions 3).
  - Observations made in `observing` and at the start have no digest, so they map nothing.
  - New `signaturesOf(step)` returns `{ before?, after? }` looked up by `stateBefore` and `stateAfter`, or
    `undefined` when neither page was signed.
- `R/service.ts`: one property, `routeSignaturesOf: routing.signaturesOf`, on the `checkAutomationStudioFlowBootstrapCompletion` call in `checkCompletion`. Nothing else changed.
- `R/llm/harness-options/bootstrap-completion.ts`
  - New optional input `routeSignaturesOf`, passed through `fromDraft` to the assembler.
  - `fromReply` now runs the accepted plan through `withoutRouteSignatures`, which drops the field from every node:
    the field is Core-derived only.
- `R/flow-bootstrap/authoring/assemble-draft.ts`: new optional input `routeSignaturesOf`. Each routed step carries its step's signatures.
- `R/flow-bootstrap/authoring/draft-routing.ts`: `AutomationStudioFlowDraftRoutedStep.routeSignatures?`. `scriptStep` copies it. `mergeStep` and the loop nodes get none.
- `R/flow-bootstrap/authoring/contracts.ts`: `AutomationStudioFlowScriptStep.routeSignatures?`.
- `R/flow-bootstrap/authoring/assemble.ts`: `buildNode` copies the step's signatures onto the plan node with `structuredClone`.
- `R/flow-bootstrap/plan/contracts.ts`: `AutomationStudioFlowBootstrapNode.routeSignatures?: AutomationStudioRouteSignatures`.
- `R/flow-bootstrap/plan/parsing.ts`
  - `routeSignatures` is now an allowed node field.
  - A value that `automationStudioRouteSignaturesValue` rejects is refused with
    `bootstrap.invalid_route_signatures` at `<node path>.routeSignatures`.
- Validation and layout: no change needed.
  - `validateAutomationStudioFlowBootstrapPlan` returns the parsed plan object, and name correction spreads
    `...node`.
  - `layoutNodes` spreads `...node`.
  - Parameter resolution uses `structuredClone`.
  - The field therefore reaches the validated build plan untouched. The round-trip test confirms this.
- `R/flow-bootstrap/adaptation.ts`: `normalizeAutomationStudioFlowBuildPlan` writes `metadata.routeSignatures`, using `AUTOMATION_STUDIO_ROUTE_SIGNATURES_METADATA_KEY`, through `routeSignaturesMetadata()`. That function re-reads the value with `automationStudioRouteSignaturesValue` and writes no key when there is none.
- Doc: `docs/architecture/automation-studio/llm-flow-bootstrap.md` has a new bold-led paragraph, "Each step records the page it started on and the page it left (t243).", right after "A step that answered an interruption is optional".
- Tests, each in the `tests/` folder beside its subject:
  - New `R/route-state/tests/build-routing-signatures.test.ts` (7 cases):
    - lookup by digest, where a step's before is the previous call's after;
    - the first look counts;
    - a first look with no route state counts the state observed right after it;
    - repeated call ids across rounds do not collide;
    - an observation without a digest maps nothing;
    - a host without a signer records nothing;
    - an oversized signature records nothing.
  - `R/flow-bootstrap/authoring/tests/assemble-draft.test.ts` (+3):
    - nodes carry their step's signatures;
    - the merge node of an optional step gets none, and a step the lookup answered nothing for gets none;
    - nothing is recorded without a lookup.
  - New `R/flow-bootstrap/plan/tests/parsing.test.ts` (3): valid values accepted, six malformed shapes refused, and a node with no signatures is unchanged.
  - New `R/flow-bootstrap/tests/route-signatures.test.ts` (4):
    - the field carries through validation;
    - normalize writes the metadata, and `automationStudioNodeRouteSignatures` reads it back;
    - the apply round trip: `stableJson(validate(stored.plan).validated) === stableJson(stored)`, and
      `stableJson(normalize(revalidated)) === stableJson(stored topology)`;
    - no key is written for a node with no signatures.
    - It sits in `flow-bootstrap/tests/` because it spans authoring, plan and adaptation.
  - `R/llm/harness-options/tests/bootstrap-completion.test.ts` (+2): the draft path puts `routeSignaturesOf`'s answer on the build plan nodes, and the reply path drops model-written signatures.

## Commands run and observed results

All `vitest` commands were run from `packages/fluxiq`, with `R=src/programs/automation-studio/runtime`.

1. **Failing-first, on unchanged code** (new tests only):
   `pnpm exec vitest run $R/route-state/tests/build-routing-signatures.test.ts $R/flow-bootstrap/authoring/tests/assemble-draft.test.ts $R/flow-bootstrap/plan/tests/parsing.test.ts $R/flow-bootstrap/tests/route-signatures.test.ts $R/llm/harness-options/tests/bootstrap-completion.test.ts`
   - Printed: `Test Files 5 failed (5)`, `Tests 14 failed | 40 passed (54)`.
   - Failure messages: `routing.signaturesOf is not a function`; `expected [ undefined, undefined ] to deeply equal [ …(2) ]`
     (assemble-draft and route-signatures); parsing `expected [ { severity: 'error', … } ] to deeply equal []`; and
     bootstrap-completion `expected [] to deeply equal [ { stateBefore: 'D0', … } ]`.
   - Three new cases passed on unchanged code:
     - "fromReply drops the field": the JSON-plan acceptor (`authoring/json-plan.ts`) already rebuilds nodes field by
       field, so a model-written `routeSignatures` never reached the parser. The explicit strip in `fromReply` is
       defense in depth, as the brief asked.
     - "a node without signatures is unchanged" and "writes no key for a node that recorded none": these are
       regression guards, not failing-first tests.
2. **First run after the change, with value imports through `../route-state/index.ts`**:
   - Printed: `Test Files 1 failed | 4 passed (5)`. The failure: `assemble-draft.test.ts`:
     `TypeError: automationStudioFlowBootstrapLargestSizeLimits is not a function`.
   - Cause: a module-evaluation cycle. `plan/parsing.ts` → `route-state/index.ts` → `router-state.ts`/`build-routing.ts`
     → `flow-bootstrap/index.ts` → `evidence-loop-steps.ts`, which calls
     `automationStudioFlowBootstrapLargestSizeLimits()` at module top level while `plan/index.ts` is still
     mid-evaluation. Its `parsing.ts` export comes before `size-limits.ts`.
   - Fix: the value imports in `plan/parsing.ts` and `adaptation.ts` now name `route-state/signatures.ts` directly.
     That file imports types only, so there is no cycle. Type-only imports still use the barrel.
3. **Same five files, after the fix**: printed `Test Files 5 passed (5)`, `Tests 54 passed (54)`.
4. **Every test in the touched subjects' directories**:
   `pnpm exec vitest run $R/route-state/tests $R/flow-bootstrap/authoring/tests $R/flow-bootstrap/plan/tests $R/flow-bootstrap/tests $R/llm/harness-options/tests`
   printed `Test Files 50 passed (50)`, `Tests 478 passed (478)`.
5. **Package check**:
   `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t243-w2 check" pnpm --filter fluxiq check` (slot b4):
   - It printed exactly one error, which is outside my files (W1's executor work in progress):
     `src/programs/automation-studio/runtime/executor/graph-run.ts(414,13): error TS7022: 'notShown' implicitly has type 'any' ...`.
   - It printed no error in any file I touched.
6. **Structure audit**: `node scripts/structure-audit.mjs` (Core root) printed `structure-audit: 3 violation(s) across 2 rule(s).`:
   - `FAIL [imports] .../flow-bootstrap/adaptation.ts: 1 import(s) reach into another directory's files instead of its barrel, e.g. "../route-state/signatures.ts" at line 25.` (mine; see Open questions 1)
   - `FAIL [imports] .../flow-bootstrap/plan/parsing.ts: 1 import(s) reach into another directory's files instead of its barrel, e.g. "../../route-state/signatures.ts" at line 9.` (mine; same cause)
   - `FAIL [failure-as-empty] .../route-state/signatures.ts: 2 caught failures are turned into empty or absent values, at lines 50, 111.` (the lead's file, not mine)

## Not verified

- No service-level end-to-end build and apply with a signing host. The round trip was checked at module level with
  the same `validateAutomationStudioFlowBootstrapPlan` and `normalizeAutomationStudioFlowBuildPlan` calls that apply
  makes. Two things were not exercised:
  - `service.ts`'s own apply path, including `assertAutomationStudioBootstrapHasNoRecordingProvenance` and the
    adaptation store's persistence.
  - The real `checkCompletion` wiring with a host that signs.
- No browser, Lab or domain signer. W3's web signer is not exercised here.
- The full Core suite was not run, by policy.

## Open questions or contradictions found

1. **The shared contract's placement forces a barrel skip.** flow-bootstrap must value-import
   `automationStudioRouteSignaturesValue` and the metadata key. Importing them through `route-state/index.ts` closes a
   module cycle, because `build-routing.ts` and `router-state.ts` value-import `flow-bootstrap/index.ts`. The cycle
   breaks at run time, as shown above. Importing the file directly fails the `imports` audit rule.
   - Suggested fix (the lead's files): move `signatures.ts` into a leaf directory with its own barrel, for example
     `R/route-state/signatures/{index,signatures}.ts` or a new `R/route-signatures/`. Keep the `route-state` barrel
     re-export if wanted.
   - Then change the two imports to `../../route-state/signatures/index.ts` (in `plan/parsing.ts`) and
     `../route-state/signatures/index.ts` (in `adaptation.ts`). Both lines are marked by the audit message.
2. **Two hazards for the domain signer (W3):**
   - Apply's `assertAutomationStudioBootstrapHasNoRecordingProvenance` throws on any key matching
     `/recording|timeline/i` anywhere in the adaptation, and signatures are now inside it. A signer must not use such
     keys.
   - Signatures count toward the plan byte bounds: `maxPlanBytes` in `parsing.ts`, and the draft's
     `maxPlanBytes` in `profile-limits.ts`. The budget is 2,048 bytes per node, and two maximal signatures are
     4,096 characters, so a large signature could refuse a Flow. Small (hashed) signatures avoid this. Excluding the
     field from the byte count would be a separate decision.
3. **The free first look's fallback state.** The brief says the look "counts the same way". When the look carried no
   `routeState`, I also map the state observed right after it, under the look's own digest. This matches the existing
   code's reading that this observation "is also the state the look left". If only carried states should count, drop
   `ran.state = observed.state` from the mapping and the matching test case.
4. **Domains that use `captureStateDigest` record no signatures.** Those are domains without `stateDigestsOnCalls`,
   whose step digests come from the hook rather than from `stateDigests` on the result. So nothing maps for them. The
   web domain reports digests on calls, so it is unaffected.
