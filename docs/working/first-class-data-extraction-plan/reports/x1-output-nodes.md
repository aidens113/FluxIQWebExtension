# x1-output-nodes: records path and timeout for `extract_list`

## Outcome

Done, brief plus supervisor amendment. The `extract_list` output definition that
Core reads through `io.getOutput(domainId, outputId).definition.metadata` now
carries `recordsPath: "extracted"`. That value is taken from the output node, not
typed a second time. The output node declares the same path and a `timeoutMs`
parameter. Mutations proved each piece: a test failed whenever that piece was
removed, and everything passed again once it was restored.

## What changed and why

First pass, as briefed:
- `domain/src/output-nodes/definitions.ts`
  - A private table `recordsPathByOutput = { "web.dom.extract_list": "extracted" }`.
  - `createWebAutomationOutputNodeDefinition` adds `metadata.recordsPath` only for
    an output listed in that table.
  - `extract_list` gains `{ id: "timeoutMs", label: "Timeout", valueType: "number",
    defaultValue: 10_000 }` after `extractList` (D14). This is the shape
    `x3-x5-execution.md:502` gives.
  - `web.dom.extract` declares no path. It also answers on `extracted`, but with a
    single value, so a default path there could never capture.
- `domain/src/output-nodes/tests/definitions.test.ts`, two tests:
  - Only `extract_list` declares a `recordsPath`, and it is `"extracted"`.
  - `extract_list` has an optional, state-bindable `timeoutMs` number that
    defaults to 10,000.

I found that Core would not see the path. Its planned proposal lift, K7, reads
`io.getOutput(...).definition.metadata?.recordsPath`
(`F:\!FluxIQ\docs\working\first-class-data-extraction-plan\reports\k-datasets-execution.md:354-361`).
In this repository that `definition` is the `webAutomationManifestOutputs` entry
from `domain/src/io/manifest-definitions.ts`, not the node definition. Both host
registrations pass that entry through unchanged as `definition`:
`io/web-automation-io.ts:41-45` and `web-panel-host.ts:56-60`.

Amendment, with ownership extended to the io files:
- `domain/src/io/manifest-definitions.ts`
  - The inline `elementTarget` spread became `manifestMetadata(action)`. It builds
    `metadata` from `elementTarget` (unchanged rule) plus `recordsPath`, and it
    returns no `metadata` key when both are absent. That keeps today's "no
    metadata" shape for every other output.
  - `outputNodeRecordsPath(outputId)` reads the path off the matching node in
    `webAutomationOutputNodeDefinitions`, imported from the `output-nodes` barrel,
    as `web-automation-io.ts` already does. The derivation is therefore one-way:
    the node declares the path, and the manifest copies it.
  - `output-nodes` imports nothing from `io` (grep of its parent imports;
    `sensitivity` has none), so this import creates no cycle.
  - The doc comment now covers both keys Core reads off this definition.
- `domain/src/io/tests/manifest-definitions.test.ts`
  - The header comment now covers the records path.
  - The existing test "an output that is not element targeted declares no
    element-target metadata at all" asserted `metadata === undefined`, which
    `extract_list` would now fail. It now asserts `metadata?.elementTarget ===
    undefined`, and keeps the whole-`metadata`-absent check for outputs with no
    records path either.
  - New table `RECORD_OUTPUTS = { "web.dom.extract_list": "extracted" }`, written
    out by hand like `ELEMENT_TARGETED_OUTPUTS`, so a change on either side fails.
  - New test "the extract_list output Core reads declares where its records are,
    and no other output does". `extract_list`'s manifest `metadata` deep-equals
    `{ recordsPath: "extracted" }`, which is exactly what Core reads, and every
    other output's `recordsPath` matches the table (absent).
  - New test "the manifest and the output nodes name the same records path",
    checked for every action type.

## Commands run and observed results

Each command ran alone.

First pass:
1. `cd domain && pnpm check`: exit 0.
2. `DOMAIN_TEST_BUILD_LABEL=x1-nodes pnpm test`: exit 0, 415 of 415 passed.
3. Removed the node's `recordsPath` spread: exit 1, 414 passed, 1 failed. The
   failure was `not ok 49 - the list extraction tells Core where its records
   are...` with `expected: 'extracted'`. Restored it, reran: 415 of 415 passed.
4. `node scripts/structure-audit.mjs`, run twice: exit 1 both times with one
   `FAIL [working-docs] docs/working/README.md is out of date`. I don't own that
   file and changed no working document header.

After the amendment (the suite grew to 440 as other workers' tests landed):
5. `cd domain && pnpm check`: exit 0.
6. `DOMAIN_TEST_BUILD_LABEL=x1-nodes pnpm test`: exit 0, 440 of 440 passed. The log
   shows `ok 63` (records path Core reads), `ok 64` (manifest and node agree), and
   `ok 61` (the narrowed metadata test).
7. Two mutations applied together in the real source; the classifier allowed both.
   Each breaks only its own tests:
   - A: removed the `timeoutMs` parameter from `extract_list` in `definitions.ts`.
   - B: removed `...(recordsPath ? { recordsPath } : {})` from `manifestMetadata`.

   `DOMAIN_TEST_BUILD_LABEL=x1-nodes pnpm test` gave exit 1, 437 passed, 3 failed:
   - `not ok 63 - the extract_list output Core reads declares where its records
     are` (B);
   - `not ok 64 - the manifest and the output nodes name the same records path`,
     `expected: 'extracted'` (B);
   - `not ok 75 - the list extraction offers a timeout...`,
     `error: 'web.dom.extract_list offers no timeoutMs parameter'` (A).
8. Restored both. `git diff` confirms the restored lines: the manifest
   `recordsPath` spread, and `timeoutMs` at `definitions.ts:163`.
9. `cd domain && pnpm check`: exit 0.
10. `DOMAIN_TEST_BUILD_LABEL=x1-nodes pnpm test`: exit 0, 440 of 440 passed.
11. `node scripts/structure-audit.mjs`: exit 1, the same single `FAIL` on
    `docs/working/README.md`. No line mentions `output-nodes` or `domain/src/io`,
    so the new import from `io` into `output-nodes` passes the import rules.

## Not verified

- The records path was not read back through Core's own IO registry. The test
  asserts on `webAutomationManifestOutputs`, the object both host registrations
  pass through as `definition`. Building `createWebAutomationDomainIo` needs a
  FluxIQ instance, and no domain test does that today.
- Core's K7 lift is not written yet (no Core code reads `metadata.recordsPath`), so
  the end-to-end default could not be exercised.
- How Core carries a node's `parameterValues.timeoutMs` into the command.
  `io/gateway-output-dispatcher.ts:8-22` uses the caller's `request.timeoutMs`,
  and `output-nodes/payloads.ts` never mentions `timeoutMs`. D16 assigns this to
  K7.
- The domain has no dependency on `@fluxiq/contracts`, so `"extracted"` was not run
  through Core's `parseAutomationStudioRecordsPath`. It is a single segment of
  letters, which meets that parser's documented rule.
- Root `pnpm check`, `pnpm test`, and `pnpm build` were not run.

## Open questions or contradictions found

1. Resolved by the amendment: the brief put the records path only on the node
   definition, but Core reads the manifest output definition. Both now carry it,
   and the manifest copies it from the node.
2. The `timeoutMs` comment in `definitions.ts` says "a recorded node scales it by
   `maxPages`". That is D14's decision, which X4 implements
   (`webAutomationExtractListTimeoutMs`). It does not exist in code yet.
3. `extract_list`'s `parameterSchema` (`actions/schemas.ts:298-301`) lists only
   `extractList`. As a result, neither `metadata.parameterSchema` nor the
   manifest's `schema` describes the new `timeoutMs` node parameter. No test
   requires it, and D14 keeps `timeoutMs` off the request. I'm flagging it in case
   schema consumers should see the node's full parameter set.
4. The manifest's doc comment repeats an earlier claim that the node definition's
   "only runtime-read field is `metadata.timeoutMs`". I did not verify that claim
   in Core.
