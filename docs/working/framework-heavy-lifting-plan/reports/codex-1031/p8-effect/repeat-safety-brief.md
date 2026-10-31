Runtime role: gpt-6.1-sol max; web role: gpt-6.1-sol medium (existing workers).
Goal: fix six reproduced downstream retry regressions, preserving existing assertions and committing-action safety.
Context: MAIN test-runs/2026-10-31-t824-domain-tests.log:139/145 passed; six failures are retries/tests/uncertain-outcome.test.ts.
Core root fxwork/t824/!FluxIQ; web root its !FluxIQWebExtension sibling.
Core owned: nodes/action-effect/**, owning definition validation/tests; existing executor/native floor paths and tests. No version/export/permission-peer edits without notice.
Web owned: actions/action-effect/**, output-nodes/definitions.ts, affected retry/action tests; no Core/shared docs/version edits.
Frozen API: optional repeatSafe?:true on registered NodeActionEffect and resolved effect. It is an explicit trusted promise, never inferred from state or model metadata. Absent remains cautious.
Definition state+commitWhen+repeatSafe is valid. A resolved commit omits safety; known consequence classes force commit; malformed/false/contradictory resolved safety rejects.
Combiner grants safety only when every state-contributing known floor explicitly promises it; any commit or known lasting class dominates. A plain state contributor cannot acquire another's safety.
Core retry/verification accepts trusted safe state; generic state stays mutating/unsafe. Explicit lasting consequences override safe state. Preserve absent-contract legacy behavior and nested uncertainty fixes.
Web promises only inspected deterministic setters: type without submit, check desired state, same-tab navigation. Preserve submit predicate/default and raw binding slots.
Navigation true/unresolved newTab commits; use canonical false-default newTab boolean schema with commitWhen, not an invented helper-only default.
Do not automatically promise upload/other setters safe; inspect implementation before any expansion.
Core named tests prove safe-state automatic retries, state-without-proof hold, commit never lowered, declared-lasting override, conservative floor union, unresolved predicates and malformed readers.
Web existing six assertions stay; add newTab true/unresolved, serialization/native parity and declared-lasting dominance cases.
No builds/typechecks/full suites/paid/browser/panel/git by workers. Root rebuilds compiled SDK before generated downstream tests.
Web mutations held until root releases completed extension typecheck; Core source can change now (no Core build/check active).
Each worker appends exact source/validation to its existing MAIN report then freezes and returns required contract. Root owns shared memory/integration.
