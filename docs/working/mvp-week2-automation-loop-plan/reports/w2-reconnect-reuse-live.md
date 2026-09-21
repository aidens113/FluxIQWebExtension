# W2 reconnect and saved-Flow reuse live report

## Result

Status: **passed with no reconnect-driver repair required**.

The production unpacked extension connected to an owned Core/gateway, the
entire owned runtime then stopped, and explicit TCP probes confirmed both the
panel and gateway listeners were gone. A separate owned runtime lifetime
freshly authenticated the panel, restored the extension connection from the
preserved disposable profile, found the same saved project/Flow/graph, and ran
that Flow to a passing submitted-page oracle with 4/4 successful actions and
zero LLM activity.

## Isolation

- Downstream: `F:\fxlab\t027-reconnect\!FluxIQWebExtension` at
  `d0cca939ce0f0dfa1ed93c37ee616e7a51fb504f`.
- Core: `F:\fxlab\t027-reconnect\!FluxIQ` at
  `949735d22839574a0437de0457802fb6216472a0`.
- Disposable workspace/profile:
  `F:\fxlab-runs\t027-reconnect\workspace`.
- Browser: headless Playwright Chromium with the production unpacked Chrome
  extension.
- Owned panel/gateway: loopback ports 34127/49127.

The workspace was copied from the already-proven isolated deterministic demo.
The source workspace and the user's panel, profile, and `.fluxiq` data were not
mutated. No provider, recording-generation, batch, repair, or regeneration
lane was entered.

## Preserved identities

| Object | Durable identity |
| --- | --- |
| Project | `a60071d7-b6c2-4815-a938-eaa49087084d` |
| Flow | `flow.1f033294-788d-4ce6-a722-2fd82332f89e` |
| Graph Flow | `flow.1f033294-788d-4ce6-a722-2fd82332f89e.subflow.dbe246cd-43b8-4ae4-bcc8-d47e0ea3db08.graph` |

Those exact identities were asserted before the stop and returned unchanged
from the playback after restart.

## Live restart sequence

### Lifetime 1: connect, then stop

Evidence:
`reconnect-before-stop-2026-09-21T01-04-43-261Z-9d972f`.

1. Core web and its gateway started against the disposable persistent store.
2. A fresh authenticated control session and production panel opened.
3. The exact saved Flow opened through the real Automation Studio hierarchy.
4. The unpacked extension connected and Core's gateway snapshot contained its
   live session.
5. The browser and complete owned Core/gateway process tree closed while no run
   was active.
6. Direct TCP probes confirmed both port 34127 and port 49127 were closed.

The evidence verdict was passed: 56 events, 42 screenshots, 0 duplicate
screenshots, and 10,550 ms evidence duration. Including owned build/startup,
authentication, connection, shutdown, and port probes, the phase took
67,019 ms.

### Lifetime 2: restart, reconnect, and reuse

Evidence:
`demo-playback-2026-09-21T01-05-27-078Z-f1c942`.

1. A new owned Core/gateway lifetime started against the same disposable
   persistent store.
2. The panel established a fresh authenticated session; no stale cookie was
   trusted as the current runtime session.
3. Chromium reused the disposable extension profile, and the production
   connection driver restored the gateway/API settings and connected the
   unpacked extension.
4. The panel reopened the exact saved Flow and recording-generated Subflow and
   verified the rendered graph layout.
5. Runtime Debug selected `No LLM intervention` and ran the saved Flow.
6. The real Scenario Lab submitted-page oracle passed.
7. The second owned runtime stopped, and both panel and gateway ports again
   probed closed.

The playback evidence verdict was passed: 99 events, 84 screenshots, 0
duplicate screenshots, and 24,977 ms evidence duration. The full restarted
playback invocation, including startup and shutdown, took 33,683 ms.

## Durable restarted run

The restarted playback created exact runtime run
`552ee961-b490-4438-a2a8-dae276f7acd2`.

- Terminal status: `succeeded`.
- Expected graph actions: 4.
- Durable action attempts: 4.
- Successful attempts: 4.
- Submitted-page oracle: passed.
- Provider calls: 0, using the established
  `(detail.providerCallCount ?? 0)` normalization.
- Interventions: 0.
- Adaptation IDs: 0.
- Change-proposal IDs: 0.
- Summary adaptation count: 0.

The zero-provider value was therefore corroborated by all four independent
LLM/adaptation activity collections, not inferred from terminal success.

## Scope and validation boundary

No mismatch occurred in the reconnect or persistence driver, so no downstream
or Core source was changed and no focused unit test was needed. The fresh pair
required build preparation; Core, domain, test contracts/evidence, Scenario
Lab, extension, and test-runner builds completed successfully before the live
proof. No broad suite, commit, or push ran.

Both isolated repositories remained git-clean. The only authored output is
this report in the main t027 working-document tree.
