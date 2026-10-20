# t743-e2b-office: worker report

## Outcome

Done. I added one new spec. It passed headed twice in a row. I made no product, harness or shared-file edits and added no helper file.

## What changed and why

New file: `apps/extension/e2e/site-reset/tests/office-read-after-change.spec.ts`. It runs on everything-store with the scripted provider, in the installed environment that `office-address-confirm.spec.ts` uses, and copies that spec's exploration pattern.

1. **Exploration** (builder turns 1-5):
   - Turns 1-3: cart, then the Sage Green 1.7 L kettle's page, then Buy Now.
   - Turn 4 keeps the checkout page view as it stood when it arrived, before anything changed, and presses "Change".
   - Turn 5 reads the chooser's two radios. The checked one gives the original address words and the unchecked one gives the other address. The read handle is the line on the turn-4 page whose words equal the original address. On the fixture that is the bare `<p>` under the "Delivering to" heading (`t469 "..."` in both runs, with no role or tag prefix). Turn 5 then picks the other radio. Exploration never confirms and never reads.
2. **Submission** (turn 6): a Flow with these steps: open the product, Buy Now (create_new), Change, choose the other radio, "Deliver to this address" (modify_existing), then `step read: read the delivery address` / `node: web.dom.extract` / `target: <the handle from turn 4>` / `extract.mode: text`. The value is stored on the step's `value` output.
3. **Trial** (turn 7): `core.test_subflow` on the accepted revision. Turn 8 completes.
4. **Watching the wire:** after pairing, the spec wraps the Core client gateway's `executeAction` on its instance, without changing anything it does. It keeps each dispatched `web.dom.extract`: whether the command carries `readsWords`, plus the answer's status and `extracted` value. This shows what actually reached the extension, from the trial, which does not go through the builder's evidence runtime.

**What it asserts:**
- The build ends `proposed`.
- The turn-4 page showed the original words at the read handle, and the chosen address differs from them.
- The submission was accepted as revision 1 with no `web.handle.unidentifiable` issue.
- One trial, answered `yes`, whose `read the delivery address` step `succeeded`.
- Every dispatched extract carried `readsWords: true`.
- The last dispatched read returned exactly the chosen address line, and none returned the original line.

The diagnostic JSON records the handles, submissions, trial answers, per-turn answer codes, the dispatched reads (the extracted value only as `chosen` / `original` / digest), the tool outcomes and the page views.

## Commands run and observed results

Both runs used `cd C:/Users/osrs_/FluxStuff/fxwork/t743/!FluxIQWebExtension/apps/extension && node --no-experimental-strip-types node_modules/@playwright/test/cli.js test -c e2e/playwright.config.ts e2e/site-reset/tests/office-read-after-change.spec.ts --workers=1 --reporter=list --output <scratchpad>/e2b-office-N`. The browser was headed: the fixture launches with `headless: false`.

- **Run 1** (`.../scratchpad/e2b-office-1`): `ok 1 ... (50.6s)`, `1 passed (1.3m)`. Diagnostic line:
  `{"resetDiagnostic":{"ending":"proposed","failure":{},"submissionIssues":[],"trial":["yes"],"readStep":"succeeded","readsShown":[{"readsWords":true,"status":"succeeded","ok":null,"code":null,"extractedIs":"chosen"}]}}`
- **Run 2** (`.../scratchpad/e2b-office-2`): `ok 1 ... (50.9s)`, `1 passed (2.0m)`. The diagnostic line was identical to run 1.
- In run 1's diagnostic, every builder turn's previous Core answer was `ok: true` with no issues (turns 1-8). Exactly one extract was dispatched, and it was the trial's.

## Not verified

- **I could not show that the spec fails without the t743 fix.** Reverting product code (`veto.ts`, `read-identity.ts`, `targets.ts`) is outside my Owns and would need a rebuild, which the brief bars. The office run's debug and the d2b and w reports are the evidence that an unmarked bare paragraph read was refused before.
- **The selector-drift path was not exercised.** The read resolved after the confirm's reload, and the selector most likely still matched the `<p>`, so the veto's handling of the mark was what ran. `read-lookup/` (the path after a selector miss) was not.
- **The saved candidate was not read.** `readsWords` is checked on the command the gateway dispatched, which is built from the saved target. I did not read the stored plan itself.
- No live (paid) run, no other scenario, no typecheck or build (barred by the brief).

## Open questions or contradictions found

1. **The trial feedback names the read step by the old words.** It names it with `control: "<original address>"`, which is the saved identity's words. The step succeeded and read the new address, but the feedback shows the model the value as it was before the change. That is consistent with "the words stay", but a model reading the feedback could mistake it for what was read. Whether feedback should label a `readsWords` target differently is for the lead to decide.
2. **The answer shape has no top-level `ok` or `code`.** The dispatched extract's answer carries `status: "succeeded"` and `extracted`, so the diagnostic's `ok`/`code` are `null`. This does not affect the assertions.
