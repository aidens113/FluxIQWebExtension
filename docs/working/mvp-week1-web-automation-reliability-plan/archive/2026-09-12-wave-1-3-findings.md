# Findings from Waves 1-3

Moved out of the plan's `Current State` on 2026-09-12, when the document crossed
the 800-line compaction threshold a second time. Nothing is deleted. The three
environmental entries below are also stated, in operational form, in
[live-validation-plan.md](../live-validation-plan.md), which is where an
operator should read them; this file keeps the history and the reasoning.

**Findings that change later work**

- The Playwright headless shell crashes on launch here; both Playwright
  configs now use `channel: "chromium"` (network-policy spec: 3 passed).
- Playwright `selectOption` fires untrusted events, which the recorder now
  ignores: recorded lanes select by keyboard.
- Password values leave the recorder unredacted (pre-existing,
  `describe-element.ts`); Phase 1.4 fixes it at the source.
- The recording lane asserts only unpaginated extract steps; paginated
  extraction is proven by the Wave 2 Flow lane.
- The structure audit reads only tracked files: stage new files first.
- Core accepts `client.start_recording` only while the approving Automation
  Studio context is under 10 s old. The runner now restamps it immediately
  before the start. The `clone` lane still carries the original defect and
  needs an existing or clone target to exercise it.
- Fixed in Core and mirrored: `pnpm structure:baseline` only lowers or removes
  entries, and refuses a new or grown violation.
- `.env.local` configures the existing install (target, base and gateway URLs,
  credentials), and a process variable cannot clear those keys; isolated runs
  therefore set `FLUXIQ_TEST_ENV_FILES=none`, which skips both env files for
  one run. Never edit `.env.local`.
- **A worker's crash is usually the machine, not the change.** Verifying the
  Core seam produced a `tsc` segmentation fault here and three separate vitest
  runs that each lost a test file to `Error: Worker exited unexpectedly`. None
  of it was the code. In Core the root cause is a native SQLite module
  corrupting under parallel load (`SQLITE_CORRUPT: malformed database schema`),
  which kills the worker process outright instead of failing a test; Core
  verifies cleanly with `--no-file-parallelism`. Downstream, running both
  repositories' checks at once was enough to segfault `tsc`, and running the
  downstream check alone passed. Run heavy gates one at a time.
- **One clean baseline run does not clear a change.** Chasing the above, the
  supervisor stashed the Core seam, saw a green parallel baseline, and briefly
  concluded the seam caused the crashes. It did not — the baseline run was
  lucky. Against an intermittent failure, compare like for like (here, the
  sequential run) rather than trusting a single green.
