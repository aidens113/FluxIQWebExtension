# Debug: run-mvcxf4uz-64cd322c

- Instance: bf-slot-2, task `crossborder-marketplace-free-hubs-under-ten`, authoring mode `project` (breadth round,
  2026-10-17), lane tree `fxwork/t565`, with lane 2's fixes 1-2 (covered-press advice, Core repeat note) built in;
  not fix 3 (decision grammar). Steps: 58. LLM calls: 28.
- Verdict: **failed**, no Flow created. Billed $0.0170 of $0.25 (supervisor $0.0069, builder $0.0100).
- How far it got: plan written on the fifth try, then three briefs. Each stopped on the start page, same as r1.
- Cause, the same as r1 (`run-mvcwem7d-34689f55`): **the builder pressed the cookie bar's "Reject non-essential"
  (`t474`) under the welcome modal (`t476`) about five times in each of three briefs, and never pressed the modal's
  closers.** This time the advice was explicit and survived repeats. Each `covered_by_layer` answer (0017, 0019, 0036,
  0049, 0051) carried `closeWith: [t478, t488]` and "Nothing was done: layer t476 covers t474. Press t478 or t488
  first; it closes that layer. Do not press t474 again while t476 covers it ...". Each `repeat_refused` carried
  Core's new covered note. The model's summaries still read "Close the cookie layer with its own reject control".
  So better words do not move this model. Fixes 1-2 are right but not sufficient.
  - The builder's own system instructions (`domain/.../system-instructions/instructions.ts`, "Popups") tell it to
    press the wanted control even when covered, then press a closer from `closeWith`, then press again. It is a
    two-step dance that the runtime, not the model, already knows how to do. In playback, the extension's press
    refuses a covered target at its actionability gate. Recovery then presses the covering layer's way out
    (dismissal allow-list: "No thanks", "x") and spares the layer holding the target, then presses again
    (`apps/extension/src/content/actions/execute.ts` 175-181, `click.ts` 189-192). In exploration, the domain refuses
    the covered press before sending it (`node-run/run.ts` 298, C4), so that defence never runs.
- Also seen: 4 plan replies refused `llm_output.unexpected_field` before the fifth was taken (0003-0010), the same
  `reason`-beside-`input` misplacement as r2. Fix 3 now folds it.
- UI review (chat): three brief returns and the supervisor's honest ending ("Three identical build briefs were
  blocked by the cookie overlay ..."). The supervisor's account is wrong about which layer: it blames the cookie
  overlay covering "Accept all", which is not what the refusals said. Otherwise the same as r1.
- Fix 4 (lane 2, domain, general): a press on a control covered by a layer with a dismissal closer is sent, not
  refused. The runtime's own defence (the actionability gate, then recovery's `pressWaysOut`) closes that layer and
  presses, exactly as in playback, and the result says what it cleared. A cover with no dismissal closer, or a
  person-only layer, is still refused as today (C4). The "Popups" instruction says so.
- Next: rerun on the changed source once fix 4 is verified.
