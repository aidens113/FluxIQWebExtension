# Debug: run-mv7rm0qo-3742a6a8

- Instance: a8-slot-2, task `bigbox-retail-pickup-cart`, authoring mode `project` (A8 round 1, 2026-10-14), lane tree `fxwork/t563`.
- Verdict: failed before the build started. 0 steps, 0 provider calls, no cost recorded; the ledger marks it
  `facilityFailureBeforeProvider` (stage `scenario.execute`, reason `unclassified`).
- How far it got: the Lab built the instance, started a Core (Next.js ready, client gateway bound), opened the side
  panel and took the start UI review; the first chat-project read then failed ("The mounted chat project read
  returned an error") and the Core exited with code 1.
- Cause: all four A8 round-1 runs were launched at once from one lane tree (`t563`) and its one Core worktree. All
  four Cores exited within one second of each other (07:06:30), although they had started up to a minute apart,
  so each was not failing on its own: concurrent runs sharing one tree's Core and its processes stopped one another.
  The established live setup gives each lane its own tree and Core (lanes A-D, `AGENTS.md` "one per live lane");
  this launch did not follow it. A supervisor setup error, not a product defect: nothing of mode `project` ran.
- Fix: one lane tree (with its own Core worktree) per concurrent live run: `t563` and three more lane trees, each
  synced to the same frozen dev pair.
