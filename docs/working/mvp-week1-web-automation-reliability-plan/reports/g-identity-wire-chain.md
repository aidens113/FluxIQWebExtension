# Report: g-identity-wire-chain

## Outcome

Done. A new content-harness spec, `identity-wire-chain.spec.ts`, now carries
rows R5 and R6 from `i-resolver-safety` permanently. It takes a real recorded
click on the baseline Save and passes it through HEAD's wire projection, the
domain's Flow-node builder (which calls `elementFingerprint`) and the domain's
command mapper, then replays it against `reworded-aria`. Both rows pass. The
mutation that projects with `1b6f5df`'s 17 keys fails both rows at exactly 0.197,
confidence 0.173. The new file's import path passes the structure audit. Every
row in the `identity-*.spec.ts` family passes except one. That row is in
`identity-signals.spec.ts`, a spec another worker added while I worked; it fails
the same way when rerun alone. The stale sentence in `identity-fixtures.ts` is
corrected.

## What changed and why

**Re-verified at HEAD first.** No wire-chain spec existed. The sentence in
`identity-fixtures.ts` was stale: it said `output-nodes/targets.ts` drops
`implicitRole`, but `elementFingerprint` now keeps `implicitRole`,
`accessibleName`, `label` and `context` (`domain/src/output-nodes/targets.ts:140-148`
as the file stands now).

**`apps/extension/e2e/content/tests/identity-wire-chain.spec.ts` (new, 120 lines).**
One describe block with two rows, which differ only in the shape of the replayed
command. Each row does the following:

1. **Records a real click** on the baseline Save with `setRecording`. It keeps the
   `dom.click` whose `metadata.sourceEvent` is `pointerdown`. The recorder sends
   two `dom.click` events per press (`content/dom-events.ts:52` and `:70`), and
   `PointerClickFilter` keeps whichever arrives first. The press arrived first
   (sequence 2 against 3), and both events carried identical elements.
2. **Asserts the recorder captured both signals the old wire dropped**
   (`testId`, `accessibleName`, `implicitRole`). A loss upstream of the wire
   therefore fails at this step, not in the score.
3. **Calls `gatewayRecordingEventFromPayload`**, then
   `webAutomationOutputPayload("web.dom.click", event.payload)`, which calls
   `elementFingerprint` at `payloads.ts:40`.
4. **Arms `reworded-aria`**. `set-mode` resets `saveCount` and `discardCount`,
   so the recording click is not counted.
5. **Replays the click in one of two shapes:**
   - (a) the node's `selector` plus `options.element`, which is R6a;
   - (b) the whole command from `webAutomationActionFromGatewayCommand`, with
     the recorded visual target, which is R6b.
6. **Asserts the reply in one `toMatchObject`**: `succeeded`, `scored-candidate`,
   `candidateCount 2`, `bestScore` close to 0.389 and `confidence` close to 0.366
   (3 digits), plus the resolved element. A failure therefore prints the status
   and the scores together. It then polls the fixture state for
   `savedInMode reworded-aria, saveCount 1, discardCount 0`.

Four design decisions:

- **Import path.** `elementTarget` is private in `gateway-payloads.ts`. The
  projection is reachable only through `gatewayRecordingEventFromPayload`, which
  I import from the directory barrel, `../../../src/background/connection/index.js`.
  Importing `gateway-payloads.js` directly would reach past that barrel, which
  `scripts/structure-audit/rules/imports.mjs:126-137` counts as a failure. No
  module in the barrel touches `chrome`, `document` or `WebSocket` at load (a grep
  found none), and the spec loads in Playwright's Node worker. The domain functions
  come from the public entry `@fluxiq-web-extension/domain/client`.
- **I went further than the brief's wording.** It asked for "the recorded
  descriptor through HEAD's wire projection and the real `elementFingerprint`".
  I used a click recorded by the real recorder, where the sibling specs read a
  descriptor through `web.dom.extract`. I also built the node and the command with
  the domain's own shipped functions. Both of those call `elementFingerprint`, so
  nothing on the extension-and-domain side of the chain is restated by hand.
- **Timing, found by running it.** `locator.click()` can return before the page
  handles the mouse events. The first version stopped recording immediately and
  captured no events. The spec now keeps recording on until the press is in the
  log, using `expect.poll`.
- **Pinned numbers.** They are the same 0.389 and 0.366 that
  `identity-resolution.spec.ts:248-249` pins for the full descriptor. That is the
  property this row guards: the wire loses nothing the resolver scores.

**`apps/extension/e2e/content/tests/identity-fixtures.ts`.** Only the stale
sentence changed: six lines out, six lines in, in the header comment (old lines
18-23). The new text says both halves now carry `testId`, `accessibleName`,
`label`, `implicitRole` and `context`, and names `identity-wire-chain.spec.ts` as
the row that runs a recorded click through both.

## Commands run and observed results

All content-harness commands were run from `apps/extension` with
`EXTENSION_TEST_BUILD_LABEL=g-identity-wire-chain`. Exit codes were captured by
redirecting to a file and echoing `$?`.

1. **First run:**
   `pnpm exec playwright test -c e2e/playwright.content.config.ts --workers=2 identity-wire-chain`
   exited 1, with 2 failed: `one click on Save was recorded … Received length: 0`.
   This was the timing defect, since fixed.
2. **Debug run of one row** (a temporary `console.log`, since removed) exited 1.
   It printed
   `[["fluxiq.contentReady","content.ready"],["fluxiq.contentEvent","dom.click"],["fluxiq.contentEvent","dom.click"],["fluxiq.contentEvent","dom.submit"]]`,
   then `Received length: 2`.
3. **Second run** exited 1, with 2 failed:
   `ReferenceError: booleanValue is not defined at domain/src/output-nodes/targets.ts:144`,
   reached through `gatewayRecordingEventFromPayload` → `recordedInputId` →
   `elementFingerprint`. This was another worker's in-flight edit, which added
   `checked`. A background poll then saw `booleanValue` defined at `targets.ts:283`.
4. **Third run** exited 0: `ok 2 … the whole command a replay dispatches`,
   `ok 1 … the node's element and selector`, `2 passed (2.9s)`.
5. **Mutation.** The spec's `acrossTheWire` was edited to narrow the projected
   element to `1b6f5df`'s 17 keys (`selector, tagName, xpath, id, classNames,
   visibleText, text, value, role, name, href, inputType, bounds, documentBounds,
   isVisibleOnViewport, hasClickHandler, attributes`). The run exited 1, with
   2 failed. Row (b) printed:
   ```
   Error: No target resolved from selector #save-settings, visual target 312,338 (refused div[data-testid="primary-actions"] scoring -0.38), element fingerprint.
   -     "bestScore": NumberCloseTo 0.389 (3 digits),
   +     "bestScore": 0.197,
         "candidateCount": 2,
   -     "confidence": NumberCloseTo 0.366 (3 digits),
   -     "strategy": "scored-candidate",
   +     "confidence": 0.173,
   +     "strategy": "fingerprint",
   -   "status": "succeeded",
   +   "status": "failed",
   ```
   Row (a) printed the same score diff. Both reproduce the investigation's R5a
   and R5b number for number, including the visual-target message.
6. **Restore.** The mutation was reversed. `sha256sum` before and after both gave
   `289f04cf2acc0a28e6fec1e6b2cb4f1e651a1d056c74179ff86c2671e00e4de0`, so the file
   is byte-identical.
7. **Family:** `pnpm exec playwright test … --workers=2 identity-` exited 1 with
   `Running 29 tests`, `28 passed`, `1 failed`. Per file:
   - `identity-ambiguity`: 5 ok
   - `identity-resolution`: 14 ok
   - `identity-veto`: 4 ok
   - `identity-wire-chain`: 2 ok
   - `identity-signals`: 3 ok, 1 failed

   The failing row was `identity-signals.spec.ts:95` (`the state a replay has to
   reproduce`, expected `false`, received `true`). Rerun alone with
   `--workers=1 identity-signals`, it exited 1 again, 3 passed and the same row
   failed. It is a real assertion diff, not a hardware artefact.
8. **Type check:** `pnpm exec tsc -p tsconfig.test.json` (covers `src/**` and
   `e2e/**`).
   - The first run exited 2 with two errors, both in other workers' files:
     `src/content/identity/context.ts(53,46)` for a missing `landmarkName`, and
     `domain/src/output-nodes/targets.ts(144,14)` for `booleanValue`.
   - The rerun, after both edits landed, exited 0 with no output.
9. **Structure audit through a scratch index.** Command:
   `cp .git/index <scratch>/gwc-index; GIT_INDEX_FILE=<scratch>/gwc-index git add …identity-wire-chain.spec.ts; GIT_INDEX_FILE=… node scripts/structure-audit.mjs`
   - With my file staged: exit 0, `structure-audit: passed (34 warning(s), 17 baselined).`
   - Control run on the real index: exit 0, same summary line.
   - The two outputs differ in one line: the advisory
     `[directory-files] apps/extension/e2e/content/tests/: 24 source files is past the 15-file advisory threshold`
     (23 on the control run). No failing finding names either of my files.

## Not verified

- **The Core hop.** Between the projection and the node, Core stores the event
  on the recording timeline, and on dispatch it runs `prepareElementTargetAction`.
  Neither step runs in the harness. The row calls the domain's node and command
  builders directly.
- **The Lab**, per design C. The run is
  `FLUXIQ_TEST_ENV_FILES=none pnpm lab run identity-drift --flow --variant reworded-aria --target isolated`,
  twice. It must show three things:
  - the click node's `parameters.element` carries `testId`, `accessibleName`,
    `label`, `implicitRole` and `context`;
  - the attempt succeeds at `scored-candidate`, about 0.389, confidence about
    0.366, with Discard untouched (`saveCount 1, discardCount 0`);
  - the resolution itself can be read. `L-replay` Defect 4 says the run bundle
    drops `resolution`, so that fix or a store watcher is needed to read it.
- **Single observations.** The passing run, the mutation run and the family run
  were each observed once, on this machine's faulty RAM.
- **Not run:** the full extension `check` (only its `tsconfig.test.json` half),
  extension `test`, root `pnpm check` and `pnpm test`. The brief did not name them.
- **The pinned 0.389 and 0.366** depend on Core's missing-identifier constant and
  on the resolver as it stood during these runs. `g-resolver-corroboration` is
  changing `score.ts` and `veto.ts` concurrently. Its predicate should leave this
  row alone, because the accessible name agrees exactly. If it does not, this
  spec and `identity-resolution.spec.ts:248` move together.

## Open questions or contradictions found

1. **`identity-signals.spec.ts:95` fails, and reproduces alone.** The row expects
   a dispatched `checked` of `false` and receives `true`. The file is
   `g-recorder-signals`' in-flight B5 work, not mine. It does not touch this
   chain's rows, which passed in the same run.
2. **The header of `identity-fixtures.ts` is out of date.** Lines 1-3 still say
   "the three identity specs beside this file share" it. At least five specs now
   import it (`large-page-resolution.spec.ts` and this one included). That lies
   outside the one sentence I owned, so I left it.
3. **The brief's "call the projection function itself" is only possible
   indirectly.** `elementTarget` is not exported, so the row calls the exported
   caller `gatewayRecordingEventFromPayload` and reads `event.payload.element`.
   That is the path the existing unit test `gateway-payloads.test.ts:151-156`
   uses. If `g-recorder-signals` renames or unexports that caller, this spec's
   import breaks at compile time.
4. **No baseline change is needed.** The only audit difference is the advisory
   file-count warning.
