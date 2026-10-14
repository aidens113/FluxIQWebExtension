# Debug: run-mv7t07hx-fe96a174

- Instance: a8-slot-1, task `crossborder-marketplace-hub-to-cart`, authoring mode `project` (A8 round 1, 2026-10-14, pair downstream `62f39010` /
  Core `39976038`), lane tree `fxwork/t563`. Steps: `lab-runs/2026-10-14/run-mv7t07hx-fe96a174/steps/`.
- Verdict: failed, no Flow created, about 0.0056 billed, 18 steps.
- What happened: the chat started the build (the t568 long-path fix worked: the conversation opened). The project
  supervisor read the task, then 7 web.find_on_page and 1 web.describe_element; its reasons show it trying to explore like a builder ('I'll type Voltbay into the site's search box (t8)') with observe-only tools, one query just 'field'; ended flow_bootstrap.evidence_repeat_without_progress / llm_evidence_loop.searching_without_acting with no plan written.
- Cause (product defect, mode `project`, A5a): the supervisor's guidance and tool set did not make its role
  plain: it should plan from the task and a short look and leave exploring and acting to builders, but it kept
  exploring with observe-only tools until the loop's stall guards ended it; where it did plan, it was asked to write
  Core's raw `AutomationStudioFlowBootstrapPlan` (router rules, interface port shapes, structured success checks)
  and could not.
- Fix: task t569 `supervisor-plans-not-explores` (Core): role guidance, a look budget through the loop's look
  withdrawal, stall redirects naming the plan step, and a simple planning format Core compiles into the structure
  plan. A rerun waits for it to merge and the lane trees to sync.
