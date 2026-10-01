# Overlay environment implementation brief

Status: Complete — exact two source/test paths frozen for supervisor review
Owner: deployment_docs_audit
Date: 2026-10-01

## Written brief

- Read parent Current State, overlay-environment-recovery-plan.md and frozen Menu implementation report. Inspect exact Core programs/overlay-environment.ts and its unchanged owning Studio environment tests only as needed.
- Own only this report. Core product/tests, Menu, Modal, shared docs and other reports stay frozen while root runs independent checks and broad gates. No commands that mutate source, broad/browser/provider gates, commits or actual data access.
- Translate the completed plan into an executable tests-first brief for exact overlay-environment.ts and NEW programs/tests/overlay-environment-focus.test.ts. Specify private helper budget or explicitly proposed additional paths if needed; never relax baseline.
- Cover capture Escape IME/modifier/defaultPrevented/current-top/document guards, dynamically eligible Tab candidates and panel/invalid-current fallback, and ownership/eligibility guarded focus restoration. Preserve old minimal FocusTarget proxy behavior, stack/listener counts, scroll/isolation restoration, first-legend exemption and idempotence.
- Preserve Menu native Tab and effect-local suppression; do not broaden trapping beneath a nonmodal top overlay or add MutationObserver/global focus reclaim. Keep later close-intent consumer edits separate.
- Return concrete fixture API, exact regression cases and reproducible narrow/scoped commands. Record source inference separately from browser assumptions. Await root release before creating tests or editing environment.

## Proposed executable steps

### Supervisor release

Status: Active implementation. Exact two Core paths below now released after root independently observed Menu130/native0 and Core typing/build native0. Full Core gate failed only the unchanged login-lock test (separate worker investigation), so broad success is NOT claimed. Core source gates are closed; no concurrent broad gate.
Omit the proposed outside-connected-focus trap branch in this unit: preserve unrelated connected focus rather than add isolation-based reclaim without a separate real-consumer reproduction. Cover owned panel/body/invalid or removed positions and stale event-target refusal. Preserve old minimal proxy behavior, first-legend eligibility and all original environment assertions. No consumer, style, baseline, protected backend or extra helper edits. Worker owns this report only additionally; tests-first native failures, exact narrow/scoped checks, then freeze. Root owns docs, commits and full certification. No live/browser/provider/private data.

1. After explicit supervisor release, own exactly Core `apps/web/src/features/programs/overlay-environment.ts` and NEW `apps/web/src/features/programs/tests/overlay-environment-focus.test.ts`. No tests are created during the hold. Root owns independent verification, authored docs and commits. Menu and Modal consumers remain frozen. Earlier report `overlay-environment-recovery-plan.md` remains source evidence; this brief makes its execution concrete.
2. Create the bounded fixture API below in the new owning test only. Reproduce ordinary/composing/defaultPrevented/modified Escape, trap-invalid candidates and panel entry, and connected-but-ineligible/external-owner focus return through the real helper's installed listeners/release. Preserve old Studio environment assertions unchanged. Record actual initial failing/passing counts and native result before source changes.
3. Add at most three focused private predicates in environment.ts: document-interaction eligibility (approximately5 lines), DOM candidate eligibility with sequential/programmatic mode (approximately18 lines), and restoration ownership/target eligibility (approximately20 lines). Update the existing capture/trap/release functions in place; preserve acquire, stack, isolation, listener setup/teardown and public exports. Target total environment module under280 authored lines; keep each new helper under25 lines. If actual structure budgets or a cohesive helper cannot fit, stop source work and request exact extraction/barrel ownership; never relax baseline or create an unapproved helper.
4. Run exact narrow suite and actual-config two-root scoped types below. Inspect failures; fix only owned source/new test. No original assertion rewrites, skips, shared source contracts, broad checks, live operations or source outside the partition. Freeze after native pass and update this own report with exact counts/time/session, source paths and limitations.

## Concrete fixture API

Implement a test-local `overlayFixture()` returning `{ document, body, node, attach, detach, setFocus, key, pointer, acquire, listeners }`.

- `document`: body.style.overflow plus body.children, activeElement, visibilityState, hasFocus mock and defaultView listeners/getComputedStyle. Its addEventListener/removeEventListener mocks retain the actual capture callbacks so `key(event)` invokes the helper's installed handler, not a reimplementation. Count callbacks and cleanup calls. Default visible/focused document, body active, actual nodes connected.
- `node(id, options)`: ownerDocument, tagName/type, numeric tabIndex, children/parent, isConnected, attribute map, hidden/inert flags, matches(:disabled), closest(hidden/inert/aria-hidden ancestors), contains, querySelectorAll and getClientRects. Native effective disabled state is a fixture property, with first-legend nodes deliberately reporting matches(:disabled)=false despite a disabled fieldset parent. getComputedStyle returns per-node inherited/computed visibility. focus mock updates document.activeElement. Default enabled button with tabIndex0 and nonzero geometry.
- `attach(parent, child)`/`detach(child)`: maintain parent/children and connected state. Body additions support actual isolation bookkeeping and original attribute/inert restoration; no observer is simulated. Panel candidates are obtained from querySelectorAll and deliberately include invalid selector-alternative matches so the helper's filter is exercised. Synthetic matches does not claim real-browser CSS/fieldset semantics.
- `setFocus(node|null)`: set current document focus independently, including outside connected controls, body, panel and removed descendants. `key({ key, shiftKey, ctrlKey, altKey, metaKey, isComposing, keyCode, defaultPrevented, target })` builds a plain keyboard-shaped event with preventDefault/stopPropagation spies, default target=current activeElement, and invokes the real retained capture callback. Dispatch after release has no callback; direct retained callback additionally tests empty/current stack fences.
- `acquire(options)`: call actual acquireOverlayEnvironment with real synthetic panel/root and explicitly selected returnFocus. Can create nested modal/drawer/menu/nonmodal entries. Return targets include full DOM nodes and the original minimal `{ focus, isConnected }` proxies without ownerDocument/geometry/matches methods. The old public proxy contract remains supported.

Keep the fixture narrow and local; do not export it or duplicate production eligibility/stack algorithms. Attr ancestry and effective disabled answers are fixture capabilities; assertions verify actual helper calls and outcomes. Real browser inert/focus/default keyboard order remains unverified.

## Exact product policy

### Capture Escape

Before dismissal, require current top entry, interactive document when its capabilities are present, and connected/rendered/nonhidden/noninert top panel when DOM capabilities are present. Ignore defaultPrevented, isComposing, keyCode229, Ctrl/Alt/Meta/Shift Escape without prevention/dismissal. Ordinary Escape preserves current canDismiss and top-only callback, then prevents/stops once. Missing capabilities in the existing minimal fixtures are unknown, not a hidden document; do not alter original fixtures to satisfy new guards. This capture guard cannot honor a preventDefault invoked later during React bubble; report that precise ordering instead of promising it.

### Trap on real Tab intent

Keep only current top trapFocus=true; do not search an underlying modal beneath a top Menu/nonmodal. Ignore handled/composing/Ctrl/Alt/Meta Tab, preserving Shift+Tab as direction. Require interactive document and current connected foreground panel; verify event target/current activeElement ownership for the real keyboard event before moving focus. Body/panel/disconnected or no-longer-eligible active positions may use first/last fallback on this actual Tab; no render/focusin observer reclaim is added. Do not react to a retained synthetic event whose target belongs to a different current control/document.

Sequential candidates require connected same-document rendered DOM, effective enabled state via :disabled, no hidden input/hidden/inert/aria-hidden ancestor, computed visibility not hidden/collapse, and numeric tabIndex>=0. Preserve native first-legend exemption. For a valid current position, native middle traversal stays untouched; wrap first/last in requested direction. For panel/body/invalid current position, preventDefault and focus first/last. When no eligible candidate exists, preventDefault and focus panel. Tab beneath nontrapping top overlay stays unchanged for Menu's local departure policy.

An outside connected current control during a true foreground modal Tab needs explicit root review before implementation: proposal is to redirect only if it belongs to a root currently isolated by this modal; unrelated permitted/new-overlay focus is left alone. This distinction uses current environment stack/isolation evidence, not blanket document focus theft. If it cannot be expressed cleanly inside the two-path boundary, omit that branch and report the remaining outside-focus limitation rather than broaden global behavior.

### Restoration

Capture document activeElement and whether closing panel/root owns it before removal/applyEnvironment. Keep lower/non-top release and idempotent release behavior unchanged. Remaining isolation must be applied before checking target eligibility, so a target still inert under another modal cannot receive focus. Require interactive document when known, same-document connected target when known, and full DOM target effective enabled/visible/noninert/rendered eligibility when available. Programmatic return targets may have negative tabIndex; that is allowed if otherwise focusable because restoration differs from sequential Tab eligibility. Preserve minimal focus proxies without HTMLElement methods.

Refuse return when an unrelated connected control has already gained focus. Permit owned closing-panel/root focus and body/null/removed-owned-focus after teardown only if returnFocus is still nonnull. Do not invent consumer dismissal reasons: Menu already sets returnFocus=null for action/outside/Tab/teardown via effect-local options, while eligible Escape/explicit return may provide a target. Consumers needing stricter close-intent policy require their own later exact brief. A newer registered overlay already makes the older entry non-top; preserve that protection. Newly unregistered overlay commit/effect ordering is a documented uncertainty.

## Regression matrix (tests first)

- Escape7 refusal variants (handled/native composition/keyCode229/Ctrl/Alt/Meta/Shift), ordinary top once, busy false dismissal, underlying never called, hidden/unfocused document, disconnected/hidden/inert top and retained handler after final release.
- Trap invalid-candidate variants: hidden input, own hidden/aria-hidden, ancestor hidden/inert/aria-hidden, CSS visibility hidden/collapse, zero rectangles, disconnected/foreign document, disabled direct/tabindex and disabled-fieldset, negative-1/negative-2 numeric tabindex. First-legend eligible candidate survives. First+Shift wraps last; last+Tab wraps first; middle stays native; panel+Tab/Shift enters first/last; disabled/removed current source fallback; empty list focuses panel. Modified/handled/composing events make no focus/prevention. Current event target mismatch refuses. Top Menu/nonmodal leaves underlying modal trap untouched.
- Return: original connected minimal proxy restoration, disconnected proxy refusal, underlying DOM target with scroll remaining locked, lower release no focus, idempotence, final original overflow/aria-hidden/inert restoration and exactly four document/two window listener teardown. DOM target hidden/inert/disabled/effectively fieldset-disabled/zero-size/foreign/disconnected and hidden/unfocused document refuse. Outside current focus stays put; newer registered overlay stays focused; body/owned focus can return; options.returnFocus=null suppresses only restoration while cleanup still completes.
- Newly attached body root: characterize isolation after actual acquire, not an invented observer. All discovered actual portal consumers acquire; no persistent F8 unregistered consumer was found. Do not add MutationObserver or report F8 fixed.

## Reproducible commands after release

Working directory: `C:/Users/osrs_/FluxStuff/fxwork/t224/!FluxIQ`.

```powershell
& 'C:/Program Files/Git/bin/bash.exe' 'C:/Users/osrs_/FluxStuff/build-slots/heavy.sh' 'codex environment focused' pnpm --filter @fluxiq/web exec vitest run src/features/programs/tests/overlay-environment-focus.test.ts src/features/automation-studio/workspace/overlays/tests/overlay-hardening.test.ts src/features/programs/tests/component-contracts.test.tsx src/features/programs/tests/use-operation-lock.test.ts src/features/programs/components/controls/tests/Menu-keyboard.test.tsx src/features/programs/components/overlays/tests/Modal-keyboard.test.tsx src/features/programs/components/overlays/tests/ModalContent-focus.test.tsx
```

Scoped actual-config harness (external temporary JSON removed in finally):

```powershell
$overlayTypeConfig = Join-Path $env:TEMP ('codex-overlay-types-' + [guid]::NewGuid().ToString('N') + '.json')
$env:CODEX_OVERLAY_TYPE_CONFIG = $overlayTypeConfig
@'
const fs = require('node:fs');
const root = 'C:/Users/osrs_/FluxStuff/fxwork/t224/!FluxIQ/apps/web';
const base = root + '/src/features/programs/';
fs.writeFileSync(process.env.CODEX_OVERLAY_TYPE_CONFIG, JSON.stringify({ extends: root + '/tsconfig.json', compilerOptions: { incremental: false }, include: [], files: ['overlay-environment.ts','tests/overlay-environment-focus.test.ts'].map(file => base + file) }));
'@ | node
try { & 'C:/Program Files/Git/bin/bash.exe' 'C:/Users/osrs_/FluxStuff/build-slots/heavy.sh' 'codex environment scoped types' pnpm --filter @fluxiq/web exec tsc --project $overlayTypeConfig --noEmit; $overlayTypeExit = $LASTEXITCODE } finally { Remove-Item -LiteralPath $overlayTypeConfig; Remove-Item Env:CODEX_OVERLAY_TYPE_CONFIG }
exit $overlayTypeExit
```

## Return / hold

Prepared executable tests-first brief only. Exact two implementation paths await supervisor release after frozen Core gates. One outside-focus trap policy refinement is flagged for root review above; no extra path is currently needed. No source/tests/shared docs/heavy/broad/browser/provider/panel/private/commit operation ran in this preparation. Menu reproducible six-suite/scoped commands were supplied to root first; its existing own report received the requested type-harness appendix before this read-only brief was processed. Menu source/tests remain unchanged/frozen.

## Implementation ledger

Supervisor release read. Exact environment/new owning test only; outside-connected trapping/reclaim branch omitted. New bounded DOM/listener fixture and regression cases written. Initial tests-first native1 reproduced46failed/13passed (59tests),0.946s, covering capture Escape, invalid candidates/entry, return eligibility and outside reclaim. Source now has the exact three private predicates and updates key/trap/release guards. Full unrelated login-lock failure remains separately owned and is not altered here.

Initial postchange seven suites189/native0/2.53s. Added six narrow cases for hidden/unfocused Tab, still-isolated return target under remaining modal, retired capture after release, proxy without optional connectivity and acquire-triggered later sibling isolation. Final native0:7files195tests/2.90s, new environment65 plus unchanged Menu42/Modal42/entry15/componentcontracts20/OperationGate1/Studioenvironment10. Original assertions were neither changed nor skipped.

Actual web tsconfig exact environment/new-test roots passes native0/3.92s; temporary external harness removed. Exact Core source/test whitespace diff check native0. All owned source/tests now frozen. Reproducible narrow/type commands are above; no persistent harness added. Source contains exactly three private added predicates, each under25 lines; no helper/barrel extraction or baseline relaxation.

Current capture Escape ignores handled/modifier/native composition/keyCode229 and inactive document/panel, preserves current busy/top routing. Sequential candidate policy uses effective :disabled, numeric tabIndex, same document/connection, hidden input/ancestry, rendered geometry and computed visibility; first-legend exemption remains native. Actual Tab from current owned panel/body/disabled/invalid position uses directional fallback; middle traversal remains native, and unrelated connected focus/stale target events are untouched. Top Menu/nonmodal leaves underlying trap unchanged.

Release captures active ownership before applying remaining isolation, then validates its connected visible enabled return destination after isolation changes. Eligible underlying target restores without unlocking the remaining modal. Moved outside focus, inactive document, ineligible or still-isolated target do not receive restoration. Minimal focus proxies without DOM methods/optional connectivity preserve original behavior; native getComputedStyle is never called on those proxies. Existing Menu returnFocus=null suppression retains all cleanup. Lower release/idempotence/listener/scroll/original aria/inert guarantees pass unchanged.

No MutationObserver/global focusin reclaim/consumer/helper/style/backend/protected/shared doc edits. Newly attached body sibling test characterizes existing acquire-triggered isolation, not a permanent unregistered consumer or F8 fix. Browser native IME/Tab/inert/fieldset/assistive-technology behavior remains uncertified; synthetic :disabled/geometry/ancestry capabilities model boundary answers, not browser implementation. Root independently reviews/types/build/full gates/docs; only exact two Core paths and this downstream own report changed.
