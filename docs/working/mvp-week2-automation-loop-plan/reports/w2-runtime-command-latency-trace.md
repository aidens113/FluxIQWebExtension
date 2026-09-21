# W2 runtime command latency trace

## Result

Status: **material live improvement retained in the isolated source; ready for
supervisor integration**.

The repeated fixed delay is owned by the extension action runner's
`waitForTabReady`: it consumed 1,001–1,005 ms on every user action while the
content script itself needed only 3–7 ms. A successful
`web.dom.capture_snapshot` immediately before an action already proves that the
same document is complete and reachable. Reusing that proof once reduced the
clean production-panel runtime from the established warm 14,774 ms boundary to
**8,165 ms** (-6,609 ms, **44.7%**), with the four actions and submitted-page
oracle still passing.

No trace-only field remains. Core was restored byte-clean. The retained
downstream change is three files and has not been committed or pushed.

## Isolation and live boundary

- Downstream: `F:\fxlab\t027-runtime-trace\!FluxIQWebExtension`, detached at
  `b0563869c4fe9aafa9d975ab638b6f555c9aa608` before the candidate.
- Core: `F:\fxlab\t027-runtime-trace\!FluxIQ`, detached at
  `949735d22839574a0437de0457802fb6216472a0`; clean after trace removal.
- Saved data copy: `F:\fxlab-runs\t027-runtime-trace\workspace`.
- Valid candidate profile/data copy:
  `F:\fxlab-runs\t027-runtime-trace\workspace-candidate`.
- Clean confirmation profile/data copy:
  `F:\fxlab-runs\t027-runtime-trace\workspace-final`.
- Browser: headless Playwright Chromium loading the production unpacked Chrome
  extension.
- Owned panel/gateway: loopback ports 34127/49127. Both are closed. Port 3000,
  the user's profile, and source `.fluxiq` data were untouched.

## Exact owner trace

Trace run:

- runtime run `a2723ce7-1e6e-4af8-aef2-1a071b805fb5`;
- evidence `demo-playback-2026-09-21T01-33-49-584Z-3487d3`;
- verdict passed, 4/4 actions, and oracle passed.

All values below are milliseconds. The variable pre/post columns are the
correctness-bearing action-boundary evidence and active-page refresh around the
command; the content column is execution inside the page.

| Action | Command total | Core → extension | Pre-action boundary | Readiness wait | Content | Post-action boundary | Return transport |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `web.dom.type` | 1,148 | 1 | 67 | **1,005** | 4 | 67 | 1 |
| `web.dom.select` | 1,943 | 1 | 637 | **1,001** | 3 | 298 | 1 |
| `web.dom.type` | 1,999 | 1 | 814 | **1,003** | 7 | 174 | 0 |
| `web.dom.click` | 2,677 | 1 | 720 | **1,005** | 5 | 943 | 0 |

The fixed cadence is therefore not Core dispatch, WebSocket transport, the DOM
verb, or result settlement. It is the unconditional one-second URL-stability
poll in `runBrowserActionCommand`. The variable remaining cost belongs to the
before/after evidence captures and was left intact.

## Candidate and safety boundary

The retained candidate changes only readiness reuse:

- a succeeded `web.dom.capture_snapshot` stores a one-shot proof containing the
  tab id, URL, Chrome document UUID, and capture time;
- the next document action consumes and deletes that proof;
- it skips the ordinary readiness poll only when the tab is still complete,
  the URL is identical, the document UUID is identical, and the proof is under
  ten seconds old;
- an absent, expired, mismatched, unavailable, or malformed proof falls back to
  the existing `waitForTabReady` behavior;
- explicit navigation and forgotten tabs clear the proof; session storage lets
  the immediate proof survive an MV3 worker lifetime, but never a replacement
  document;
- snapshot capture, before/after host-state capture, diffing, action ordering,
  post-navigation settling, and the assert retry remain unchanged.

This is intentionally not a general “tab was once ready” cache. The skipped
wait follows a read-only snapshot that itself completed after the normal
settling check and cannot initiate navigation.

## Live A/B

The valid instrumented candidate used a fresh browser profile so Chromium had
to activate the rebuilt unpacked extension:

- runtime run `88d22f05-8030-415b-b72c-c2b1a45aabac`;
- evidence `demo-playback-2026-09-21T01-45-36-732Z-285bc5`;
- runtime step **7,643 ms**;
- user command attempts 148 / 140 / 150 / 475 ms;
- readiness segments 0 / 0 / 1 / 0 ms;
- 4/4 actions and submitted-page oracle passed.

Two earlier candidate passes were invalid performance measurements: the copied
extension bundle contained the candidate, but the reused persistent Chromium
profile kept its previously registered MV3 worker active. Their returned trace
did not contain a field present in the copied bundle, proving the candidate had
not loaded. They passed correctness but are excluded from the A/B conclusion.

After removing all trace instrumentation and tightening the proof to Chrome's
document UUID, the clean confirmation passed:

- runtime run `6ab52bfd-d98b-464b-8738-e6c13e31653f`;
- evidence `demo-playback-2026-09-21T01-50-53-229Z-88091a`;
- runtime step **8,165 ms** versus established warm 14,774 ms;
- evidence verdict passed, 102 events, 86 screenshots;
- action evidence durations 85 / 95 / 82 / 386 ms;
- durable run summary succeeded with 4 action attempts, one route, one subflow,
  zero interventions, zero adaptations, and zero change proposals;
- submitted-page oracle passed.

## Focused validation after live improvement

Only after the live reduction was established:

- production extension build passed;
- focused `automation-tab.test.ts` and `action-runner.test.ts`: **34/34 passed**;
- new focused cases prove that a snapshot proof is one-shot and that a same-URL
  replacement document cannot reuse it;
- `git diff --check` passed;
- no full suite ran.

Retained files in the isolated downstream source:

- `apps/extension/src/runtime/automation-tab.ts`;
- `apps/extension/src/runtime/action-runner.ts`;
- `apps/extension/src/runtime/tests/automation-tab.test.ts`.

## Reusable node-capability check

This lane exposed **no missing reusable Flow node**. The existing
`web.dom.capture_snapshot` node already provides the needed observation and is
correctly reusable before actions. The missing seam was runtime-level reuse of
its readiness evidence, which belongs in the extension runtime rather than in a
new node.

One test-facility follow-up is concrete: A/B lanes that rebuild an unpacked MV3
extension need a fresh profile or an explicit extension-reload/build-identity
check. Without it, a live pass can silently execute the prior service worker
and produce a false performance conclusion.
