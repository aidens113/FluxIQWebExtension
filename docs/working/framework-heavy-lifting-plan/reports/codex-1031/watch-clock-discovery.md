Outcome: Done
Changed: `docs/working/framework-heavy-lifting-plan/reports/codex-1031/watch-clock-discovery.md` (discovery report only)
Validation: read-only `rg` scan and inspection of five candidate test files -> found the cases below; no checks run as instructed
Not verified: behavior under virtual timers; no tests run
Report: `docs/working/framework-heavy-lifting-plan/reports/codex-1031/watch-clock-discovery.md`
Notes:
- `ignored-press/tests/ignored-press-watch.test.ts`: “a sign the press's own handler queued ... without waiting” and “a request that arrives inside the window ends the watch when it arrives” assert `Date.now() - started < 1_000` against a 5,000 ms settle window.
- `ignored-press/tests/settled-look.test.ts`: the brief busy/revert case asserts `< 1_200` against 1,500 ms; persistent changed state asserts `< 5_000` against 10,000 ms. Both are early-settlement contracts. Other rows cover delayed and deadline behavior without an upper-bound assertion.
- `tests/rate-limit-notice.test.ts`: early exit on disconnected control and `beforeunload` each assert `< 1_000` against 5,000 ms; stop-working control asserts `< 1_000`; icon-only control asserts `< 600`. These are watch early-exit checks. Delayed notice/readability checks also use `Date.now()` and real timers.
- `tests/in-place-effect.test.ts`: “a region ... that never changes does not delay the answer” and “a region inside the link ... does not hold the answer” assert `effect.afterMs < 100`. This is a measured watch-result threshold, not a whole-test elapsed bound; a late scheduled observation can affect it.
- `tests/assertion-evaluation.test.ts`: “a claim that is already true...” (`elapsedMs < 1_000`) and “a claim nothing could satisfy...” (`Date.now() - started < 1_000`) assert immediate watch termination. This is a wait/evaluation test rather than a pure watch test.
- For these semantic claims, virtual `Date` plus `setTimeout`/`setInterval` can prove that the watch returns before its virtual deadline, and that delayed events or deadline expiry are handled at the expected virtual time. They cannot establish a real scheduler latency guarantee; the current upper bounds only approximate that with wall time. The `in-place-effect` threshold similarly needs virtualized clock/polling to remove scheduling noise.
