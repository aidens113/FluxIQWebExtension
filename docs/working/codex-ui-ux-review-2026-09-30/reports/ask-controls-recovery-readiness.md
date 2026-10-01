# Ask controls keyboard recovery readiness

Status: Complete
Owner: runtime_contracts
Date: 2026-10-01

## Written bounded scope and exact reads

Supervisor released READ-ONLY AskControls readiness investigation: current controls, actual mounted Chat owner/controller seam declarations and nearest synthetic DOM fixture, maximum four files. Determine ask ID/epoch/input ownership/errors/retry/disposal so proposed keyboard work preserves frozen Chat contracts. Own only this report; no source/tests/check/broad/live/private/storage/shared-doc/commit changes.

Exactly four downstream files read in bounded sections:
- apps/extension/src/panel/chat/conversation/ask-controls.ts
- apps/extension/src/panel/chat/chat-panel.ts (turnControls, action scope, activation, owner replacement and target-change seams)
- apps/extension/src/panel/chat/conversation/controller.ts (answer, readiness/generation/error and target/connection declarations)
- apps/extension/src/panel/chat/tests/fake-dom.ts

Prior extension-navigation-keyboard-audit.md remains the separate keyboard mapping finding; no duplicate implementation or new owner defect is asserted here. No other source/test body, Core backend, stored thread/user data or live panel inspected.

## Confirmed trusted mounted ownership contract

chat-panel turnControls captures owner, actionScope, destination controller, state.conversationId, turnId/text and serialized entire displayed ask. answer callback calls destination.answer(captured askId,kind,value) only when owner identity/currentness and action scope match, actionsAllowed holds, conversation remains identical, and current controller turns contain the same turnId/text/ask signature. This binds an old answer callback to the actual rendered question, not merely a reusable ask ID. Changed status/options/answer or changed owner/thread invalidates the retained callback. Do not weaken this signature to askId equality.

Activation gate actionsAllowed permits the historical initial-owner compatibility path until activation is explicitly observed, or an active current owner afterward; an explicitly inactive panel disallows actions. setActive(false) disconnects controller, stops reads and refreshes controls/action scope. Owner replacement disconnects old controller and creates new owner-bound controller/feed before rendering. Thread changes refresh controls and update controller target. These are existing frozen owner fixes, not a new AskControls implementation obligation.

Controller answer independently requires readable connected/nonfallback state, a shown conversation, current pending ask ID in turns, and no operation already in answering map for that ask. It synchronously installs an operation token before calling request; duplicates are refused even if a retained control callback bypasses native disabled UI. Wire request remains panelConversationAnswer with captured askId/kind/value/projectId; local keyboard changes must not alter it. Completion removes only its own operation token and checks captured generation before publishing feedback/refresh, protecting later connection/target generations and same-ID newer operation state. Issued requests are not cancelled or replayed merely because old UI disappears.

Controller safeRequest converts thrown transport failure to existing fixed recovery result. Answer failure publishes existing ask-specific error unless refusal/unsupported routes to fallback. Retry is a fresh explicit answer after busy clears; no automatic answer mutation retry is present. Successful answer invalidates revision and refreshes thread. Subsequent read removes answerErrors for asks no longer pending. Preserve these behavior/error paths.

## Local controls/input ownership and limits

askControls builds fresh native labelled text input/Answer button for an open question, disabled from context.answering. Its text callback closes over that actual input and context; it trims the input at invocation, so no global/current-other-input lookup exists. Choice callbacks likewise capture their displayed choice and trusted context.answer. Local factory has no owner/current predicate or dispose API, and no cancellation/operation/error transport responsibility; trusted mounted context enforces them.

No input.isConnected or document-visibility check exists in the local callback. In the actual mounted seam, owner/signature/action scope and activation gates already reject retired owner/thread/changed-ask callbacks. Pure DOM removal while the same owner/signature/scope remains current is not an independently proven forbidden action; a retained callback can still call that context, but browser user input cannot ordinarily reach a detached node. Do not add isConnected gating that changes standalone controls/native focus compatibility or claim a hidden-owner leak. Entire Chat component exports no dispose in the inspected return; lifecycle uses setActive(false) and owner replacement. This audit does not authorize changing that API.

The factory does not accept/store prior input value across a fresh invocation. Whether an answer-busy/error render replaces the actual live input and loses typed words depends on Thread/MessageView reconciliation outside the four-file budget. Thus input-loss-on-retry is conditional and unproven, not part of the keyboard unit. Preserve existing explicit retry/error presentation; do not add draft storage or restructure mounted ask cards without another exact brief.

## Fixture readiness and proposed exact implementation partition

Retain proposed exact two paths: existing conversation/ask-controls.ts and NEW conversation/tests/ask-controls-keyboard.test.ts. No Chat/controller/ask-copy/composer/protocol/storage/read retry source or original test edits. Implement only local event eligibility: plain Enter, not already handled, no modifiers, no isComposing/native229. Existing plain Enter trims and forwards text; explicit Answer/choice clicks, native disabled state, local error role=status and settled/unsupported rendering remain as before. Do not introduce an operation lock, current ask API, local draft store, auto retry or independent mutation owner.

FakeElement fixture dispatch directly invokes registered listeners with supplied fields. It has no bubbling/default generation, disabled-node event suppression, synthesized native click or real composition lifecycle; isConnected always true. This is sufficient to prove context callback eligibility for exact synthetic keyboard shapes and existing local labels/buttons/text, not backend acceptance or actual browser IME ordering. Do not modify shared fake to manufacture native semantics. When tests send to a disabled fake input, distinguish synthetic callback invocation from real native user delivery; any count after context.answer is not proof controller dispatched.

CoreAsk exact declaration and owning ask-copy test fixture were not body-read because this investigation already used four files. Supervisor should explicitly authorize those bounded fixture-only reads before tests-first implementation; do not fabricate partial ask wire fields or use cast-to-any as a shortcut. The approved source/test edit partition can remain exactly two paths.

New suite meaningful cases: plain Enter and explicit Answer click forward exactly current input trimmed text; empty input no answer; native229 with isComposing=false, synthetic composition, defaultPrevented and each shortcut modifier ignore Enter; non-Enter stays native; input/Answer disabled property mirrors answering; ask error remains nearby role=status; settled/unsupported asks do not acquire editable controls; choice clicks preserve kind/value. No raw text logging. Actual existing owner/controller suites should run unchanged as narrow compatibility evidence after release; source/body reads or edits beyond two paths remain held.

## Verification and remaining assumptions

Read-only source/fixture inspection, no validation commands or live/native/browser/private operations. Actual frozen owner/controller fences are source-confirmed here, not newly rerun. Upstream owner context implementation, Thread/MessageView reconciliation, input preservation on retries, browser native disabled/composition/default timing and whole-panel disposal requirements remain outside scope. Proposed keyboard guard fixes wrong local interpretation while preserving trusted answer ownership; it must not claim a new lifecycle fix or duplicate prior Chat work. Worker readiness findings await root review and explicit implementation release.
