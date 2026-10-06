# t193-1003-w1: Full Debug of `run-musp4h2f-72e8ed99`

Worker t193-1003-w1 (worker-high), 2026-10-03. Brief: t193-1003-w1-debug-run-musp4h2f. Read-only apart from the two
files listed below.

## Outcome

Done. Every field of the template is filled in
`docs/working/language-driven-flow-loop-plan/debugs/run-musp4h2f-72e8ed99.md`. Where the evidence was missing, the
field says `NO EVIDENCE:` and names what was needed: the final cart after the last test press. All three lead
findings are confirmed, two of them with corrections.

## What changed and why

- **New: `debugs/run-musp4h2f-72e8ed99.md`**, copied from `run-debug-template.md` and filled in. It holds:
  - Stage 1, copied from `reports/t193-lead-1003.md`.
  - Stage 2: 62 rows (the chat read 0001, 60 decisions and the instruction read 0033), grouped by round with each
    round's decisions and cost. Every refused amendment is listed with its reason code, the answer text quoted from
    the decision dumps, and whether that answer was enough.
  - Stage 3/4: the node list of each of the four tests with real parameters, and the outcome of every step.
  - Stage 5: the cart tabulated from page views, each change attributed to its step.
  - Stage 6: the six judge calls.
  - Lead findings A-C checked, carry-ins C4-C18 checked, a UI review (14 defects), 17 causes and the instrumentation
    gaps.
- **New: this report.**
- Nothing else was edited. Core's working tree already had uncommitted edits by someone else to `action-permissions.ts`,
  `verify-only.ts`, `summary.ts`, `observation.ts`, `progress.ts`, `not-finished.ts`, `judgement.ts` and
  `contracts.ts` (modified 18:17Z and later, after the run). I did not touch them. Because the run used `dist` built
  at 17:45Z from HEAD `6beae684`, every Core citation is `git show HEAD:…`.

**Findings in brief**
- **A, confirmed.**
  - At HEAD, `action-permissions.ts` l.249-256 matches by quote substring only.
  - Read 0033's `create_new` quote is the whole joined clause. The split acts' quotes are neither contained in it nor
    contain it, and this does not depend only on ", both for pickup": the split re-attaches "to my cart" to a2 and
    gives a3 its own "add one pack".
  - The dist parser does give a2 and a3 `kind: add_to` (I ran it), but HEAD ignores the kind.
  - Result: Add to cart was pressed in every test, at `S/0122`, `0128`, `0159`, `0165`, `0170`, `0191` and `0197`.
- **B, confirmed.**
  - At HEAD, `summary.ts` l.200 sends `observed` only for non-mutating steps or checked ones.
  - `S/0190`'s `t932 "2" was "1"` and `S/0191`'s "Qty 2 · Pickup" were both dropped.
  - In judge 0198's request (l.418-425), step 9 has no `observed`.
- **C, confirmed, with one correction.** The split pair is round 3's (0198 no, 0199 yes), not round 2's (0171/0172
  were no, no).
  - At HEAD, `progress.ts` l.51 counts nothing for a change from `no` to `unknown`.
  - At HEAD, `not-finished.ts` l.92 says "still could not judge it" after a `no`, and l.46 gives "what is left" only
    for a `no`.
- **Cart.** The person ended with 13 items, $198.67 (inferred), against 4 items, $43.39:
  - towels: 8 (one exploration press plus three test presses);
  - two shipping-only "250 Count (3-Pack)" packs;
  - two single 250 Count packs.
- **Carry-ins.**
  - C4 recurred. a3 was named on a search-type step, then a3 and a3.size on the 3-Pack link.
  - R2-C8 and R2-C9 were not seen, because finding A masked them.
  - C13, C14, C16, C17 and C18 recurred. C18: four cache collapses, about $0.0031. C17 did no harm: s7 is not
    optional in the final flowShape.
- **New causes beyond the lead's**, detailed in the debug's Causes table:
  - `bind_new_key` compares a bind against `ranWith` while the draft shows `target`, so the answer told the model
    something false. It cost 6 decisions and stalled round 0.
  - The `already_in_flow` and `already_out` answers carry no `next`.
  - "both for pickup" is not parsed into a choice, so the 3-Pack satisfied the checklist.
  - When an act moves, the old Add to cart press is left in the Flow with no act.
  - Dropping a step does not drop the steps that act inside the layer it opened.
  - `consequences` placed inside `parameters` is accepted silently. This one is PLAUSIBLE only.

## Commands run and observed results

- `python <scratchpad>/w1/dump.py` dumped all 199 step folders to `<scratchpad>/w1/dump.txt` (1,415 lines). I read all
  of it.
- Per-round cost summed from `meta.json`:
  - explore r0: 15 calls, $0.020596;
  - read: $0.000192;
  - repair r1: 32 calls, $0.046296;
  - repair r2: 9 calls, $0.013140;
  - repair r3: 4 calls, $0.007380;
  - judge: 6 calls, $0.004238;
  - chat: $0.000147.

  These match `live-llm.json` `runSpend` (build 60 calls, $0.087412194; total $0.091989786).
- I fitted token prices from three calls and got $0.003/M cached, $0.15/M uncached and $0.60/M output. The fit
  reproduces 0005, 0130 and 0180 exactly. On those prices the cache hits lost at the four collapses cost $0.003086.
- `node <scratchpad>/w1/acts.mjs` ran `automationStudioInstructedActs` from Core `dist` on the instruction. It printed
  a1 `set`, a2 `add_to` (quote "…12 Double Rolls size to my cart, both for pickup", choices quantity and variant) and
  a3 `add_to` ("add one pack … to my cart, both for pickup", choice variant).
- The `dist` `action-permissions.js` l.158-167 has no `LASTING_KINDS`. Its mtime is 10:45:51 PDT, and the source
  mtimes are 11:17 PDT and later.
- `git show HEAD:` was used on `action-permissions.ts`, `summary.ts`, `progress.ts`, `not-finished.ts`,
  `agreement.ts` and `amendment.ts`. The lines are cited in the debug.
- `git status --short` in Core listed the uncommitted files named above. I did not run `git diff` on their content
  beyond `--stat`.
- The decision dumps were parsed for `core.resumed`, `core.amendment_check.*`, `core.repeat_check.15`, `core.budget`,
  the last `core.flow_draft` of each round, the per-iteration placement of acts in round 1, and the `check` events.
- I diffed request files at each cache drop (`cmp` / `diff`). The first differing lines were user l.152, l.202, l.444
  and l.261.
- I viewed these screenshots: 02, 03, 04, 05, 06, 08, 09, 10, 12, 13, 14, 16, 19 and 20 panels, and the 03, 04, 12
  and 20 scenario pictures. From the UI-review `.json` I parsed all 20 moments: overlay text, rects, pageLoads and
  takenAt.

## Not verified

- The final cart (13 items, $198.67) is inferred from the arithmetic of the observed header values. No page view
  exists after `S/0197`.
- I did not view the panels for moments 01, 07, 11, 15, 17 and 18, or 16 of the scenario pictures. Their overlay
  text and rects were read from the `.json`.
- Cause 13, the misplaced `consequences`, was not traced through the permission gate.
- For R2-C9, I did not check whether a fixed A leaves s13 "Continue shopping" excused. The expectation that it would
  rests on its merge after s13 in the flowShape.
- I did not identify exactly which steps round 1's 0046 dropped (targeted d9-d11).
- I did not run any Core or downstream tests. The brief named no checks.

## Open questions or contradictions found

- The brief says "round 2's split (no, yes)". The split was round 3's judging (0198/0199); round 2's pair (0171/0172)
  was no, no. Perhaps the brief counted repairs from 0.
- The brief calls 0033 "the instruction read". It was made lazily, at 18:04:29Z, after round 0's exploration and
  before its test, and its own summary says "before any page work begins".
- Answer folder `S/0073` says `applied` for decision 0072, but that decision's rerun was refused (`S/0074`). A reader
  of the answer folders alone would think the rerun ran.
- Core's working tree holds uncommitted fixes for A-C by another agent. The supervisor should know that those files
  are in flight before assigning more work on them.
