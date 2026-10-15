# Debug: run-mv93ywox-9b5aa220

- Instance: a8-slot-3, task `social-network-feed-confirm-requests`, authoring mode `project` (A8 wave 5 canary 2,
  2026-10-14, pair downstream `19f1f1b2` / Core `f78dcba9`, after t619), lane tree `fxwork/t566`. Steps: 0.
- Verdict: failed (`process.startup`, stage `scenario.execute`), no Flow, $0: the run never reached the chat.
- What happened: after a 148 s prelude, the Lab's `gateway-server-build` step
  (`packages/test-runner/src/core-web-build/server-adapter.ts`, `prepare`) ran Core's
  `apps/web/scripts/build-client-gateway-server.mjs` under a fixed 60 000 ms limit; the process supervisor stopped it
  at the limit, esbuild reported "The service was stopped", and the run ended "gateway-server-build timed out".
- Cause (Lab defect): the native gateway server is regenerated before every run ("native generation precedes
  cache-key collection"), even when its identity receipt already matches its sources, and a build step is failed on a
  fixed wall-clock limit. The machine was carrying a worker's deliberate loaded test runs (t616), which made the build
  slower than 60 s; a wave starting four Labs at once carries the same risk. Not a product defect.
- Fix: downstream t620 reuses a gateway artifact whose receipt matches its sources and bounds the build by something
  other than a fixed 60 s.
- Next: relaunch the canary after t620 merges.
