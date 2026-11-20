# Debug: run-mwoj9sre-a073c148

| | |
| --- | --- |
| Status | Stopped in error by the campaign watchdog at 21:24:32 local, while it was making progress. Not a product result. |
| Campaign | 2026-11-19 evening, lane B (`fxwork/t960`, instance `campaign-b`) |
| Source | dev, extension 6314624df and Core 71d25f484 |
| Site and task | professional-network, `professional-network-netherlands-data-engineers`, on Haiku |
| Reached | attempt 1, 31 steps, 15 calls, about $0.03 |
| Steps | `C:/Users/osrs_/FluxStuff/lab-runs/2026-11-19/run-mwoj9sre-a073c148/steps` |

## What happened

- Haiku called `web.detect_repeating_structure {target: t646}` repeatedly (0015 to 0027).
- Core's own guard refused the repeats (0024, 0026, 0028: `llm_evidence_loop.already_answered`), and at 0029 the model
  moved on (`core.run_node add`, then `core.run_node`).
- The watchdog's new repeat rule still counted 4 identical calls among the last 6 decisions and stopped the run. That
  was wrong: the repeats were refused, so Core was already handling them, and the newest decision was a different call.

## Fix (campaign tooling, not product)

The detector (`repeat.py` in the supervisor's scratchpad) now:
- counts only calls Core did not refuse;
- requires the newest decision to be the repeated call.

Retested on four runs: it still catches run-mwoi785f-ebe09067's `core.run_flow` loop, and stays quiet on runs
mwoj9sre, mwohvt8n and mwodpw10.

Rerun the task in lane B.
