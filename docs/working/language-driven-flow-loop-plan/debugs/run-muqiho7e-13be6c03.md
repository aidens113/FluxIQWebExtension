# run-muqiho7e-13be6c03: earbuds, chat-driven; every list read refused as not JSON (2026-10-02, t194 run 14)

- **Run:** `everything-store` / `everything-store-plus-earbuds-under-50`, instance `t194-slot-3`, headed, chat-driven, default
  model, no cost flag; trees at dev (Core `eed0cc34`, downstream `5261aa8e`: F42, t235 names-only catalog and
  `core.describe_nodes`, t237 web system instructions, t234 one $0.10 purse per Flow, lanes A/B/D's fixes, lane B's stable
  prefix). Step log `C:/Users/osrs_/FluxStuff/lab-runs/2026-10-01/run-muqiho7e-13be6c03/steps/`.
- **Verdict:** failed, no Flow (`lab.chat_build_failed`): the build ended "at its limit of 2 repairs, while each repair was
  still getting further". **Cost $0.0880** (ledger `finish`), 28 decisions (15 build, 13 in two repair rounds, 2 of them
  malformed), 6 judge calls, 1 chat call.

## The first decide step (supervisor's checks)

`steps/0003-decide/request.txt`: the system message (5,634 chars) carries the web instructions (reading the page view,
finding things, popups, lists, limits, efficiency); `nodeCatalog` is names only with `nodeCatalogNote` and
`core.describe_nodes` offered. The request body is **40,529 characters** (`request.json`), not ~27 k: of the user message's
32,796, the decision schema is 14,642, evidence (the opened page) 8,872, tools 6,772, catalog 5,180 (t235's area).

Request bodies as reads accumulate (characters / input tokens / cached): 0003 40,529 / 9,707 / 0; 0009 65,104 / 17,242;
0017 86,413 / 24,423 / 16,768; 0029 108,161 / 30,676 / 24,192; 0031 (complete) 109,800 / 31,160 / 24,320; repair rounds
restart at 71,045 (0040) and reach 109,692 (0058). Per decision $0.0016-0.0078; the cached share is 75-80 % once warm.

## (a) What the judge said, and whether it was right

All six judge calls (0037/0038, 0067/0068, 0078/0079) said the same in substance: "The Flow only navigates to the store,
dismisses two popups, and types a search" / "a five-step navigation stub". **Right**: the Flow had no list read, so it
returned 0 rows against the 13 expected.

## Why the Flow never had its read

**Every list read's result was refused by Core before the model saw it.** The read ran and succeeded on the page
(`steps/0018`, `0020`, `0024`, `0026`, `0028`, `0030`: `web.inspect.succeeded`), but the model was shown
`ok: false, code: llm_evidence_loop.tool_result_invalid.evidence_not_json ... This call failed and returned no evidence`
(`steps/0019-decide/request.txt`, the `extract-page2-1` entry). Cause: F42's read account
(`domain/src/runtime/llm-evidence/node-run/shown-rows/account.ts`) put the first three row objects into `firstRows` by
`slice`, so the same objects sat in `firstRows` and `extracted`; Core's decision parser checks evidence with a JSON walk that
never clears its `seen` set (`runtime/llm/evidence-loop-decision.ts` `isJsonValue`), so an object met twice reads as a
cycle and the whole result is refused. The model re-ran the read five times ("rerunning the list extraction with a
corrected argument"), then completed "from the draft steps already added" (`0031`): a Flow without its read.

**Fixed, F43** (lane C's regression from F42): the domain copies the first rows; Core's check refuses only a true cycle
(`seen` holds the path being walked). Both new tests fail on the old sources.

## The user's question: "it read list like 5 times in a row on the same page"

Real calls, not a chat display defect: six `web.output.dom-extract_list` calls (05:22:24-05:22:59 UTC: `extract-page2-1`,
`rerun.9`, `rerun.9.2`, `rerun.12`, `rerun.13`, `rerun.14`), each a full paged read that succeeded on the page, each
refused by Core as above, so the model never saw a row and tried again. The chat showed each as "Read list · the page --
Done" (`screenshots/00009-c38f58031253.jpg`), which was true of the page and false of the build. The test replays at
0032-0036 and 0061-0066 are the dry runs of the navigation steps (navigate, two dismissals, type), not reads. UI defects
for t191/t174: a card says "Done" for a call whose result Core refused; "the page" names neither the list nor the page.

## (b) Were the repair rounds converging?

No. Both repairs met the same refusal on every read and handed back another navigation-only Flow; the judge said the same
thing each time. They counted as "getting further" only because, with a judge, `automationStudioFlowBootstrapJudgementAdvanced`
(`runtime/flow-bootstrap/unfinished-build/judgement.ts:207-208`) treats any change of the Flow's replay signature as
progress (a six-step stub became a five-step stub). Proposal, not applied: let the purse be the stop for repair rounds
(no fixed count) only together with a stronger progress test under a judge: a repair advances when more of the checklist
is done or the judge's refutation changes in substance (e.g. its missing acts shrink), never by a different but equally
wrong Flow; keep the no-progress stop. On run 14's evidence the fixed cap stopped a loop that was not converging.

## Other

- Two malformed provider replies in the repair (0054, 0055).
- The first decide request is 40.5 k characters with a 14.6 k decision schema (t235).
