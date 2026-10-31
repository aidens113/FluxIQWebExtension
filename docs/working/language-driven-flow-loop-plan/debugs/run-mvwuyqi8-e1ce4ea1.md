# Debug: run-mvwuyqi8-e1ce4ea1

Status: Repair t835 passed owning checks and actual provider-free production startup; integration pending, no retry yet.
Run: company-website/company-website-gas-engineers, workflow gas-engineers, Claude lane slot1, 2026-10-31.
Pinned source: Core55ebfc148d2accd5b5c8c6e52c7bda72ce4eb3d0 / Down9045ca0dcc58189d70ee450c647525bf32340097.
Provider configured: anthropic / claude-sonnet-5-5 / CLAUDE_API_KEY, whole build allowance $5.

## Outcome and distance

The repaired provider-free preflight passed with zero calls. The live invocation then passed its prelude and built Core's production web app, including compilation and type validity. Startup failed before extension chat, browser task execution or model authoring: Core health never became ready within 60 seconds. Total run225.582s; Flow not created, oracle/report verdict absent, provider calls0, no billed model result. This is not a Claude performance or authentication result.

## Cause and evidence

Preserved core.log reports MODULE_NOT_FOUND, “Cannot find module as expression is too dynamic,” in production SSR chunk Users_osrs__FluxStuff_fxlab_t833-claude_!FluxIQ_c8e79ef4._.js at1:6821, reached at1:6781/7905. Core web-build log exits0. The final evaluation identifies process.startup / readiness.timeout / core.health. Lead did not raise readiness timeouts, bypass the loader, reset a fixture, alter the oracle or relaunch unchanged source.

## Repair and acceptance

t835 traces the exact generated stack to the native ESM loading seam and fixes production bundling while retaining public export and host-registration semantics. Required before another live attempt: owning regression tests, touched web types/audits, actual isolated production startup provider-free, paired integration/publication and repin. Keep the eight-row task/oracle and $5 allowance unchanged. No guard overrides.

Artifacts remain ignored in the pinned Lab run bundle and central lab-runs/2026-10-31/run-mvwuyqi8-e1ce4ea1. No credentials, profiles or recorded page data are copied here.

Validation: t835 lead11loader/11cache tests, fresh SDK117.462s/types99.507s and both plain structure audits passed. Actual isolated production startup via compiled Lab coordinator PASS185.844s: page200, gateway401, runtime initialized, providersdisabled; test processes closed. No paid retry before source integration/repin.
