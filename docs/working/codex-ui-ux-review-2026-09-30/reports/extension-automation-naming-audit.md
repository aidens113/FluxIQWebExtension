# Extension automation naming audit

Status: Complete — read-only audit/report frozen
Owner: worker wait_gaps

Read compacted plan Current State, exact naming brief and frozen navigation-focus report. Only this report is writable; extension source remains frozen during supervisor full/types/build gates. No heavy/live/provider/panel operations.

## Source findings

- Actual contract is chat/target.ts: automation carries flowId plus a name snapshot; question targets carry a separate title. There is no chat-target.ts or standalone chat/context-line.ts; context owner is chat/view/context-line.ts. Naming here means context text/title, empty-chat copy, composer placeholder and strip Run accessible name; source does not set the browser document title.
- shell/mount-panel.ts:129–137 propagates Chat target into strip.show and listens only to chat.onTargetChange. Refresh of list-owned metadata has no reverse notification into Chat.
- automation-strip.ts:102–109 finds the current row and uses its current name for Run aria-label, while its shown object remains the Chat target snapshot. chat-panel.ts:178–186 updates shownTarget/context/placeholder only when open is invoked; context-line.ts:36–38 derives name text and title solely from that target. Thus after an external rename reaches the list, Run names the new automation while chat context/title/placeholder keep the previous name. This is a source-confirmed missing synchronization seam, not browser verification.
- Reusing chat.open with a fresh same-flow name preserves thread.clear/clock/history branching because threadChanges is false, but chat-panel.ts:188 calls follower.followNow unconditionally. A passive name refresh implemented through open would therefore jump a reader to latest. The safe fix must distinguish metadata refresh from real thread navigation.
- Removing the shown flow from current rows leaves the Chat target/conversation open. Strip Run becomes disabled, exports/notice disappear, and connected-state lines become empty; Run aria-label falls back to the captured old name. No explanation distinguishes current-list unavailability from an ordinary empty run summary. This proves missing feedback, not that the Flow or conversation was deleted in Core; permission/filter/backend ownership is outside this audit.

## Preservation constraints

Keep flowId as thread identity. Passive metadata must not switch to Latest, clear history, reset a turn clock, erase a draft, move selection/focus, scroll to latest, or force a new thread read. A missing row alone must not claim deletion or cancel work. Preserve the last known automation name and existing conversation until the person explicitly navigates away; disable Run as today and explain only that it is unavailable in the current list. Retain offline/loading/read-failure wording rather than treating an unconfirmed missing row as removal.

## Minimal next implementation ownership

One coherent serial brief owns these six existing paths, all under apps/extension/src/panel; they are dependent and should not be partitioned into overlapping parallel workers:

| Product owner | Exact owning test | Proposed change |
| --- | --- | --- |
| automations/automation-strip.ts | automations/tests/automation-strip.test.ts | Add a passive name-change subscription on the mounted strip, reporting only the shown matching current row's changed flowId/name. Commit its remembered name before notifying, and notify after drawing to prevent recursive stale emissions. Keep keyed controls/error state intact. Show neutral unavailable-current-list feedback only in complete list/empty modes where no row matches; retain loading/offline semantics. |
| chat/chat-panel.ts | chat/tests/navigation-focus.test.ts | Add a narrow same-flow automation-name update method. Ignore Latest/question/other-flow/no-op updates. Reuse existing same-thread target update rendering while suppressing followNow only for this passive method; keep public open's explicit-navigation behavior unchanged. Update controller's same-thread metadata so a first send's title is current, without changing generation/read/history/draft/scroll. |
| shell/mount-panel.ts | shell/tests/mount-panel-navigation.test.ts | Subscribe strip metadata to the new Chat method only when the current Chat target is the same automation flow. No tab dispatch, general draw focus or request added. Existing chat target→strip wiring remains. |

No controller, composer, context-line, target.ts, barrel, shared fake, styles, Core or wire-contract ownership is required for the proposed seam. The new mounted-component methods live in their existing exported local UI types. A direct strip→chat.open loop is insufficient: its unconditional followNow must not become a passive refresh behavior. A dedicated passive Chat method preserves existing explicit open behavior rather than changing all same-thread user navigations.

## Regression proposal

1. Actual shell fixture opens a Flow with prior history, then a local captured automation-list poll receives its renamed row. Assert context text/title, composer placeholder, Chat target name, empty-chat copy when relevant, and Run accessible name agree on the new name. Same flow/conversation/message nodes remain; count conversation list/read calls before/after metadata refresh to prove no added read.
2. Type a draft and set selection/focus; scroll away from latest and dispatch the owning scroll event before rename. Assert draft, selection, focus, scroll position and Jump-to-latest state persist after poll/metadata render and any held prior reply. Repeat while outside/hidden/unfocused document owns focus. Explicit real thread navigation and Latest Back still retain their established follow/handoff behavior.
3. Repeated identical names emit no additional metadata changes. A name update for an old flow after navigating to Latest/question/another flow is ignored. Reentrant target→strip updates terminate without extra focus/read or a loop. Names remain plain text, including markup-like names.
4. Remove the open Flow from a successful complete list (including empty list). Retain historical target/name/conversation/draft/scroll; disable Run and clear exports while showing only current-list unavailability. Do not assert Core deletion or auto-open Latest. Returning the row clears that feedback and refreshes a changed name. Offline/loading/read failure must not manufacture a deletion/unavailability claim from an unconfirmed empty state.
5. Strip metadata/availability updates retain export/notice control identity and pending/error state; removed controls retain the already verified source-owned nearest-neighbor fallback and active-document guards. New tests extend the existing local owning models, not shared fake DOM.

Direct owning tests currently cover basic automation→Latest target/context changes, explicit focus/no-steal/late replies, keyed strip controls, and in-place stream/live nodes. They do not exercise a refreshed automation name arriving at an already open chat, metadata-only scroll preservation, or a missing shown row's explanation. Existing same-flow identity protection was established in the earlier navigation audit; this audit adds no runtime claim or new execution.

## Validation and boundaries

Source/owning-test inspection only, including named contract path discovery. Existing prior row ownership wiring was consulted for refresh ingress; no additional module changes are proposed. No tests, types, build, audit, live browser, provider, panel command or commits run during supervisor gates. Only this report changed. No claim about actual server rename notifications, Core deletion semantics, browser rendering, or live accessibility certification. Product/test source remains frozen; proposed ownership requires a new explicit implementation brief after current gates.
