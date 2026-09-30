# Run debug: `run-mun8tgdh-36ae87a2`

## Header

- Run id: `run-mun8tgdh-36ae87a2` (t174 run 2)
- Scenario / variant / task: everything-store / none / `everything-store-kettle-to-cart`
- Command: the brief's template, from `C:\Users\osrs_\FluxStuff\fxwork\t174\!FluxIQWebExtension`
- Build: Core `task/t174-live-lane` with t174 Fix 1 (grant refusals named), before t177 was applied. 2026-09-29, build 22:31:11 to 22:42:48 UTC. deepseek, deepseek-flash.
- Provider calls, tokens, cost: the Lab counted 1 call; it recorded no usage and cost 0.
- Verdict as reported: failed, `lab.generation_unfinished`. The build ran 675,053 ms and the Lab stopped waiting for it.
- **Stage reached:** 2 at most. It is unknown whether any decision call completed.

## Stage 1: the instruction and the expected chain

Same as `run-mun5e1ie-5aeefbbd.md`.

## Stage 2: exploration

- NO EVIDENCE: no decision, tool call or duration survives. The build never finished, so Core stored no failure, and the Lab deleted the run's Core store. `logs/core.log` holds only the Next.js startup lines.
- What the two runs share: run 1 took 239 s to reach its first decision call, and run 2 had not finished after 675 s with one call counted. Both point to a long wait inside the build before or around its first decision: the first observation through the extension, the call itself, or something before the loop.

## Stages 3 to 6

None. No Flow was proposed.

## Causes

| # | Cause, precisely | Repo and file | Fix | Task id |
| --- | --- | --- | --- | --- |
| 1 | Not established. The build spends minutes before or around its first decision, and nothing records where. | - | Instrumentation (gap 1) first | t174 |

## Instrumentation gaps found

| Stage | What could not be answered | File that drops it |
| --- | --- | --- |
| 2 | Where an unfinished build's time went | No channel existed. Added: `runtime/llm/evidence-loop/progress-trace.ts` in Core, enabled with `FLUXIQ_BUILD_PROGRESS_TRACE=1`. It writes content-free tool and decision start/end lines to Core's stdout, which the Lab keeps as `logs/core.log`. Run 3 uses it. |
