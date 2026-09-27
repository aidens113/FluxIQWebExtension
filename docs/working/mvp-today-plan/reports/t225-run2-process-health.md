# t225 — Run 2 process health

## Outcome

- Observed matching run activity for approximately four minutes, from `2026-09-27T00:37:49Z` through `2026-09-27T00:41:50Z`, using nine samples at roughly 30-second intervals.
- Matching processes were still present at the monitoring cap, so observation stopped because the requested time limit was reached, not because run completion was observed.
- The original process tree showed measurable CPU and working-set movement. At the final sample, its PIDs were gone and a new matching PowerShell/Node pair was present. This establishes process turnover, but the permitted evidence is insufficient to classify it as a normal transition, restart, or separate invocation.
- The Lab build lock was absent in every sample.
- No run result, artifact status, or scenario outcome was inspected or inferred.

## Samples

CPU and working-set deltas are relative to the previous sample of the same PID. `new` means the PID was not present in the preceding sample.

| UTC | Lab lock | Matching process observations |
| --- | --- | --- |
| `2026-09-27T00:37:49.9102787Z` | absent | `powershell.exe` PID `14440`: CPU `0.312 s`, WS `82.5 MB` (initial); `node.exe` PID `15660`: CPU `10.172 s`, WS `97.1 MB` (initial) |
| `2026-09-27T00:38:20.0773947Z` | absent | `powershell.exe` PID `14440`: CPU `0.312 s` (`+0.000`), WS `80.5 MB` (`-2.0`); `node.exe` PID `15660`: CPU `10.438 s` (`+0.266`), WS `108.1 MB` (`+11.0`); `node.exe` PID `20816`: CPU `0.875 s`, WS `63.2 MB` (new) |
| `2026-09-27T00:38:50.1088322Z` | absent | `powershell.exe` PID `14440`: CPU `0.312 s` (`+0.000`), WS `79.7 MB` (`-0.8`); `node.exe` PID `15660`: CPU `10.516 s` (`+0.078`), WS `107.6 MB` (`-0.5`); `node.exe` PID `20816`: CPU `0.875 s` (`+0.000`), WS `65.4 MB` (`+2.2`) |
| `2026-09-27T00:39:20.1796780Z` | absent | `powershell.exe` PID `14440`: CPU `0.312 s` (`+0.000`), WS `79.5 MB` (`-0.2`); `node.exe` PID `15660`: CPU `10.750 s` (`+0.234`), WS `110.1 MB` (`+2.5`); `node.exe` PID `20816`: CPU `0.953 s` (`+0.078`), WS `64.8 MB` (`-0.6`) |
| `2026-09-27T00:39:50.2265114Z` | absent | `powershell.exe` PID `14440`: CPU `0.312 s` (`+0.000`), WS `79.4 MB` (`-0.1`); `node.exe` PID `15660`: CPU `10.844 s` (`+0.094`), WS `113.3 MB` (`+3.2`); `node.exe` PID `20816`: CPU `0.984 s` (`+0.031`), WS `65.1 MB` (`+0.3`) |
| `2026-09-27T00:40:20.2722446Z` | absent | `powershell.exe` PID `14440`: CPU `0.312 s` (`+0.000`), WS `77.9 MB` (`-1.5`); `node.exe` PID `15660`: CPU `10.953 s` (`+0.109`), WS `115.1 MB` (`+1.8`); `node.exe` PID `20816`: CPU `0.984 s` (`+0.000`), WS `65.0 MB` (`-0.1`) |
| `2026-09-27T00:40:50.3116595Z` | absent | `powershell.exe` PID `14440`: CPU `0.312 s` (`+0.000`), WS `76.6 MB` (`-1.3`); `node.exe` PID `15660`: CPU `11.109 s` (`+0.156`), WS `117.4 MB` (`+2.3`); `node.exe` PID `20816`: CPU `1.031 s` (`+0.047`), WS `64.7 MB` (`-0.3`) |
| `2026-09-27T00:41:20.3533515Z` | absent | `powershell.exe` PID `14440`: CPU `0.312 s` (`+0.000`), WS `76.6 MB` (`+0.0`); `node.exe` PID `15660`: CPU `11.375 s` (`+0.266`), WS `116.7 MB` (`-0.7`); `node.exe` PID `20816`: CPU `1.047 s` (`+0.016`), WS `64.9 MB` (`+0.2`) |
| `2026-09-27T00:41:50.3846820Z` | absent | Original PIDs absent; `powershell.exe` PID `20524`: CPU `0.156 s`, WS `57.1 MB` (new); `node.exe` PID `7140`: CPU `0.219 s`, WS `46.8 MB` (new) |

## Health interpretation

- The original primary Node process accumulated `1.203 s` of CPU and grew from `97.1 MB` to `116.7 MB` working set between its first and last observations. It gained CPU in every interval, which is inconsistent with a fully dead or static process during that window.
- The secondary Node process appeared during monitoring and later accumulated CPU as well. The launcher remained CPU-flat while its working set declined, which is not independently diagnostic.
- The final PID turnover prevents a stronger conclusion about continuity. Matching activity remained present, but this monitor did not establish whether the new pair belonged to the same logical run.

## Safety limits observed

- Process command lines were used only for internal matching and were neither recorded nor printed.
- No process was started, stopped, interrupted, or otherwise modified.
- No run artifacts, recorded page data, credentials, browser/provider state, or Lab output were opened.
