# Domain catalog failure investigation — 2026-10-31

Outcome: Done
Changed: this report only; no product/source/git changes.

## Exact cause

The failure is deterministic vocabulary interference in the catalog, not test ordering, virtual clocks, a stale bundle, or a leaked registry.
`domain/src/actions/schemas.ts:255` describes the surviving click node as: "Click a DOM element. Choose ensureState as an exact observed state signature ...".
Core's `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/plan/required-terms.ts:39` accepts any equivalent word found in any offered definition; `:61` includes its entire description.
Consequently the incidental instruction to **choose a parameter** is treated as proof that click provides the **choose an option** capability.
The negative registry correctly removes `web.dom.select` and `web.dom.check`; its remaining click description alone falsely satisfies `choose`.
The debugger captured `requiredTerms=["enter","choose","submit","verify","end"]`, `missingRequiredTerms=[]`, and exactly one selection-word match: `web.output.dom-click.description`, term `choose`.
No Core mutation or earlier test entry is required to reproduce it. The registry uses its own Map; the definition list is cloned by the domain. The imported Core junction resolves to frozen t822's sibling Core.

## Cause and distance travelled

The owner script rebuilt and loaded **only** `src/tests/domain.test.ts`, under unique label `catalog-debug-1031-solmax`, from a fresh ignored cwd with inherited provider credentials and `FLUXIQ_*` removed.
A debugger breakpoint inspected existing locals immediately before the original assertion; it changed no source, registry, result or assertion.
The complete catalog and both provider-free dry runs passed before the unchanged negative assertion failed at compiled line 20378.
The subsequent incomplete-harness/provider-unreachable checks were not reached. No provider call, browser or panel was used.
The run finished in about five seconds, exit 1: `1 of 1 domain test entries failed to load: src/tests/domain.test.ts`.
The first launcher attempt rejected an absolute Windows `--import` path before loading any test; a relative preload path corrected that setup error.
Retained evidence: `test-runs/2026-10-31-domain-catalog-debug/domain-entry.log` (ignored).

The premise that t821 domain passed is contradicted by `test-runs/2026-10-31-sweep-1/web-test.log:3433`: it records the identical t821 loader failure at line 20378. The node:test pass count excludes this top-level load failure.

## Minimal fix ownership and narrow acceptance

Downstream owns the immediate catalog wording fix: in `domain/src/actions/schemas.ts:255`, change the incidental "Choose ensureState" to "Use ensureState" while retaining the exact signature/skip behavior. This removes an unintended capability claim; do not remove or weaken the negative catalog assertion or provider gate.
Core owns the broader fragility: capability availability is inferred from unrestricted prose, so future incidental words can repeat this. A structural redesign would need an explicit capability declaration and compatibility work; it is outside this read-only brief.
The existing unchanged negative guard already supplies a meaningful regression: selection is available with its nodes, missing without both selection nodes, and no provider is called when missing.
After the targeted fix, run the following provider-free entries together with a fresh unique label/root:
`node domain/scripts/test-domain.mjs src/tests/domain.test.ts output-nodes/tests/model-facing-catalog.test.ts output-nodes/tests/click-ensure-state.test.ts`
Also run the documented domain typecheck and structure audit for the eventual change. No full suite is needed or authorized today.

Validation: `node --import ./catalog-preload.mjs C:/Users/osrs_/FluxStuff/fxwork/t822/!FluxIQWebExtension/domain/scripts/test-domain.mjs src/tests/domain.test.ts` -> reproduced exit 1, exactly one entry; debugger proved the sole false capability match.
Not verified: proposed wording fix, later assertions, full suites (daily cap used), live browser behavior.
Report: docs/working/framework-heavy-lifting-plan/reports/codex-1031/domain-catalog-failure.md
Notes: Product source remains untouched. No commits, spawning or paid calls. Fix requires the lead's next scoped unit.
