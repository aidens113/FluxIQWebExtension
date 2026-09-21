# W2 stable-tab latency live report

## Result

Status: **no material live improvement; candidate reverted**.

The exact saved production-panel Flow passed under both event-invalidated
readiness-cache candidates, but neither changed the warm runtime boundary. The
stronger candidate persisted readiness across MV3 worker lifetimes and still
measured 14,820 ms, 46 ms slower than the established comparable 14,774 ms
baseline. The repeated one-second cadence therefore is not removable by
remembering that the tab is already complete.

Both candidates were removed from the isolated source. No product change,
focused test, broad suite, commit, or push resulted from this lane.

## Isolation

- Downstream: `F:\fxlab\t027-stable-tab\!FluxIQWebExtension` at
  `d7ec1a19ce1bf61197644e25f1e6a14655d6fb7b`.
- Core: `F:\fxlab\t027-stable-tab\!FluxIQ` at
  `949735d22839574a0437de0457802fb6216472a0`.
- Disposable workspace/profile:
  `F:\fxlab-runs\t027-stable-tab\workspace`.
- Browser: headless Playwright Chromium with the production unpacked Chrome
  extension.
- Owned panel/gateway: loopback ports 34127/49127, stopped after every run.

The durable store was copied from the already-proven isolated deterministic
demo. The source workspace and the user's panel, profile, ports, and `.fluxiq`
data were not mutated. Project, Flow, graph, and Router identities stayed
unchanged across the A/B runs.

## Live baseline

Evidence:
`demo-playback-2026-09-21T01-13-59-517Z-8f3f0b`.

- Real panel runtime step: **15,125 ms**.
- Evidence verdict: passed.
- Durable actions: 4/4 succeeded.
- Submitted-page oracle: passed.
- Persisted run summaries: zero interventions, adaptations, adaptation IDs,
  and change-proposal IDs; no provider lane was entered.

This fresh-profile measurement was 351 ms slower than the established warm
14,774 ms baseline. The established run is the fair comparison for a warm
candidate: it also had 99 evidence events and 84 screenshots.

## Candidate A: process-memory readiness

The first candidate remembered a settled tab's URL and invalidated it on
`tabs.onUpdated` loading or URL events, tab removal, explicit navigation, and
same-URL reload. It retained the original one-second settling wait after each
invalidation.

Evidence:
`demo-playback-2026-09-21T01-16-30-033Z-69cf04`.

- Real panel runtime step: **14,847 ms**.
- Difference from the same-workspace fresh baseline: -278 ms (1.8%).
- Difference from the comparable established warm baseline: +73 ms.
- Correctness: 4/4 actions, submitted-page oracle, and zero LLM/adaptation
  activity all passed.

The noise-level result showed that a process-memory cache was not surviving at
the boundary that owned the cadence, so it was not a viable product change.

## Candidate B: session-scoped, event-invalidated readiness

The second candidate kept the same navigation safety and added a
`chrome.storage.session` readiness marker. The `tabs.onUpdated` listener was
registered synchronously when the MV3 worker loaded so navigation could wake
the worker and invalidate the marker between commands. A locally observed
invalidation always overrode a pending storage removal, and explicit
navigation invalidated before `tabs.update` or same-URL `tabs.reload`.

Evidence:
`demo-playback-2026-09-21T01-18-51-601Z-1d7065`.

- Real panel runtime step: **14,820 ms**.
- Difference from the same-workspace fresh baseline: -305 ms (2.0%).
- Difference from the comparable established warm baseline: **+46 ms**.
- Evidence: 99 events, 84 screenshots, verdict passed.
- Correctness: same durable identities, 4/4 successful actions, submitted-page
  oracle passed, zero interventions/adaptations/proposals, and no provider lane.

Persisting readiness across worker lifetimes therefore made no material
difference either. The 14.8-second boundary matches the earlier decomposition:
the recurring time belongs to correctness-bearing before/after host-state
capture and action execution, not a stable-tab poll that can be skipped.

## Decision and validation boundary

The definition of done required a material runtime reduction without weakening
navigation safeguards. That condition was not met, so the entire isolated
`automation-tab.ts` candidate was reverted with no test added. The downstream
and Core isolated worktrees are clean, and both owned ports are closed.

The prerequisite Core production build and downstream Scenario Lab,
production extension, domain, evidence, and test-runner builds passed. They
prepared the live A/B and are not presented as unit-test proof. Per the
live-first brief, no focused unit test or full suite ran after the live result
showed there was no change worth retaining.
