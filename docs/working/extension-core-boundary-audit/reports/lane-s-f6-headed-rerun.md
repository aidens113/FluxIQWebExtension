# Lane S F6: headed rerun of the t728 chat check

## Outcome

Partial. The rerun was started but did not finish. The harness made me hand back before it was done, and handing back stops the background process. So there is no exit code, no check result and no screenshots.

## What changed and why

No source or test file was edited. I wrote two scratch scripts, copied from lane-s-f3 with only the label changed to `lane-s-f6`: `<scratchpad>/lane-s-f6-build.mjs` and `<scratchpad>/lane-s-f6-check.sh`.

## Commands run and observed results

- `node scripts/check/core-build.mjs` in D printed: "FluxIQ Core's build at ...\t728\!FluxIQ is current with its source." Core was not rebuilt.
- `sh lane-s-f6-check.sh D lane-s-f6 lane-s-f6-build.mjs` ran with its log in `<scratchpad>/lane-s-f6-run.log`. It resolved the `lane-s-f6` instance paths and reused `test-contracts:build` from the stamp. It was still in the Lab build phase, which took about 12 minutes in lane-s-i, when the run was cut short. The check itself never started.

## Not verified

None of the brief's outputs exist: the exit code, the 14 checks, the saved instruction compared with the typed sentence, and the chat and overlay headline. `D/test-runs/lane-s-f6/` may be empty or missing.

## Open questions or contradictions found

To finish this, the rerun has to go to a worker that is allowed to wait about 15 minutes in the foreground, or the supervisor can run the same script itself.
