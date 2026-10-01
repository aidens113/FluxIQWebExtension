# Core tooltip interaction implementation

Status: Complete — exact three paths frozen for supervisor independent verification
Owner: deployment_docs_audit
Date: 2026-10-01

## Written brief

- Supervisor source release: Core full80759/native0/344files2706tests/207.22s, types14622/native0/48883ms and build69790/native0/199764ms closed. Structure37927 only inherited protected4506/4505; no new violation. Read parent Current State and completed core-tooltip-interaction-plan.md, then execute exact released paths now. Source checkpoint0e868679 is preserved.
- Exact Core three paths: apps/web/src/features/programs/components/layout/Tooltip.tsx; NEW same directory tests/Tooltip-interaction.test.tsx; apps/web/src/app/styles/global-foundation/06-controls-and-menus.css tooltip selectors only. Own this report additionally; preserve unrelated authored selectors and tokens exactly.
- Root accepts minimal NON-EXCLUSIVE eligible Escape dismissal: no preventDefault/stopPropagation or promise of tooltip-only Escape before parent capture. Existing overlay environment/busy/authorization/native child semantics remain intact; no listener-order workaround or environment edit.
- Implement approved independent hover/focus ownership, dismissed-until-both-depart lifecycle, current document/anchor callbacks and cleanup, mouse/pen popup hover bridge, touch policy, stable description/ID/native child handlers and dynamic text. Do not lease by children JSX identity or add timers/portals/positioning services.
- Tests first actual Tooltip events/listener lifecycle, Escape/reopen/handoffs/defaultPrevented/composition/modifiers/inactive document, native child click/key behavior, merged descriptions and retired callbacks. Preserve unchanged shared component contracts. CSS interaction tests do not certify physical bridge geometry or viewport clipping.
- No extra original test/fixture or cross-owner integration path is released. If actual overlay integration needs a new test boundary/helper, ask precise path release before writing it; root independently validates integrated overlay contracts.
- After release heavy owning suites +exact actual-config two TypeScript roots (CSS diff reviewed separately), all dependency diagnostics, whitespace/module budgets; no baseline/timeout/compiler/harness weakening. Freeze and report precise limitations. No shared docs/commits/broad/browser/Lab/providers/panel/private state.

## Worker execution progress

Source released after root Core full344files2706tests/types/build passed; inherited protected structure remains root-owned. New23 actual Tooltip event/lifecycle regressions written first. Initial run exposed a new-fixture Fragment props null access alongside missing product events; corrected that fixture access only. Corrected baseline **22 failed / 1 passed**, native1/934ms: existing associations already pass while the interaction handlers/visibility ownership are absent. Product then implements independent hover/focus state, dismissal until both depart, eligible non-exclusive current-document Escape, mounted/current-anchor/retired listener guards, and visible popup pointer bridge through exact tooltip selectors.

First owning run: **43 / 43 passed**, native0/3.91s (new23 plus unchanged shared contracts20). Exact whitespace native0; Tooltip51lines / test108lines. Authored CSS diff confirms only tooltip selectors changed, no token/other selector edits. Strict actual-config two roots found two test-only unknown React element props accesses in createNodeMock; narrowed fixture boundary className props, no product/compiler/harness weakening. Scoped retry pending; source not yet frozen. Native child handlers and merged descriptions preserved; no integrated overlay or browser geometry claim.

## Final verification and freeze

- Scoped strict retry against actual web tsconfig, exact Tooltip and new owning test roots: **native0 / 4.50s**, zero product/test/dependency diagnostics. Only the fixture props type assertion changed after the passing owning run; it erases at runtime. Temporary external config removed. No compiler option relaxation.
- Final exact-three-path `git diff --check`: native0. Source51lines/test108lines; stylesheet diff reviewed above. Original shared assertions and consumers remain untouched.
- Exact three product/test/style paths are now frozen. No source/helper/environment/shared-doc/commit/broad/live/private changes beyond the release.

Reproducible narrow suite from paired Core `apps/web`:

```powershell
& 'C:/Program Files/Git/bin/bash.exe' 'C:/Users/osrs_/FluxStuff/build-slots/heavy.sh' 'codex tooltip owning regressions' pnpm exec vitest run src/features/programs/components/layout/tests/Tooltip-interaction.test.tsx src/features/programs/tests/component-contracts.test.tsx
```

Scoped strict configuration: temporary JSON extends absolute actual `apps/web/tsconfig.json`, sets `compilerOptions: { incremental: false }`, `include: []` and absolute `files` for the two owned TypeScript roots. Run heavy `pnpm --filter @fluxiq/web exec tsc --project <temporary-config> --noEmit` from paired Core; remove that temporary config afterward. CSS is reviewed independently, not included as a TypeScript root.

The test fixture invokes actual Tooltip-owned React handlers and actual registered document callbacks. It checks mixed pointer/focus dismissal persistence, relatedTarget ownership, mouse/pen/touch policy, eligibility keys/inactive documents, description stability/dynamic text, native child handler preservation and listener retirement. It does not exercise native browser event bubbling or popup bridge hit testing. No focus command, synthesized click, preventDefault, propagation suppression, timer, portal or overlay environment mutation was added. Accepted Escape is **non-exclusive**, so an existing parent overlay may also process the same eligible key; exclusive first-Escape-tooltip-only behavior is not claimed. Root owns integrated overlay/full checks; browser geometry, clipping, zoom and assistive technology remain unverified.
