# t200 merge into downstream dev: conflict resolution

Worker report. Merge of `task/t200-model-sees-whole-page` (b507d5fa) into `dev`
(4ad16d82), in `C:/Users/osrs_/FluxStuff/!FluxIQWebExtension`. Everything is
resolved and staged. Nothing was committed, and the merge was not aborted. Core
(`!FluxIQ`) was not touched: no edits, no build.

## Outcome

Done, with one gap. All 7 conflicted files are resolved. Ten dev-side files that
no longer compiled or passed against t200 were adapted, and everything is staged.
The core-build gate refuses: Core's dist is behind its source while the Core half
of this merge is in progress. Because of that, the domain and extension suites ran
directly, bypassing the gate, against the current (dev) Core dist. Four domain test
type errors remain. All four expect t200's Core, which removes `maxEvidenceBytes`
from the harness contract.

## What changed and why

Conflicted files:

- **`apps/extension/src/content/action-runtime/interference/index.ts`**: kept
  both header paragraphs. Lane D's `probe-points` and `pressable-way-out` are
  kept, and so is t200's `layer-kind`. The exports had already merged cleanly:
  `clearableLayerOverPage` and `layerKind`.
- **`apps/extension/src/runtime/index.ts`**: exports both `./look-across-frames`
  (t200) and `./navigating-page` (t202).
- **`apps/extension/src/runtime/action-runner.ts`**: kept both behaviours.
  - The run is now `lookAcrossFrames(action, await runActionInFrame(..., request.pace), addressed, ...)`,
    so lane C's page pace still reaches the send, and t200's merge of every frame
    still wraps the look.
  - Per t202's integration note, the file now imports `metNavigatingPage` from
    `./navigating-page`. Its own `NAVIGATING_PAGE_ERRORS` and `metNavigatingPage`
    copies are deleted.
- **`domain/.../node-run/replay.ts`**: took dev's side (t196). The answers live
  in `replay-answer.ts` and `verify.ts`, and `WebNodeRun` comes from
  `./context`. t200's inline `answer`, `answerWithPage` and `replayStates`
  copies were dropped. t200's change to them was to remove the byte budget, and
  that change was carried into `replay-answer.ts` (see the adapted files below).
- **`domain/.../node-run/run.ts`**: kept dev's lane C rejected-row read and lane A
  F13's `run.addresses.ran(...)`, without a budget:
  `webNodeReadWithRejectedRows(result.payload)`. Removed the stale
  `run.request.maxEvidenceBytes` argument from the `address_not_shown` refusal,
  because t200 changed `refusal()` to take `(page, code, detail, record)`.
- **`domain/.../sanitize.ts`**: took t200's unbudgeted ending
  (`tellWebLlmLookAlikesApart`, no `trimToBudget`), plus lane A F13's
  `pageQuery` on the binding. The `pageQuery` doc now says the packet's
  `location` shows the query too, with secret values withheld, while `pageQuery`
  holds the raw query and stays inside the domain.
- **`domain/.../tool-rejection.ts`**: dropped `evidence_budget_exhausted` (t200
  retired it) and kept `not_at_start_location` and dev's `address_not_shown`.

Dev files adapted to t200 (these did not conflict, but broke once merged):

- **`llm-evidence/capture.ts`**: the auto-merge left `pageQuery: bounded.pageQuery`,
  and t200 had renamed that variable to `sanitized`. This was a compile error; the
  line now reads `sanitized.pageQuery`.
- **`node-run/rejected-rows.ts`** (lane C) imported `serializedBytes` from the
  deleted `../limits`.
  - The byte budget and the shrink loop are removed. The signature is now
    `webNodeReadWithRejectedRows(payload)`.
  - The samples are every row the page's sampling returns.
  - Kept and rejected rows both pass `webNodeReadResult`, which drops denied keys
    and withholds credential-shaped strings. So the samples now get t200's
    secret screening too, which they did not get before.
- **`node-run/replay-answer.ts`** (t196) used `../limits`. The budget is removed,
  so a failed or changed replay always carries its page whole. This matches
  t200's change to the old inline `answerWithPage`.
- **`node-run/shown-addresses.ts`** (lane A F13).
  - t200 packets now show a link's query, so `saw()` remembers each link with its
    own query rather than `[]`. Without this change, a model shown
    `/ip/x?variant=1` would be refused for navigating to exactly that link.
  - Updated the header comment, which said packets never carry a query.
- **`plan-resolution/target-packets.ts`**: comment only. Since t200, the one look
  that can be cut short is one the capture itself cut (`captureTruncated`). The
  `rememberLook` behaviour is unchanged.

Tests adapted:

- `node-run/tests/rejected-rows.test.ts`: the budget test now checks that the
  read comes back whole. The flooded-page bound is still checked.
- `node-run/tests/shown-handle-past-cap.test.ts`: replaced
  `WEB_LLM_EVIDENCE_BOUNDS` with a local constant for the live length of 40. The
  shown packet is now the whole page (45 elements).
- `plan-resolution/tests/target-packets-look.test.ts`:
  - The look that is cut short is now a capture with `truncated: true`, not one
    that hits the 40-element cap.
  - A literal `truncated: cut` replaces a conditional spread, which the
    structure audit's contract-spread rule failed.
- `node-run/tests/shown-addresses.test.ts`:
  - The refusal's packet now shows the link as `${SHOWN_ITEM}?variant=1`.
  - Added a test: navigating to a shown link's own query is allowed, and another
    value for the same key is refused.
- `harness-options/tests/person-needed.test.ts` (dev only): removed the dead
  `maxEvidenceBytes: 64_000`, as t200 did in seven other domain tests.

## Commands run and observed results

- **Domain source typecheck**: `npx tsc -p tsconfig.json --noEmit` in `domain`,
  run through heavy.sh. It first showed 1 error (`capture.ts(444) Cannot find
  name 'bounded'`). After the fix it printed no errors.
- **Domain test typecheck**: `npx tsc -p tsconfig.test.json --noEmit` in
  `domain` finishes with 4 errors. They are
  `detect-option.test.ts(61)`, `options.test.ts(229)`,
  `harness-options/tests/person-needed.test.ts(135)` and
  `recovery-selector-hints.test.ts(135)`, and each says "Property
  'maxEvidenceBytes' is missing". Core's dist still requires the field. That dist
  is dev's (checked: `dist/.../harness-options/option.d.ts` has
  `maxEvidenceBytes`), and t200's Core removes it.
- **Extension check**: `node scripts/check-extension.mjs` (both tsc projects and
  the in-memory bundles) exited 0.
- **Core-build gate**: `node scripts/check/core-build.mjs` refused: "FluxIQ Core's
  build ... is 15 minute(s) behind its source. Stale: ...evidence-loop/stall-redirect.ts".
  So `pnpm --filter ... test` was not run as written.
- **Domain suite** (run directly, bypassing the gate, against the current Core
  dist): `DOMAIN_TEST_BUILD_LABEL=t200merge-ds node scripts/test-domain.mjs`.
  - First run: 1036 of 1037 passed. The failure was `shown-addresses.test.ts`,
    where the link href now carries `?variant=1`.
  - After the fix: `tests 1038, pass 1038, fail 0`.
- **Extension suite** (run directly, bypassing the gate):
  `EXTENSION_TEST_BUILD_LABEL=t200merge-ds node scripts/test-extension.mjs` gave
  `tests 1662, pass 1662, fail 0`. `node scripts/smoke-test.mjs` printed
  "Extension smoke test passed."
- **Structure audit**: `node scripts/structure-audit.mjs` first gave 1 violation
  (contract-spread in `target-packets-look.test.ts`). After the fix:
  "structure-audit: passed (134 warning(s), 119 baselined)".
- **Unmerged paths**: `git diff --name-only --diff-filter=U` printed nothing.

## Not verified

- **Nothing ran against the merged Core.** It is not built yet, and its merge
  belongs to another worker. The 4 test type errors should clear once Core is
  merged and rebuilt, but that was not observed. Both suites must be re-run
  through `pnpm --filter ... test`, gate included, after Core is built.
- **No live browser run.** The resolved paths that only a browser run can
  exercise are the frame merge plus the pace in `action-runner.ts`, and lane D's
  interference together with t200's `layerKind`.
- **`pnpm check` and `pnpm build`** were not run.

## Open questions or contradictions found

1. **Rejected-row samples are still capped by lane C's page contract.**
   `domain/src/actions/extraction/rejected-samples.ts` allows 3 rows per
   condition and 80 characters per value. That is the wire contract of the
   request for samples. t200 did not touch it, and this merge left it alone. It
   is arguably a cap the user's order covers.
2. **`MAX_PAGE_QUERY_PAIRS = 16` in `sanitize.ts`** (dev) caps the raw
   `pageQuery` kept on the binding. It never reaches the model, so I kept it.
3. **Two dev comments still mention the old forty-control packet** as history:
   `run.ts` around `run.looked`, and the header of `shown-handle-past-cap.test.ts`
   (now annotated). The behaviour they describe is still correct.
