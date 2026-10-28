Outcome: Done

What changed and why
- Core test packages/fluxiq/src/programs/automation-studio/runtime/service/recordings/tests/process-restart.test.ts: the cause is a machine-speed-dependent fixed deadline. Each case spawns a child that opens real SQL stores. The sweep log shows the late-finalize write child killed at its 45 s execFile timeout (test took 45380 ms), while neighbours took 15-45 s. Alone the same case takes 6-25 s. Not a product defect: the child was killed by the deadline, not by an assertion.
- Fix: per-phase child deadline 240 s (the child exits itself when done; the deadline only catches a hang), test timeout derived as 2 phases + 60 s. No assertion removed.

Commands run and observed results
- Solo, three runs before the edit (pnpm test <file> in packages/fluxiq): "Test Files 1 passed (1) / Tests 13 passed (13)" each time, 108 s, 164 s, 132 s. late-finalize took 10 s, 24 s, 18 s (spread shows the load sensitivity).
- After the edit, with the directory service/recordings: "Test Files 4 passed (4) / Tests 34 passed (34)" (plus a second group "Test Files 3 passed, Tests 54 passed").
- pnpm check (packages/fluxiq): tsc finished with no errors.
- pnpm structure:check (repo root): "structure-audit: passed (443 warning(s), 1152 baselined)".

Not verified
- Three solo runs were done on the original file, not re-done after the edit (the edit only widens timeouts). The sweep-load failure was not reproduced; diagnosis rests on the sweep log timing (kill at 45 s) and solo variance.

Open questions or contradictions found
- None. Note a 13-test file taking 100-160 s alone is slow; splitting or sharing a probe run is a possible later improvement, out of scope.
