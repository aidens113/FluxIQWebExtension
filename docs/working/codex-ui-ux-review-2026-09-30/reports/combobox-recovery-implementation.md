# Combobox recovery implementation

Status: Complete (supervisor keyboard follow-up implemented; exact two paths re-frozen)
Owner: runtime_contracts
Date: 2026-10-01

## Written brief

### Supervisor keyboard review follow-up

Root read the complete142-line implementation. Same exact two paths released for a final tests-first correction: composing/native keyCode229 Enter must not select a current option; handled/defaultPrevented events and Ctrl/Alt/Meta/Shift shortcuts retain native input behavior. Preserve plain current Arrow/Enter/Escape and existing14 cases. Use actual React nativeEvent composition rather than only a fabricated wrapper field, and test no callback/prevention for these cases. No new API/options/styles/shared assertions. Freeze again after owning/scoped checks; root combined verification follows.

- Read parent Current State and completed core-native-controls-audit.md. Core corrected full2629/types/build passed; final structure only inherited protected4506/4505 after root comment reconciliation. Own exact Core components/controls/Combobox.tsx and NEW controls/tests/Combobox.test.tsx, plus this report only.
- Tests first: disabled+defaultOpen and enabled/open then disabled must mask options immediately and reject retained selection/query/key callbacks; first closed Down enters first, Up last, then wrap; empty Enter retains native no-selection behavior.
- Gate before callback dispatch with current disabled/props/options/lifetime identity. Removed/replaced options or retired onChange owner callbacks and unmounted controls cannot select. Current options/caller-controlled value/query/Enter/click/typing/Escape/blur remain compatible. Loading does not imply disabled authorization.
- Preserve native input focus, no automatic mutations/focus reclaim, original shared component-contracts assertions, searchable labels/descriptions and existing CSS/API. No Menu/Field/shared helper/barrel/config/style/consumer/private/backend edits.
- New actual mounted primitive regressions + unchanged component-contracts through heavy; actual-config exact two-root strict typing, whitespace/module budget, then freeze. Record original failure and actual outcomes as they happen. No broad/live/provider/panel/commits/shared docs; request exact release for extra paths.

## Progress

Added the exact new actual mounted primitive suite; product unchanged. First run3cf0bf/native1 exposed six meaningful failures plus unsupported Vitest2 matcher usage in four compatibility cases. Replaced that new-test matcher with exact mock.calls equality before any product edit. Clean tests-first run ba0d57/native1:11tests,6fail/5pass,123ms tests/1.44s Vitest. Failures confirm disabled list masking, retired options/callback/query dispatch and first-Down ordering. Ordinary loading/control-value, backward entry, empty/single choices, description search/Escape/blur and mouse-focus cases pass baseline. Existing shared assertions have not been edited. ReactTestRenderer emitted its existing React deprecation notice; no browser validation is claimed.

Implemented only Core `apps/web/src/features/programs/components/controls/Combobox.tsx` and NEW owning `components/controls/tests/Combobox.test.tsx`.

The primitive now masks its list and active descendant synchronously when disabled, closes the local disclosure without external mutation, and checks a render-renewed option/value/disabled/onChange/onQueryChange lease plus mounted lifetime before every action/query/key/blur dispatch. Removed/replaced options, retired callbacks, A→B→A callbacks and unmounted instances cannot select. Selection also requires current filtered membership and closes its synchronous view state before callback dispatch, preventing retained duplicate option activation after close. Loading alone leaves choices actionable. CSS, option/value API, native input focus, controlled value, label/description search, Escape/blur restore and empty Enter semantics remain intact.

First closed ArrowDown enters at index0; first Up enters at the last filtered option. Arrows after opening move/wrap as before. View refs allow a current retained key/blur handler to use current active/selected state without dispatching through a retired owner. No focus call or keyboard/role redesign was introduced.

Added three further cases for A→B→A/duplicate-close dispatch, controlled selection replacement with obsolete blur/key callbacks, and React.StrictMode lifecycle replay. Final new suite14tests plus unchanged shared contract20tests all pass. Existing shared contracts, Field/other controls/consumers/helpers/barrels/config/styles and private/runtime/backend files were not edited.

| Observed check | Native outcome | Evidence |
| --- | --- | --- |
| Initial implementation new+shared owning suites | 0 | 423a11,31tests passed/163ms test time/1.93s Vitest |
| First scoped type check | 1 | 755dc6,one new-test optional onQueryChange annotation diagnostic; corrected only the synthetic fixture assertion |
| Final new+shared owning suites | 0 | 172988,34tests passed/184ms test time/1.73s Vitest |
| Final actual-config exact-two-root strict types | 0 | c850e3,0 diagnostics/3.848s tool |
| Exact diff check and module review | 0 | 696db2; product142lines,owning test209lines,below400advisory/800hard |

All heavy calls used the required wrapper. Scoped types used TEMP `codex-t224-combobox-types.mjs`, actual Core web tsconfig/options and dependency diagnostics, no tracked config or emit. No broad gate, actual browser/assistive/focus/viewport certification, provider/panel/private-data operation or commit was performed. Both released source/test paths are now frozen; root owns independent review/integration/full gates when the disjoint Field worker also freezes. Login and Database JSON remain frozen.

## Supervisor keyboard follow-up progress

Added seven mounted regressions using nativeEvent.isComposing, nativeEvent.keyCode229, defaultPrevented and each Ctrl/Alt/Meta/Shift modifier; every case exercises Enter/Down/Up/Escape and requires no prevention, callbacks, selection, expansion or query mutation. Product unchanged for observed tests-first6c3600/native1:7new failures/14original pass,131ms test/1.15s Vitest. The seven failures demonstrate Enter intercepting native/handled/shortcut events before the guard correction. Existing first-phase tests/assertions remain intact.

Added one early keyboard guard in the same product handler: current lifetime/owner remains required; defaultPrevented, nativeEvent.isComposing, nativeEvent.keyCode229 (plus React event keyCode229 compatibility), and Ctrl/Alt/Meta/Shift return before preventDefault or state/callback changes. Plain current Arrow/Enter/Escape still use the original first-phase behavior. No new API/options/styles/shared assertions.

Observed final owning check d873aa/native0:21owning+20unchanged shared=41tests passed,282ms tests/3.57s Vitest. Actual-config exact-two-root typing c0d0fb/native0,0diagnostics/9.943s tool. Exact diff check d45316/native0; product142lines/test233lines. Required heavy wrapper used for owning/types. React nativeEvent-shaped mounted regression events validate React handler policy, not a real operating-system IME session/native browser delivery. Source/test are re-frozen; root owns combined independent verification and broader gates. No broad/live/private/provider/panel commands, shared files or commits occurred.
