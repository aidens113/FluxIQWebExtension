# W2 Humanness: where the `humanness` record was lost (t898)

## Outcome

Done. The record was never dropped. It reached Core one level deeper than the
place Core's Flow step log reads it. The domain's output dispatcher now lifts it
to the top of the dispatch payload, the same way it already lifts `skipped`.
A provider-free Lab attempt at `--humanness 100` now writes `humanness` into
every replay step that pressed or scrolled. The same attempt without the option
writes none.

## Where it was lost (with evidence)

Each hop, in order:

1. The content script attaches `humanness` to the click, type or scroll result.
   The extension runtime (`execute.ts`, `action-runner.ts`, `command-router.ts`)
   spreads the result through every hop, so the field survives. The Lab run
   below confirms this end to end.
2. `domain/src/client/browser-result-mapping.ts` builds the gateway result. Its
   `payload` is `webAutomationActionResultPayload(result)`, which includes
   `humanness`.
3. **`domain/src/io/gateway-output-dispatcher.ts` (`dispatchWebAutomationOutput`)
   builds the dispatch payload as
   `{ status, message, result: <gateway payload>, route, skipped, toggle, clearedLayers, obstruction }`.**
   It lifts some fields to the top because Core reads them there. `humanness`
   was not one of them, so it stayed at `payload.result.humanness`.
4. `domain/src/runtime/adapter.ts` (`executeWebAutomationRuntimeCommand`) returns
   that payload to Core with its top level unchanged. A Flow replay takes this
   path: the replay steps show its `send.<action>` spans.
5. Core's `framework/automation-service/io-policy.ts` (both the runtime and the
   IO dispatcher) sets `outputs.result = result.payload`. Core's `runtime/service.ts`
   passes the result through as the adapter returned it.
6. Core's `runtime/llm/step-log/flow-step.ts` reads
   `attempt.outputs.result.humanness`. The record was at
   `attempt.outputs.result.result.humanness`, so the step log found nothing.

The earlier Core probe passed because it used `outputs: { result: { humanness } }`.
That is the shape Core expects, not the shape the domain produced. The same
nesting defect happened before with `skipped`: see the header of
`domain/src/io/tests/gateway-output-dispatcher-skipped.test.ts` (t775-P).

## What changed and why

- New `domain/src/actions/humanness-record.ts`, exporting
  `webAutomationHumannessRecordValue(value: unknown)`. It holds the field-by-field
  reader that was private to `gateway-mapping.ts`, so both hops copy the record
  through the same reader. It keeps `level`, `aimed`, and `misclick {x, y}`
  (only when both coordinates are finite), and drops everything else.
- `domain/src/client/gateway-mapping.ts`: the private `humannessRecordValue` is
  removed, and the shared reader is used instead. The gateway payload is
  unchanged: the existing `gateway-mapping-humanness-record` tests still pass.
- `domain/src/io/gateway-output-dispatcher.ts`: lifts
  `humanness: webAutomationHumannessRecordValue(result.payload.humanness)` to the
  top of the dispatch payload, beside `skipped` and `obstruction`. The
  client's nested payload is left as it came. The lift happens on any status,
  because a failed press was still made that way.
  A level-0 result carries no record, the value is `undefined`, and `compact`
  drops it. The payload is therefore byte-identical (tested).
- New test `domain/src/io/tests/gateway-output-dispatcher-humanness.test.ts`:
  - the record is lifted, and the nested copy is kept;
  - a failed press keeps its record;
  - only the named fields are copied;
  - a level-0 or unreadable record gives the payload's exact earlier JSON
    (`JSON.stringify` equality) with no `humanness` key.

No Core file was edited. No file owned by t893 or W1 was touched.

## Commands run and observed results

- `cd domain && DOMAIN_TEST_BUILD_LABEL=t898-trace node scripts/test-domain.mjs io/tests/gateway-output-dispatcher-humanness client/tests/gateway-mapping-humanness`
  -> `# pass 11`, `# fail 0` (4 new tests plus the 7 existing humanness mapping tests).
- `cd domain && DOMAIN_TEST_BUILD_LABEL=t898-trace node scripts/test-domain.mjs io/tests/gateway-output-dispatcher client/tests/gateway-mapping-humanness`
  -> `# tests 63`, `# pass 63`, `# fail 0` (all dispatcher tests).
- `cd domain && DOMAIN_TEST_BUILD_LABEL=t898-trace node scripts/test-domain.mjs runtime/tests/adapter`
  -> `# pass 75`, `# fail 0`.
- `node .../heavy-slot.mjs run t898-domain-check -- pnpm --filter @fluxiq-web-extension/domain check`
  (tsc for src and tests) -> exit 0. Output ended with
  `{"build-cache":"build","step":"domain:check",...}`, with no errors.
- `node scripts/structure-audit.mjs` (extension) ->
  `structure-audit: passed (245 warning(s), 552 baselined).` The only warning on
  a touched file is the existing `gateway-mapping.ts` line-count advisory, and the
  file is now shorter.
- `pnpm structure:check` (Core) -> `structure-audit: passed (530 warning(s), 969 baselined).`
- Before the fix, run `run-mwc0xah1-abdee0a8` (`--attempts 4 --humanness 100`):
  `grep -rl humanness` over the whole run directory found nothing.
- After the fix:
  `node .../heavy-slot.mjs run t898-trace --priority -- pnpm lab attempt company-website --task company-website-apprentices --authoring-mode answer-first --scripted-model --attempts 2 --humanness 100`
  -> `"status":"passed"`, run **`run-mwc2gdm2-f6917f92`**. Attempt 2 replayed the
  saved Flow. Every Flow step with a `send.click` or `send.scroll` span has
  `humanness`, and every step without one (state-routed `ended` clicks, navigate,
  merge, extract_list) has none:
  ```
  0028-flow-web.output.dom-click succeeded sent=send.click humanness={"level": 100, "aimed": true}
  0029-flow-web.output.dom-scroll succeeded sent=send.scroll humanness={"level": 100, "aimed": false}
  0032-flow-web.output.dom-scroll succeeded sent=send.scroll humanness={"level": 100, "aimed": false}
  0035-flow-web.output.dom-click failed sent=send.click humanness={"level": 100, "aimed": false}
  0036-flow-web.output.dom-click failed sent=send.click humanness={"level": 100, "aimed": true}
  0037-flow-web.output.dom-click succeeded sent=send.click humanness={"level": 100, "aimed": true}
  ```
  Excerpt from `steps/0029-flow-web.output.dom-scroll/meta.json`:
  `{"step": 29, "toolId": "web.output.dom-scroll", "status": "succeeded", "humanness": {"level": 100, "aimed": false}}`.
- The same command without `--humanness` -> `"status":"passed"`, run
  **`run-mwc2jxb2-f218b42f`**. No Flow step's `meta.json` has `humanness`, even
  though 7 of its steps sent a click or scroll. `grep -rl '"humanness"'` over the
  whole run directory found nothing.

Both Lab runs used the scripted model, so no provider was called. The run
reports show `NOT LIVE, stand-ins: model, spend`. I used `--attempts 2` instead
of 4 because the second attempt is the first one that replays the saved Flow,
and only replays write `flow-*` steps.

## Not verified

- I did not run the new dispatcher test against the old code to watch it fail.
  The Lab runs before and after the fix (none, then present on every press)
  are the evidence that the fix works.
- No live browser run with a provider, and no `--attempts 4` run after the fix.
- Typing was not exercised: the task has no type step. Type results take the
  same dispatcher path as click and scroll.
- No misclick happened in either run, so the `misclick` point was checked only
  by unit tests.

## Open questions or contradictions found

- The brief says to confirm with "the same provider-free Lab attempt", and also
  allows "`--attempts 1`" for a confirmation run. A single attempt writes no `flow-*`
  steps: attempt 1 explores through `core.run_node` tool steps. Confirmation
  therefore needed `--attempts 2`.
- Not related to the drop: in `run-mwc2gdm2-f6917f92`, steps 0035 and 0036 are
  replay clicks that failed with `web.target.not_shown` before 0037 succeeded.
  The run without humanness (`run-mwc2jxb2-f218b42f`, steps 0031 to 0033) failed
  the same way, so it is not caused by humanness. I did not investigate it.
- Other uncommitted changes in this worktree are not mine:
  `page-record.ts`, `press-raw-read.test.ts`, `reports/w2-humanness.md`,
  `reports/w2-humanness/{flow-level,task-level}.md`.
