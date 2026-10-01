# Studio navigation audit

Status: Complete; source-only audit frozen for supervisor review
Owner: runtime_contracts worker
Date: 2026-10-01

## Written brief

- Identity source/tests stay frozen for supervisor review. Read only Core automation-studio/onboarding/entry/StudioStartJourney.tsx, onboarding/OnboardingView.tsx, onboarding/OnboardingLiveView.tsx, onboarding/onboarding-steps.ts, navigation.ts and their directly owning tests/frontend navigation consumers needed to establish destinations.
- Read parent Current State. Existing onboarding48 and authoring/navigation/question/recovery changes are verified; preserve them. Inspect explicit entry/navigation versus passive refresh, destination correctness and actionable retry, current-owner/captured async callbacks, keyboard/focus ownership and draft continuity.
- Record source-confirmed defects with exact paths/lines and proposed bounded tests/implementation partitions; distinguish visual/browser hypotheses and avoid duplicating existing fixed evidence. Do not broaden into Studio coordinator or protected runtime/conversations/context-packet/storage.
- Write progressively here; no product/test/shared-doc edits, broad checks, actual project/private data, browser/provider/panel operations, commits or pushes. Return prioritized findings or honest no additional defect after source audit.

## Findings

Initial source inspection complete. The existing guided journey preserves child drafts, requires explicit actions and validates URL consumption; do not rework those fixed protections. New confirmed concerns are onboarding source-owner stale readiness, malformed success being interpreted as absence/crashing, and the Secret Keys setup link dropping domain scope. StudioStartJourney still clears its mounted flag only in passive cleanup, leaving a retained-handler unmount-commit window. Source-only findings require bounded reproduction; no browser tests or product edits were made.


Audit paused briefly for supervisor-requested Identity subject-description correction (separate exact source/test ownership); Identity correction completed and re-frozen at61focused tests/types pass. Resumed this read-only audit. Existing onboarding/entry source remains unchanged.


## Source-confirmed findings and priority

### N1 ? Onboarding shows a prior source owner's readiness while checking the new owner (P2)

onboarding/useOnboardingReadings.ts:15?17 initializes one state record with LOADING, but sources replacement only changes the effect dependency at:28. It neither masks nor tags readings by sources identity during render. OnboardingLiveView:8 obtains useOnboardingSources, whose memo changes with live gateway/Secret Keys API identity (useOnboardingSources.ts:16?20). Thus replacing domain/API-backed sources after all steps were done leaves old ready/checklist data visible until both new reads complete. If one new read is slow, the prior context can display FluxIQ is ready throughout that delay. Passive cancelled guard prevents an old effect from writing after cleanup but does not prevent the first stale render or the unmount-commit window before cleanup.

Regression: old sources return listening/paired/usable DeepSeek key; rerender with new sources whose requests are deferred and inspect first commit. New owner must show checking/current/blocked rather than old ready. Resolve old or new requests in adverse order and prove old source never publishes current state. This is frontend readiness/presentation, not execution authorization or a backend bypass.

### N2 ? Malformed successful readings can crash or masquerade as absence (P2)

useOnboardingReadings.ts:21 converts any successful keys result to payload?.keys ?? []; an ok success missing its real SecretKeysSnapshot keys becomes an asserted empty list, even though the owning Secret Keys snapshot contract requires keys (frontend exported contracts only, secret-keys/types.ts:74?76). OnboardingSources deliberately has a weak optional adapter type; strengthen/validate minimal consumed payload semantics locally without demanding unrelated full gateway fields absent from existing fixtures.

settle:46?48 accepts any defined payload, including null/nonobjects. onboarding-steps.ts:41?47 then accesses gateway.value.webRuntime, pairingCheck:58?64 reads sessions.length and pairings.some, and deepSeekKeyAvailability reads key.kind/filter. A null gateway/key member throws; a string sessions value can be counted as connected extensions; a missing keys success is shown as no key rather than an unknown check. Valid empty arrays remain genuinely empty and must retain existing copy/step behavior. Validate only summary fields consumed by this checklist; never inspect/render actual key or pairing token values.

Also, calling source methods occurs before settle's try block, so a synchronously throwing injected source does not become local failed reading. The live Program API normally normalizes transport failures; this is defensive source-boundary recovery, not a claim that ordinary fetch errors are unhandled. Catch raw injected errors into fixed actionable messages rather than appending arbitrary exception strings if that policy is released; existing explicit endpoint error copy must be considered before changing old tests that intentionally show connection refused.

### N3 ? Onboarding Secret Keys link drops the active domain context (P2)

onboarding-steps.ts:9 KEY_ACTION uses AI_PROVIDER_SECRET_KEYS_HREF, which is fixed /programs/secret-keys (settings/ai-provider-model.ts:30). StepAction at OnboardingView.tsx:71 uses that href directly, and the component receives no domain-aware override. Meanwhile GetStartedClient.tsx:14?18 preserves the current encoded domainId when starting Studio, and useOnboardingSources live API reads follow domain-scoped Program API ownership. Choosing Open Secret Keys therefore discards the current domainId even when the checklist was loaded under it.

Source-confirmed consequence is navigation context loss; actual backend credential store, authorization or key resolution consequences were not inspected. Proposed local override should carry only the current encoded domainId on the fixed internal path, never arbitrary return/destination query values. Keep unscoped default href and existing tests. Regression uses /get-started?domainId=web%2Fteam&return=external and asserts fixed /programs/secret-keys?domainId=web%2Fteam with no external return/project data. Guided onStart already preserves the correct start/domain pair and must remain unchanged.

### N4 ? Entry banner retains action lifetime through unmount commit (P2)

entry/StudioStartJourney.tsx:23 sets/clears mounted only in useEffect. consume at:24?36 checks mounted/scope/activated/current intent, correctly prevents duplicate activation, validates project-ready state, and uses the current host consumption guard. However, parent/sibling layout callback during unmount commit can call a previously retained action before passive cleanup sets mounted false. Existing entry test tests only after act has flushed full unmount; it does not cover that commit window.

A bounded two-file correction is layout lifetime cleanup plus an owning commit-probe regression for both action and Dismiss. Preserve scope generation, activated lock, host consumeIntent boolean guard and child mount/draft continuity. Direct domainId-only change is not independently keyed here, but the supplied host entryKey includes pathname plus full query signature, so no actual domain-only stale-entry defect is claimed from this audit. The relevant host lines appeared in targeted symbol search only; protected Studio coordinator content was not read.

### N5 ? Fixed-interval probes can overlap; partial progress waits for both reads (P3)

useOnboardingReadings.ts:35?40 calls refresh every5seconds while unfinished; each tick replaces the read effect and marks prior results cancelled. There is no hook-level in-flight coalescing, completion-based schedule or hidden-document pause. For injected independent sources whose latency always exceeds pollMs, all previous-cycle completions can be discarded indefinitely. The live gateway/Secret Keys calls both use Program API safe GETs, whose existing request policy deduplicates; that mitigates the simple live-network starvation case, so this report does not claim inevitable production starvation or repeated independent HTTP requests for every tick.

Promise.all at:20 holds both step readings until both settle: a responsive runtime check remains displayed as checking while a slower key source is pending. This is source-confirmed delayed independent feedback, with actual runtime latency unmeasured. A future hook-only unit can coalesce manual/timer activations while pending, schedule next unfinished check after completion, pause in hidden documents and publish independently settled current-owner steps. Preserve the specified stop-on-complete and pollMs0 one-read contracts; this checklist is not an ongoing connection dashboard. No invented server timeout or transport policy edits.

## Navigation and focus assessment

navigation.ts correctly drops flow/subflow/view/detail descendants without the required parent, canonicalizes known aliases, restricts detail kinds and retains ids after the first colon. Existing navigation.test.ts covers those boundaries and deterministic breadcrumbs/default views. No additional confirmed pure-navigation defect was found in these allowed paths. Do not alter a protected coordinator just to add speculative checks.

Guided entry performs no passive action; it retains the child workspace mount/draft while the banner appears/disappears and uses explicit Create automation/Open Connected browsers/Dismiss, all covered by existing entry tests. GetStartedClient tests already cover the current encoded domain, three start options and exclusion of arbitrary external return/project query values. None of those completed fixes should be repeated.

No explicit focus handoff appears in StudioStartJourney after consuming the focused banner button, but the actual create dialog/Connected browsers destination can establish its own focus through host behavior. Without host navigation inspection or a live browser (not authorized), lost destination focus is a hypothesis, not a proven defect. Local tests could verify callbacks/order and active-visible ownership, but cannot certify browser focus restoration. A focus implementation should follow destination-owned contracts only after supervisor-approved investigation; do not add unconditional autofocus.

OnboardingView's start/Connected browsers callbacks and GetStartedClient's router callback have no retained-owner/mounted guard. An obsolete synthetic handler can invoke old navigation after host replacement/unmount; ordinary rendered current buttons use current props. This is a lower-priority candidate for a combined current-route callback fence and commit-probe test, not evidence of an ordinary visible click navigating incorrectly. No asynchronous navigation is triggered by readiness polling.

## Exact proposed implementation partitions

1. Entry lifetime only: onboarding/entry/StudioStartJourney.tsx and its existing entry/tests/StudioStartJourney.test.tsx. Layout lifetime fence plus commit-probe/duplicate/scope/child-draft tests. Keep no new host/coordinator edit.
2. Reading ownership/recovery: onboarding/useOnboardingReadings.ts plus new owning onboarding/tests/useOnboardingReadings.test.tsx. Optional limited OnboardingView.tsx feedback/callback changes and existing tests/OnboardingView.test.tsx only if explicitly released. Owner-tag/mask readings, caught/validated minimal source responses, current generation/mounted completion fences, meaningful deferred-source recovery. If schedule changes are included, test slow uncoalesced sources, manual overlap, hidden resume, pollMs0 and completion stopping. No backend or source API protocol change is necessary for presentation invalidation; actual HTTP cancellation would require a separate explicit optional signal contract release.
3. Domain-preserving setup link: app/get-started/GetStartedClient.tsx; onboarding/OnboardingView.tsx; corresponding existing tests/GetStartedClient.test.tsx and onboarding/tests/OnboardingView.test.tsx. Add a fixed-path, domain-encoded href override with unscoped default. Do not change provider policy, generic AI_PROVIDER_SECRET_KEYS_HREF or protected coordinator. Partition2 and3 both need OnboardingView when callback/feedback changes are included, so execute serially or release one combined view owner.

## Validation ledger and boundaries

Read parent Current State and exact original brief paths; followed direct onboarding reading/source helpers, allowed GetStartedClient consumer and their tests, direct client query/frontend types and AI-provider availability constant needed to establish source/destination behavior. Existing Program API deduplication policy was consulted narrowly to avoid falsely claiming inevitable live polling starvation; no Studio coordinator, runtime service, storage, conversations or context-packet source was opened. Targeted symbol search showed StudioStartJourney host entryKey/destination callbacks only. Two guessed canonical-view-definition paths did not exist; no broader directory read followed.

No source/test edit or heavy/test/type/build/audit command for this Studio audit, no actual project/key/pairing data, browser/provider/panel operation, protected code/shared-document edit, commit or push. Findings are source claims pending bounded reproduction, with live scheduling/focus/storage consequences expressly unverified. Own audit report is complete and frozen for supervisor review; Identity source remains separately frozen after61tests/types passed.
