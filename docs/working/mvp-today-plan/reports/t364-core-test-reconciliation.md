# t364 — Core test reconciliation

## Result

The two t360-owned test files are reconciled without production changes. Core's package typecheck passes, and both focused suites pass all 61 tests.

## Edits

- `runtime/flow-bootstrap/generation-failure/tests/diagnostics.test.ts`
  - Narrowed the representative diagnostic step with an explicit fixture-presence guard before reading its nested optional members.
  - Moved the invalid `draftRevisionAfter` fixture from `maxIterations + 1` to `maxIterations * 2 + 1`, beyond production's intentional two-times-iteration revision bound.
- `runtime/tests/deepseek-bootstrap-exploration.test.ts`
  - Declared fixture plan nodes as JSON objects with a required string `key`, so generated edge endpoints are valid JSON strings rather than `JsonValue | undefined`.
  - Typed each generated registry tuple with `AutomationStudioNativeNodeImplementation`, preserving the closed execution-result status union without weakening the result assertions.

No production source, provider/live path, shared plan, raw artifact, commit, or push was changed.

## Validation

```powershell
pnpm --filter fluxiq check
```

Exit 0 (`tsc --noEmit`).

```powershell
pnpm --filter fluxiq exec vitest run src/programs/automation-studio/runtime/flow-bootstrap/generation-failure/tests/diagnostics.test.ts src/programs/automation-studio/runtime/tests/deepseek-bootstrap-exploration.test.ts
```

Exit 0: 2 files passed, 61 tests passed (51 diagnostics and 10 deterministic service tests). The service suite retained both the exact 26-decision exhaustion reproduction and the same-prefix corrected-convergence branch.
