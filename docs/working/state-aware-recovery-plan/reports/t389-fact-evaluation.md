# t389 B1-facts: report

Worker report for brief B1-facts (state-aware recovery plan, browser contracts B1/B2, Core C9).
Tree `C:/Users/osrs_/FluxStuff/fxwork/t389-fact-evaluation`, branch `task/t389-fact-evaluation`. Not committed.

## Outcome

Done. A batched, zero-wait, three-valued fact check exists end to end on the browser side: domain function with
the C9 shape, gateway mapping, background route, content-side evaluator, capability `web.facts`, host capability
`fact-evaluation`, docs. Unit tests per kind for true/false/unknown pass; a headed, provider-free content-harness
check on everything-store `deal-wheel` reads the dialog fact `true` while the wheel shows and `false` after a
person closes it.

## What changed and why

**Design decision: a fact check is a gateway command type, not a Flow action.** It travels `execute_action` under
`web.page.facts` (`WEB_AUTOMATION_FACT_CHECK_ACTION_TYPE`) but is not in `WEB_AUTOMATION_ACTION_TYPES`. Adding it
there would have created an output node, schema, catalog entry and chat-step words, and broken
`apps/extension/src/panel/copy/step-copy.ts` (`satisfies Record<BrowserActionType, ...>`), which this brief may
not touch. It follows the precedent of `web.structure.detection` (a capability that lists no action type).

Domain (new):
- `domain/src/actions/fact-check/` - wire contract: `request.ts` (queries per kind, per-query `frameId`,
  `documentTimeOrigin`), `answer.ts` (verdict, closed unknown reasons, evidence, 120-char excerpt bound),
  `answer-value.ts` / `request-value.ts` (field-by-field readers both ends use), `index.ts`.
- `domain/src/runtime/facts/` - `condition.ts` (C9 types: `WebAutomationFactCondition`, `WebAutomationFactResult`,
  `WebAutomationFactEvaluationContext`, `WebAutomationFactEvaluator`), `query.ts` (condition grammar, binding
  resolution of `{ input }` / `{ value }` from Core-supplied maps, refusals as `unsupported`/`unbound`),
  `evaluate.ts` (`createWebAutomationFactEvaluator`: one dispatch per batch, 5 s command bound, never throws,
  secret-screens excerpts/names with `screenedWebLlmText`, URL excerpt via `screenedEvidenceUrl`).
- `domain/src/client/fact-check-mapping.ts` - `webAutomationFactCheckFromGatewayCommand`,
  `webAutomationFactCheckResultPayload`.

Domain (edited): `runtime/host-runtime.ts` (`WebAutomationHostRuntime` type = boundary + `factEvaluator`; capability
`fact-evaluation`), `runtime/capabilities.ts` (`web.facts`, `WEB_AUTOMATION_FACTS_CAPABILITY_ID`,
`WEB_AUTOMATION_FACT_KINDS`, in both the runtime and gateway lists, no action types, `metadata.version: 1`),
barrels `runtime/index.ts`, `client/index.ts`, `src/index.ts`; tests `runtime/tests/host-runtime.test.ts` (capability
list now includes `fact-evaluation`), `runtime/tests/capabilities.test.ts` (new row). `actions/types.ts` was not
edited: re-exporting there would add a type-level cycle; the contract is exported through the barrels instead.

Extension (new):
- `content/facts/` - `fact-page.ts` (read surface), `judge.ts` (all per-kind rules; `false` in a `loading` document
  becomes `unknown` except for `url`), `dom-page.ts` (live reads: selector via the assertion's `firstMatch`,
  element description via `resolveTarget`, visible/enabled/text via the assertion's reads, chosen state via
  `readChosenState`, dialogs via `dialogEvidence()`; sensitive controls never read), `evaluate.ts`
  (`evaluateFactBatch`: synchronous, stale document -> all `stale_document`, per-claim throw -> `capture_failed`).
- `runtime/fact-check-runner.ts` - groups claims by frame, one `fluxiq.evaluateFacts` per frame, concurrent, no
  waits/reinjection/retries; no answer -> `unreadable_frame`, wrong-length reply -> `capture_failed`.
- `shared/fact-check-message.ts` - message name and shapes.

Extension (edited, minimal routing): `content/message-handler.ts` (new synchronous branch),
`runtime/command-router.ts` (`evaluateFacts`, optional `sendGatewayResult`), `runtime/index.ts`,
`shared/protocol.ts` (`ServerCommandPayload` gains `evaluate_facts`), `background/connection/gateway-session.ts`
(splits the fact command off before `browserActionFromGatewayCommand`, which would refuse it),
`background/connection/server-command-channel.ts` (answers it with no runtime status, boundary capture or recorded
event). To reuse the assertion's queries without a copy: `content/action-runtime/assertion-evaluation.ts` now
`export`s `firstMatch`, `readText`, `isVisible`, `isInsideClosedContainer`, `isEnabled` (keyword only, no behaviour
change), re-exported with clearer names from `content/action-runtime/index.ts` together with `resolveTarget` and
`readChosenState` (also added to `checkable-state/index.ts`). These four files are outside the brief's literal
"Owns" list; the barrel rule forbids reaching past them.

Docs: `docs/architecture/web-capabilities.md` new section "Fact Checks (`web.page.facts`)"; a paragraph under
"Action Surface" in `docs/architecture/extension-client.md`.

Fact grammar (what Core R2 sends as `fact`/`op`/`value`): `exists|absent|visible|enabled|checked|selected` with the
fact's own word as op (for the C9 four) or `equals` + optional boolean; `text|url|value` with
`equals|contains|matches`; `count` with `equals` + number or `count` + `">= 3"`-style string; `dialog` /
`dialog.<consent|rate_limit|robot_check|promotion|assistant>` with `exists|absent` (+ optional name-contains
value) or `contains` + name. Target: `{ selector?, element?|fingerprint?, shadowHosts?, frameId? }`.

## Commands run and observed results

- `npx tsc -p tsconfig.json --noEmit` (domain) -> no output, exit clean; `npx tsc -p tsconfig.test.json --noEmit`
  (domain) -> no output.
- `npx tsc -p tsconfig.json --noEmit` (extension) -> first run: `judge.ts(67,35) TS2345` (target possibly
  undefined); fixed; rerun -> no output. `npx tsc -p tsconfig.test.json --noEmit` (extension, includes e2e) -> no
  output.
- Unit tests. The repo uses `node:test` bundled by esbuild, not vitest, and the package runners have no file
  filter, so a scratch runner mirroring `domain/scripts/test-domain.mjs` / `apps/extension/scripts/test-extension.mjs`
  options was used (scratchpad `t389-run-tests.mjs`, label dirs under `.test-build-scratch/`, removed afterwards):
  - new domain files (query, evaluate, fact-check values, fact-check-mapping, capabilities, host-runtime):
    `# tests 43 # pass 43 # fail 0`.
  - new extension files + assertion-evaluation: `# tests 28 # pass 28 # fail 0`.
  - changed directories, extension (`runtime/tests`, `background/connection/tests`, `content/action-runtime/tests`,
    `checkable-state/tests`, `content/facts/tests`, `content/tests`; 70 files): `# tests 697 # pass 697 # fail 0`.
  - changed directories, domain (`runtime/tests`, `runtime/facts/tests`, `client/tests`, `actions/fact-check/tests`,
    `src/tests`; 30 files): `# tests 183 # pass 183 # fail 0`.
  - `domain/src/runtime/expectation/tests` (unchanged behaviour check): `# tests 48 # pass 48 # fail 0`.
- `pnpm --filter @fluxiq-web-extension/extension test:content -- --headed --workers=1 deal-wheel-facts` ->
  `ok 1 e2e\content\tests\facts\tests\deal-wheel-facts.spec.ts:50:1 > everything-store deal wheel: the dialog fact
  is true while the wheel shows and false once it is closed (11.1s)`, `1 passed (28.5s)`. Headed Chromium, content
  harness, everything-store with `set-mode deal-wheel`, page `/scenarios/everything-store/s?k=earbuds`, no provider.
  Asserted live: dialog any/by name/`exists`/`visible`/`text`/`url`/`count`/`enabled`/`value` all `true` while
  showing; `dialog.promotion` `unknown` (`unclassified_dialog`); stale `documentTimeOrigin` -> both `unknown`
  (`stale_document`); after clicking the wheel's decline line: dialog any/by name/promotion/exists `false`,
  not-visible / no dialog / count 0 `true`.
- `pnpm --filter @fluxiq-web-extension/extension build` -> chrome/firefox/e2e-chromium "verified 22 files"
  (firefox placeholder gecko.id warning is pre-existing).
- `node scripts/structure-audit.mjs` -> first run: 2 `as-never` violations in my tests; fixed; rerun
  `structure-audit: passed (184 warning(s), 257 baselined)` (same counts as before my change; no warning names a
  new or changed file).

## Not verified

- No path through a real background service worker and Core: the harness has no worker, and no Lab/live run was
  made (none allowed). `gateway-session.ts` -> `server-command-channel.ts` -> `command-router.evaluateFacts` ->
  `sendToTab` -> content was type-checked and unit-tested in pieces (runner with a fake `send`), not run together.
- `unreadable_frame` and `capture_failed` were proven in unit tests only (runner and judge/evaluate), not live.
- Child-frame facts were not exercised live; Firefox was built but not run.
- Whether Core's bridge `appendActionResult` records a `web.page.facts` result into an active recording (it does for
  every `executeAction`); untested.
- Full suites (`pnpm check`, `pnpm test`) not run, per the brief.

## Open questions or contradictions found

1. **`promotion` and `assistant` are never produced.** `content/action-runtime/interference/layer-kind.ts` says so in
   its header. So `dialog.promotion` is `unknown` while the deal wheel (or any unclassified dialog) shows; Core R2
   handlers should gate on `dialog` + name, or a classifier for those kinds is needed (outside this brief).
2. **C9 `{ value: string }` semantics are unspecified.** Implemented as a bound value Core supplies by path in
   `context.values`, symmetric with `{ input }` -> `context.inputs`; missing -> `unknown` (`unbound`). Core R2 should
   confirm, and must pass the resolved maps.
3. **`fact` vocabulary is this host's** (listed above and in `WEB_AUTOMATION_FACT_KINDS`); C9 leaves it opaque. R2's
   authoring guidance should use these words.
4. B2 also names overlay and loading evidence as facts; only dialogs were in this brief's kinds, so a covering layer
   without a dialog role (crossborder's welcome popup) is not visible to `dialog`. Not added.
5. Brief said "vitest"; the repository's tests are `node:test`. Ran them as above.
6. Core will call: `WebAutomationHostRuntime.factEvaluator(conditions, context)` from
   `createWebAutomationHostRuntime` / `bindWebAutomationHostRuntime` (capability `fact-evaluation`), typed by
   `WebAutomationFactEvaluator`, `WebAutomationFactCondition`, `WebAutomationFactResult`,
   `WebAutomationFactEvaluationContext`; standalone `createWebAutomationFactEvaluator(dispatch)`; client capability
   id `WEB_AUTOMATION_FACTS_CAPABILITY_ID` (`web.facts`, version 1).
