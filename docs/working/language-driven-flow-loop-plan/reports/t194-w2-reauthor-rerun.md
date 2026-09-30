# t194-w2: why the re-author could not re-run the Flow's own extraction step

Worker report for brief t194-w2. Evidence: `run-munnhi5q-4867dabe`,
`decision-trace.json` `flows[0].runs[0].recovery.resultReauthor.attempts[0].evidenceLoop.steps`
and, for comparison, the build's loop at `flows[0].adaptations[0].evidenceLoop.steps`.
Line numbers are HEAD (`92b35192`) unless marked "now".

## Outcome

Done. There were two separate defects, both in the downstream domain. Neither
is in Core, and Core's per-loop decision history (t189) does not leak. Both are
fixed with tests that fail without the fix and pass with it. Core is unchanged.

## Causes

### 1. `answered_the_same_again` on the re-author's first detection

- Produced at `domain/src/runtime/llm-evidence/repeated-refusal.ts:84`
  (`answer.resultReason = "answered_the_same_again"`), when the serialized
  refusal equals the last one stored under the same key (`:73-76`).
- The key is set at `domain/src/runtime/llm-evidence/tools.ts:320` as
  `session \0 project \0 flow \0 toolId`, from one `createWebLlmRepeatedRefusals()`
  per runtime (`tools.ts:237`). The key contains no loop, no call input and no
  page. A repeat is detected on the **answer bytes per tool**. It is not detected
  on the call or on the page.
- The build's last detection (build loop step 27, iteration 20) was refused
  `no_repeating_structure` / `nothing_repeats_on_page`, and nothing on the
  detect key cleared that slot. Only a non-refusal answer from the same tool
  clears it (`:67-71`). The Flow run does not go through `executeTool`. So the
  re-author's first detection (iteration 1), in the same session, project and
  Flow, produced the same bytes and was counted `repeatedAnswer: 2`.
- It is not Core's history. The only producer of the string is the domain file
  above; Core has only a comment at `runtime/loop-limits/evidence-loop.ts:65`.
  Core builds `history`, `answeredRequests`, `amendmentMemory` and `noProgress`
  inside `runAutomationStudioLlmEvidenceLoop`
  (`runtime/llm/evidence-loop.ts:243,276,287,308`), so each loop gets its own.
- The later `answered_the_same_again` rows on `core.run_node` (iterations 3, 4
  and 8) are genuine repeats inside the re-author: the same
  `extraction_handle_required` refusal each time, 360 bytes, then 379 with the
  count. They are a consequence of cause 2.

### 2. `extraction_handle_required` on the rerun of the inherited f9

- Produced at `domain/src/runtime/llm-evidence/plan-resolution/resolve-plan-node.ts:371`:
  a literal `extractList` (`resolveWebExtractionSlot` returned `literal`) is
  refused `web.handle.extraction_required` whenever
  `stores.extractions.issuedFor(scope)` holds (`structure/handles.ts:110-113`).
  It surfaces through `node-run/run.ts:253` (`target_unobserved`) and is mapped
  to the reason at `tool-rejection.ts:468`.
- The handle it wants is an `extraction.N` issued by `web.detect_repeating_structure`
  for this project and Flow, written as `extractList: {handle, fields?, where?, ...}`.
- Why f9 has none: during the build the draft keeps the handle
  (`node-run/run.ts` `flowParameters`), but assembly resolves it, and the Flow
  **persists the resolved literal**: `item` plus field `selector`s
  (`flow-lane.json`, `parametersWithheld: extractList.item, extractList.fields.*.selector, ...`).
  The re-author's draft is seeded from the persisted node parameters (Core
  `runtime/llm/node-tools/draft-from-flow.ts`), so f9 is a literal.
- Why that literal is refused: `issuedFor` is keyed only by project and Flow,
  and it is still true from the build's two detections. The rule "a literal
  after a detection is a guess" therefore fired on the Flow's own step, which
  was written by this domain's resolver and not guessed. It fires whether the
  step is rerun as it stands or amended.
- Why an amendment could not work even without the refusal: the model is shown
  the seeded step with every `selector` key withheld
  (`runtime/llm/harness/draft-screen.ts`). A `rerun` replaces the whole input
  (`flow-draft/amendment.ts`, "write every key it needs"), so each amended field
  comes back without its selector. A field spec without a selector reads the
  item itself (`actions/extraction/request.ts:34`). The re-author's page also
  had no detectable list (its detection found nothing repeating), so it could
  not get a fresh handle either.

## What changed and why

1. **The repeat count belongs to one loop** (`repeated-refusal.ts`, `tools.ts`).
   - `WebLlmRepeatedRefusals.answered(scope, toolId, answer)` gains
     `startedOver(scope)`, which lets go of every slot in that
     session/project/flow scope (now `repeated-refusal.ts:75,80,106`).
   - `executeTool` calls `startedOver` when the call is the loop's opening look
     (now `tools.ts:316`). The opening look is recognised by
     `opensExploration`: toolId `core.run_node` and callId
     `initial.core.run_node` (now `tools.ts:526-538`). Core files every loop's
     free first look under `initial.<toolId>` (`runtime/llm/evidence-loop.ts:402`),
     and a model cannot reuse that id inside a loop that already used it,
     because Core suffixes a reused id (`evidence-loop/call-id.ts`).
   - Inside a loop, a genuine repeat (same tool, same answer) is still counted.
2. **A Flow's own extraction is its detected list, not a guess**
   (`structure/handles.ts`, new `plan-resolution/own-extraction-list.ts`,
   `resolve-plan-node.ts`).
   - The handle store now remembers, per (project, Flow, frame, item selector),
     each field under every key it answers to: the detected keys (on `retain`)
     and the plan's keys (new `wrote`, called whenever an extraction handle
     resolves, now `resolve-plan-node.ts:368`). This is bounded to 64 lists and
     64 keys per list, and it outlives handle eviction.
   - `ownList(scope, item, frameId)` reads it back.
   - In the literal branch (now `resolve-plan-node.ts:378-383`), a literal whose
     `item` is a list this Flow detected, in the same frame
     (`browserFrameId`), is no longer refused:
     - As it stands, it is `unchanged`.
     - If a field comes back without a selector, it gets exactly the selector
       its key already had, but only when the kind matches and, where the field
       names an attribute, the attribute matches too. The result is `resolved`.
     - A key no column answers to, or a kind that differs, is left as written.
       Nothing is guessed.
   - A literal naming any other item, or the right item in another frame, is
     still refused `extraction_required`.

## Tests

New, each confirmed failing before the fix and passing after it:

- `domain/src/runtime/llm-evidence/tests/repeat-across-explorations.test.ts`
  - Before the fix it failed with `actual 'answered_the_same_again'`, expected
    `'nothing_repeats_on_page'`, on the re-author's first detection.
  - It also asserts that a genuine repeat is still counted in both loops.
  - A second case checks that a detection whose callId merely looks like
    `initial.*` does not reset the count.
- `domain/src/runtime/llm-evidence/plan-resolution/tests/own-extraction-list.test.ts`
  - Three cases: a verbatim rerun is `unchanged`; an amendment written from the
    withheld draft is `resolved` with exactly the Flow's selectors, a detected
    key restores its own selector, and an unknown key or wrong kind is left as
    written; an undetected item, another frame, or another Flow's keys are
    refused or unchanged.
  - Before the fix all three failed with `web.handle.extraction_required`.
- `domain/src/runtime/llm-evidence/tests/reauthor-reruns-own-extraction.test.ts`
  - End to end: build (opening look, detect, extract by handle), assembly
    (`resolvePlanNodeParameters`), then re-author (opening look, then a
    `run_node` rerun with selectors withheld and a `where` added).
  - It asserts `web.inspect.succeeded` and that the `web.dom.extract_list`
    command reaching the page carries the Flow's selectors.
  - With the fix disabled by a temporary edit (since reverted) it failed with
    `actual 'web.action.rejected.target_unobserved'`, which is the live symptom.

## Commands run and observed results

- Targeted bundles, built the way `scripts/test-domain.mjs` builds them (a
  scratch runner with esbuild and the same externals, output to the ignored
  `domain/.test-build-scratch/t194-w2`, removed afterwards):
  - new tests before the fix: `repeat-across-explorations` 1 of 2 failed;
    `own-extraction-list` 3 of 3 failed.
  - after the fix: `# tests 5 # pass 5 # fail 0` (repeat-across-explorations
    plus extraction-failure-detail), `# tests 3 # pass 3` (own-extraction-list),
    `# tests 1 # pass 1` (reauthor-reruns-own-extraction).
  - every `tests/*.test.ts` under `domain/src/runtime/llm-evidence` (50 files):
    `# tests 344 # pass 344 # fail 0`.
- `DOMAIN_TEST_BUILD_LABEL=t194-w2-suite bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t194-w2 domain" node scripts/test-domain.mjs`
  (in `domain/`): exit 0, `# tests 911 # pass 911 # fail 0 # cancelled 0`, no
  entry failed to load. The scratch label directory was removed afterwards.
- `npx tsc -p tsconfig.json --noEmit` (domain): exit 0, no output.
- `npx tsc -p tsconfig.test.json` (domain, noEmit): exit 0, no output.
- `node scripts/structure-audit.mjs` (downstream root):
  `structure-audit: passed (124 warning(s), 120 baselined)`. That is the same
  count as before my edits.
- Core: nothing changed, so no Core vitest or Core structure audit was run.

## Not verified

- No live run, per the brief.
- Whether the live re-author model writes its amended f9 in the shape the fix
  restores: `item` copied from the draft, and fields under the Flow's own keys
  and kinds. The draft shows `item` and the field kinds, and only `selector` is
  withheld, but the model's actual amendment input is not recorded anywhere in
  the run bundle.
- Two gaps remain in the restoration:
  - A `where` condition whose `read` selector was withheld
    (`extractList.where.1.read.selector` on this Flow) is not restored. A rerun
    that copies it reads the item's own text for that condition.
  - The detection handle behind the Flow is not given back to the model. If the
    model writes handle vocabulary without a handle, the step is still refused.
- The Lab runs one runtime per scenario. After a domain restart the
  list memory is empty. `issuedFor` is then false too, so a literal passes
  `unchanged`, which is the pre-existing behaviour, but withheld selectors are
  not restored.
- The loop-start signal depends on Core's `initial.<toolId>` call id, which is
  a string convention and not an exported constant. If Core renames it, the
  reset silently stops, and the only effect is that cross-loop repeats return.
  Pinning it would need a Core export plus a Core dist build, which this brief
  forbids.

## Open questions or contradictions found

- The brief asked whether a repeat is detected "on the page rather than on the
  call". It is detected on neither: it compares answer bytes per tool within a
  session/project/Flow. I kept that inside a loop, because different calls
  answered identically are still worth flagging to the model, and changed only
  its lifetime. If the supervisor wants "same call" to be part of the key, the
  place is `repeated-refusal.ts` `slot()`.
- `issuedFor` also outlives the loop. A literal the re-author's model invents,
  naming no detected item, is still refused with the text "a repeating list was
  already detected here", which is true of the Flow but not of that model's
  loop. I left it, because such a literal is still a guess. Resetting it at the
  opening look would be the same pattern as fix 1.
- `domain/src/runtime/llm-evidence/node-run/replay.ts` and
  `node-run/tests/replay-ambiguous-target.test.ts` carry another lane's
  uncommitted work. I did not touch them. They were included in, and passed,
  the directory and whole-suite runs above.
