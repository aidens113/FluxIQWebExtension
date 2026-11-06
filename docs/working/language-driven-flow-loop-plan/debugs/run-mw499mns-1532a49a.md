# Debug: run-mw499mns-1532a49a

Status: Failed before any provider call (`process.startup`: "Core web panel production build did not succeed"). Lane B's tenth launch (t876, slot-2): 0 steps, 0 model calls, $0. Nothing about the product was measured.
Source: Core ca7a27921 (with `$row.url`), built for this launch / Downstream 6e816be2e plus the uncommitted run-9 debug note.
Task: everything-store-batteries-and-descaler as an attempt-2 pair (`--attempts 2`), Haiku, `--llm-max-cost-usd 1 --llm-cost-ceiling-usd 1`.

## Result and distance reached

The prelude finished: domain, host, extension and test-runner were rebuilt in 200 s. The run then started its isolated Core at about 16:48, and the Core web panel's production build failed about 6 minutes later. No browser opened, no instruction was typed, and nothing was spent.

## Cause

Most likely lane B's own supervisor, not the product. Core's web build is keyed by Core's inputs and builds from the Core tree at startup. While it was building, from about 16:52, the supervisor was editing Core source for the act-label fix (`answer-first/act-record/`: `read-answer.ts`, `act-gate.ts`, `contracts.ts`, `record.ts`, `item-names.ts`, and deleting `page-words.ts`). The supervisor had treated "past the prelude" as safe for Core edits. It is not: the Core web build happens after the prelude, inside "starting an isolated Core". The build's own log was not found in the run's folder, so this is the likely cause, not a confirmed one. The other candidate is low free memory on the machine (the lead reported about 0.5-1.3 GB free during the four lanes' rebuilds, with this build alone taking about 1.6 GB). Only a local check that fails for lack of memory is re-run without tracing. A failed live launch is traced, and this note records both candidates.

## Repair

A process rule, not code. Lane B edits Core source only after a run has opened its visible Chrome, because by then Core's web build is done. It never edits while a run is "starting an isolated Core". The next launch rebuilds from a finished tree.

## Next

Finish and verify the act-label fix, rebuild, then rerun this pair.
