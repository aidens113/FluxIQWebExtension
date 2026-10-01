# Live lane briefs after integration round 3 (2026-09-30)

Supervisor record. The full brief text goes to each lead; this file keeps what a later session needs to re-dispatch them.
Dispatch only after dev is validated and pushed in both repositories, and after dev is merged into each lane's tree.

## What changed since the lanes last ran (each lead's debug judges against this)

- **The whole page reaches the model** (t200, t210): every rendered element of every frame and open shadow root, in
  document order, no caps, no ranking, no byte budgets; covering dialogs and layers are flagged per element. The only
  request bound is the model's 1,000,000-token window, refused loudly with its size.
- **The three-phase build** (t196, t208, t211, t214): the model authors the draft (a step it runs is evidence until it adds
  it), sees the instructed acts and choices as a checklist, and progress means the Flow advanced. No replay from the start
  during exploration; the Flow is tested and judged once the model says it is ready; then repaired, finished, or ended
  `flow_bootstrap.not_doable` with a reason. A build never just ends: an empty draft keeps exploring; a budget hit ends
  `evidence_budget_exhausted` saying what was tried; six unreadable replies end `model_replies_unreadable`. Every round's
  trace is kept.
- **Page interaction**: a click that reloads its own page is applied (t202); every click and navigation gets the robot-check
  allowance (t203); lane D's corner probe, wall handling and re-press (R1, R2, F20); lane C's paged lazy tail and page pace.
- **Repair**: a failed step the ladder cannot fix is re-authored (lane B C2, with t207's guard).
- **Permission**: every consequential task on the ten sites declares its permission point and the Lab answers as the
  person there (lane D L1, t205); money, delete and send/publish always ask.
- **The chat** (t191): every step is its own message with the model's reason; actions are cards with icons; robot-check
  and permission cards resolve from Core's event (waited out, answered, allowed, declined, cancelled).
- **The Lab**: $0.25 per build (t212); the guards (balance, unchanged source, missing debug, 4th run in 30 minutes); the
  spend ledger; run artifacts screened (t212).

## The four lanes (one slot each, no queueing; headed; the ten realistic scenarios only)

| Lane | Slot, instance | Tree | Tasks, in order |
| --- | --- | --- | --- |
| A create and run (t174) | slot-1, `t174-slot-1` | `fxwork/t174` | crossborder hub-to-cart, bigbox pickup-cart, everything-store kettle-to-cart, company-website quote-request |
| B self-repair (t193) | slot-2, `t193-slot-2` | `fxwork/t193` | the `variantArmedAfterBuild` tasks: bigbox cart redesigned, company-website quote redesigned, job-board Halvard redesigned, social-feed group-post regrouped |
| C judge its answer (t194) | slot-3, `t194-slot-3` | `fxwork/t194` | everything-store-plus-earbuds-under-50, local-classifieds bike search, auction kestrel, crossborder spain-hubs, professional-network data engineers |
| D control flow and consequential acts (t195) | slot-4, `t195-slot-4` | `fxwork/t195` | social-feed confirm-requests, professional-network withdraw-stale-requests, bigbox pickup-order, job-board apply-quillmark, photo-social moon-jar |

## Rules for every lead

- One run per launch, started by the lead for a reason (the fix under test). No loops, cron or keepers. Obey the guards;
  never create an override.
- Full debug per the Full Debug Protocol after every run, with the screenshot UI review of the chat, the cards and the
  overlay, in `debugs/<run-id>.md` in the lane's tree. Judge each run against the three phases above.
- A pass is a Flow that was built, ran, and did the task (C: matched the expected dataset; B: the repaired, persisted,
  zero-provider replay). A permission stop is never a pass. A task is done after two passes in a row.
- A failure is a product or Lab defect, never machine load. Name each cause at the value, node or selector level; read the
  other lanes' reports first; the first lane to record a cause owns it.
- Stop at the first insufficient-balance failure. Report each run's cost from the ledger.
- Only the supervisor commits, merges and pushes; leads write "Ready to commit" with validation in their fix logs.
