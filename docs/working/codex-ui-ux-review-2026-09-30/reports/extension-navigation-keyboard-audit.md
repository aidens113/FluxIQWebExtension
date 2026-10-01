# Extension navigation keyboard audit

Status: Complete
Owner: runtime_contracts
Date: 2026-10-01

## Written bounded brief and exact inspection

Supervisor released READ-ONLY extension panel navigation/shortcut/native editing audit, maximum four source/test files, excluding extraction binding frozen paths. Own only this report; no source/test/shared docs/check/broad/live/private/Core/backend/commit operations.

Exactly four downstream files read:
1. apps/extension/src/panel/shell/top-bar.ts
2. apps/extension/src/panel/shell/tests/top-bar.test.ts
3. apps/extension/src/panel/chat/conversation/ask-controls.ts
4. apps/extension/src/panel/chat/conversation/ask-copy.ts

Identifier searches located other handlers/call sites/test declarations, but no other source/test bodies or extraction binding files were read. Initial regex search syntax failed harmlessly; retried using separate rg expressions. No validation command or product mutation occurred.

## Confirmed existing navigation compatibility

TopBar creates two native tab buttons, attaches keydown to each button, and maps only ArrowRight/ArrowLeft/Home/End to wrapped tab index. It prevents default, focuses chosen tab and calls parts.onTab once. Alt/Ctrl/Meta/Shift, isComposing and keyCode229 return without consuming; Enter and Space have no helper mapping and remain native button behavior. showScreen updates selected/class/roving tab stops; settings/getting-started keep Chat reachable. Three direct owning tests cover mapping/wrap/focus, modifiers/composition229, and native Enter/Space plus gated-screen semantics. This is already implemented and does not justify another broad navigation rewrite or editing input filters globally.

No document-global panel navigation listener exists in the inspected top-bar source. Handler is attached only to tab buttons; native Chat inputs are outside those buttons. Hidden/inactive Chat dispatch correctness belongs to the separately frozen Chat/controller owner work and was not re-audited. Do not infer a hidden-panel leak merely from absence of a TopBar dispose API.

## E1 confirmed: handled tab-navigation event still selects another screen

TopBar keydown guard omits event.defaultPrevented. A recognized plain Arrow/Home/End event whose earlier listener has already called preventDefault still invokes tab focus and parts.onTab. Exact local public sequence: ArrowRight on Chat with defaultPrevented=true, no modifiers/composition =>target Automations =>preventDefault/focus/onTab(automations). No native-input mapping is involved. Existing direct test flags do not cover defaultPrevented. This is source-confirmed local handled-event ownership behavior; existence of an actual earlier tab listener in production was not established within scope, so current production incidence is conditional and lower priority than E2.

Narrow optional proposal: top-bar.ts plus NEW shell/tests/top-bar-handled-key.test.ts (or exact root-authorized owning suite extension while preserving all three current assertions). Guard defaultPrevented before mapping. Test handled plain navigation leaves callback/focus/selection/prevention untouched, ordinary key mapping unchanged. No screen-state/shell/CSS/helper/API changes required. This is defensive event-boundary strengthening, not a claim of currently observed unwanted screen changes.

## E2 confirmed: open-question answer Enter lacks native IME/handled/shortcut guards

askPresentation selects words only for status=pending and kind=open. askControls then creates labelled type=text input and Answer native button; submit sends context.answer(text,input.value.trim()) when nonempty. The input keydown invokes submit for Enter and !event.isComposing. It does not check keyCode229, defaultPrevented, Alt/Ctrl/Meta/Shift or an independent composition-start state.

Exact source-confirmed local sequence: pending open ask, nonempty input, key=Enter/isComposing=false/keyCode229 =>context.answer(text,trimmed value) is called. A legacy IME confirmation event with that shape is therefore interpreted as submission while the existing TopBar policy correctly leaves229 alone. Likewise already-prevented or modified Enter still calls answer. Context callback may have downstream request/owner/duplicate gates; this audit establishes the unwanted local submission attempt, not that a server accepted an answer, draft was lost, or hidden panel sent data. Controller and actual owner implementation remain frozen and were not read. Scope searches identify the existing answer-owner control, but no broader safety guarantee is inferred from search snippets.

The keydown does not preventDefault for successful plain Enter. These controls are not rendered as a form in this file, so no duplicate native form submission is claimed. The input is single-line and question semantics clearly support Enter submission; keeping plain Enter and explicit Answer is compatible. Composition229 and already-handled events should be ignored. Shortcut policy should be stated explicitly before implementation: plain unmodified Enter submits, Alt/Ctrl/Meta/Shift Enter stays unconsumed, consistent with inspected navigation guards. No new send shortcut is implied.

## Exact narrow E2 proposal and meaningful tests

Proposed exact two paths: apps/extension/src/panel/chat/conversation/ask-controls.ts and NEW conversation/tests/ask-controls-keyboard.test.ts. Preserve ask-copy/controller/composer/Chat/shell/protocol/extraction and existing tests. No helper extraction or public interface is needed for a local event guard. Tests should exercise actual askControls/askPresentation using existing fake-DOM support and synthetic pending-open ask, with context.answer spy; retain plain Enter trimmed answer, explicit Answer click and blank-input no-op behavior.

Tests-first cases: native229 with isComposing=false never calls answer; event.isComposing=true never calls answer; defaultPrevented true never calls answer; each modifier on Enter no answer; other keys no answer; plain Enter answers once with text/trimmed value; Answer click continues; settled/unsupported asks expose no editable submission control; answering controls preserve native disabled attributes. Native disabled controls normally suppress user dispatch, but retained handler/operation lifetime should not be changed casually: full answer-owner ownership is a separate frozen contract, not authorized by this local keyboard unit.

Before implementation release, root should authorize bounded fixture reads of actual CoreAsk declaration and existing fake-DOM helper if needed; this audit consumed all four body reads. Do not invent incomplete wire ask fields or change test mocks/shared harness to accommodate implementation. Run narrow owning/new+unchanged ask presentation/owner suites and actual config scoped types only after release. Synthetic dispatch proves callback eligibility, not browser-generated Enter/Space click or IME event timing.

## Verification and limits

Source inspection only, no checks/types/build/live/browser/Lab/provider/panel/private state/backend or commits. Existing TopBar test declarations inspected, not executed. Actual native browser IME shape, keyboard default ordering, earlier handled tab listeners, disabled control delivery, hidden-panel lifecycle and backend acceptance remain unverified. Findings are worker claims for root review. Core settings/floating and extension extraction bindings remain frozen.
