# Mounted Chat owner recovery plan

Status: Complete; read-only design frozen for supervisor review
Owner: runtime_contracts worker
Date: 2026-10-01

## Written brief

- Read parent Current State, root chat-owner-recovery-audit.md and exact mounted chat/controller/composer/feed/shell/consumed ExtensionStatus plus directly owning tests/helpers.
- Preserve independently verified root controller correction43focused/strict0; automation owner source remains another worker's partition and is not a stable dependency to inspect.
- Plan confirmed gateway/Core/client/project/pairing owner masking, retained leases, pending operations, history/activity resets, coalesced active refresh, drafts/newer revisions and accepted sends without wire changes or cancellation claims.
- Own this downstream report only; no product/tests/shared docs edits, broad checks, live/browser/provider/panel/private data or commits. Implementation requires a separate released brief.

## Progress / source-confirmed constraints

Read exact mounted Chat, frozen controller and composer, feed lifecycle and shell call ordering, consumed status/settings fields, owning mounted/focus/feed/composer/target tests and direct draft-storage helper. No Automations source was opened. Parent Current State/root audit preserves the frozen controller exception/generation/answer recovery; those fixes are not reimplemented here.

Mounted Chat render currently observes only connectionState. A same-connected Core/gateway/client/project/paired change keeps target, controller turns, activity snapshot/history, clock, historyTaken, seen and callback state. A false/true reconnect already invalidates controller reads via the root correction and preserves existing same-owner presentation; it must not be mistaken for a new owner.

ActivityFeed.stop invalidates completions/subscriptions but deliberately retains confirmed snapshot. A stop/start alone therefore cannot clear old-owner history. Recreating a feed scoped to a new owner is sufficient to isolate its local snapshot and preserves all existing feed lifecycle semantics; existing feed source need not change. The shell has a separate activity feed for working holds, so resetting the Chat feed does not reset shell working state. That is a separate source-confirmed consideration, not permission to edit shell or Automations.

Controller generation keys target/connection, not remote owner. Replacing its instance at a confirmed owner change isolates same-ID conversations and operation locks without editing the frozen controller. Old callbacks must also be fenced: calling the new controller with an old same-ID ask would otherwise pass the controller's valid-current-ask test. Owner leases, not ask ID alone, belong in mounted Chat.

Composer's existing editRevision correctly protects newer typing/fill/retyping from successful send clearing. It does not know owner. draft-storage intentionally persists one unscoped string as a per-viewer convenience. A new owner cannot silently reuse that persisted text as an explicitly reviewed current-owner draft, and a late accepted old-owner send cannot erase a current-owner edit. This requires an explicit draft transfer policy before release; no actual stored drafts were inspected.

## Proposed ownership and lifecycle contract

Use a private owner tuple in mounted Chat: gatewayUrl, last confirmed settings.coreApiUrl, clientId, normalized projectId (string versus null/no current project), paired. Compare consumed values only, never stringify/log the status. Missing optional settings preserves the last confirmed Core address; a genuinely present different/empty address changes owner. ConnectionState, sessionId, tab URL/id, queue/activity counts, timestamps, recording state and automation names are volatile presentation and do not change owner. Reconnect within that tuple keeps drafts/confirmed turns/scroll and uses the root controller's existing connection generation fence. Initial minimal synthetic statuses remain supported: absent owner fields are not read as literal string values or exposed; first confirmed owner binds the mounted context. Test first confirmation separately from actual replacement.

The tuple is a frontend context observation, not a pairing-token identity. A token replacement that leaves all observable fields identical cannot be detected by this protocol; do not add or expose token material. A retained same-valued A/B/A transition still receives a fresh opaque epoch so an original A callback cannot become current again.

On a confirmed tuple replacement, before starting new reads:

1. Advance owner epoch; invalidate rendered operation/navigation leases and clear pending timer/debounce state.
2. Stop the old Chat feed and set the old controller disconnected, cancelling its quiet retry schedule and fencing its old read/answer completion. Keep any already dispatched request intact.
3. Instantiate a fresh owner-bound controller/feed privately in chat-panel.ts, with onChange closures that first test captured instance/owner equality. This resets same-ID conversation turns, anchor/revision, operation locks/errors and feed local history without editing either frozen controller or feed.
4. Reset shownTarget to latest, clock/historyTaken/seen/answerIn/read notice/turn opener list, clear the thread immediately and update current context/placeholder. Emit target change only after state is coherently reset. New target requests follow the current relay ownership, never an old flow/project identifier.
5. Preserve the composer DOM and page focus. Owner reset does not call focus or followNow; update the visible stream/history without reclaiming external focus. Same-owner passive names retain exact existing no-read/draft/selection/scroll behavior. Actual owner replacement may reset old thread position without implying navigation focus handoff.
6. If active and connected, start current-owner subscription/read and a fresh poll schedule; inactive owners remain masked and wait for activation. Coalesce explicit refresh/debounce/activation/timer triggers per current controller rather than continually restarting generation. Existing controller refresh already coalesces a pending cycle plus one follow-up, so preserve that intentional contract rather than replace its read retry implementation.

Background capability unsupported remains a mounted capability result, not a per-Core authentication failure: preserve the existing no-more-reads/fallback behavior for a known unsupported conversation relay across remote owner changes, using a mounted flag/presentation override if instance replacement would otherwise retry it. A refused token belongs to its owner/connection and may recover on pairing/reconnect as today. Do not synthesize new PanelResult codes or modify wire messages. Feed unsupported capability likewise must not be retried on every status observation.

Every request wrapper captures the instance owner and refuses *new* obsolete dispatch before calling the underlying request. Once invoked, that request is already dispatched and may succeed; its Promise still resolves truthfully for its initiating operation, but old owner callbacks cannot publish into new mounted state. This wrapper must not turn a server-accepted send into a fictitious cancellation. Disconnect alone continues the root's current accepted-target send semantics.

## Retained rendered control leases

Turn controls capture owner epoch, target/thread identity and the rendered pending ask identity. Check the lease before invoking the captured controller. This closes the same-ask-ID-across-owners/targets hole that the controller correctly cannot identify without mounted context. Completion remains controller-owned; no duplicate answer policy or weakening of the root correction.

Use the same eligibility policy for Retry, Show the question, contextual Back, example Fill, and any detached turn Open FluxIQ action. Capturing owner alone is insufficient for an old control after a same-owner target switch. Lease stable controls through the current node/context, and ensure rerendered or cleared stream controls cannot regain validity through A/B/A. Preserve genuine explicit current navigation and the verified focus handoff: focused visible current Back can focus composer/fallback; obsolete or programmatic actions cannot.

Composer input/click/key callbacks live on permanent nodes, so treat events from the current visible enabled composer as current controls, with owner-bound draft validation before send. Merely retaining a function reference is not a new owner confirmation. Programmatic fill from an old empty-state control must fail before changing draft or focus. Hidden/inactive lifecycle invalidates old rendered navigation/answer controls, while the unsent current-owner draft stays intact for reopening. Avoid indiscriminately clearing on every shell draw.

## Explicit draft and accepted-send policy (recommended for implementation brief)

Keep the existing one-draft convenience; do not introduce a durable project/conversation store. Associate its current draft with observed owner context metadata using one atomic versioned record at a new internal UI key, for example fluxiq.ui.conversationDraft.v1, containing only version/text/non-secret owner identity. Read the existing raw-string key only when no new record exists, and always treat it as literal unowned text even when it resembles JSON. This separate key makes legacy text encoding unambiguous. Write the new record before best-effort removal of legacy text; an explicit empty new record prevents old legacy text from resurrecting if removal is refused. Failed new writes leave the old draft unowned rather than falsely owner-stamped. A standalone composer without owner binding keeps its existing legacy behavior for direct consumers/tests. No tokens, browser page state, recordings, turn history or logs.

On first owner binding, restore a draft only when its recorded owner matches. A legacy/unattributed or different-owner nonempty draft remains visible as a parked draft with a concise status and an explicit `Use draft here` action. Sending is disabled until explicit adoption; an edit alone must not silently adopt the draft. Offer `Clear draft` as a reversible person-controlled action, never discard the text merely because remote context changed. Confirmed owner changes similarly park the current unsent text and increment owner/edit revisions. Returning to an earlier owner may restore its still-held draft only if its captured owner matches and no newer user edit would be overwritten. Keep the bounded single saved/parked draft rather than an unbounded map of project drafts.

This metadata changes only extension-local UI draft convenience already authorized by existing draft-storage; durable project/policy/recording ownership stays in Core. Because persistence encoding changes, the eventual brief must explicitly release draft-storage.ts and meaningful compatibility tests. Validate malformed/legacy/blocked storage as unowned preserved text where possible, never a current-owner ready-to-send stamp. No storage values were inspected during this audit.

At submit capture initiating controller/target lease, draft owner and editRevision. Same-owner successful sends still clear only the unchanged submitted revision; newer edits/fill/retyping persist exactly as the current tests require. A successful old-target send within the same owner remains true and goes to its original thread. A server-accepted old-owner send is acknowledged by its initiating Promise, but cannot clear, transfer, persist over or release the new owner's draft/lock. If a parked original draft is retained after the remote owner changes, do not automatically adopt or resend it after an old success; the person controls transfer. A late failure cannot relabel the current owner's composer or restore its obsolete draft. Never imply frontend invalidation cancelled an already dispatched command.

The owner-stamped persistence and explicit parked-draft controls are a proposed product policy for supervisor release, not implemented or silently assumed. A smaller four-path mounted-only solution could quarantine every legacy/restored nonempty draft, but would add repeated review friction on same-owner popup reopen; therefore the six-path design below is preferred.

## Exact proposed partition and sequencing

Candidate combined six-path implementation, disjoint from the automation worker and frozen root controller:

- apps/extension/src/panel/chat/chat-panel.ts
- apps/extension/src/panel/chat/tests/chat-owner-recovery.test.ts (new)
- apps/extension/src/panel/chat/conversation/composer.ts
- apps/extension/src/panel/chat/conversation/tests/composer-owner.test.ts (new)
- apps/extension/src/panel/chat/conversation/draft-storage.ts
- apps/extension/src/panel/chat/conversation/tests/draft-storage-owner.test.ts (new)

Public Composer owner/draft binding method can be defined in its existing file and passed by mounted Chat; no barrel change is necessary because existing exports already expose Composer/createComposer. All owner comparison/lifecycle glue remains private in chat-panel.ts if within its module budget. If that would breach structure budgets, supervisor must explicitly partition a focused owner-context module and barrel before release; do not improvise a seventh path.

Keep conversation/controller.ts, feed/activity-feed.ts, shell/mount-panel.ts, shared/protocol.ts, relay/background/Core and all Automations files unchanged. Existing controller43 and mounted focus/feed/draft/target tests run as validation only. A later separately released shell owner unit may reset its working feed/hold on owner changes, but this unit neither edits it nor claims that responsibility fixed. Shell may synchronously redraw from target listeners; establish the owner reset fully before emitting that notification, then test the existing integration ordering.

## Meaningful tests-first plan

1. New mounted owner tests first reproduce same-connected gateway/Core/client/project/paired replacement leaking old target/turns/activity and same-ID retained ask dispatch. Use full synthetic statuses with harmless synthetic identifiers and a stub request/listener; never actual project/storage data. Keep all original fake-DOM helpers unchanged; local test instrumentation can capture node listeners, request resolvers and timers.
2. Test absent optional settings after confirmed Core does not reset; same-owner connection/session/tab/queue/recording/name changes retain exact turns/draft/caret/scroll/read-count contracts. Confirm A/B/A creates distinct lease generations, and first owner binding differs from replacing a confirmed context. No source-text-only readiness claim.
3. Defer old list/get/activity/send/answer requests. Replace owner while connected and inspect synchronous first presentation before resolving anything. Current same-ID turns and operations win; old results, failures, retained pushes/debounce/quiet retry closures and detached controls cannot modify new state or request new commands. New controller operation can proceed without waiting for an old owner's pending operation.
4. Test active/inactive and hidden/page-hide lifecycle separately from owner changes: no duplicate feed subscription/timer, coalesced current reads, current active owner retries ordinary read failure, obsolete owner has no retries, inactive owner masks old history then reads when reopened. Feed read-after-push precedence and existing failed-reread retention remain unchanged for same owner.
5. Composer owner tests reproduce late accepted send clearing across replacement, then verify original unchanged/edited/retyped/filled/failed/IME behavior plus parked transfer. Adoption is explicit, no send on fill/edit/owner change; current native Enter/Shift+Enter/IME controls remain intact. Accepted old-target sends retain original destination; accepted old-owner acknowledgements do not clear later draft or a newer lock.
6. Draft storage tests cover legacy raw string, valid matching/nonmatching owner records, absent metadata, malformed schema, empty text, blocked storage and versioned record round-trip; use only isolated fake storage. A valid user-authored legacy draft resembling JSON remains literal because versioned metadata uses a separate new key. Test new-record write failure preserves unowned legacy text and a successful empty record prevents legacy resurrection after removal failure. No unavailable persistence may mark an unowned draft as current.
7. Run affected six-path tests plus unchanged controller/controller-recovery/target-switch/composer-draft/composer-keys/feed/chat-panel/navigation-focus/mount-panel-navigation suites with the required heavy wrapper and actual package commands. Inspect native outcomes. Run real extension test-config scoped types with owning/global/dependency diagnostics, exact diff check and then freeze. Root independently verifies and owns full extension gates, architecture docs and integration. No broad/live/private commands in worker.

## Limits / completion ledger

Source-only design complete. Read exact named source/consumed types and directly owning tests/helpers; no incomplete Automations controller, protected Core/backend, actual browser/pairing/project/draft data. No source/test/shared-doc edit, heavy/test/type/build command, browser/provider/panel operation or commit. This report is a worker claim pending supervisor review. Onboarding's prior eight paths remain frozen and untouched during this task.

UI owner epochs cannot validate an untagged *new* relay response as belonging to a different remote context when the wire provides no owner identity. Recreating/masking drops locally retained old snapshots and old requests; the current relay remains responsible for the response it returns. The shell's working-hold feed and indistinguishable token replacement are explicit remaining boundaries. No live browser focus, scroll or dispatch authorization certification is claimed from source inspection.
