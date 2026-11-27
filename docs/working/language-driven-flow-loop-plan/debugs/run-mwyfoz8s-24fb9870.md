# run-mwyfoz8s-24fb9870: company-website apprentices, passed live (4 of 4)

Lane: t1059 `live-lane-2`. Task: `company-website/company-website-apprentices`, answer-first, `--attempts 4`,
visible Chrome, run watcher on. Provider: Anthropic `claude-sonnet-5-5` for build and judge, fluxiq 0.54.32.
Step files: `C:/Users/osrs_/FluxStuff/lab-runs/2026-11-26/run-mwyfoz8s-24fb9870/steps/`. The watcher raised no alert.

## Attempts

| Attempt | Path | Calls | Cost | Answer (oracle) |
| --- | --- | --- | --- | --- |
| 1 | explore | 18 (interpretation 1, judge 2, decisions 15) | $0.44, 84 s | right; 4 rows stored and shown |
| 2 | run of the saved Flow, nothing else | 1 (the judge's check of the run) | $0.06 | right |
| 3 | run of the saved Flow | 0 | $0 | right |
| 4 | run of the saved Flow | 0 | $0 | right |

Each later attempt ran against what the attempt before left, with no reseed, found none of the asked acts already done,
changed nothing on the site, and was proven to start from the attempt before's saved Flow.

## Why it passed

This is the first live run after the judge fixes (t1065 to t1069). The judge answered through `core_check_answer`, and
both its answers in attempt 1 were read. The read task has no lasting act, so the later attempts never met the
end-state stop that made bigbox's later attempts call the model (run-mwyfc9uf-215bbd84).

## Next

Nothing to fix from this run. Attempt 2's single judge call is the check of a saved Flow's first live run. Whether that
check should cost a call is a product question already open in the plan, and not a defect of this run.
