# t905 normal input owner implementation
Role: heavy worker, gpt-6.1-sol, Max. Lead-approved first unit; wait for explicit source release before editing or running checks.
Root C: C:/Users/osrs_/FluxStuff/fxwork/t905/!FluxIQ/packages/fluxiq/src.
Read codex-t905-input-owner-design.md first-unit brief and rationale; later execution/secret/witness sections are not implementation authority.
Own new C/runtime/input-basis/** and C/framework/automation-service/service/input-basis/**, local barrels/tests only.
Own report docs/working/mvp-launch-plan/reports/codex-t905-input-owner.md in paired extension.
Must not touch engine/admission/replay/judge/run-secrets/FluxNode authoring, existing service wiring, public package exports, other lanes/shared docs, generated data or private credentials.
Implement durable nonsecret owner/revision and private immutable snapshot/head storage using existing owning APIs; no new storage engine/migration.
Trusted scope binds project/task/principal/logical producer; no raw request principal or value-derived key.
Use opaque owner/binding IDs and positive monotonic revisions; only exact private nonsecret JSON and ordered authenticated producer refs participate in structural comparison.
Private execution-copy accessor must isolate caller/reference mutations; lease proves stored bindings only, not that execution used them.
Trusted secrecy inspection is required. Missing/active/raw/unverified secret context or secret-bearing origin returns unknown before any snapshot/head write.
No plaintext secret copy, new value hashes, redacted-value equality or secret-bearing dataset row copied to the new snapshots.
Authenticate each producer ref through its owning port; arbitrary well-shaped refs cannot become trusted provenance. Unknown/foreign/stale producer => unknown, no receipt.
Validate scope/reference encoding before deriving filesystem keys; reject cross-project/principal/slot/owner references and malformed/unsupported input without dropping fields.
Same values and current producers reuse revision; any value/producer/definition change advances, including A->B->A.
Do not hold project DB transaction while writing snapshot. CAS head atomically; reread/recompare after race, never return an unpublished receipt.
Snapshot/head failures preserve original error and prior head; orphan snapshot is not authority. Corrupt/unreadable state never becomes a fresh owner by fallback.
Reopen across a fresh process/store requires exact durable authority and readable immutable snapshot/count. Missing authority stays unknown; no WeakMap-only durable proof.
Tests cover comparison distinctions, mutation isolation, restart using actual temporary storage, scope isolation, producer authenticity, CAS concurrency, original failure identity, and zero writes for unverified secrecy.
No arbitrary retry cap, cancellation suppression, user-data access, browser, provider calls, package builds or full suites.
After source release, run only adjacent owner/store tests, fluxiq package check and unchanged structure audit via heavy-slot coordinator (one reader/job per lane).
Freeze source for each check and final lead acceptance; report all failures and exact endpoint. Ask lead only for precise necessary scope expansion.
End Outcome/Changed/Validation/Not verified/Report/Notes.
