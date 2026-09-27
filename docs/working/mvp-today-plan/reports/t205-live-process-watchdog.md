# t205 — Live process watchdog

## Outcome

**Active at the snapshot.** One process tree consistent with the single active run was present at 2026-09-26 17:21:09.948 -07:00. Its oldest in-tree process had been alive for about 196.3 seconds. The tree contained five processes: one `powershell.exe`, three `node.exe`, and one `cmd.exe`.

No second `node.exe`/`cmd.exe` tree was observable, so this snapshot found no competing Lab or build tree. This conclusion is deliberately limited to process topology: process names alone cannot establish purpose with certainty.

## Sanitized snapshot

| Name | PID | Parent PID | Start time (-07:00) | Elapsed at snapshot | Lifetime CPU |
| --- | ---: | ---: | --- | ---: | ---: |
| `powershell.exe` | 25596 | 20376 | 17:17:53.684 | 196.3 s | 0.281 s |
| `node.exe` | 20516 | 25596 | 17:17:53.993 | 196.0 s | 12.625 s |
| `node.exe` | 27388 | 20516 | 17:19:00.480 | 129.5 s | 1.188 s |
| `cmd.exe` | 24412 | 20516 | 17:19:01.351 | 128.6 s | 0.016 s |
| `node.exe` | 27412 | 24412 | 17:19:01.378 | 128.6 s | 16.406 s |

The tree's aggregate lifetime CPU at the instant of observation was about 30.516 seconds. Presence and accumulated CPU establish that the tree existed; a single snapshot does not claim that every member was actively consuming CPU at that instant.

One older standalone `powershell.exe` process was also present, with no `node.exe` or `cmd.exe` descendant in the permitted process-name set. The watchdog's own short-lived `powershell.exe` observer was excluded from the run tree. Neither was classified as a competing Lab/build tree.

## Boundaries

The observation selected only process name, PID, parent PID, creation time, kernel CPU time, and user CPU time. It did not read command lines, environment, standard input/output, network payloads, credentials, logs, run artifacts, browser state, or provider state. It sent no input or control signal to any process and made no build, test, source, shared-document, Lab, browser, or provider change.

## Open items and follow-up

None from this snapshot. Any later health decision requires a new supervisor-authorized observation; this report is not continuous monitoring and does not authorize interference with the active tree.
