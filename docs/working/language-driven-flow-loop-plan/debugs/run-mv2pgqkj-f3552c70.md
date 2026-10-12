# run-mv2pgqkj-f3552c70: paid proof R4a (second attempt), crossborder hub-to-cart with the flash deal (failed)

Full debug: [r4a-debug-run-mv2pgqkj.md](../../state-aware-recovery-plan/reports/r4a-debug-run-mv2pgqkj.md) on downstream
`dev`. It covers all 98 step folders, core.log, live-llm.json, and the 14-moment UI review.

## What it did

This was a candidate-mode build started from the extension chat. Task:
`crossborder-marketplace-hub-to-cart-flash-deal-during-build`, variant `flash-deal`, flash model, $0.10 ceiling, 48
decisions. The trees were Core `4842a4ac` and downstream `f583fd2a`, which include t419, t420 and t421.

- **Exploration:** the model closed the flash deal itself and accepted the cookies. It collected the coupon and chose
  Space Grey, 7-in-1 and Spain. It never typed into the quantity box.
- **Revision 4:** passed the static checks after four handle refusals.
- **Trials 1 and 2:** both failed at "set the quantity to three" with `web.target.not_found`, this time with no
  score.
- **Revision 5:** rebound every handle to a newer view and split the step into clear and type.
- **Trial 3:** resolved the box, then failed the clear step with `output_not_observed`, because the site puts "1"
  back.
- **Revision 7:** types "3" only. It was accepted, but the model called `complete` without testing it.
  `candidate.trial_required` was its 48th decision, which ended the build.

There was no judge and no promotion. The run used 49 calls and cost $0.0779; the first attempt used 34 calls and
cost $0.0525.

## Why it failed

**Decisive:** a created node's element identity
(`domain/src/runtime/llm-evidence/plan-resolution/element-identity.ts:83` and `:101-117`) leaves out the packet's
`label`. The quantity input has no accessible name; its only words are the nearby label "Quantity". So the step's
saved identity was just `{ tagName: "input", selector: "#fb1l6ufkg" }`, and that id rotates on every load.

- t419 dropped the absent selector, as designed. Nothing was left to score (`apps/extension/src/content/identity/score.ts:218`),
  so the failure carried no `bestScore`.
- t420's on-page reading (Core `candidate-trial/target-on-page.ts:94`) needs that score, so it never fired. The
  feedback stayed generic ("not found on the page"), and the model spent its decisions hunting a "stale handle":
  - 10 `already_answered`;
  - 1 `look_withdrawn`;
  - 4 unusable replies;
  - 1 retest that could only fail.

**Secondary:**
- Revision 5 resolved the box only because this scenario redraws the same id on every reset.
- The flash-deal step targets "Grab the deal" (t1052) rather than the deal's Close (t1048). It was never exercised.
- The cookie step's handle came back from memory (t1036).
- The model claimed "trial passed" for a revision it never tested.

## What changes next

- **Domain (the fix):** carry `label` (secret-safe, via `whole(element.label)`) in `WebPlanElementIdentity` and keep
  it across views. Consider `classNames` and the raw `id` too.
- **Test with the real identity:** rebuild t419's and t420's fixtures from the identity a created node actually
  carries, and assert that the R4a quantity box resolves, or at least yields a `bestScore`.
- **Report the dropped token:** let t419's dropped-token measurement reach the failure's `actual`, so a trial says
  the saved address is on no element.
- **Wording:**
  - the clear-step reason should read "the site set the box back";
  - "Choose" should also apply in exploration cards;
  - the final message should say the newest version was never tested.
- **Relaunch R4a** only after the domain fix is merged and the proofs tree is synced and rebuilt.

## What was done (2026-10-10, before the third attempt)

- t422, t425: one fingerprint builder (`domain/src/element-fingerprint/`, read from packets by
  `runtime/llm-evidence/packet-fingerprint/`) for recorded, model-built and repaired steps: tag, words, label, id,
  name, classes, role, input type and allowlisted attributes; a step with fewer than two identity signals is refused
  at save. The quantity box now saves its label "Quantity" beside the rotating id.
- t423: an interruption is dismissed through its way out, never its offer (a step pressing "Grab the deal" under
  `consequences: none` is refused); typing replaces a box's value, so no clear step.
- t424, t428: the clear step reads "it ran, but the site set the box back"; after a failed step the chat says what
  really comes next.
- t426, t431, t432: nothing the model reads says how a control was found (no selector, id, class, score, "address"
  or "fingerprint"); a failed control is named by its own words; the model is never asked for, or allowed to write, a
  selector. The "report the dropped token" item above was withdrawn under the user's rule that the model never handles
  fingerprints.
- t429: steps written in an in-run repair are resolved and fingerprinted like built steps.
- t430: a model's `consequences: none` never unlocks a second press of a committing act; the page decides.
