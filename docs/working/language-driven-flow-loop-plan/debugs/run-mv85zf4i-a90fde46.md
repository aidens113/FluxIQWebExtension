# Debug: run-mv85zf4i-a90fde46

- Instance: a8-slot-4, task `everything-store-plus-earbuds-under-50`, authoring mode `project` (A8 round one, launch
  6, 2026-10-14, pair downstream `6fbf6b6f` / Core `2db229e9`), lane tree `fxwork/t567`.
- Verdict: failed, no Flow, $0.0037 billed, 13 steps.
- What happened: one subflow `find_earbuds` (two read parts, an output); both briefs (64 turns, 116 calls) came back
  `blocked`, `llm_evidence_loop.invalid_configuration`, 0 calls; the supervisor amended once and ended honestly.
- Cause (product defect, Core): the builder's submit tool description was 2,165 characters, over the 2,000-character
  tool limit, because the brief's two parts and its output line were written into it.
- Fix: Core t584 (the brief text moves into the submit tool's `flow` input description; an invalid configuration's
  result names its check and values); t588 carries that into the brief's return reason.
