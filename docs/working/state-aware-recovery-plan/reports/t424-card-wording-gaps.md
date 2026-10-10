# t424: card wording gaps after t421

## Outcome

Done for both findings. Nothing committed. One extension test outside this brief's ownership fails, and it
was already failing before this change (see Open questions).

## What changed and why

Evidence: R4a attempt 2, `run-mv2pgqkj-f3552c70` (steps 0018-0024, 0074, 0092; UI review moments 04 and 12).

1. **Exploration said "Tick" for swatches.** The model's exploration `core.run_node` calls carry only
   `target: { handle }` (steps 0020/0022/0024: `t940`, `t951`, `t958`), never the `element` a saved step
   carries. So Core's `chosen()` in `runtime/activity/wording/action.ts` saw no element, applied its "no element
   = box" rule, and said "Ticking". Trial calls carry the saved element (no role, no input type), so they read
   "Choose". The page view the model was shown printed those handles as `t940 clickable "Space Grey" marked`
   and so on.
   - Core `runtime/activity/call-context.ts` now also records, for each handle a view printed, the kind word
     the view printed before the name. It keeps the word only when it tells a box from an option
     (`checkbox`, `switch`, `radio`, `option`, `tab`). Any other word, `clickable` included, or no word at
     all is kept as `""`, meaning the element says neither. A new `role(call)` accessor returns it.
   - `observer.ts` `describedOf` now adds that `role` to the call words in every case. Before, it returned
     early whenever the domain's `describeCall` gave a target, which it did in this run.
   - `AutomationStudioActivityCallWords` gains `role?`. `chosen(parameters, words)` uses the carried element
     when there is one, and otherwise `{ role: words.role }`, under the same BOX/CHOICE/neither rule as before.
     A call with neither an element nor a printed role is still a box.
   - Result: the exploration titles now read "Choosing “Space Grey”" and so on. `action-of.ts`'s existing
     title override turns that into the card "Choose · Space Grey". The extension's `card-words.ts` takes the
     name from Core's `activityActionOf`, so neither it nor the Chrome side panel or Firefox popup needed a
     change.
2. **"the site set the box back" did not show.** There were two causes:
   - **The kind did not match.** The overlay's "A step didn't work in the test: …" comes from
     `activityActionOf(...).why` on the run's "Recovering from a failed step" row
     (`runtime/activity/step/recovering.ts`, phase `repairing`). `action-of.ts` gives every `repairing` row
     the kind `repair`, so `activityActionFailureReason` never received `type`. A new `reasonKind()` in
     `action-of.ts` words a `repair` row's reason for the failed step's own kind. It reads that kind from the
     row's `Node:` (`web.output.dom-clear`, which is `type`) or its title. The card's kind itself is unchanged.
   - **The code was not one the outcome readers treat as a failure.** The clear step really returned
     `web.validation.output_not_observed` (step 0092: `failureCode`, 4 attempts, "the field holds \"1\""),
     not t421's `web.action.rejected.output_not_observed`. Core's `FAILING` (`action-of.ts`) and the
     observer's outcome regex did not match it, so a tool row with that code read "done". Both now match
     `not_observed|state_mismatch`.
   - **Extension changes.** In `shared/activity/wording.ts`, `toolOutcome` read
     `web.validation.output_not_observed` as "done". It now reads a ran-but-unseen code as
     "that didn't work: <Core's card why>" (`activityActionOf(event).why`, which carries the kind). In
     `shared/activity/not-tried.ts`, a `rejected.output_not_observed` code read
     "not tried: it ran, but …", which contradicts itself, and is no longer counted as not tried.

Tests, each rebuilt from this run's rows:
- Core `activity/tests/call-context.test.ts` has 2 new tests. They use the real view lines and the
  `pick.*` calls, with the domain's `describeCall` words kept, and expect "Choose" ×3. A printed
  `checkbox` and an unprinted handle still read "Ticking".
- Core `activity/step/tests/recovering.test.ts` is new. It covers the real recovering row (`n9`,
  "clear the quantity field", `web.output.dom-clear`, `web.validation.output_not_observed`), whose why is
  now "it ran, but the site set the box back", and a click with the same code, which keeps the page's words.
- Core `ui/activity-action/tests/action-of.test.ts` has 1 new case for the real code.
- Extension `shared/activity/tests/wording.test.ts` has 1 new test covering a clear with each of the two
  codes, a type, and a click.
- Run against the original Core sources (restored by copy afterwards), the two new Core observer and
  recovering tests fail: `Tests 2 failed | 9 passed`.

## Commands run and observed results

- Core `npx vitest run src/ui/activity-action src/programs/automation-studio/runtime/activity`
  (packages/fluxiq) -> `Test Files 48 passed (48)`, `Tests 537 passed (537)`.
- Core `pnpm run check` (packages/fluxiq, tsc --noEmit) -> finished with no error output.
- Core `pnpm run build` (packages/fluxiq) -> built, because the extension consumes dist.
- Core `node scripts/structure-audit.mjs` -> `structure-audit: passed (322 warning(s), 1160 baselined).`
- Extension `EXTENSION_TEST_BUILD_LABEL=t424 node scripts/test-extension.mjs panel/chat shared/activity`
  -> `# tests 379`, `# pass 379`, `# fail 0`. The first run failed only on the new test, which then led to
  the `FAILING` fix.
- Extension `npx tsc --noEmit -p .` (apps/extension) -> exit 0, no output.
- Extension `node scripts/structure-audit.mjs` -> `structure-audit: passed (184 warning(s), 651 baselined).`
- Extension `... test-extension.mjs background/activity content/activity-overlay` (extra, outside the
  brief) -> `# tests 183`, `# fail 1`. See below.

## Not verified

- No live or paid run, and no browser check. The words were checked through unit tests only.
- The extension bundles were not rebuilt (`pnpm run build` in apps/extension). The Lab needs that rebuild
  before a live round.
- A swatch the page draws as a `<button>` prints `button`, which this reads as "says neither" and so
  "Choosing". A real `role="button"` toggle checked by `web.dom.check` in exploration would also read
  "Choosing", while a saved step with an explicit `button` role reads "Ticking". The printed `menuitem`
  cannot tell `menuitemcheckbox` from `menuitemradio`, so it is also read as neither.
- Core apps/web and other Core folders were not run.

## Open questions or contradictions found

- **Pre-existing failure, not owned:** extension
  `apps/extension/src/background/activity/tests/candidate-trial.test.ts:65` expects
  "A step didn't work in the test: it wasn't on the page" for `web.target.not_found`. Since t421 Core says
  "FluxIQ couldn't find it where it was saved". This change does not affect that string, because not_found
  has no kind-specific words. It needs a one-string update by whoever owns `background/activity`, like the
  Core apps/web `messages.test.ts:80` case t421 reported.
- The chat card that settles a failed trial step may itself show the kind "repair". Only its `why` was
  changed here.
