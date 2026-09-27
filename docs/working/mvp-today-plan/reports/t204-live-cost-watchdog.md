# t204 — Live cost watchdog

## Outcome

Run 1 should be watched against the runner's existing per-grant limits, not a newly invented whole-command cap. A comparable healthy language-loop run completed in about 305 seconds, used 35 provider calls across its provider-bearing work, and cost about $0.049. The practical planning range is therefore about **300–450 seconds** and roughly **$0.05**, but neither figure is a stop threshold.

The `create-flow` command has two independently authorized provider-bearing grants: the build grant and the playback/repair grant. The repair plan copies the build plan's limits. The deterministic `--replays 1` pass issues no grant and must add zero provider calls. Consequently, 26 calls or $2 is a **per-grant** ceiling, not a valid whole-command ceiling; using either as a command-wide stop would reject legitimate runs such as the 35-call comparison run.

## Configured ceilings

The t178 command does not override the current default budget. Each of the two grants is bounded by:

| Bound | Configured value |
| --- | ---: |
| Provider calls | 26 |
| Input tokens per request | 48,000 |
| Output tokens per request | 8,000 |
| Total tokens per request | 56,000 |
| Aggregate tokens per grant | 560,000 |
| Provider-call timeout | 25 seconds after the Core clamp |
| Estimated cost per call | $0.25 |
| Aggregate estimated cost per grant | $2.00 |
| Provider retries | 0 |

If both grants consume every allowance, their mathematical whole-command exposure is 52 calls, 1,120,000 aggregate tokens, and $4.00. Those totals are useful for monitoring only: the runner enforces the two grants separately and does not configure a third command-wide ceiling at those values.

The time bounds are stage-owned rather than a single whole-command timeout:

- Flow creation has a 300-second HTTP request bound and an outer proposal deadline of 675 seconds (11 minutes 15 seconds), including its bounded polling path.
- Granted playback/repair has a 600-second (10-minute) run lease and terminal-detail wait cap.
- Replay is provider-free and cannot spend provider budget.

No lower wall-clock kill threshold should be added. The earlier roughly 950-second run included a known, since-fixed erroneous repair wait; it is not a healthy expectation and also does not justify replacing the current stage deadlines.

## Watch procedure

Before launch, record the start time, the two-grant budget table above, and the expected 300–450-second range. Only the single t178 command may be in flight, and run 2 must not begin until run 1 has fully settled and its sanitized result has been reviewed.

At about 300 seconds, emit a routine heartbeat. At 450 seconds, change the watchdog state to **amber** and report the elapsed time, last completed stage, and current sanitized stage if the runner exposes one. Amber is an escalation for observation, not permission to terminate the process or start another run.

After amber:

- If build is active, continue observing its owned deadline up to 675 seconds.
- If playback/repair is active, continue observing its owned 600-second lease/wait cap.
- If a configured stage deadline expires while the process remains active, escalate to the supervisor with the stage and elapsed time. Let the owning runner settle and preserve its evidence; do not force-kill it or launch a replacement without an artifact-safe decision from the supervisor.
- If total elapsed time is high while each stage remains inside its own configured bound, report that fact without inventing a whole-command stop.

Treat the run as stopped/failed when the runner terminates or emits one of these observable conditions:

- `performance.budget`, a Core budget breach, or observed usage above any applicable per-grant call, token, request, or cost limit;
- a nonzero provider-retry allowance, incomplete per-call accounting, or provider calls that cannot be attributed to the build or repair grant;
- zero provider calls for provider-bearing work (`runtime.behavior`), or any provider call during deterministic replay;
- a stage deadline/lease failure emitted by its owner;
- an existing-run/build-lock collision, redaction/secret attestation failure, or bundle inspection failure.

These are failure observations, not instructions to relax a limit, manually retry a provider call, or start a second Lab run.

## Safe status fields

Status updates may contain only sanitized aggregates and closed-vocabulary state:

- elapsed seconds; watchdog state (`normal`, `amber`, `failed`, `settled`); last completed stage; current stage when available (`setup`, `build`, `review`, `playback`, `judge`, `repair`, `replay`, or `settlement`);
- run ID once assigned; verdict; failure category; exit code; bundle-finalized and inspection-pass booleans;
- provider, model, profile ID, and grant purpose (`build_and_adapt` or `explore_and_adapt`);
- per-grant provider-call count, aggregate input/output/total tokens, aggregate estimated cost, configured caps, and budget-breach count/category;
- aggregate exploration outcome/stop-code counts and verification, repair, and replay counts/outcomes.

Never include credentials or their source values, prompts, model responses, instruction text, recorded page data, selectors, authorization material, raw artifact contents, or unsanitized failure messages. Report build and repair usage separately before presenting any whole-command sum.

## Evidence used

- `docs/working/language-driven-flow-loop-plan.md` and its run-time summary archive: comparable duration/cost/call observations and the fixed long-wait history.
- `docs/working/mvp-today-plan/reports/t178-live-run-preflight.md`: exact run-1 command, serial-run rule, provider-free replay, and safe CLI result fields.
- Current runner budget, plan, grant, flow-creation, and terminal-wait constants: the limits recorded above and the separate build/repair accounting boundary.

## Open items and follow-up

None. This report defines observation and escalation only; it does not authorize a Lab run, provider call, browser operation, budget change, or new stop policy.
