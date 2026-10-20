# Report: t741-e2e-office-r3 (provider-free reproduction of office r3's reset shape)

Tree: downstream `C:/Users/osrs_/FluxStuff/fxwork/t741/!FluxIQWebExtension`, branch `task/t741-rerun3-fixes`.
No commits. No Core file and no source outside the new spec were touched. The extension was not rebuilt.

## Outcome

Done. The new spec `apps/extension/e2e/site-reset/tests/office-address-confirm.spec.ts` passes headed,
using the installed extension, the real Core gateway and the scripted provider. It passed twice in a row
(runs 7 and 8). The office r3 shape does occur on the fixture. The checkout's "Deliver to this address"
press has no witness of its own:

- every start-state read of `/checkout` has 0 collections;
- the address radios are hidden when checkout is read, so the only checkout controls read are the 3
  that are always shown;
- the act's words carry no `on "<control>"`.

So the trial act falls under a-settle's adoption rule. Nothing had to be forced.

## What changed and why

- New `apps/extension/e2e/site-reset/tests/office-address-confirm.spec.ts`. It reuses the existing
  helpers through `../index`. No new helper file was needed, so `index.ts` is unchanged.
  - The scripted builder takes these turns:
    1. reads the cart complete; its ref is issued (`destination-N`);
    2. opens the product page;
    3. presses Buy Now with `create_new` and `resetDestination` set to that ref;
    4. clicks the address section's "Change", declared none;
    5. clicks the unchecked saved-address radio, declared none (office r3 declared that radio none too);
    6. submits a subflow: open the product, Buy Now (`create_new`), open the chooser and choose the
       address (both `consequences: none`), then confirm with "Deliver to this address"
       (`modify_existing`). The confirm is never pressed in exploration, as in office r3;
    7. tests revision 1;
    8. navigates elsewhere, so that only Core's own look reads the cart;
    9. submits revision 2, which adds a `capture_snapshot` step so the test runs a real trial;
    10. tests revision 2;
    11. completes.
  - A wrapper records every decision's `undoes` and `resetDestination`, what each turn had just been
    answered (codes only), and any refused submission. That made the first failures diagnosable.
  - The assertions:
    - the build ends `proposed`;
    - no builder decision carries `undoes`;
    - Core's looks declare nothing lasting;
    - only Buy Now declared a lasting class in exploration;
    - both tests are trials with distinct `trialRunId`s, answer `yes`, and test revisions `[1, 2]`.
      So the second test was not refused `candidate.trial_reset_required`;
    - in each trial, the step labelled "confirm the chosen address" succeeded. The page the trial left
      shows the chosen address as checkout's own address line, and the chooser is closed. That proves
      the confirm really changed site state;
    - Core looked before each trial (`looksBefore` is at least 1 each time);
    - the second test's pre-trial look read the cart, and every cart read has one hash;
    - the first trial's `startedWith.cannotUndo` is just the explored Buy Now;
    - the second trial's `startedWith.cannotUndo` is `[buy, trial Buy Now, trial confirm]`, and each
      entry carries `LEFT_UNCHANGED`. The confirm's words start with `trial step N`.

## Commands run and observed results

Every run used
`cd apps/extension && node --no-experimental-strip-types node_modules/@playwright/test/cli.js test -c e2e/playwright.config.ts e2e/site-reset/tests/office-address-confirm.spec.ts --workers=1 --reporter=list --output <scratchpad>/e2e-office-r3-<N>`.
Before running, I checked that Core's dist was newer than a-settle's source: `dist/.../site-reset/ledger.js`
is 07:54 against the source's 06:49, and it contains `issuedDestinations`. The extension dist is from 07:57.

| Run | Result | Cause, and what I changed |
| --- | --- | --- |
| 1 | Failed: `ending: failed`, `evidence_repeat_without_progress` | My radio regex `(?!.*checked)` also excluded "unchecked", so the builder threw at turn 5. |
| 2-4 | Failed the same way | The submission was refused. I added answer and refusal capture to find out why. |
| 5 | Failed: the refusal's `issueCodes` were `web.step.consequences_undeclared` and `web.step.expected.consequences_classes_or_none` | The chooser and radio script steps had no consequences line. I added `consequences: none` to both. |
| 6 | Failed only on my feedback assertion | The settlement shape already held: `looksBefore [1,1]`, tests `["yes","yes"]`. I had asserted `step.control === "Deliver to this address"`, but the confirm step's feedback carries no `control` (see open questions). I switched the assertion to the step label and added the page-after-trial address check. |
| 7 | **`ok 1 ... (1.0m)`, `1 passed (1.3m)`** | |
| 8 | **`ok 1 ... (1.0m)`, `1 passed (1.3m)`** | Stability re-run. |

The diagnostic line run 7 printed, which proves the settlement:

```
{"resetDiagnostic":{"ending":"proposed","failure":{},"tests":["yes","yes"],"revisions":[1,2],"looksBefore":[1,1],"started":[[{"act":"act-1","did":"click \"Buy Now\" button (left on the site; nothing it could change showed a change in fresh complete reads taken after it)","call":"buy"}],[{"act":"act-1",...,"call":"buy"},{"act":"act-4","did":"trial step 2 \"start the checkout\" on \"Buy Now\" (left on the site; nothing it could change showed a change in fresh complete reads taken after it)"},{"act":"act-7","did":"trial step 5 \"confirm the chosen address\" (left on the site; nothing it could change showed a change in fresh complete reads taken after it)"}]],"undoesSent":0}}
```

From run 7's `reset-office-r3.json`:

- **Outcome order:** `buy | chooser | choose | site-reset.look.1.arrival | trial.first.page | elsewhere | site-reset.look.2.arrival | trial.second.page`.
- **Reads during the second test call (`readsAtTest` = [8, 12]):** reads 12 and 13 are `/cart`, with
  the same hash as every other cart read; that is Core's look. Read 14 is the trial's `/checkout`.
- **After trial 1:** `leftOnSite` still listed act-7 as open, with no "left unchanged" words.
- **At trial 2:** act-7 was admitted as settled `unchanged`, with no builder call under `undoes`
  anywhere. That is the settlement by Core's own look.

## Not verified

- **A run without a-settle's change.** I may not edit or rebuild Core, so I did not prove that this
  spec fails against the old ledger. The old behaviour for this shape (a `name` refusal and
  `trial_reset_required`) is inferred from the office note and `t741-a-settle.md`.
- **Typecheck and lint of the spec.** The brief forbids typechecks. Playwright transpiled and ran the
  spec, which does not check types.
- **The judge's request text.** The scripted provider answers `loop_verification` without recording
  its context, so "reported to the judge" is proven through the trial answer's
  `startedWith.cannotUndo`, the field the brief names. The judge prompt itself was not inspected.
- **The multi-brief, entry-preparation variant** (office act-15/18) was not reproduced. This spec is
  a single brief with two trials. a-settle's Core test `project-ledger-entry-repeats.test.ts` covers
  entry preparation.

## Open questions or contradictions found

1. **The trial feedback drops the control name when a press reloads the page.** For the confirm step,
   `feedback.steps[4]` has no `control`, and the act's words read `trial step 5 "confirm the chosen
   address"` with no `on "Deliver to this address"`. Buy Now, Change and the radio all carry
   `control`. The difference is probably that this press reloads the page (`location.reload()` after
   the mutation), so the label is lost before it is recorded. This is outside my brief and I made no
   change. Without the control name, the judge and the model are told less about which control the act
   pressed.
2. **The second-revision trick still matters.** As office-buy-now notes, an unchanged revision is
   answered from the stored yes. This spec uses the same added `capture_snapshot` step.
