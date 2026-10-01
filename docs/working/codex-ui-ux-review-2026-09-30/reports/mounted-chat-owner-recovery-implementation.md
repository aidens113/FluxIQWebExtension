# Mounted Chat owner recovery implementation

Status: Complete; eight source/test paths frozen for independent supervisor review
Owner: runtime_contracts worker
Date: 2026-10-01

## Written brief / hold

- Read parent Current State and frozen mounted-chat-owner-recovery-plan.md. Six proposed paths accepted in principle; inspect module budgets and propose exact owner-context/helper/barrel/test needs before implementation release.
- Preserve root frozen controller/feed/shell/protocol/Automations and original assertions. Confirmed owner tuple/missing settings/volatile reconnect distinctions, leased requests/UI, coherent latest reset, active-only reads and unsupported capability lifetime are binding.
- Explicit parked/adopt/clear draft policy; atomic separate versioned local UI key/literal legacy fallback; preserve standalone composer/storage APIs and newer edits/accepted sends.
- Own this report only during held extension full3272 gates. No source/test edit, heavy/check/broad/live/browser/provider/panel/private-data operation, shared doc or commit. Await explicit final-path release.

## Budget inspection and exact proposed paths

Current chat-panel.ts339 lines, composer.ts165; draft-storage.ts36. Read-only structure rule inspection confirms advisory400 and hard800 lines, exported value/module rules and existing chat/index.ts barrel. No structure command was run, baseline/config changes are neither proposed nor needed.

The owner tuple/confirmed-Core retention/opaque epochs/request lease is a cohesive non-DOM responsibility. Adding it alongside mounted reset/draft/callback glue would push chat-panel past its advisory budget and mix identity observation with rendering. Propose exactly two additional paths beyond the accepted six:

- apps/extension/src/panel/chat/owner-context.ts (new, one exported createChatOwnerContext plus related types)
- apps/extension/src/panel/chat/tests/owner-context.test.ts (new, pure ownership/lease cases)

No barrel edit is needed: chat already has index.ts, and this helper is internal to chat-panel, imported directly like existing private same-thread/target helpers. Do not re-export a private lifecycle helper from the public Chat facade. No new directory or prefix group is introduced. If supervisor requires a public re-export, chat/index.ts would be a separately released ninth path; it is not necessary for the internal design.

Total proposed eight paths awaiting explicit release:

1. apps/extension/src/panel/chat/chat-panel.ts
2. apps/extension/src/panel/chat/tests/chat-owner-recovery.test.ts (new)
3. apps/extension/src/panel/chat/conversation/composer.ts
4. apps/extension/src/panel/chat/conversation/tests/composer-owner.test.ts (new)
5. apps/extension/src/panel/chat/conversation/draft-storage.ts
6. apps/extension/src/panel/chat/conversation/tests/draft-storage-owner.test.ts (new)
7. apps/extension/src/panel/chat/owner-context.ts (new)
8. apps/extension/src/panel/chat/tests/owner-context.test.ts (new)

Keep owner-context below roughly120 lines, mounted glue narrow, composer below roughly300 and storage below roughly150; these are planning estimates, not measured final budgets. Do not compress code or remove useful comments to evade a threshold. If mounted responsibility still grows excessively, report exact evidence before adding any further path.

## Executable owner-context policy

createChatOwnerContext receives the existing request function and privately retains observed gateway/Core/client/project/paired fields. observe(status) updates last confirmed settings.coreApiUrl only when present and compares the consumed tuple. It reports initial binding separately from replacement while advancing the lease whenever previously unknown identity becomes confirmed. If any data was read under an unknown owner before first confirmation, that lease/data is retired and masked just like a replacement; no unknown-context history is silently adopted. First binding classifies a legacy standalone draft without discarding it. Missing optional settings preserves the confirmed Core URL; missing projectId normalizes to null/no current project per ExtensionStatus semantics. Gateway/client/paired absent in historical partial test statuses retain an already confirmed field or remain unknown, not invented strings/booleans. First richer observation is tested independently from replacement. Reconnect/session/tab/recording/activity/name changes leave an otherwise identical owner epoch unchanged.

Each captured owner contains an opaque token, stable non-secret storage identity string and current() predicate. A/B/A gives a new token even when the storage identity returns to A. Its typed request adapter checks current() before dispatch, returns a fixed existing ordinary failure result when obsolete, and otherwise calls the underlying request without adding/changing wire fields. Already dispatched promises remain truthful, including successful old-owner sends; only new obsolete dispatch is refused locally. No owner tuple/status/key data is logged.

The helper does not instantiate DOM, controller/feed or own timers; those remain mounted Chat responsibilities. This keeps frozen controller/feed contracts untouched and makes identity/lease behavior independently testable.

## Mounted reset and callback sequence

Replace const controller/feed with captured owner-scoped instances, constructed through one private factory in chat-panel.ts. Callbacks check both captured owner token and current instance identity before onFeedChange/renderAll. render(status) observes owner synchronously before enabling reads and before shell's following Automations observation.

On replacement: advance context epoch; clear debounce/timer; stop old feed; disconnect old controller (cancels quiet retries and advances its generation); clear old answerIn/seen/clock/historyTaken/turn-openers/read presentation; set shownTarget latest and update context/placeholder; bind composer to new owner and park its existing nonmatching text; instantiate current controller/feed. Render coherent empty/checking state before notifying target listeners, because shell showTarget/draw may synchronously call setActive. Finally connect/start current instances according to actual active/connected flags; make reentrant activation idempotent. Inactive replacements do not initiate a fresh Chat read until active again.

Do not call focus or followNow during reset. Keep permanent composer DOM/caret and source-owned explicit navigation handoff. Same-owner passive automation renames preserve original no-read/draft/selection/focus/scroll assertions. Controller/relay requests remain unchanged. A same-owner target switch retains original accepted send destination and draft behavior.

Known unsupported conversation capability is mounted-lifetime sticky, including across remote owners; keep presentation fallback and suppress further conversation reads after its verified unsupported result. Refused is owner/connection-recoverable. Feed unsupported likewise must not retry for every status observation. Resetting current owner data does not automatically reset shell's separate working feed or recording/Automations state; those stay outside this unit.

Rendered turn controls, pending ask callbacks, Retry, Show question, Back, example Fill and turn-specific Open FluxIQ capture owner/target/node lease. Test lease before using the captured controller or mutating draft/focus; an old same-ID pending ask cannot answer a new owner's current ask. Cleared/replaced nodes do not become valid again through same-ID A/B/A. Stable current native controls remain functional. Hidden/inactive transitions retire old rendered action leases while retaining current-owner draft convenience; reopening establishes current leases without resetting owner history merely for a tab change.

Timer/debounce/feed triggers target the captured current instance and are cleaned on owner/inactive transitions. Preserve controller's existing pending-read coalescing plus single again follow-up and quiet retries. No changes to read failure thresholds, backend cancellation, source signal, wire or fallback protocol.

## Composer and persistence policy

Add an owner-binding method to existing Composer type, receiving opaque token, storage identity and current() predicate. Preserve createComposer(send), fill/focus/placeholder/render and standalone behavior. Owner binding does not remount box, force focus or send. A current matching restored owned draft remains usable without another review on each popup open.

Draft storage retains legacy read()/write(text) unchanged for standalone consumers. Add typed owning read/write methods in the same module, using new UI key fluxiq.ui.conversationDraft.v1 and a single JSON record `{version:1,text,owner}` where owner is a string or explicit unowned null. Read the old fluxiq.ui.conversationDraft value literally only when no new record exists. Never parse legacy JSON-looking text. Validate the new envelope minimally; malformed records preserve recoverable text as unowned or fall back to literal legacy text, never silently adopt. This is one UI draft, not persisted project/thread/history state.

Owned writes set the atomic new record before best-effort removal of legacy text. Empty writes retain an explicit empty new record to prevent legacy resurrection after removal failure. Blocked storage costs only convenience; it must not create an owner stamp in memory that was never confirmed for restored text. Continue existing DOMException handling and preserve unrelated unexpected error behavior unless owning regression evidence requires a separately documented change. No actual localStorage values are read by the worker.

Owner replacement increments composer owner/edit revision. Keep the current nonempty text and its original ownership as a parked draft; render a fixed status, explicit Use draft here and Clear draft controls. Sending remains disabled while parked. Editing or Fill alone preserves parked status; only explicit adoption binds the current owner and writes its metadata. Clear is an explicit person action; no automatic loss on owner switch. Current empty owner drafts need no review. Returning to an earlier owner can unpark only the current retained draft whose recorded identity matches; do not introduce a map of project drafts or overwrite a newer text revision with storage rereads. Persistence reads once for initial binding; later mounted transitions use the current held draft.

At submit capture owner token, edit revision and initiating controller. Preserve original unchanged/edited/retyped/filled/failed/IME cases. A successful accepted old-target send in the same owner remains true; clearing requires unchanged edit revision as today. Owner replacement makes a previous send ineligible to clear or write over current/parked text, release a fresh operation or relabel feedback. Explicit adoption increments revision, so a late accepted prior-owner success cannot clear adopted text even if the text string is identical. Failed old-owner sends cannot restore obsolete text. Frontend fences do not cancel or authorize already dispatched commands.

## Tests-first implementation sequence after release

1. Write only new owning tests for owner-context and the smallest mounted/composer/storage regressions. Reproduce current mounted same-connected owner history/target leak, retained same-ID ask dispatch, and unchanged draft cleared by a previous-owner accepted send. Record exact native failures and distinguish harness failures; owner-helper tests initially lack their explicitly released module and are not counted as product reproductions.
2. Implement pure owner-context; test confirmed Core retained through absent settings, each tuple field replacement, volatile same-owner observations, incomplete first binding, A/B/A lease invalidation, obsolete pre-dispatch refusal and truthful already-dispatched completion.
3. Implement versioned draft methods and composer binding. Test legacy literal JSON text, matching-owner restore, different/unowned parking, edit/fill without adoption, explicit adoption/clear, same-owner reopen without repeated review, return to matching held draft, malformed envelope and blocked storage, atomic write failure/legacy removal failure. Original standalone read/write/composer assertions remain unchanged.
4. Implement mounted instance/reset/leases. Defer old list/get/feed/push/send/answer and replace owner synchronously while connected; inspect first presentation and callback dispatch counts. Same-ID new context remains isolated, fresh operation can proceed without old lock, old completions cannot clear/read/publish. Test coherent listener notification and active/inactive reentrant activation without duplicate subscriptions/timers, unsupported/refused lifetime, current quiet retries and late old callbacks.
5. Preserve original Chat, navigation-focus, target-switch, controller/controller-recovery43, composer-draft/keys, activity-feed, shell navigation assertions through focused validation only. Use local new-test fake-DOM instrumentation and existing helpers without editing them. Synthetic focus/scroll/listener tests are not live browser certification.
6. Run affected/new owning suites and specified original compatibility suites through heavy.sh with unique codex labels; actual extension strict test-config roots include all released files and report owning/global/dependency diagnostics. Exact-path diff check and measured source line counts, then freeze. Root owns independent verification/full gates/authored architecture docs/integration. No broad command in worker.

## Progress ledger / hold

- 2026-10-01: read written parent brief/Current State and frozen plan; inspected current source line counts, existing barrel and narrow structure rule constants. Proposed eight exact paths with no barrel change. No product/tests/helper source written, no heavy command or actual storage/private data inspection. Full extension gates remain supervisor-owned; source release required before tests-first execution. Onboarding and all earlier units remain frozen.

## Final implementation and freeze

Implemented exactly the released eight paths; no existing test/mock/helper assertion was changed. The helper captures confirmed remote context and typed request leases; mounted Chat recreates owner-scoped controller/feed instances, synchronously resets target/history and fences subject callbacks, source completions, subscription/debounce/poll callbacks. Old controllers are disconnected and old feeds stopped; frozen controller/feed source is unchanged. No shell/protocol/Automations/background/Core/barrel/source helper expansion.

Historical first initialization may read before any setActive observation, preserving existing standalone mounted Chat contracts. Supervisor explicitly confirmed this exception. Every later unactivated owner replacement is masked and waits for activation. Explicit inactive/hidden lifecycle disables fresh owner reads and old action dispatch. Active owner reset is coherent before synchronous shell target notification, and replacement subscriptions/timers are idempotent. Reconnect/session/tab/activity/name-only changes retain the owner and existing drafts/confirmed turns/reading position; missing optional settings retains last confirmed Core address.

Latest Back is a generic mounted same-owner action, so its current button survives ordinary same-owner target changes and keeps the verified fallback focus handoff. It is renewed/fenced across owner or active lifecycle. Subject-specific examples/Retry/question/ask controls have narrower target/owner scopes; asks also require the same current conversation, turn text and pending ask semantics. This preserves original native focus assertions while preventing same-ID retargeting. Rebuilding current subject controls does not remount composer or scroll follower; passive names preserve DOM/selection/focus/read count.

Composer binds a draft to opaque owner and edit revisions. Foreign/legacy text is parked with fixed review guidance and explicit Use draft here/Clear draft controls; editing/fill never adopts or sends it. Retired adoption/clear controls cannot affect later owners. Matching owned text restores without repeated review. Atomic separate versioned UI record preserves literal legacy JSON-looking text, write-failure nonadoption and explicit-empty records against legacy resurrection. Standalone legacy read/write/composer behavior remains intact. Accepted old-target sends remain accepted; owner/revision/operation identity prevents old success/failure from clearing adopted/newer text or releasing a new send lock. No command cancellation or backend authorization guarantee is claimed.

Observed validation ledger (worker claims pending supervisor verification):

- Original mounted reproduction:2tests/2fail/native1/34.7292ms, confirmed project/Core replacement retaining old target.
- Initial compatibility:35tests/34pass/1fail/native1/301.7749ms; the unchanged fallback Back focus assertion exposed excessive target fencing. Fixed generic same-owner Back policy, not its original test.
- Expanded compatibility:9suites57tests/native0/298.3735ms.
- New owning cases:4suites31tests/native0/122.4464ms.
- Retained stale poll reproduction:10tests/9pass/1fail/native1/252.0748ms, retired callback added2requests (10 versus8). Fixed exact timer/debounce handle ownership plus captured owner/controller/feed; old callbacks cannot dispatch or clear a new schedule.
- Latest comprehensive dependent focused run:13suites128tests/native0/1651.217ms. Includes all four new owning suites and unchanged Chat/focus/controller/controller-recovery/target/composer-draft/keys/feed/shell-navigation suites. Dependent checks remain provisional through other worker freeze; supervisor independently reruns frozen integration.
- FINAL actual strict test-config scoped8roots native0 (91763), zero owning/global and zero dependency diagnostics. TEMP checker resolves actual chrome/node typeRoots; no tracked compiler config/baseline relaxation.
- Exact-path git diff --check native0. Product measured407lines Chat (advisory400/hard800),32 owner-context,214 composer,61 draft-storage. Slight Chat advisory growth remains honestly reported; no hard-budget violation or extra module without release.

All tests and type runs use C:/Program Files/Git/bin/bash.exe with C:/Users/osrs_/FluxStuff/build-slots/heavy.sh and unique codex labels. Narrow TEMP runner C:/Users/osrs_/AppData/Local/Temp/codex-t224-chat-owner-tests.mjs bundles named tests only into ignored apps/extension/.test-build-scratch/codex-chat-owner; TEMP types C:/Users/osrs_/AppData/Local/Temp/codex-t224-chat-owner-types.mjs reads actual tsconfig.test.json with exactly the eight roots. No broad gate/browser/provider/panel/private state/shared-doc/commit/push action.

All eight source/tests now frozen. Source masking/leases drop old retained UI data and old requests; untagged new relay responses still belong to relay responsibility. Shell's separate working feed and indistinguishable pairing token replacement remain outside this unit. Synthetic DOM/timer/storage tests do not certify live browser focus/scroll or actual dispatch authorization. Parent owns authored documentation, integration and independent full gates.

- Explicit eight-path implementation release received after ninth extension1878/type/build/structure passed. Tests-first two mounted original regressions failed native1/34.7292ms (confirmed project/Core owner kept old automation target). Initial compatibility35 run passed34 with one preserved focus assertion revealing Back must remain a generic same-owner latest action across target changes; kept its owner/activation lease while preserving DOM/button identity for same-owner target changes. No original test/helper edits. Supervisor explicitly confirmed historical first initialization read before activation observation; owner replacement and explicit inactivity remain deferred/disabled.

- Current eight-path implementation now passes new four suites31tests/native0/122.4464ms and nine-suite compatibility57/native0/298.3735ms; provisional actual strict test-config8roots0 owning/global/0 dependencies/native0. New mounted tests cover first-read compatibility, explicit inactive/replacement deferral, same-ID retained ask/current ask, old pending thread/activity/listener drops, same-owner missing settings/reconnect/name/draft preservation, unsupported lifetime and synchronous shell listener activation. Source remains within hard budgets (Chat402/advisory400, Composer214); measured slight Chat advisory growth reported for review, no helper/baseline relaxation or extra path. Checks remain provisional through other worker freeze.
