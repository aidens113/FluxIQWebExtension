# t193-wI: debug files for lane B runs 3-9

## Outcome

Done. Seven debug files are written under `docs/working/language-driven-flow-loop-plan/debugs/`. Each one has
every template section plus a UI review, and each is 83-97 lines long. Each file was built from its run's
`summary.json`, `evaluation.json`, `events.ndjson`, `snapshots/{flow-lane,live-llm,decision-trace}.json`, the
`logs/core.log` build trace, and at least three screenshots opened with Read. Overlay sample counts come from
the local `*.ui-review.local.json` beside each run from run 4 on.

## Per run

| Run | Stage | Cost (build, live-llm observed) | Top causes | UI defects |
| --- | --- | --- | --- | --- |
| 3 `munpjclw` | 2 | $0.1147, 64 calls | F confirmed: picks "succeeded", but the chip stayed Carden Falls. C: 13 repeats (report said 6-13). D: dry-run steps 40 failed, 41 and 43 unreproducible, all 8 times. N1: the model resubmitted the same draft 8 times and ran into the 64-call limit | Old card panel with no chat; "Done" shown mid-build (`00009`); no overlay; failure never shown (`00020`) |
| 4 `munri5gr` | 2 | $0.0643, 34 | H: 6 unchanged d7 amendments (report said 8). H2: dry-run steps 3 **and** 7 unreproducible, 8 and 18 failed. N2: decision 17 unusable with no code | "Using core.run_node" (`00008`); user message missing; "Build failed / Build failed" with no reason; time and step counts wrong (`00014`) |
| 5 `munutuvf` | 6 | $0.0670, 34 (+ verify $0.0020, repair $0.0109, re-author $0.0283) | I1 mechanism: store steps d4, d10 and d11 were amended out to pass the dry run. C4: breach on repair call 5, limit not recorded. N3: the full-name search returns nothing, and "+ Add" hit a popular-list item (soap). N4: re-author cost missing from live-llm | Grant prompt with raw `create_new` for a cart add (`00016`); prompt left open at failure (`00023`); counts wrong |
| 6 `munv9eqy` | 6 | $0.0890, 48 (+ $0.0021, $0.0113, $0.0278) | N5: accepted although the last dry run had 2 unreproducible and 2 failed steps. N6: Add to cart "succeeded" at 0.566 with no cart change. N7: no size or quantity; the build added napkins 100 Count. C4 | Raw ids (`00012`, `00030`); counters disagree (`00030`); no overlay at failure (`00038`) |
| 7 `munw16g4` | 2 | $0.0835, 43 | H: d3 amended 7 times unchanged. H2: steps 3 and 10 unreproducible. N8: a "Robot or human?" check appeared during the dry-run replay (`00009`) | "core.replay.unreproducible" shown to the user (`00009`); counts wrong, and duplicated text (`00015`) |
| 8 `munwdydi` | 6 | $0.0925, 50 (+ repair $0.0138) | I1: the Flow has no "Set as my store" (d3, d6 and d7 were amended out). N9: repair patch rejected `unexpected_field`/`unsupported_runtime_patch` with no retry. N6: s9 succeeded, but the cart stayed at 1 item | Raw node id in the status (`00020`); grant prompt; no failure reason (`00024`) |
| 9 `munwmt25` | 5 | $0.0541, 28 (+ verify $0.0021) | N5: accepted with dry-run step 15 failed; the Flow has **no towel step**. N3: empty towel search. N10: `unverified` counts as success, so no repair. N6: Add to cart absorbed the redesign at 0.566 | **"Run finished" with a green tick** while the goal failed (`00020`); raw node id (`00018`) |

Seen in every run: the Simple/Advanced toggle and the stale "To do: Add an AI model key" card, even while a
live key is in use. The overlay is absent at the start and at the first mid-build moment, and it flickers at
several moments. The user's instruction never appears as a chat message.

## What changed and why

- Created the 7 `debugs/run-*.md` files named in the brief, following `run-debug-template.md` and modelled on
  `run-munnq7vz-98c3481c.md`. Stage 2 groups turns and gives the counts. Stage 1 is copied from the lane
  report.
- New causes are labelled N1-N10, and the same label means the same cause in every file. Letters from the
  lane report are confirmed or corrected in each file's Causes table.

## Commands run and observed results

- Scratchpad extractors (`wI-digest.js`, `wI-trace.js`, `wI-rec.js`, `wI-rec2.js`) printed each run's steps,
  nodes, actions, dry runs, recovery stages and costs. The numbers in the files are copied from that output.
- Section check: all 7 files `sections=10/10`, 83-97 lines.
- `git status --short` shows only the 7 new debug files. The report file is new as well.

## Not verified

- The owning source files for N1-N10. I did not read any source, so those cells say `NO EVIDENCE of owning
  file` or cite the lane report.
- Which budget limit C4 breached, since the bundle records only `budgetBreach: true`.
- Which control each scored-candidate Add to cart pressed. It may have been Buy now.
- The final cart for run 9.
- Whether the dry-run reset clears the cart (run 4).
- The panel pictures in the `ui-review.local/` folders. I read only the bundle screenshots, and took the
  overlay counts from the JSON.

## Open questions or contradictions found

- The lane report's Runs rows have these errors:
  - Run 3: "decisions 6-13" should be 5 and 7-12, plus 6 later repeats. There were 8 refused completions, not
    one.
  - Run 4: it gave 8 unchanged amendments, but there were 6. It also left out unreproducible step 3.
  - Run 6: "the same as run 5" is wrong. Run 6's Flow kept a store pick and ran every node, and verification
    refuted it.
- The result re-author's calls (17 decisions, about $0.028 in each of runs 5 and 6) are not in the
  `live-llm.json` totals.
- In run 9, `live-llm.json` files the 2 verification calls under `repair`.
- C4 is not defined in the lane report's Causes table, only in the Runs rows.
