Role: Discovery worker, gpt-6-luna, High. Read-only; no spawning/git/source edits/checks/provider calls.
Goal: identify other pure watch tests beside robot-check that assert short real-clock upper bounds and could fail for the same scheduling assumption.
Root: C:/Users/osrs_/FluxStuff/!FluxIQWebExtension; source only apps/extension/src/content/action-runtime/ and adjacent owned tests.
Known failure: robot-check/tests/robot-check-watch.test.ts required real elapsed100-400ms for a120ms window, observed1143ms. Lead has converted all9 tests in that MAIN file to virtual timers, not tested yet while frozen t821 runs.
Search narrowly Date.now/performance.now/elapsed/took plus upper-bound assertions; inspect at most five matching test files and their owning timer usage if needed.
Do not edit the lead's file or frozen t821. No stress/full/narrow test runs; current sweep owns validation.
Return only concrete files/test names and whether virtual Date/setTimeout/setInterval can prove the same actual contract. Do not recommend raising bounds or changing production without evidence.
Report docs/working/framework-heavy-lifting-plan/reports/codex-1031/watch-clock-discovery.md; maximum35lines.
End Outcome/Changed/Validation/Not verified/Report/Notes contract.
