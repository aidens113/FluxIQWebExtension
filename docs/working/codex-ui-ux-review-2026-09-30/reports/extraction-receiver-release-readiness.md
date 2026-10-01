# Extraction receiver release readiness

Status: Complete ? read-only readiness; implementation HELD
Owner: recording_controls
Date: 2026-10-01

## Written brief and preserved work

Supervisor bounded this work to the completed extraction-session-id-implementation.md state, the held extraction-receiver-ownership-plan.md, and at most four direct content sources. Only this NEW report is owned. Session binding remains frozen: seven product paths, four new owning suites, five fixture-only paths and the explicitly released single schema assertion; worker208 tests/scoped17 roots passed, awaiting independent root review. No prior source, tests, reports or shared document was reopened here.

Exact four source reads: apps/extension/src/content/picker/session.ts; content/picker/messages.ts; content/picker/recorded-event.ts; content/message-handler.ts. No other direct source or original test read, source/test write, check, heavy/browser/Lab/provider/private operation, commit or push in this readiness task.

## Actual current receiver behavior

session.startPick unconditionally calls stopPick, then installs a fresh picking session and shared capture listeners. stopPick clears timer/listeners/overlay and forgets session. Pointerdown sets draining and sends the actual synchronous structural inference result; click/auxclick, draining Escape and the10s backstop all eventually call stopPick. A genuine successful list pick therefore has no local identity left by the time a normal panel Confirm arrives.

messages.handleExtractionMessage always acknowledges start, cancels every current picker regardless of message ID, and calls stopPick BEFORE recordExtraction regardless of message ID. Parsing requires only a string ID. A known old cancel or record A can consequently stop B; a known retired start can replace B. Those are routing/lifetime defects, not proof of authorization failure. recordExtraction remains synchronous: validate definition, check isRecording, then emit data.extract; its original refusal and recording order must remain unchanged.

Timer/listener callbacks also need leases. Current timeout closes global current session through stopPick, so a retained A timeout can release B even if clearTimeout was called. Shared listener functions inspect global session; merely checking session exists cannot distinguish a retained old A callback invoked after B. Per-overlay-instance callback closures must guard the captured session object BEFORE swallowing an event or changing current state. Each restarted drain timer also needs its own token so an obsolete timeout for the same session cannot prematurely release the newer drain window.

message-handler answers extraction only from the active content instance/top frame; sender is not used for extraction here. Preserve those routing rules. This audit does not inspect or certify sender, project, recording-manager, tab/frame authorization, background ownership or protected runtime.

## Smallest cohesive receiver unit ? exact six initial paths

Product3:
- apps/extension/src/content/picker/session.ts
- apps/extension/src/content/picker/messages.ts
- apps/extension/src/shared/extraction-messages.ts ? ONLY synchronized truthful stale_session content-refusal union/comment addition if supervisor accepts it

NEW tests/support3:
- apps/extension/src/content/picker/tests/receiver-ownership.test.ts
- apps/extension/src/content/picker/tests/confirmation-lifetime.test.ts
- apps/extension/src/content/picker/tests/confirmation-fixture.ts

No picker barrel/host/router/recorder/recorded-event/backend/Core/old test/helper edit is required by this design. messages imports new local session capabilities directly. Existing shared exports and compiled message handling provide the vocabulary contract; new owning handler cases assert the exact stale_session response, so no standalone contract-only suite is necessary. shared/extraction-messages.ts overlaps frozen binding and must be serially released only after its root checkpoint/review.

Use the separately completed extraction-confirmation-fixture-plan.md for its genuine synthetic repeating-list inference and public recorder setup. That plan remains held and was not reopened here. NEW local fixture may implement the missing standards-consistent DOM selector/listener primitives instead of mutating old fake-shadow-dom/session fixtures. Actual pointerdown must produce a nonempty structural proposal before any confirmation-lifetime success assertion; no mocked inference, invented picked field, injected production hook or real page data.

## Session ownership and exact handlers

Keep an accepted local lease separate from overlay/listener lifetime. Store only actual ID/form and structural outcome state, never proposal preview values, pairing tokens or browser storage. A real successful list inference marks the lease confirmable. Refusal remains rearmable under that SAME ID as existing background behavior expects. Generic release removes overlay/listeners/timer but preserves a successful confirmation lease; matching cancellation/replacement retires it. Local retired IDs prevent only known retired deliveries during that lease memory lifetime.

start B retires known A, releases A overlay, and creates B. Current duplicate B start while picking should acknowledge without duplicate listeners. Refused B can rearm B with a NEW overlay callback instance without tombstoning B. A duplicate start after a successful picked B must preserve its confirmation lease and not downgrade it to picking. Known retired A start returns stale_session without touching B. Never-seen start C may legitimately replace B because opaque IDs convey no arrival chronology.

cancel A compares ID before ANY release. Matching A removes its overlay/confirmation lease and records its retirement; unknown or known-retired A is an acknowledged idempotent no-op with respect to B. Remember an unknown cancellation ID only as a cancellation tombstone, so a later matching start delivery cannot rearm it within the supported memory lifetime. Do not announce page Escape twice or interpret popup disappearance as cancellation.

record A performs its local lease decision before ANY stop/release/emit. Exact current successfully picked A can release its own residual drain and call existing recordExtraction. It remains valid after click/auxclick, captured current timeout or draining Escape. Mismatching/known-retired A, or currently picking/refused A without a successful proposal, returns stale_session and emits nothing. Invalid-definition/not-recording still come from the existing recording gate and leave the appropriate confirmation lease retryable. A successful command emits once for that invocation; do NOT consume all confirmation identity or cache a different definition across explicit Confirm retries.

Trusted idle no-pick DefineExtraction stays compatible: with no local lease and a never-retired requested ID, invoke existing definition/recording gate without creating a pick lease or stopping an overlay. When B exists, unowned A record is refused. Idle known-retired A remains refused. This is bounded correlation policy, not authorization or proof that an unknown idle record was issued by the current caller.

## Explicit release decisions and readiness condition

Recommend truthful stale_session vocabulary rather than falsely reporting not_recording or silently extending invalid_definition to mean owner mismatch. Exact shared union/comment change and both new handler assertions need explicit synchronized release; existing authored refusal strings/count receipt/run semantics stay unchanged. No new content message names or fields are needed.

Exported stopPick is currently unconditional forget/reset and original owning tests may use it as administrative teardown, potentially reusing synthetic IDs. Before release, the supervisor must resolve its lease/tombstone reset semantics against the original session/message tests. Recommended bounded policy: preserve explicit administrative hard reset as full local state reset, while all production receiver cancellation/replacement/drain paths use the new exact-owned release/retirement operations. Tests use the existing reset seam, with no production-only fixture hook. The supported known-retired claim then lasts until an explicit administrative reset/content-document replacement; it cannot survive that reset. If hard reset is instead meant to retain tombstones, exact original fixture identity/setup scope may be needed after demonstrating reuse, preserving every behavioral assertion. No reset/fixture decision was invented in source here, and no original tests were inspected under this four-source budget.

A retired-ID cache cap would also weaken a document-lifetime known-retired guarantee after eviction. Choose/document full local lifetime memory versus a bounded cache proof limit; do not silently claim both permanent local fencing and arbitrary eviction. IDs alone are retained, never page values. Stronger durable lifecycle/authority is outside this unit.

## Tests first ? executable cases after release

1. Actual parsed handler start A then B; old cancel A leaves every B overlay/listener; exact cancel B clears only B. Unknown cancel C is safe and a subsequent start C is refused within supported tombstone lifetime.
2. Known retired start A after B returns exact stale_session and never recreates A overlay; current duplicate B installs no duplicate listeners; real refusal B rearms same ID without retiring it.
3. Capture A listener and timeout, replace by B, invoke retained callbacks: no B release or swallowing. Restart A drain timer and invoke the old same-A timeout: newer drain remains. Existing entire physical-press swallowing and10s current backstop remain intact.
4. Genuine list proposal A through actual pointerdown/inference, then click, auxclick, current timeout and draining Escape separately; record A through actual parsed handler emits one data.extract for each isolated valid invocation. Proposal assertion is mandatory; event has selectors/names/counts and no sampled page cells.
5. Still-picking Escape announces exact A once and retires A; matching cancel after successful overlay drain retires confirmation without spurious background cancellation. Duplicate start cannot turn picked A into an unconfirmable pick.
6. Retired/mismatching A record while B picking/picked returns stale_session, emits zero and preserves B. Current invalid definition and recording-off refusal preserve original vocabulary and retryable local lease.
7. Trusted idle never-seen-ID DefineExtraction records through existing real recording seam; idle retired-ID record refuses; unowned record while B is active refuses. No universal ownership claim from idle acceptance.
8. Two explicit current picked-A record invocations retain existing retry behavior; tests do not invent at-most-once or assert cached success for a different definition. Existing domain definition/count/recording-first/run-failure paths remain unchanged.

After source release, reproduce actual current failures first, run these owning suites plus original picker/session/message/recorded-event and relevant background confirmation/receiver vocabulary callers through external TEMP heavy harness, then exact actual-config scoped roots. No original assertion/harness/compiler/baseline relaxation. Root independently verifies and owns broad/type/build/structure coordination. This is source-based readiness, not browser certification.

## Separately held work and proof limits

The held receiver plan contains a smaller complementary background unissued-start unit: control.ts plus NEW extraction-start-currentness.test.ts, exact captured store object checks after ensure and before dispatch/ack/cleanup/rearm. This readiness task did not reread backend source and makes no new backend verification claim. That unit can fence unissued stale A; it does not retract an already-issued message.

Never-seen already-issued A delivered after B cannot be ordered from opaque IDs. Neither a retired-ID set, UUID sorting, locally reset counter nor receiver callback lease proves that A is old rather than a legitimate later start. Stronger ordering/handshake needs separately synchronized message/store/background/receiver lifetime design and its own release.

Confirmation idempotence is also separate: background records before run and failed run retry may carry a new dataset nonce. Retiring on first record, suppressing duplicates or caching success changes that contract and must not be smuggled into routing fixes. No across-command at-most-once, mutation cancellation, universal idle-record origin, project/recording authority or live browser guarantee is made.

Final claim: only this report was written. Exact six-path cohesive receiver unit is ready for supervisor policy/scope release after frozen binding review, with reset/vocabulary/tombstone lifetime decisions explicit. Every existing implementation path remains frozen.

## Read-only reset compatibility supplement ? supervisor released

Supervisor independently reviewed frozen binding source/new suites and observed owning208/native0 plus scoped17roots0. Root corrected the new mounted-test import to use the existing background/extraction barrel after its structure check; this worker did not reopen that frozen test. Full extension gate58454 was active throughout this supplement; no source/test/check changes here.

Bounded discovery used rg stopPick under apps/extension, plus picker/message test path discovery. Exact FOUR files read for this supplement: content/picker/tests/session.test.ts; content/picker/index.ts; e2e/content/tests/extraction/tests/extraction-picker.spec.ts; content/picker/messages.ts. No original tests were run.

Actual caller inventory: session.ts has internal start replacement, click/auxclick drain,10s timeout and Escape calls; messages.ts has cancel and record calls. The ONLY external stopPick call found under apps/extension TypeScript sources is session.test.ts line73 in finally. Picker index exports only message parsing/handling and its Handling type, not stopPick. No product router/host imports the administrative stop function through the picker public barrel. Receiver implementation must migrate ALL six normal lifecycle call sites to owned release/retirement paths; exported stopPick can therefore remain an explicit administrative full reset without making ordinary cancellation/drain forget tombstones.

Synthetic reuse is concrete: session.test.ts caches its module import in a shared session variable; all three started-picker cases call startPick("s1","list") in the same module instance. The first case escapes a waiting pick. Every case finally invokes existing stopPick before global restoration. Keeping retirement of s1 across that administrative teardown would suppress the later same-ID cases or require fixture changes. Full administrative reset clears overlay/listeners/timer, accepted lease, retired IDs and callback/timer tokens; it preserves all existing test setup/assertions exactly and needs no new reset hook or old fixture edits. A retained pre-reset callback must still be inert after reset because its captured instance/token is no longer current.

Confirmed policy recommendation: preserve exported stopPick as explicit full reset. During normal receiver operation, retire IDs for replacement/matching cancellation/picking Escape and retain those ID-only tombstones for the remainder of this content-document lifetime, except an explicit administrative reset. Ordinary successful structural-pick drain and record invocation retain the confirmation lease without clearing retired IDs. No arbitrary cache eviction is recommended in this bounded unit; an evicting cap would need its own declared fencing limit. Only known local IDs are remembered and nothing is persisted. There is no existing product external administrative-reset caller in the searched extension TypeScript scope; a future caller must understand that reset deliberately ends the old local ordering memory.

Messages has no directly owning Node test file under current picker/tests; discovery found only session.test.ts. The real content extraction-picker.spec.ts is the existing browser owner for the message path. Its valid picked confirmation uses pick-catalog, a trusted browser click produces a real proposal, overlay count becomes0, then extraction.record with the SAME ID expects ok:true and exactly one data.extract with matching definition/D3 assertions. The other cases use distinct pick-escape and pick-preview IDs. New local owning message/lifetime suites are therefore necessary; administrative reset compatibility does not authorize replacing the real proposal with a fake or asserting overlay presence at confirmation. No existing e2e source/assertion adaptation is needed by the recommended receiver policy.

Preserve source-based limits: no browser behavior was exercised here; no authority/sender assurance, already-issued unseen-ID chronology, across-command confirmation idempotence, backend currentness or successful broad gate claim is made. Tombstones guarantee only known deliveries while that local lifecycle memory remains; explicit hard reset/document replacement ends that memory. The four-source budget is satisfied and the reset question is now resolved as a concrete compatible recommendation for supervisor release. Stale-session vocabulary and exact six implementation/test paths remain HELD until explicitly released.
