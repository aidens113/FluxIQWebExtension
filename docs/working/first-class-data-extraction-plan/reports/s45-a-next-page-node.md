# Report: s45-a-next-page-node (worker-high, W-A of S4/S5)

Tree: `C:/Users/osrs_/FluxStuff/fxwork/t284/!FluxIQWebExtension`, branch `task/t284-read-list-s45-next-page`. No commits.

## Outcome

**Partial.** The action `web.dom.next_page` and its node `web.output.dom-next_page` are built to contract C1. All the
fail-first tests failed before the change and pass after it. The structure audit exits 0. The domain check exits 2 on
**one error, outside my files**: `src/runtime/llm-evidence/structure/packet.ts(291,66)` is missing `answer` on
`WebAutomationExtractListRequest`. The concurrent W-B worker added that field in `domain/src/actions/extraction/*` (shown
as modified in `git status`, and I did not edit those files). `tsc` on both `tsconfig.json` and `tsconfig.test.json`
reports no other error. Before W-B's edit landed, `tsc -p domain --noEmit` passed with all of my changes in place.

## What changed and why

New `domain/src/actions/next-page/` (barrel `index.ts`):
- `request.ts`: the types `WebAutomationNextPageWay` and `WebAutomationNextPageRequest`, as C1 defines them.
- `answer.ts`: the types `WebAutomationNextPageBy`, `...End`, `...Fault` and `...Answer`. `End` and `Fault` are
  `Extract<WebAutomationExtractionPaginationStop, ...>` (summary.ts stop words), so the two vocabularies cannot drift.
- `words.ts`: `WEB_AUTOMATION_NEXT_PAGE_WORDS`, the closed word lists (modes, by, ends, faults), checked against the
  types with `satisfies`.
- `request-value.ts`: `webAutomationNextPageRequestValue`. It refuses unknown keys (top level and inside the way), empty
  or whitespace selectors, unknown modes, another mode's control, and any `maxPages`/`maxScrolls`. When `mode` is absent
  it stays absent. `itemElement` goes through the one `elementFingerprint` normalizer (the `output-nodes/targets` leaf,
  as `read-request.ts` does).
- `answer-value.ts`: `webAutomationNextPageAnswerValue`. It rebuilds the answer field by field, drops extra keys, and
  refuses a word outside its outcome's set or a `page` that is not a positive integer.
- `schema.ts`: `webAutomationNextPageSchema(elementFingerprintSchema)`, the JSON parameter schema (no bound fields).

`actions/types.ts`: the following were added:
- `"web.dom.next_page"` in the union and in `WEB_AUTOMATION_ACTION_TYPES`
- the legacy alias `dom.next_page`
- the command member `nextPage`
- the result members `nextPage` and `route?: "ended"`
- type and value re-exports of `./next-page`

`actions/safety.ts`: `review`, so that `effect.ts` gives `mutate`. `actions/schemas.ts`: an action row with label
"Next page", required `nextPage` and optional `timeoutMs`.

New `domain/src/output-nodes/next-page/` (barrel):
- `catalog-text.ts`: the node description (202 characters, first sentence 74), the tags, and the `nextPage` grammar
  (262 characters). The grammar leads with C2's handle form `{list: "extraction.N", control?: "tN"}`, then the literal
  form.
- `parameters.ts`: the `nextPage` (object) and `timeoutMs` (default 30 000) parameters,
  `WEB_AUTOMATION_NEXT_PAGE_TIMEOUT_MS`, and the `ended` port (`role: "branch"`).
- `dispatch.ts`: `webAutomationNextPageDispatch`. A `nextPage` that does not parse gets a failed result:
  `graph_validation_or_unknown_node`, stage `dispatch`, not retryable, code `web.next_page.invalid_request`, no effects.
  A valid one dispatches `{ parameters: {...params, timeoutMs}, timeoutMs }`, using the authored timeout or 30 000.

`output-nodes/definitions.ts`:
- catalog text for next_page
- a new `branchPortsByOutput` record, so the outputs are `success`, `failed`, `ended`
- effect `mutate`
- the parameters and the icon `chevrons-right`

The node does not require a selector, so it gets no `elementTarget` and no `item` input. `output-nodes/native-runtime.ts`
routes next_page through the dispatch above. `output-nodes/index.ts` exports `./next-page`.

`client/gateway-action-parameters.ts` lifts `nextPage` (`nextPage` is in the `Pick`). Because the schema requires it, a
refused one refuses the command with `INVALID_PARAMETER`. `client/gateway-mapping.ts` adds two fields to the result
payload. `nextPage` goes through the answer parser. `route` is `"ended"` only when `result.route === "ended"` **and** the
parsed answer's outcome is `ended`.

`io/gateway-output-dispatcher.ts` puts `route: "ended"` at the top level of the dispatch payload, and only when the
client payload's `route` is exactly `"ended"`. `runtime/adapter.ts` needed no code change: both of its payload guards
keep the top level, so the route reaches Core. I added a comment only, and `adapter-route.test.ts` pins the behaviour.

Test files changed because they enumerate every action type (one-line edits):
- `client/tests/structure-detection-wire.test.ts` and `src/tests/domain.test.ts`: 18 becomes 19.
- `io/tests/input-model.test.ts`: next_page added to the dispatch-only outputs.
- `output-nodes/tests/definitions.test.ts`: next_page excluded from "no other node has catalog tags/description".
- `output-nodes/tests/native-runtime.test.ts` (and the source comments in `definitions.ts` and `native-runtime.ts`):
  "eighteen" becomes "nineteen".

The only total record the compiler asked for outside the brief's files was `WEB_AUTOMATION_ACTION_EFFECT` in
`definitions.ts`, which I own.

New test files:
- `actions/next-page/tests/{request-value,answer-value}.test.ts`
- `output-nodes/tests/next-page-node.test.ts`
- `client/tests/gateway-next-page.test.ts`
- `io/tests/gateway-output-dispatcher-route.test.ts`
- `runtime/tests/adapter-route.test.ts`

The largest tests folder is now `output-nodes/tests` with 9 files.

## Commands run and observed results

- **Fail-first, before the change.** `node <run-subset.mjs> <domain> s45-a-ff <each new test>`, then `node --test`.
  - The two parser files failed to bundle: `Could not resolve "../request-value"` and `"../answer-value"`.
  - The node tests failed 7 of 7, the client tests 6 of 6, the dispatcher route test 1 of 2 and the adapter route test
    2 of 2.
- **After the change, new tests only.** The same 6 files: `# tests 26 # pass 26 # fail 0`.
- **The brief's set plus every changed test.** Command: `node <run-subset.mjs> <domain> s45-a` over
  `output-nodes/tests/*`, `client/tests/*`, `actions/tests/*`, `actions/next-page/tests/*`, `io/tests/*`,
  `runtime/tests/adapter*` and `src/tests/domain.test.ts` (32 files), then `node --test`.
  - First run: 228 of 229 passed. `io/tests/input-model.test.ts` failed: "every output is recordable or dispatch-only".
  - I fixed that test as listed above.
  - Rerun: `# tests 229 # pass 229 # fail 0`.
- **Other tests that enumerate the actions.** `runtime/tests/{carried-row-service-repair,carried-service-repair,
  capabilities}`, `src/tests/{core-gateway-recording-order,safety,web-panel-host}`: `# tests 23 # pass 23 # fail 0`.
- **Domain check.** `pnpm.cmd --filter @fluxiq-web-extension/domain check` printed `core-build: ... current`, then the
  single TS2345 in `llm-evidence/structure/packet.ts(291,66)` (W-B's `answer`), and exited 2.
  - `npx tsc -p tsconfig.json --noEmit` and `-p tsconfig.test.json` print only that one error.
- **Structure audit.** `node scripts/structure-audit.mjs` printed `structure-audit: passed (172 warning(s), 118
  baselined)` and exited 0.
  - Advisory warnings on the files I touched: `actions/types.ts` at 591 lines, `client/gateway-mapping.ts` at 540 and
    `runtime/adapter.ts` at 443. All three were already over 400 before this change.

## Not verified

- A domain check with exit 0 after W-B's edit. It needs W-B, or the supervisor, to update
  `llm-evidence/structure/packet.ts`.
- The extension. I did not touch `apps/`, and it will not compile until its own worker adds the action to its total
  records.
- Core's handling of the `ended` branch (S2's work). No live, Lab, browser or provider run.

## Open questions or contradictions found

1. **No plan-time parameter contract was added.** C2's model form `{list: "extraction.N"}` is resolved by plan
   resolution, which is not built here. A contract that checked the literal request would refuse the handle form if
   Core runs contracts before resolution, as the extract-list contract's handling of handles suggests it can. Until
   resolution lands, the node refuses an unresolved handle at run time with `web.next_page.invalid_request`. The
   catalog text already tells the model to write the handle form.
2. **Client capabilities.** The executable action types are derived from `WEB_AUTOMATION_ACTION_TYPES` (the
   structure-detection-wire test asserts this). So once the extension builds against this domain, it advertises
   `web.dom.next_page`, whether or not its verb exists yet.
3. **Robot-check allowance.** next_page does not get the robot-check allowance (`checkWaitMs`), which only click and
   navigate get. A Next link that navigates onto a robot check that clears by itself would have only the 30 s timeout.
   Decide whether the allowance should be added.
4. **Fault-to-code mapping.** C1 says which failure code each fault word maps to, but this domain does not export that
   mapping as a value. The extension producer has to apply it, and the comment in `answer.ts` documents it.
