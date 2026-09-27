# t281 — Downstream rebuild closure

Status: **Complete with classified NO-GO**

## Decision

The ordered downstream rebuild completed successfully against the final Core outputs, but the downstream root check returned exit 1 at the machine's already-known task-fixture boundary. Per the brief's stop-on-failure rule, execution stopped immediately. The tracked-input freshness procedure was not run, and this report does not establish downstream freshness or live readiness.

Classification: **environment-limited check failure, not a downstream compilation/build failure.** The failing fixture processes could not spawn `git` for temporary `git worktree add` operations and reported `Exec format error`. This matches the limitation already recorded in Current State. No product assertion is inferred from that machine failure.

## Serial build results

All commands ran from `F:\!FluxIQWebExtension`, one at a time and in the required dependency order.

| Step | Command | Result | Observed duration |
| --- | --- | --- | --- |
| Domain | `pnpm --filter @fluxiq-web-extension/domain build` | PASS, exit 0; cleaned 504 emitted files and rewrote 797 specifiers in 238 files | 5.69 s |
| Test contracts | `pnpm --filter @fluxiq-web-extension/test-contracts build` | PASS, exit 0 | 2.05 s |
| Test evidence | `pnpm --filter @fluxiq-web-extension/test-evidence build` | PASS, exit 0 | 1.62 s |
| Extension | `pnpm --filter @fluxiq-web-extension/extension build` | PASS, exit 0; TypeScript and default unpacked targets rebuilt | 7.92 s |
| Scenario Lab | `pnpm --filter @fluxiq-web-extension/scenario-lab build` | PASS, exit 0; its owning script also rebuilt test-contracts | 9.73 s |
| Test runner | `pnpm --filter @fluxiq-web-extension/test-runner build` | PASS, exit 0; existing domain declarations satisfied its guard | 13.70 s |

Only generated outputs were changed, and only through their owning package build commands.

## Downstream check failure

Command:

```powershell
$env:NODE_OPTIONS='--max-old-space-size=8192'
pnpm check
```

Result: **FAIL, exit 1** after 12.22 seconds.

The root sequence reached `pnpm task:test`. That suite reported:

```text
tests 120
pass 89
fail 31
skipped 0
duration_ms 6686.0842
```

The observed failing cases were worktree/task fixtures whose temporary-repository setup attempted `git worktree add` and received:

```text
error: cannot spawn git: Exec format error
```

Because `pnpm check` uses `&&`, the later root structure audit and recursive package checks were not reached by this invocation. They are therefore **not claimed** here.

## Hard-stop consequences

- The t263 tracked-input `Assert-Fresh` procedure was **not executed** after the check failure.
- No Core or downstream freshness verdict is claimed by t281.
- No one-Lab process/lock gate, dry-run, browser, provider, Lab, or live command was run.
- No authored source or shared working document was edited.
- No run artifact was inspected or changed.
- No commit or push was made.

## Required follow-up

The supervisor must decide whether the previously documented equivalent structure/package checks may satisfy this environment-limited root fixture gap, or whether the machine's `git worktree add` spawn failure must be repaired first. Only after that decision and a green accepted downstream check closure should the tracked-input freshness assertions be run on the unchanged rebuilt outputs.
