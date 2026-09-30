# t195-slot-4: 346 runs that failed on an empty DeepSeek balance (2026-09-30)

One debug for 346 identical runs, because nothing in any of them ran past the first provider call.

- **Runs:** 346 run directories under `test-runs/instances/t195-slot-4/`. The first is `run-muo2nioi-e4a9bd18` (12:21Z) and the last is `run-muodhgog-5be437d1` (17:22Z). All are task `bigbox-retail-pickup-order`.
- **What each did:** the build's first model call failed `flow_bootstrap.provider_http_error`. `provider-failures.local.json` records the provider's insufficient-balance answer. `evaluation.json` records `runtime.behavior` with at most 1 call. No page was explored and no draft or Flow was made. The cost was $0 per run.
- **Why they ran at all:** the lane's unattended keeper (`t195-queue2.sh`, old scratchpad, now `*.disabled`) relaunched pickup-order after the lane's agent had ended, and went on relaunching after the balance ran out. That is the waste described in the plan's Current State ("What went wrong overnight"). It is a process defect, not a product one. Dev's Lab guards (`5363e39b`) now refuse this pattern in three ways: `lab-slots/STOP-balance` is written on the first insufficient-balance failure; a failed run on unchanged source is refused; and a 4th start within 30 minutes is refused.
- **Stages 1-6:** NO EVIDENCE: no stage past the first provider call ran.
- **UI review:** NO EVIDENCE: the builds ended before any overlay or chat state worth judging. The bundles' screenshots show the blank start tab and the panel.
- **Fix:** none needed in the product. The guards above, together with the rule that a live run is started only by a live agent for a reason, prevent a repeat.
