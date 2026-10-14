# Debug: run-mv8186yr-a385fd3a

- Instance: a8-slot-2, task `bigbox-retail-pickup-cart`, authoring mode `project` (A8 round one, launch 5,
  2026-10-14, pair downstream `269de980` / Core `048a1d91`, 250-call cap), lane tree `fxwork/t565`.
  Steps: `lab-runs/2026-10-14/run-mv8186yr-a385fd3a/steps/` (350). Full analysis:
  `automation-project-agents-plan/reports/a8-bigbox-run-mv8186yr-debug.md`.
- Verdict: failed, no Flow, $0.094 billed. Briefs were sized 26 and 46 turns (under the loop's 64), so builders ran.
- What happened: the supervisor planned store first, then the cart parts; all eight builders worked the site and got a
  proposal accepted, but none of the 20 subflow trials could pass: `switch_store`'s trials ran on the page the builder
  left (`web.target.not_found`, then `web.target.ambiguous`), and the dependent briefs' 14 trials all answered
  `subflow.trial_predecessor_missing`. Builders told to "complete with outcome blocked" had no such completion, so their
  20 honest endings were refused as unusable and the stop guard ended five briefs. The supervisor saw only generic
  codes, resent four briefs, and ended honestly with 9 of the build's acts left on the site.
- Cause (product defects, Core, mode `project`): A, a subflow trial neither reloads the tab after the start hook nor
  undoes the build's acts (breaks the user's reset rule of 2026-10-12); B, a dependent brief starts though its
  predecessor has no passing proposal; C, a builder cannot end honestly. Secondary: probe lines leak through a refused
  submission's `previous`; dependent builders explore from the build's start, not their entry; returns carry no cause;
  the plan added an unused value and made a "keep unchanged" constraint its own subflow; no reset at the honest end.
  The judge was never called.
- Fix: Core t578 (trial setup and reset), t579 (dispatch waits for a passing predecessor), t580 (builders explore from
  their entry; a read-only brief's press reaches the gate), t581 (honest endings, no probe leak, returns name the
  cause, no revision drops its only lasting act), t582 (plan checks; reset or report at an honest end). Follow-up: a
  saved control's fingerprint should not depend on text the build's own acts change (report fix 11).
