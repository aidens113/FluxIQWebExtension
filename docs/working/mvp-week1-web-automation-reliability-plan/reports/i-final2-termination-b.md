# Investigation: final2 Bench B termination

Worker report, 2026-09-13. This is a bounded, read-only diagnosis of the
terminated B campaign. No Lab/build/run was started, and no run artifact was
deleted, moved, or modified during this investigation.

## Preserved state

- Owned root: `F:\fxlab-runs\final2\b`.
- Bench id: `bench-mu0ggjci-d81bb3dc`.
- Wrapper start: `2026-09-13T23:38:26.806Z`; child PID 13792.
- `bench-driver.log` is 3,287 bytes / 66 lines. A process-only comparison with
  the imported auth-gate value plus bearer/cookie/password/HTML/data-URL/page
  payload pattern checks found no secret or page-data match before its bounded
  tail was inspected.

## Proven timeline

All timestamps in this section are UTC.

- `23:38:26.806`: wrapper status and command log created.
- `23:38:44.239`: last command-log write. Its bounded tail contains only
  successful package-build completion and the isolated instance/path summary;
  it contains no terminal, error, or exit line.
- `02:19:19.929`: `runs.json` last updated with the 155th finalized executable
  result. The empty staging directory for the next run was created at the same
  instant.
- `02:19:31.960`: wrapper status heartbeat last updated, recording
  `leakTriggered=false` and minimum free memory 5,276,368,896 bytes (4.91 GB).
- `02:19:47.511`: Windows System/User32 event 1074 records a restart initiated
  by `RuntimeBroker.exe`, action `restart`, reason `Other (Unplanned)`, reason
  code `0x0`, and an empty comment.
- `02:19:49`: the Windows Event Log service stopped normally (event 6006),
  followed by Kernel-Power shutdown event 109 at `02:19:54`.
- `02:20:24`: Kernel-General records the next OS start (event 12); Event Log
  restarted at `02:20:39` (event 6005).

There was no Application Error, Windows Error Reporting, or .NET Runtime crash
event in the termination window, and no resource-exhaustion event. Security
4689 process-exit auditing was unavailable, so no independent child exit code
exists there.

## Cause determination

**Proven cause:** a controlled Windows restart terminated the wrapper and its
child while the bench was active. The final heartbeat 15.55 seconds before the
restart, a complete result 27.58 seconds before it, and creation of the next
empty staging directory show that the campaign was still advancing immediately
before shutdown. This is not a normal bench completion: only 155/189 executable
evaluations finalized, no `wrapper-outcome.json` exists, and no terminal line
was written to the command log.

The restart initiator is proven only to the Windows boundary above. The event
record does not prove which user action or higher-level component caused
`RuntimeBroker.exe` to request it. A human restart, shell/UI action, maintenance
automation, or another brokered request therefore remains hypothesis, not
fact.

Repeated NTFS events 136/137 reported C: transaction-resource-manager errors
from `02:18:04` through shutdown, and event 55 reported a C: index-structure
corruption after boot. A separate event 98 referenced another volume that was
neither the current C: nor F: volume identity. These are material host-health
signals, but the logs do not establish them as the restart trigger. They also
do not implicate the owned F: run root directly.

Low memory, a leak stop, a bench assertion, and a Node crash are contradicted
or unsupported: sampled minimum free memory stayed above the 3 GB guard, the
last leak flag was false, the log has no terminal failure, and the OS has no
matching application-crash record.

## Wrapper outcome-path comparison

The launcher was an inline, process-only Node wrapper; no standalone wrapper
source was persisted in the run root or worktree. Repository/run-root search
found `minimumFreeBytes`, `leakTriggered`, or `wrapper-outcome` only in the
status artifact. Accordingly, source-line verification is unavailable.

The observed launch contract was that the wrapper held the lock, sampled
memory and leaks while awaiting the child, then wrote `wrapper-outcome.json`
on the terminal child path. A machine restart kills both processes before that
post-child path can complete. The still-running status plus absent outcome is
therefore exactly consistent with OS interruption, but the current artifact
design cannot encode the terminal cause by itself.

## Required hardening before restart

1. Treat this host as unhealthy until C: filesystem/transaction-manager health
   is checked and remediated by the host owner. Also verify F: health and that
   no restart is pending. A new multi-hour campaign should not begin merely
   because the machine has rebooted.
2. Establish an explicit no-restart maintenance window for both paired labs.
   Preventing sleep alone is insufficient because event 1074 is an explicit
   restart request.
3. Persist a non-secret copy or version/hash of the wrapper source with the run
   so terminal behavior is auditable. Continue loading the auth value only in
   process; never serialize it with the source or lifecycle state.
4. Pre-create the outcome/lifecycle record as `running` before child spawn,
   including wrapper PID, child PID, machine boot identity, start time, command
   identity, run root, and heartbeat. Update it atomically after every finalized
   row and to a terminal state on child close, wrapper signal, exception, leak
   stop, or normal completion.
5. On the next supervisor startup, compare the saved boot identity with the
   current boot and convert a stale `running` record to
   `interrupted_by_system_restart`, preserving the last finalized row and
   heartbeat. This recovery step is necessary because Windows shutdown may not
   give a user-space handler enough time to write.
6. Capture child exit code/signal and wrapper stop reason separately. Flush the
   terminal record synchronously/atomically before releasing the lock. Keep the
   command log separate from the secret-bearing child environment.
7. Use a fresh run root for the replacement acceptance campaign. Preserve this
   root as interruption evidence; do not resume into or overwrite its 155
   finalized bundles. The four timing-only reruns and 34 unexecuted evaluations
   remain separate unverified work.

## Conclusion

The B campaign was interrupted by a proven OS restart, not shown to have failed
inside the bench. The exact actor behind the brokered restart and whether the
C: NTFS errors motivated it remain unproven. Restarting the campaign is blocked
on host/filesystem health confirmation, a protected no-restart window, and a
durable wrapper lifecycle record that survives/reconciles machine restarts.
