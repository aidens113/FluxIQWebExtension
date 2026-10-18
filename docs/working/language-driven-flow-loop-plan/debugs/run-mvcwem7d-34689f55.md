# Debug: run-mvcwem7d-34689f55

- Instance: bf-slot-2, task `crossborder-marketplace-free-hubs-under-ten`, authoring mode `project` (breadth round,
  2026-10-17, downstream `fb3919e2` / Core `76d66fe8`), lane tree `fxwork/t565`. Steps: 35. LLM calls: 17.
- Verdict: **failed**, no Flow created (`lab.chat_build_failed`). Billed $0.0114 of $0.25 (supervisor $0.0038, builder
  $0.0074).
- How far it got: plan written and one subflow briefed. Both briefs stopped on the start page. Nothing was searched.
- Cause: **the builder pressed a control under a covering layer five times in each brief, and never pressed the layer's
  own close.** The start page opens with two layers. A "Welcome back" coupon modal (`t476`, closers `t478` "x" and
  `t488` "No thanks") has a backdrop that covers the cookie bar. The builder tried to answer the cookie bar first: it
  pressed `t474` "Reject non-essential", which is `covered-by t476`.
  - First answer (0011, `covered_by_layer`): `closeWith: [t478, t488]` and next "press one of closeWith to close it,
    then make this same call again, unchanged". The model made the same call again, unchanged, on the very next
    decision (0012).
  - Second answer (0013, `answered_the_same_again`): **`closeWith` was gone**, and next fell back to the generic
    "close or answer it with one of its own controls on the page". `repeatedRejectionDetail`
    (`domain/src/runtime/llm-evidence/repeated-refusal.ts`) restates every detail member by name but omits
    `closeWith`. That is the very drop its own header warns about. The page lists the cookie bar's controls
    immediately before `t476`. Told to use "its own controls on the page", the model kept reading `t474` as one of
    them ("Close the cookie banner and welcome popup with their own dismiss controls").
  - Then three `llm_evidence_loop.repeat_refused` (0015, 0017, 0019), whose note is the generic "do something
    different". The brief ended, and the supervisor re-briefed: "dismiss the overlay first". Brief 2 did the identical
    sequence (0023-0032). The supervisor ended the build honestly (0035).
- Not the cause: the runtime's own layer clearing (`apps/extension/src/content/actions/execute.ts`, recovery
  `pressWaysOut`). It never ran, because the domain refuses a press on a covered control before sending it
  (`node-run/run.ts` 298, C4 of `run-mup2i28c-6c7fc209`). That refusal is by design, and its advice is what failed.
- UI review (chat): the plan card, the two brief returns and the supervisor's ending each posted in order, with
  reasons. The ending is said twice, back to back: the bold "The supervisor ended the build" card, then the plain
  "The build failed: ..." message with the same sentence. The toast repeats it a third time. Nothing misleading was
  shown; the duplication is noise.
- Fix (lane 2, general, no scenario words):
  1. Domain: a repeated refusal keeps `closeWith` (`repeated-refusal.ts`).
  2. Domain: the covered-press `next` names the closers and the order explicitly: press a closer first; pressing the
     target again while the layer covers it is refused the same way. It no longer ends on "make this same call again,
     unchanged" (`rejection-next/next-sentence.ts`).
  3. Core: the repeat guard's note for a covered press says the layer must be closed first, and that the earlier
     answer names its closers (`repeat-guard/feedback.ts`).
- Next: rerun this task on the changed source.
