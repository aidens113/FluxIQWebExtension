# Extension navigation and keyboard audit

Status: Complete — read-only audit; report frozen
Owner: worker extension-navigation-audit
Scope: t224 panel navigation modules/tests read-only; own report only.

## Current State

Read the paired plan's Current State and located exact paths with `rg --files`. No project/category navigation or ARIA-menu module exists in the inspected extension panel source. Current navigation is Chat/Automations tabs, Settings, automation context/Latest chat, and Open FluxIQ controls. Project scope is implicit in thread requests; this audit does not treat absent selectors/categories as a defect or propose new product capabilities. Extraction source remains frozen and untouched during supervisor gates.

## Concrete findings

1. **Automation strip discards focused export/notice controls on refresh (priority 1).** `automations/automation-strip.ts:45` constructs dataset controls each draw; lines 75–79 replace exports and clear the notice; the notice Open FluxIQ button is also reconstructed. Polling, working-state changes, and export pending/completion draw the strip. Clicking an export therefore synchronously detaches that button during its own pending update. Stable automation list rows do not cover this surface. Preserve controls for the same flow/run/dataset/format, update their handlers and disabled state in place, and restore a nearby visible destination only when a genuinely removed control owned focus. Static Run/main Open FluxIQ controls are already stable.

2. **Automation selection hides the focused source without a destination handoff (priority 1).** `shell/mount-panel.ts:67` opens the selected automation and switches to Chat; line 135 hides Automations. Neither this path nor shell drawing focuses the visible Chat destination. `automations/tests/choose-automation.test.ts` verifies open-before-show ordering, but not focus. Add user-activation-only focus handoff after the destination is visible: the visible enabled composer, or the selected visible Chat tab when composer is unavailable. Avoid adding focus to general draw, reconnect, or background target updates. Hidden-pane focus loss is inferred from DOM removal/visibility semantics; no live browser claim is made.

3. **Back to Latest chat hides its own focused button (priority 1).** `chat/chat-panel.ts:122` binds Back directly to `open({kind:"latest"})`; `chat/view/context-line.ts:35` hides the context containing Back. The open path updates target/controller/scroll but has no focus handoff. `focusComposer` already exists at `chat-panel.ts:301`. Handle the explicit Back action separately from general programmatic open: focus a visible enabled composer immediately, or a named visible fallback when offline/fallback hides the composer. Async replies must not later pull focus back. Existing chat tests do not model actual active-element changes because shared fake focus is a no-op.

4. **Top-bar keyboard handling consumes modified/composing navigation keys (priority 2).** `shell/top-bar.ts:49–59` intercepts ArrowLeft/Right/Home/End without checking modifiers, `isComposing`, or legacy keyCode 229. Thus shortcut/composition events can select another tab and are prevented. Guard these events; retain plain wrapping arrows/Home/End and native button Enter/Space semantics. No owning DOM keyboard test currently exists. Actual browser shortcut behavior has not been exercised.

## Existing protections and lower-priority observations

- Tab buttons already have tablist/tab roles, accessible names/controls, selected state, and roving tabindex. Plain arrows wrap and Home/End choose the boundaries. Screen-state tests cover Settings/gated screen precedence and tabs closing Settings.
- `chat/conversation/controller.ts:172–189,212–215,288–291` checks target generation around read/send replies. Owning `conversation/tests/target-switch.test.ts` covers stale-target reads and same-flow rename without another thread read. Refreshes are serialized; a slow previous request can delay a new read, but no reply-overwrite defect was established. No cancellation/timeout redesign is justified by this audit.
- Latest requests target a project thread; automation requests target a flow; question requests target a flow/run. Owning navigation tests cover request scope. `chat/stream/target-activity.ts` treats a same-flow build question as already here while in that automation, so mixed automation/question target equality alone is not evidence of a reachable navigation bug.
- A chosen automation name is captured in ChatTarget. List refresh updates current rows/strip labels but does not automatically refresh the chat context/placeholder. An externally renamed flow can therefore retain stale chat labels until opened again. This is a source-derived consistency candidate, not a live reproduction. Handle only as a serial follow-on: preserve same-thread history/draft/scroll; `chat.open` currently calls `follower.followNow` even for metadata changes. Do not dispatch overlapping shell/chat workers for this.
- Open FluxIQ routing/context ownership is outside the authorized panel-only audit. The panel callback alone does not prove that its deep link is wrong; no background/Core inspection or recommendation was made.

## Minimal independent implementation partitions

All paths below are under `apps/extension/src/panel/`. Each needs an explicit implementation brief; none has been edited here.

| Partition | Exact proposed ownership | Meaningful regressions |
| --- | --- | --- |
| Strip identity | `automations/automation-strip.ts`; new `automations/tests/automation-strip.test.ts` | Same dataset controls survive polling/working/export pending and completion; handlers use current flow/run/dataset/format; reordered controls retain focus; removed focused control chooses a visible neighbor/Run/Open fallback; unrelated focus is untouched; unchanged notice opener remains stable. |
| Shell selection handoff | `shell/mount-panel.ts`; new `shell/tests/mount-panel-navigation.test.ts` | Focused row activation opens the right target before showing Chat and hands focus to a visible destination; loading/offline fallback is reachable; polling/reconnect/general drawing never steals unrelated focus. |
| Latest Back handoff | `chat/chat-panel.ts`; new `chat/tests/navigation-focus.test.ts` | Back hides context and focuses a visible destination; unavailable composer uses fallback; delayed old/new replies do not move focus; programmatic open and same-thread metadata changes preserve unrelated focus. |
| Tab keyboard | `shell/top-bar.ts`; new `shell/tests/top-bar.test.ts` | Plain arrows/wrap/Home/End select/focus correctly; selected/tabindex states remain consistent across Chat/Automations/Settings/gated screens; modified and IME events are neither prevented nor routed; native activation callbacks remain correct. |

The four partitions share no product/test files. No helper/barrel/shared harness changes are presumed authorized. Use local per-test focus modeling or a narrowly named local harness, with ownerDocument.activeElement, focus, visibility/disabled state and event flags sufficient for each seam; obtain exact file clearance before adding any helper. Do not modify shared chat fake DOM. Shell mounting may require mocked child modules to test actual dispatch ordering; keep those stubs local and assert resulting visibility/focus rather than reproducing implementation logic. Prefer the keyboard/strip partitions first; shell and Back can follow independently. Optional rename consistency work overlaps shell/chat partitions and must wait for them rather than become a parallel brief.

## Validation

Read-only source and owning-test inspection only: shell top-bar/mount/screen-state; automations chooser/strip/controller; chat target/context/conversation navigation and relevant owning tests. No tests, build, structure audit, browser/live, provider, panel management, commit, or product/test/shared-document edits. Report is the only write. Findings describe source behavior and coverage gaps, not verified browser behavior. Existing extraction and stable-row implementation remained untouched.
