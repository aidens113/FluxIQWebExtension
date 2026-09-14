# `i-final2-termination-a` — bounded A2 termination diagnosis

**Status:** complete — the campaign crossed an operating-system restart and did
not reach either the bench's or wrapper's normal completion path.

**Scope:** read-only diagnosis of `F:\fxlab-runs\final2\a` and its wrapper;
no Lab command, build, source edit, artifact mutation, or raw page/log disclosure.

## Established facts

### Last durable campaign state

- The last finalized bundle, W13 recording repeat 2, completed at
  `2026-09-14T02:19:00Z`. `runs.json` was last written at `02:19:01Z` with 153
  evaluated rows and 12 planned skips.
- A staging directory for the next row was created at `02:19:01.642Z`. Its only
  bounded record is `events.ndjson`: runtime preparation at `02:19:27.325Z`,
  then W13 Flow repeat 2's first two steps and checkpoint from `02:19:30.504Z`
  through `02:19:30.930Z`. It has no run manifest, evaluation, completion
  marker, or redaction attestation.
- The memory wrapper's last sample was `02:19:30.069Z`, 8,847 MiB free. The
  preceding seven samples ranged from 6,018 to 9,112 MiB. The campaign-wide
  minimum was 5,185 MiB, so neither the 3-GB start/pause gate nor memory
  pressure explains the stop.
- The attestation watcher last wrote at `02:19:15Z`. It had processed all 153
  finalized attestations, all with zero findings. The leak stop branch did not
  fire.

### Wrapper and command outcome

- The wrapper normally waits for the child `exit`, prints `BENCH_EXIT`, samples
  once more, scans attestations, then enters `finally`, closes descriptors and
  removes its lock. None of that terminal evidence exists: the aggregate
  report is absent, the command session retained no final output, and the
  zero-byte exclusive lock survived until the later audited cleanup.
- The private command log is only 3,292 bytes and stopped changing at
  `23:39:01Z`, roughly 160 minutes before termination. Before examining its
  bounded tail, it was scanned against the dynamically read auth value and
  against authorization/bearer, password, cookie, HTML, query-URL and data-URL
  markers; every count was zero. Its final bounded lines show successful
  package builds and the Lab's path/instance declaration only. They contain no
  error, failure, exit, report, or terminal bench line. The per-run evidence
  lived in bundles rather than this command log.
- The prior cleanup audit found zero owned processes and zero listeners on 456
  unique assigned ports. The historical unified-exec session is no longer
  queryable, and Windows Security process-termination audit evidence was not
  available. Therefore the wrapper PID's exact exit code or termination signal
  cannot be recovered.

### Operating-system timeline

Windows retained a coherent restart sequence in the System log, in local PDT:

| Time | Event | Bounded meaning |
| --- | --- | --- |
| `19:19:47.511` | User32 1074 | `RuntimeBroker.exe` requested a `restart`; reason `Other (Unplanned)`, code `0x0` |
| `19:19:49.063` | EventLog 6006 | Event Log service stopped |
| `19:19:54.058` | Kernel-Power 109 | Kernel power transition |
| `19:20:11.375` | Kernel-General 13 | Operating-system shutdown |
| `19:20:24.986` | Kernel-General 12 | New operating-system boot; CIM reports the same boot time |
| `19:20:39.533` | EventLog 6005 | Event Log service started |

There was no Application crash event 1000, 1001, or 1026 in the bounded
termination window. The restart sequence begins 16.6 seconds after the last
staging event and is the only retained machine-level termination event.

## Cause assessment

**Proven:** the machine performed an orderly OS restart while A2 was incomplete;
the Lab, bench aggregator, and wrapper did not take their normal exit paths.
The stop was not caused by the wrapper's leak branch or memory gate. The
machine restart is therefore the proven external cause class and the direct
reason no process survived to complete the campaign.

**Not proven:** Windows retained neither this wrapper PID's exit status nor a
process-termination audit record, so the exact kill signal/time cannot be tied
to PID 19124. The 16.6-second interval between the last artifact and logged
restart request is consistent with session/restart teardown, but it is not a
per-process trace. Event 1074 identifies Runtime Broker as the requester; it
does not prove whether a user action, update workflow, policy, or another app
caused Runtime Broker to request the restart. Those remain hypotheses.

An independent wrapper bug is possible in principle because timer callbacks
are not guarded, but the retained artifacts do not support one here: all 153
attestations parsed, the watcher never saw a leak, memory remained healthy, no
application crash was logged, and a host restart immediately followed. A
runner/product failure also cannot explain the machine reboot.

## Required hardening before restart

1. **Stable-host gate.** Do not launch the next multi-hour pair until the
   supervisor checks for pending restart/maintenance state and establishes a
   no-restart window long enough for both benches plus comparison. Record the
   boot identifier (`LastBootUpTime`) at launch. Do not infer the initiator from
   User32's generic reason.
2. **Durable wrapper state.** Before spawning, atomically write an allowlisted
   status record containing label, boot identifier, wrapper/child PIDs, command
   shape hash, pins, start time, and `state=running`. Update it on each heartbeat
   with the last finalized count and memory value. On child exit, write the
   numeric exit and `state=exited` before cleanup. A stale `running` record after
   boot-id change then proves host interruption without depending on a live
   tool session.
3. **Meaningful lock.** Put label, boot identifier, PID and start time in the
   exclusive lock rather than leaving it empty. Refuse reuse while that PID and
   boot are live; after a reboot, require the same bounded process/listener and
   artifact audit performed here before a supervisor removes it.
4. **Guard monitor callbacks.** Catch and durably record memory-sampler and
   attestation-reader errors. A transient partial JSON read must be retried and
   must not crash the wrapper. Install bounded `uncaughtException`,
   `unhandledRejection`, child `error`, and termination handlers that attempt a
   status write and lane-specific child-tree cleanup without exposing content.
5. **Decouple supervision.** Host the wrapper in a durable hidden process/job
   whose lifetime is not the conversational terminal session. Place the child
   in a lane-owned Windows Job Object so wrapper loss closes only its exact
   descendants. This does not survive an OS restart, but it distinguishes tool
   disconnection from host shutdown and prevents orphans.
6. **Fresh evidence only.** Preserve this root unchanged and restart A and B in
   new roots from the beginning. Do not resume at row 154 or fold these 153
   evaluations into a new denominator; criterion 5 requires two complete,
   consecutive repeat-three aggregations at identical pins/load.

The W27 repeat-0 gateway timeout is separate from the termination: repeat 1
passed, and repeat 2 was never reached. It should remain a single load
observation until a complete fresh bench classifies it; it is not evidence for
changing the termination hardening.
