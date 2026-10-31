Role: standard worker; gpt-6.1-sol, medium.
Goal: add one realistic Chromium content-harness regression for supplied relative-date reference across wall-clock midnight.
Root: C:/Users/osrs_/FluxStuff/fxwork/t823/!FluxIQWebExtension.
Read discovery report shared-clock-web-discovery.md browser follow-up, content/harness.ts and existing extraction item-conditions spec.
Owned: apps/extension/e2e/content/tests/extraction/tests/item-conditions.spec.ts (or one existing cohesive spec, identify in report); no other source edits. Report MAIN codex-1031/shared-clock-browser.md.
Use only ten realistic fixtures, no synthetic browser page or fabricated rows. Prefer job-board whose site clock is fixed2026-09-21: hold browser wall time one day later and pass extractList.now matching site reference.
Find actual DOM date labels/absolute dates and derive an independent expected positive row set from fixture/DOM. Choose an unambiguous date condition that differs without supplied clock; do not alter fixture/oracle or assume labels blindly. Explicit expected rows must be nonempty.
Use the actual content extract-list action; check row identities/results, not only request echo. Sorting if useful. No Core panel/API/model provider calls.
Use existing harness/time mocking conventions; preserve real performance/deadline timers if adjusting Date.
Do not launch tests/builds while Core edits; prepare spec and give lead exact focused command. If no honest fixture-bound proof is achievable, report concrete constraint without forcing a test.
No full suites, test weakening, git, fixture changes, secrets or user data.
Return Outcome, Changed, Validation, Not verified, Report, Notes(max3lines).
