# t194-w48: reads cheap after the request that produced them; links relative

## Outcome

Done. Only the newest read's rows are shown whole now. In each earlier read a newer read replaced, Core puts `supersededBy` in place of the rows inside `read`, and the domain's short account of the read stays. A new read-only Core tool, `core.recall_result`, returns those rows whole. Kept rows and rejected rows write same-origin links as paths from the origin, which the read states once. Nothing new is refused.

Run 13's last request (`0032-decide`), rebuilt from its `steps/` files:

| Case | Evidence section | Request body (request.json) | request.txt |
| --- | --- | --- | --- |
| As sent | 150,634 | 238,196 | 290,929 |
| Rebuilt from steps with the old shaping and page keys (sanity check) | 150,634 (identical bytes) | 238,196 | 290,929 |
| New read shaping (F40 + w48 links/account), page keys only | 106,737 | 191,379 | 243,728 |
| New shaping + read rows declared (w48, final) | **62,184** | **144,732** | **182,608** |

Per read in that request: `extract.results1` 26,146 -> 2,358; `rerun.12` 45,563 -> 2,388; `rerun.13` (the newest, still whole) 59,092 -> 37,605. Absolute-URL characters in the user message went from 49,353 to 1,547.

## What changed and why

**Core** (`fxwork/t194/!FluxIQ`, `runtime/llm/`):
- `decision-context/view-groups.ts` (new): groups the declared view keys. A plain key is a key at the top of the result, which is the page as before. `holder.member` is a member of the object the result holds under `holder`. Each holder is its own kind of view.
- `context-window.ts`: replaces each group separately, newest back. For a held group the reference goes inside the holder (`read.supersededBy`) and names the next result whose same holder carried one. Each reference is written once and never changes, which keeps the cache stable. A click or a page view never replaces read rows, and only a newer read does. The answers of Core's own recall tool form one more group, so an earlier recall's `restored` is replaced by the next recall. Top-level behaviour is unchanged: the B1 tests and `request-prefix.test.ts` pass as they were.
- `evidence-recall/` (new: `tool-id.ts`, `description.ts`, `tool.ts`, `restored.ts`, `binding.ts`, `index.ts`, `tests/binding.test.ts`): `core.recall_result {callId}`.
  - It only observes: no page capture, never a Flow step, never refused. An unknown id is answered `{recalled, found:false}` with `core.recall.not_found`.
  - It answers from the results the binding saw come back (each call's evidence, kept by callId), and returns that result's held members whole: `{recalled, restored:{read:{extracted, rejectedRows, rejectedRowsNote}}}`.
  - It never returns the page, because the target can be looked at again.
  - It is offered only when some `holder.member` key is declared, so a domain that declares only page keys sees no new tool.
- `harness-options/registry.ts`: `OBSERVED_STATE_KEY` now also accepts one `holder.member`. `evidenceLoopBinding` wraps its result with `automationStudioLlmEvidenceRecallBinding`.
- `harness-options/binding.ts`: doc comment only.
- Plumbing: the declaration still flows as `observedStateKeys: readonly string[]` (binding -> registry -> service/runtime-exploration -> loop config -> `evidence-loop.ts` -> `shown.ts` -> window). The type did not need to widen. `evidence-loop.ts`, `service.ts`, `loop-configuration.ts` and `shown.ts` are untouched.
- Barrels: `decision-context/index.ts` and `llm/index.ts` export the new modules.

**Downstream** (`fxwork/t194/!FluxIQWebExtension`, `domain/src/runtime/llm-evidence/`):
- `observed-state/read-rows-keys.ts` (new): `read.extracted`, `read.rejectedRows`, `read.rejectedRowsNote`. A click's `read` holds none of them.
- `observed-state/view-keys.ts` (new): the page keys plus the read keys.
- `tools.ts`: the declaration line only, `observedStateKeys: WEB_LLM_VIEW_KEYS`, and its import.
- `node-run/shown-rows/` (new: `links.ts`, `account.ts`, `index.ts`):
  - `links.ts`: one writer per read. A same-origin absolute address becomes its path from the origin, and other origins stay whole. A path starting `//` stays whole.
  - `account.ts`: adds `origin` (once, only when some link was written short), `firstRows` (the first 3 kept rows), and `restOfRows` (one sentence naming `core.recall_result`). These go ahead of `extracted`, so a replaced read keeps `extraction`, `validation`, `firstRows`, `restOfRows` and `origin`: rows kept, rejected/alone per condition, pages, stop reason, the first rows and how to get the rest.
  - Reads whose `extracted` is not a list, and clicks, are unchanged.
- `node-run/rejected-rows.ts`: uses the shared writer instead of page-view's `webLlmLinkWriter`, so `rejectedRows` no longer carries its own `~`. Its result goes through `webNodeReadOutcome`.

**Why paths from the origin, not `~`.** `node-run/shown-addresses.ts` remembers the addresses a read showed by parsing its rows. It reads only absolute addresses or paths from the site root, against the read's page. A `~/...` link is neither. With `~`, a product page a read listed would have become "not shown" for a later navigation. F40's `~` in rejected rows already had this gap; this change closes it. The cost is that on the Lab's stores a link keeps the `/scenarios/<store>` prefix. On a real site `~` is the bare origin and the two forms are the same length.

## Commands run and observed results

- Core, from `packages/fluxiq`: `npx vitest run` on `runtime/llm/tests`, `decision-context`, `evidence-recall`, `harness-options` and `evidence-loop/tests/request-prefix.test.ts` -> `Test Files 44 passed (44)`, `Tests 505 passed (505)`.
- `bash .../heavy.sh "t194-w48 core check" pnpm check` -> exit 0. It ran twice, the second time after the barrel-import fix.
- `pnpm build` via heavy.sh -> exit 0. Core `dist` had to be rebuilt: the domain links Core's `dist`, and the old `dist` refused the dotted keys (`observed state keys are invalid`), failing 6 tests in `runtime/llm-evidence/tests/recovery-selector-hints.test.ts`. After the rebuild they pass.
- Core `node scripts/structure-audit.mjs` -> exit 0. A first run failed for 26 files in `llm/tests` and for deep imports; both are fixed. The held-view tests were merged into `tests/context-window.test.ts`, and imports now go through barrels. The audit prints "1 baseline entries can be lowered"; I did not run `structure:baseline`.
- Domain, via heavy.sh: `npx tsc -p domain/tsconfig.json --noEmit` -> exit 0, and `-p domain/tsconfig.test.json --noEmit` -> exit 0.
- `narrow-tests.mjs ... t194-w48` over `runtime/llm-evidence/node-run`, `observed-state`, `harness-options` and `runtime/llm-evidence/tests` -> `53 test files`, `# tests 339`, `# pass 339`, `# fail 0`.
- Downstream `node scripts/structure-audit.mjs` -> exit 0. A first run failed because three files in `node-run/` began with `read-`; the new files moved to `node-run/shown-rows/`.
- Measurement: `node <scratch>/w48-measure/run.mjs`. It bundles `<scratch>/w48-measure/measure.ts` with the domain's esbuild into `domain/.test-build-scratch/t194-w48-measure/`, which is gitignored. It rebuilds the `0032-decide` evidence from each tool step's `call.json` and `result.json`. Run-13 reads are pre-F40, so each read's rejected rows are turned back into `extraction.rejectedSamples` before the new `webNodeReadWithRejectedRows` runs. The result then goes through Core's `automationStudioLlmDecisionContextShown`, with the history, draft and budget entries kept from the request. It is rendered as the compact body and with Core's `automationStudioLlmStepLogRequestText`. The numbers are in the table above.
- New tests fail on the old source by construction: they import modules that did not exist (`evidence-recall/`, `view-groups.ts`, `shown-rows/`, `read-rows-keys.ts`). The changed F40 assertions expect `origin` and `/scenarios/...` where the old code wrote `~`. I did not run them against the old source, because stash and checkout are forbidden.

## Not verified

- No live run and no model call. Two things are untested:
  - whether the model actually calls `core.recall_result`, or reads `restOfRows` correctly;
  - the loop's own handling of the new tool, end to end, through `runAutomationStudioLlmEvidenceLoop`. That includes the state-digest hook capturing the page around a recall, the repeat guard answering an identical recall from memory, and the step log. Only the binding and registry are unit-tested.
- I did not run any extension or Lab test that reads the shown `read` shape.
- I did not check the `web.browser.navigate` node with a root-relative URL the model might write. `shown-addresses.ts` accepts it; the navigate node's own resolution is untested.
- No full suites were run.

## Open questions or contradictions found

1. **Merge order.** The downstream declaration (`read.*` keys) requires the Core registry change. An older Core refuses the whole bundle (`observed state keys are invalid`), which breaks every build. Both repositories must merge together, and any consumer's Core `dist` must be rebuilt.
2. **Recall tool description, for t235.** It is new and in its own file: Core `runtime/llm/evidence-recall/description.ts` (`AUTOMATION_STUDIO_LLM_EVIDENCE_RECALL_DESCRIPTION`, about 470 characters). The tool id is `core.recall_result` (`evidence-recall/tool-id.ts`). The domain's `restOfRows` sentence names the id as a literal in `node-run/shown-rows/account.ts`, so the domain does not wait on a Core rebuild.
3. **The system instruction is unchanged.** It is in `evidence-loop-decision.ts`, which I do not own. It still says "To see again something only a replaced view showed, look at the target as it is now." For reads, `restOfRows` and the tool description say otherwise. t235 may want one clause there naming `core.recall_result` for held views.
4. **Links already shown as `~`.** No domain code expands a `~` link the model writes back (page-view links, t223). This predates w48, but the model now sees `~` in pages and root paths in reads.
5. **Newest-read cost.** `rerun.13`, the newest read, is still 37,605 characters, mostly F40's `rejectedRows`. That is by design, since the newest read is whole, but it is now the largest single entry.
6. **Docs.** `docs/architecture/` was not updated, because it was outside my owned paths. Two things are new and documentable: held view keys, and the recall tool.
