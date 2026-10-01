# Field control association implementation

Status: Complete — exact source/test paths frozen for supervisor verification
Owner: deployment_docs_audit
Date: 2026-10-01

## Written brief

- Shell four paths stay frozen for root verification. Read parent Current State and core-native-controls-audit.md Field finding. Own exact Core components/controls/Field.tsx and NEW controls/tests/Field.test.tsx, plus this report only.
- Tests first actual rendered association: existing direct child ID diverges from label htmlFor with implicit or distinct wrapper ID. Preserve existing child ID first, then wrapper id, then generated ID; one effective ID owns label and hint/error associations.
- Cover child/wrapper/neither ID and generated uniqueness; existing aria-describedby merge/current hint/error; preserve native aria-invalid/aria-required when no wrapper override, required/error feedback and direct-child cloning. Custom children still forward props; do not transform fragments/multiple controls or change CSS/caller semantics.
- Keep all shared component-contracts assertions unchanged; Combobox/Menu/Core backend/other workers/helpers/barrels/config remain untouched.
- Run new owning association regressions plus unchanged component-contracts through heavy; actual web config strict two roots, whitespace/module budget, then freeze. No broad/live/provider/panel/commit/push/shared docs/private data. Record evidence and limits in this own report.

## Progress

Parent Current State and exact actual primitive finding read. Actual Field uses wrapper/generated controlId for label/messages but preserves a distinct child ID when cloning, confirming association divergence. New owning actual SSR-rendered association regressions written for direct native/custom children, child/wrapper/generated IDs, description/validation preservation and caller-owned multiple controls. Initial native 1 reproduced 7 failed / 6 passed (13 tests), 1.12s. Source now derives a single effective ID from valid direct child's existing ID, then wrapper/generated ID; label, cloned control, hint and error use it consistently. Native caller ARIA merging/overrides and direct-child contract remain. Shell four paths stay frozen.

## Verification and return

- New functional Field suite (13) plus unchanged shared component-contracts (20): **33 / 33 passed**, native 0, 2.54s. No original assertions weakened or skipped.
- Strict TypeScript against actual apps/web/tsconfig.json, exact Field.tsx and new Field.test.tsx roots, incremental disabled: **native 0**, 3.69s. Temporary external config removed after execution; inherited compiler options retained.
- Scoped `git diff --check`: native 0. Field.tsx is 32 lines. Exact two Core paths are frozen for supervisor independent review; no helpers, styles, consumer files, shared documents, broad gates or commits changed.
- Verification demonstrates actual server-rendered label/control/message ID associations and preserves native ARIA attributes. Live browser label activation and assistive technology behavior were not exercised.

Reproducible narrow command from paired Core, under the heavy wrapper:

```powershell
& 'C:/Program Files/Git/bin/bash.exe' 'C:/Users/osrs_/FluxStuff/build-slots/heavy.sh' 'codex field association regressions' pnpm --filter @fluxiq/web exec vitest run src/features/programs/components/controls/tests/Field.test.tsx src/features/programs/tests/component-contracts.test.tsx
```

Scoped types use a temporary JSON extending absolute `apps/web/tsconfig.json`, with `compilerOptions: { incremental: false }`, `include: []`, and absolute `files` for the exact two owned paths; run heavy `pnpm --filter @fluxiq/web exec tsc --project <temporary-config> --noEmit`, then remove that temporary file. No broad verification claimed.
