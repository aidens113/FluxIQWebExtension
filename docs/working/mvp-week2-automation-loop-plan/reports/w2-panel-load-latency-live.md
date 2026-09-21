# W2 panel load latency live report

## Result

Status: **healthy live; measured no-change result**.

An authenticated warm Automation Studio load reached a selected project's
enabled hierarchy search in 323 ms, then 305 ms in a same-code repeat. The
trace found no fixed wait and no duplicate request on the interactive critical
path large enough to justify weakening or restructuring gateway refresh
correctness. No source change was made.

## Isolated boundary

- Downstream: `F:\fxlab\t027-panel-load\!FluxIQWebExtension` at
  `d0cca939ce0f0dfa1ed93c37ee616e7a51fb504f`.
- Core: `F:\fxlab\t027-panel-load\!FluxIQ` at
  `949735d22839574a0437de0457802fb6216472a0`.
- Run root: `F:\fxlab-runs\t027-panel-load`.
- Browser: headless Playwright Chromium, 1280 x 720.
- Panel/gateway: isolated loopback ports 34227/49227.
- UI path: authenticated panel -> Automation Studio -> project list -> exact
  isolated project -> visible, enabled project-hierarchy search.

The fixture store was copied into the new run root. The source fixture and the
user's panel, profile, and `.fluxiq` data were not mutated or inspected for
content.

## First warm load

Evidence:
`panel-load-baseline-2026-09-21T00-57-39-479Z-d08226`.

- DOM content loaded: 126 ms.
- Project list ready: 197 ms.
- Selected project interactive: **323 ms**.
- `GET /api/programs/automation-studio/projects`: 1 request, 16 ms.
- `GET /api/client-gateway/snapshot`: 2 requests, 24 ms aggregate, 13 ms max.
- `POST /api/client-gateway/automation-studio-context`: 3 completed requests,
  20 ms aggregate, 9 ms max.
- All responses were HTTP 200.

Only method, endpoint path, status, count, and timing were recorded. Query
values, response bodies, identities, cookies, and private project content were
not captured in the report.

## Same-code timing rerun

Evidence:
`panel-load-baseline-repeat-2026-09-21T00-58-35-935Z-d8b516`.

- DOM content loaded: 109 ms.
- Project list ready: 175 ms.
- Selected project interactive: **305 ms**.
- Global pairing snapshot: started at 115 ms, completed in 7 ms.
- Automation Studio context publication: started at 182 ms, completed in
  9 ms.
- Automation Studio gateway snapshot: started at 182 ms, completed in 12 ms.
- Project list: started at 181 ms, completed in 15 ms.
- Selected-project context publication: started at 295 ms, completed in 2 ms.
- All responses were HTTP 200 and the same hierarchy control was enabled.

The first trace counted one additional context response before observation
stopped. This is timing-sensitive publication/cleanup activity, not a stable
blocking request count; the repeat shows the two state-bearing publications
that complete before interactivity.

## Owner diagnosis

The largest repeated endpoint class was the gateway snapshot:

- `GlobalClientGatewayPairing.tsx` polls the global pairing/session snapshot so
  pairing prompts remain available throughout the authenticated application.
- `useGatewayRecordingBridge.ts` reads the same endpoint for Automation Studio
  gateway activity and recording state.

Those calls serve different subscribers. In the timed repeat they completed in
7 ms and 12 ms, and the second call ran concurrently with the 15 ms project
list request. Removing either therefore cannot materially lower the measured
305 ms interactive boundary, while coalescing them would introduce shared
cache/invalidation behavior across independently correct pairing and recording
refresh lifecycles.

The context posts are also state-bearing rather than a fixed delay: the first
publishes the no-project context and the last publishes the selected project.
They are fire-and-forget from the UI and did not gate project interactivity.
No timeout, sleep, retry backoff, serial snapshot/context/project fan-out, or
slow endpoint appeared on the critical path.

## Change and validation boundary

No Core or downstream source was changed because the live evidence did not
support a material user-visible gain. Consequently no focused unit test was
added or run. The prerequisite Core production build and downstream driver
builds completed successfully; those builds prepared the fresh pair and are
not presented as latency proof. No broad suite, commit, or push ran.

Both isolated repositories remained git-clean. The only authored output is
this report in the main t027 working-document tree.
