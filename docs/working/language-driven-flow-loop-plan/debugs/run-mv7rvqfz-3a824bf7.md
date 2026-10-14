# Debug: run-mv7rvqfz-3a824bf7

- Instance: a8-slot-1, task `crossborder-marketplace-hub-to-cart`, authoring mode `project` (A8 round 1 relaunch, 2026-10-14), its own lane tree
  `fxwork/t563` with its own Core worktree, launched alone or a minute apart from the other lanes.
- Verdict: failed before the build started. 0 steps, 0 provider calls, no cost recorded; the ledger marks it
  `facilityFailureBeforeProvider` (stage `scenario.execute`, reason `unclassified`).
- How far it got: the Lab built the instance, started a Core (Next.js ready, client gateway bound) and the
  scenario server, and opened the side panel. The Lab's chat lane then failed at
  `packages/test-runner/src/extension-chat-check/project-navigation/driver.ts:14` ("The mounted chat project read
  returned an error"): the panel's project chat showed "Loading the conversation..." and the composer "Chat
  unavailable", so the instruction was never typed. The Core and scenario processes then exited with code 1 at
  the Lab's teardown.
- Cause: not the round-1 shared-tree mistake (this lane had its own tree): every chat-started build on the
  current pair fails at the panel's project read, so a change merged on 2026-10-13/14 most likely broke the
  panel's conversation read or Core's answer to it. Root cause under investigation provider-free in task t568
  (`reports/t568-lab-chat-unavailable.md` when it lands).
- Fix: the t568 fix, merged and the lane trees synced, before any relaunch.
