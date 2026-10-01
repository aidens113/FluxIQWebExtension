# Onboarding owner and navigation recovery

Status: Complete; source/tests frozen for independent supervisor review
Owner: runtime_contracts worker
Date: 2026-10-01

## Written brief (planning released; product held)

- Identity source/tests stay frozen for eighth gates. Read parent Current State and own frozen studio-navigation-audit.md. Preserve verified guided journey, provider defaults, explicit start/dismiss and child drafts.
- Exact proposed Core paths: automation-studio/onboarding/useOnboardingReadings.ts and new owning tests/useOnboardingReadings.test.tsx; OnboardingView.tsx and existing tests/OnboardingView.test.tsx; onboarding/entry/StudioStartJourney.tsx and existing entry/tests/StudioStartJourney.test.tsx; app/get-started/GetStartedClient.tsx and existing tests/GetStartedClient.test.tsx. No types/sources/helpers/host/coordinator edits without explicit release.
- Render-mask readings by source owner, current generation/layout lifetime; catch synchronous injected source failure and rejected reads with fixed exception feedback. Validate only consumed gateway runtime/session/pairing summaries and AI-key metadata, preserving legitimate empty and optional fixtures. Failed reads never become false absence/ready; actual endpoint refusal copy stays meaningful, no token/key values inspected/rendered.
- Coalesce manual/timer unfinished probes and publish independently settled current-owner steps. Completion-based next checks, hidden pause/resume, pollMs0 one-read and stop-on-complete must preserve explicit manual refresh and current drafts. No new source-signal/backend/dedup/timeout contract or automatic mutation/navigation.
- Fixed Secret Keys setup href accepts current encoded domain via explicit view override with unchanged unscoped default; preserve safe GetStarted query/intent consumption and provider policy. No generic provider constant or arbitrary-return changes.
- Entry action and Dismiss use layout lifetime/current scope/callback fences; keep activated lock, host consumeIntent guard and child workspace mount. If view callbacks fenced, preserve genuine current explicit activation and modifier/native browser behavior; no speculative autofocus.
- Plan/tests-first design only while eighth Core gates active; ALL SOURCE/TESTS HELD. Supervisor explicitly releases after gates. After release narrow synthetic source-replacement/malformed/slow/hidden/commit/destination tests plus original onboarding48, actual-config scoped checks then freeze.
- No extra/shared/protected runtime/storage/conversation/context-packet/API/backend/styles/provider-policy paths, actual keys/pairings/projects, broad/live/browser/provider/panel operations, commits or shared docs.

## Design / progress

Planning complete; all Core product/test source remains held pending explicit supervisor release. Read parent Current State, the frozen Studio audit, all eight proposed paths (the new hook test does not exist yet), and direct existing types/model/LiveView forwarding needed to confirm compatibility. No checks or source changes during planning.

### Source ownership and lifetime

Implement privately inside useOnboardingReadings.ts; keep its public return and OnboardingSources unchanged. A source-identity owner token changes during render when sources changes, and published readings carry that token. Return LOADING whenever published ownership differs, including the first replacement commit. A layout lifetime fence and monotonically increasing read generation prevent old owners, replaced requests and unmount-commit callbacks from publishing. Owner replacement starts a fresh check through the normal effect; no remount of the surrounding onboarding/Studio workspace. This is presentation invalidation, not cancellation of the underlying HTTP request or an authorization boundary.

refresh is captured against its source owner and checks current owner/lifetime before starting a check. One owner has at most one pending two-source cycle. Repeated current manual activations while pending coalesce without resetting generation, restarting requests or queuing a surprise follow-up. Manual refresh after completion starts one new cycle even if the checklist was complete or pollMs is zero. Each cycle marks its current readings checking; gateway and key results publish independently as they settle. A slow key check must not delay a confirmed runtime result. No old confirmed ready state may be presented as newly checked data after an owner change.

Schedule one timeout only after both reads of the current cycle have settled and the latest isComplete predicate says unfinished. Read current options through a ref so the inline predicate in OnboardingView does not restart reads. Changing pollMs updates the next schedule, not the source owner. pollMs zero disables automatic rereads but preserves the initial check and explicit Check again. Completion removes automatic scheduling; do not turn this checklist into continuous monitoring. While document.visibilityState is hidden, clear/avoid automatic timers; current pending results can settle safely. A return to visible triggers one unfinished current-owner check if idle, coalesces if pending, and does nothing automatically once complete or pollMs zero. Explicit manual activation stays available. Listen/clean up only in the effect; tolerate missing document in non-browser tests. No interval, invented timeout, AbortSignal/source contract, backend or dedup policy changes.

### Consumed response validation and feedback policy

Call each injected source inside its own async try block so synchronous throws and rejected promises become a fixed local failed reading: gateway `The FluxIQ runtime could not be reached.`; keys `Your API keys could not be read.` Never append an exception object/message. Preserve a genuine endpoint `{ ok: false, error: nonempty string }` as meaningful refusal copy, including the existing connect ECONNREFUSED test. A malformed envelope/success becomes a fixed unavailable/invalid-response failure; do not convert it to absent, disconnected or ready. Envelope requires boolean ok; success requires an object payload. Do not log payloads.

Gateway validation is deliberately limited to consumed fields. Missing optional summary fields retain existing fallback behavior, so current route fixtures with sessions/webRuntime but no enabled/trustedClients/auditLog/pairings remain supported. If present, webRuntime must be an object; clientGatewayListening must be boolean and clientGatewayError string. Present sessions/pairings must be arrays of non-null objects, not strings or null. Session identifiers, when present, must be strings; do not inspect unrelated capabilities/metadata. Pairing consumedAt/expiresAt, when present, accept finite numbers and finite nonblank numeric strings consistent with ClientPairing and Number(expiresAt) in the model. Do not inspect pairingCode, referenceCode or tokens. Preserve absent pairings, genuinely empty arrays and expired/consumed pairing semantics. Ignore unconsumed full snapshot fields rather than impose an unrelated full API validator.

Key success must contain an actual keys array; missing/null keys is unknown, never empty. Members must be non-null summary objects with correctly typed fields consumed by availability: name/kind/scope strings, enabled boolean, provider and scopeRef strings when present, respecting the existing summary optionality. Do not restrict other legitimate provider/kind/scope strings merely because only DeepSeek LLM/global counts as ready. Fields not consumed by this checklist are not validated or copied into feedback. No key values are inspected or rendered. Keep enabled global DeepSeek readiness, disabled/other-scope unusable copy, no-key empty copy and unchanged provider/adaptation policy.

### Navigation and retained callbacks

Add an explicit optional secretKeysHref to OnboardingViewProps, retaining action.href as the unscoped default. Existing OnboardingLiveView already forwards Omit<OnboardingViewProps, sources>; no edit is needed there. GetStartedClient computes the fixed `/programs/secret-keys` path plus only current domainId encoded using URLSearchParams. No return/project/arbitrary destination parameters, generic provider constant change or host edit. Existing Studio start routes retain start/domain exactly.

Use layout lifetime plus render/scope fences for explicit view callbacks and the route's retained router callback. Old onStart, Connected browsers and refresh closures must not invoke a replacement source/callback owner or navigate after unmount. The route fence follows router identity and the current query signature; current callback invocation uses the authorized fixed route. For a retained setup-link callback, prevent an obsolete event only; leave genuine current anchors and modifier/native browser navigation untouched. Do not replace anchors with router buttons, blanket preventDefault, add autofocus or alter current start option behavior. A view render-token fence can invalidate old callbacks without remounting children or triggering new source reads.

StudioStartJourney changes its mounted fence from passive to layout setup/cleanup. Include callback identity in the retained action/Dismiss eligibility fence if necessary so same-scope callback replacement cannot consume obsolete intent; keep existing scope/activated lock, current host consumeIntent boolean guard and explicit project-readiness checks. Avoid treating cosmetic unrelated child renders as new intent activation. Preserve the banner's child workspace mount/draft state and all existing URL/scope tests.

### Tests-first sequence after release

1. Add only the new owning hook test and regression cases in the existing three owning test files, keeping original assertions. First reproduce a small independent set against the held original source after release: first-commit owner-ready leak, malformed successful keys/gateway, independently delayed results, lost domain href, and retained action/Dismiss during unmount layout commit. Persist exact native result/failure reasons; distinguish harness failure from product reproduction.
2. Hook deferred tests use stable Harness/Profiler identity throughout mount/update so a probe does not accidentally remount the hook. Cover A-ready to B-pending first commit; A/B/A owners; old settle after replacement/unmount; captured old refresh; initial sync throw/rejection/fixed feedback; typed endpoint refusal; valid empty/legacy partial summaries; null members and malformed consumed fields; no key/token values in output. Resolve gateway and keys independently and verify current-source output only.
3. Fake timer/visibility tests cover pending manual coalescing, latency greater than pollMs without discarded current results, completion-based next check, no timer while pending, hidden pause/visible unfinished resume, resume coalescing, completion stop, pollMs zero initial/manual only, option changes, and timer/listener cleanup. Test both incomplete failure recovery and all-ready stopping. Do not claim live-network or browser certification.
4. Existing OnboardingView tests retain five current cases/copy/explicit controls; add current versus retained replacement/unmount handlers and default/overridden href. Preserve genuine native modified click semantics using event doubles only where a guard is installed. GetStartedClient adds domain `%2F`/spaces/unscoped href and exclusion of return/project parameters, route replacement/unmount callback tests, and unchanged three start URLs/live stub reads.
5. Existing entry test adds both action and Dismiss callbacks invoked by a persistent parent's layout probe after child deletion, plus same-scope callback replacement. Preserve all existing describe/demonstrate/extract, catalog/restoring, project-choice, consume refusal, duplicate, scope change, and child draft/mount assertions. Do not use a probe newly introduced only at update, which would remount and hide the defect.
6. After changes run only the affected hook/view/entry/route suites plus existing onboarding-steps/navigation/entry-intent owning suites constituting the original verified onboarding48. All heavy commands use the supervisor-required heavy.sh wrapper and a unique codex label. Run real-config scoped types for the eight exact roots; inspect owning, global and dependency diagnostics. Run git diff --check on exact paths. Persist final counts/native exits/duration, then freeze all source for independent supervisor review. No broad gates in this worker.

### Exact released partition (still held)

- apps/web/src/features/automation-studio/onboarding/useOnboardingReadings.ts
- apps/web/src/features/automation-studio/onboarding/tests/useOnboardingReadings.test.tsx (new)
- apps/web/src/features/automation-studio/onboarding/OnboardingView.tsx
- apps/web/src/features/automation-studio/onboarding/tests/OnboardingView.test.tsx
- apps/web/src/features/automation-studio/onboarding/entry/StudioStartJourney.tsx
- apps/web/src/features/automation-studio/onboarding/entry/tests/StudioStartJourney.test.tsx
- apps/web/src/app/get-started/GetStartedClient.tsx
- apps/web/src/app/get-started/tests/GetStartedClient.test.tsx

No source/types/helper/LiveView/host/coordinator expansion is needed by this plan. If implementation exposes a genuine requirement beyond these paths, stop that dependent edit and report exact evidence for supervisor scoping rather than broadening ownership.

## Validation ledger

- 2026-10-01 planning: read Current State and frozen Studio audit; inspected exact current source/tests and direct consumed types/provider availability/LiveView forwarding. Parent eighth broad gates active; all Core source/tests held. No product/test edit, heavy command, live/private operation, shared-doc edit or commit. Design above is source-confirmed planning, not verified implementation. Await explicit source release.

## Implementation result / final freeze

Implemented exactly the eight listed paths: four existing product files, three existing owning test files and the new owning hook test. All original assertions remain, including real Session guided entry integration, unchanged restoration input and draft mount continuity. No types/source adapter/LiveView/provider policy/helper module/host/coordinator/backend/shared document changes.

The hook now render-masks source replacements, fences layout lifetime and old owner completions/manual handlers, settles gateway and key progress independently, and coalesces pending probes. Automatic unfinished checks schedule after both current reads settle, pause when hidden and resume once when visible; explicit refresh remains available after completion and with pollMs zero. Underlying network requests are not cancelled and no new transport timeout/dedup contract is claimed.

Malformed successes remain unknown failures; missing keys no longer mean an empty catalog. Source exceptions receive fixed messages; actual endpoint refusal strings remain meaningful. Gateway optional unconsumed fields stay compatible with partial fixtures. Final validator refinement requires a string sessionId on each present session object (the actual session contract requires it), preventing an empty object from falsely counting as a connected browser. Existing pairing timestamp numbers/numeric strings remain valid, without reading codes/tokens. Key summary typing retains other provider/kind/scope values and never reads key values.

Domain-aware Secret Keys navigation uses only the fixed internal path and encoded current domain. Native current link clicks/modifiers remain untouched; obsolete captured link events are prevented. Retained start/Connected browsers/refresh/route handlers cannot invoke replacement owners or act in unmount layout commits. Entry action/Dismiss now uses layout lifetime and rejects replaced same-scope command callbacks; the activated lock, host consumeIntent guard and child mounts remain unchanged.

Final observed worker validation (claims pending supervisor verification):

- Tests-first original source reproduction: five new hook tests, five failures, native1, vitest907ms (no harness failure).
- Initial narrow four suites:30tests/native0/9.45s (88991).
- Expanded six suites:76tests/native0/9.89s (63990).
- First eight-suite original/recovery run:91tests/native0/14.00s (14091).
- First scoped real-config type check: native1, eight owning diagnostics and zero dependency diagnostics; exact-optional JSX props and test act callback returns corrected without assertion changes.
- FINAL eight suites:91tests/native0/12.06s (82426): hook32, View7, entry17, route11, steps9, page2, actual Session entry7, pure navigation6.
- FINAL real web-config scoped types (22558): native0; eight source/test roots plus next-env; zero owning/global and zero dependency diagnostics. Temporary checker: C:/Users/osrs_/AppData/Local/Temp/codex-t224-onboarding-scoped-types.mjs. No tracked config/baseline changes.
- Exact-path git diff --check: native0. Seven modified tracked paths and one new hook test confirmed; all eight source/tests frozen now.

All tests/type commands used C:/Program Files/Git/bin/bash.exe with C:/Users/osrs_/FluxStuff/build-slots/heavy.sh and unique codex labels. No broad gates, browser/panel/provider/actual private state, shared docs, commits or push. Synthetic renderer/source/timer/visibility tests do not certify live browser behavior. Supervisor owns independent verification and integration.

- Implementation release received after supervisor eighth 333files/2342tests/types/build passed. Tests-first five hook regressions reproduced five original failures (native1; vitest907ms): first-commit owner leak, independent progress delay, missing keys false absence, appended exception detail, duplicate manual pending reads. Initial exact source implementation now underway; focused original owning suites running. No extra source paths or broad checks.

- Expanded original/recovery/navigation checks passed8files91tests/native0/14.00s (14091). First scoped types found8 owning diagnostics/0 dependency diagnostics: two exact optional prop issues and six act timer callback return types; corrected conditional prop omission/private required union and awaited void timer callbacks without changing any test assertion. Corrected scoped types running. Added validation for raw array key success and sessions missing an identifier; optional unrelated gateway fields remain supported. No source/test mutation while checks read those files.
