# Debug: run-mv8cam5t-436efa46

- Instance: a8-slot-3, task `social-network-feed-confirm-requests`, authoring mode `project` (A8 round one, launch 7,
  2026-10-14, pair downstream `760d42bf` / Core `6a81a391`), lane tree `fxwork/t566`.
  Steps: `lab-runs/2026-10-14/run-mv8cam5t-436efa46/steps/` (147).
- Verdict: failed (`lab.chat_build_unfinished`), no Flow, $0.056 billed.
- What happened: two subflows, `confirm_requests` (done, trial yes) and `read_accepted` (partial once, then done, trial
  yes); assembly; the whole test (0141) answered yes, with all three judge calls. The site had shown a rate-limit
  notice during the confirm loop, so the supervisor sent a repair brief to add pacing and a dismiss-and-continue branch
  (the user's rule for interruptions); while that builder ran, the Lab's chat deadline passed and the run was recorded
  unfinished.
- Cause (Lab defect): the Lab waits a chat-started build `60 + 600 + 15 + 120` s
  (`packages/test-runner/src/flow-lane/creation/chat/build-from-chat.ts:80`), sized for one candidate loop; Core bounds
  each loop (540 s) but no whole project build, so neither side owned the project build's time.
- Fix: t592 (Core exports and enforces a 30-minute project build bound with an honest ending; the Lab's project-mode
  deadline derives from it, candidate unchanged). The first `project` build to pass its whole test on this task.
