# Getting Started connection result recovery

Status: Active — focused tests and scoped types passed; full extension gates pending
Owner: Codex supervisor
Date: 2026-10-01

## Findings and correction

When a connection goal renders before a pending request refuses, the old error is installed after the goal observation and remains until another status render. The new component regressions reproduce both connect and disconnect versions. A pending-request guard also prevents repeated handler activation through the acknowledgement period. Unexpected rejection is caught with fixed local text and releases both controls.

The mounted view retains its latest rendered status and immediately reconciles newly installed feedback against that status. An unmet goal still retains refusal until explicit retry or a later matching status. Existing labels, approval code, guide steps, element identity and acknowledgement-first cancellation contract remain unchanged. No transport cancellation, background or protocol redesign.

## Validation

- Initial new harness mistakenly selected a nested Open FluxIQ notice rather than the view's own notice; corrected that selection before using results as product evidence. Original corrected reproduction: 3 failed, 1 passed, native1, 157.5092ms; rejected-promise case intentionally omitted until catch exists.
- Corrected component5 plus unchanged start-steps10: 15/15 passed, native0, 240.1355ms, heavy-wrapped esbuild plus node --test in isolated ignored scratch output.
- Scoped actual-config types initially could not resolve chrome/node from the temporary config location; pointing typeRoots to the existing package node_modules/@types restored the same libraries. Types then caught incomplete store fixtures and the invented side-panel surface spelling. Fixtures now include subscribe and use the real sidepanel contract. Corrected scoped types for Start plus paused-recording source/tests passed, native0; no compiler checks relaxed.
- Full extension checks wait for Settings/Forget worker freeze. No browser, popup lifecycle, provider or panel management validation performed.
