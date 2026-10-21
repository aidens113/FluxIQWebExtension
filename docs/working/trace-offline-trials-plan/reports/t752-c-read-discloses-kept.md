# t752 unit C: extract_list discloses its kept rows itself

## Outcome

Partial. The new parameter `discloseText` works in the extension reader, the domain contract, the dispatch path, the summary type, the catalog text and the `incompleteTextNext` sentence. All tests in the folders I touched pass, and the new headed content-harness spec passes on social-network-feed.

Three files outside my ownership need small edits before this is complete and typechecks (exact patches below):

- `structure/packet.ts` breaks the domain typecheck.
- `plan-resolution/extraction/slot.ts` refuses the new key in the model's handle form.
- `content/actions/extract-list.ts` does not yet send `disclosedRows`.

Three tests outside my ownership assert the old two-read wording and now fail. One spec owned by lane t749 does the same.

## What changed and why

Parameter name: `discloseText` (boolean, inside `extractList`). It follows the existing words `text-disclosure/`, `assertTextDisclosed` and "fully disclosed text".

Extension, `apps/extension/src/content/extraction/`:

- `text-disclosure/disclosure-control.ts` (new): `textDisclosureControl`. This is the recognition of a collapsed control (a button or role=button with a "See/Read/Show more" style caption, not expanded or hidden), moved unchanged out of `text-disclosure.ts`.
- `text-disclosure/refused-controls.ts` (new): a WeakMap from each `incomplete_text` refusal to the control it found. Because it is a WeakMap and not a property on the error, no DOM element ever rides on a serialized failure.
- `text-disclosure/text-disclosure.ts`: records the control in the map. The refusal's `actual` now names `discloseText: true` on the same read in place of the two-read shape. The `incomplete_text: field <name>` prefix is kept, which `refusal.ts` parses.
- `text-disclosure/press-disclosure.ts` (new): `pressTextDisclosure` presses one control and waits for it to open.
  - It refuses a control outside the row, a link with an href (or anything inside one), and a form's submit button.
  - It calls `click()`, then polls every 50 ms for up to 2 s (or the read's deadline, whichever is sooner).
  - The control counts as open once it has left the row, says it is expanded, is hidden, or no longer has a disclosure caption.
- `text-disclosure/read-disclosing.ts` (new): `readDisclosing` runs the row's read-and-judge. When that read is refused `incomplete_text`, it presses the control the refusal named, restores the condition notes, and judges the row again.
  - The refusal only fires on kept rows, and on rejected rows only where a rejecting condition judged a collapsed field. That is the existing rule in `assert-disclosed.ts` and `item-filter.ts`, so a row rejected on other fields is never pressed.
  - Each control is pressed at most once, and at most 8 per row. A row still collapsed after its press re-throws the original refusal, as today.
- `list-reader.ts`: the per-row read and judge became a `judge` closure. With `discloseText` it runs through `readDisclosing`; otherwise it runs once, synchronously, exactly as before.
  - `conditionNotes` snapshots and restores the conditions' `seen` and kept values, so a refused attempt leaves no partial-text values behind.
  - The outcome gains `disclosedRows`, the rows this document's read pressed; it is present only when `discloseText` is set.
  - The header records the cause. The file is 772 lines (budget 800).
- `text-disclosure/index.ts`: also exports `readDisclosing`.
- `tests/fake-shadow-dom.ts`: adds `replaceChildren` and `setAttribute`, so a test can redraw an element.

Domain:

- `actions/extraction/request.ts`: `discloseText?: boolean` on `WebAutomationExtractListRequest`, with documentation and the cause.
- `actions/extraction/schema.ts`: `discloseText: { type: "boolean" }`. `issues.ts` derives the allowed keys from here.
- `actions/extraction/read-request.ts`: carries only `true`. A non-boolean value is dropped and named `"discloseText"` (added to the `DroppedPart` union).
- `actions/extraction/summary.ts`: optional `disclosedRows` count. An invalid value drops the whole summary, the same rule every other count follows.
- `output-nodes/extract-list/issues.ts`: adds the code `web.extract_list.invalid_disclose_text`.
- `output-nodes/extract-list/catalog-text.ts`:
  - New grammar clause: `discloseText?: true opens each kept row's own "Read more" (e.g. a long review) first.` The grammar is now 686 of 700 characters.
  - The example declares `discloseText: false`, so Core will fold the key in beside `extractList`.
  - No social words; a test enforces that.
- `runtime/llm-evidence/rejection-next/next-sentence.ts`: `incompleteTextNext` now says to send the same read with `discloseText: true` and keep its conditions, and that no separate click step or repeat is needed. It also says what to do if the read is refused again with the parameter already set. It names the field when `instead` carries its code. The header records the history from t738 to t752.
- The dispatch and one-page request (`dispatch.ts`, `one-page-read.ts`): no change needed. `discloseText` is not in `OFF_THE_PAGE`, so it stays on the page request; a test proves this.
- The gateway lift (`gateway-action-parameters.ts`): no change needed, because it lifts through `webAutomationExtractListRequestValue`. A test line proves it.
- `capabilities.ts` lists no extract_list parameters, so nothing changed there.

Docs: `docs/architecture/extension-client.md`, the paragraph on incomplete text, is rewritten to describe `discloseText`, what it presses and refuses, the wait, the `disclosedRows` count and the history.

Tests, all written first and shown failing before the change:

- `apps/extension/src/content/extraction/text-disclosure/tests/read-disclosing.test.ts`: book reviews with "Read more", driven through `extractList`, six cases:
  - The kept long review is read whole and the long review dropped by the date condition is never pressed (`disclosedRows: 1`).
  - Without the parameter the read is refused and nothing is pressed.
  - A rejection that judged collapsed text is pressed and judged again (both `field` and `read` conditions).
  - With no conditions, every row is pressed.
  - A row still collapsed after its press is refused, pressed only once.
  - A link or a form's submit button is never pressed.
- `text-disclosure/tests/text-disclosure.test.ts`: the refusal names `discloseText`.
- `domain/src/actions/extraction/tests/disclose-text.test.ts`: reading, dropping, schema, and the summary count.
- `domain/src/output-nodes/extract-list/tests/disclose-text.test.ts`: the issue code, the dispatch keeping the key on the page, and the grammar and example.
- `domain/src/runtime/llm-evidence/rejection-next/tests/next-sentence.test.ts`: the two incomplete-text tests are rewritten.
- `domain/src/client/tests/gateway-command-parameters.test.ts`: one lift assertion added.
- New headed spec `apps/extension/e2e/content/tests/extraction/tests/social-read-discloses-kept.spec.ts`. Rows are picked by feed position. It runs two reads with `discloseText` and a position condition:
  - A read that drops the collapsed post leaves it collapsed.
  - A read that keeps it returns that post whole, with no `incomplete_text`, in one call. Other collapsed posts stay collapsed.

The reader test sits in `text-disclosure/tests/`, not `extraction/tests/list-reader.test.ts`. That folder is at the 25-file limit, and the file is 775 lines.

## Commands run and observed results

All tests below were run from the t752 tree.

Before the change:

- `EXTENSION_TEST_BUILD_LABEL=t752c node scripts/test-extension.mjs extraction/tests/kept-row-disclosure` printed `# pass 2 # fail 4`. Cases 1, 3, 4 and 5 failed (case 5: `0 !== 1`, not pressed). The file was later moved to `text-disclosure/tests/read-disclosing.test.ts`.
- `DOMAIN_TEST_BUILD_LABEL=t752c node scripts/test-domain.mjs extraction/tests/disclose-text extract-list/tests/disclose-text rejection-next/tests/next-sentence client/tests/gateway-command-parameters` printed `# pass 6 # fail 9`. All the new contract, issue, grammar, summary and next-sentence cases failed, as did the gateway assertion. The dispatch case already passed, because the page request already keeps unknown keys.

After the change:

- `node scripts/test-extension.mjs content/extraction` printed `# pass 395 # fail 0`. An earlier run showed 2 failures, both in another worker's in-progress `infer-fields-row-control.test.ts`; they passed on rerun.
- `node scripts/test-domain.mjs actions/extraction/tests output-nodes/extract-list/tests rejection-next/tests client/tests` printed `# pass 230 # fail 0`.
- `node scripts/test-domain.mjs plan-resolution/extraction/tests llm-evidence/structure/tests output-nodes/tests action-failure/tests node-run/tests` printed `# pass 495 # fail 3`. The 3 are non-owned tests asserting the old wording (listed under Open questions).
- `pnpm --filter @fluxiq-web-extension/extension check` did not get to run. Its gate stopped first: "FluxIQ Core's build at ...\t752\!FluxIQ is not current with its source". Core has uncommitted edits from another t752 unit under `result-verification/read-account/` and `project-agents/`. Core is read-only for me, so I did not rebuild it.
- I ran the underlying checks directly instead, against Core's existing build:
  - `node scripts/check-extension.mjs` gave 2 errors, both `domain/src/runtime/llm-evidence/structure/packet.ts(352,66): Property 'discloseText' is missing ... OptionalFields<WebAutomationExtractListRequest>`.
  - `npx tsc -p tsconfig.json --noEmit` and `npx tsc -p tsconfig.test.json --noEmit` in `domain/` gave the same single packet.ts error each. Nothing else.
- `pnpm --filter @fluxiq-web-extension/extension build`: not run. It runs the same Core gate and `tsc --noEmit`, which fails on packet.ts. The content harness builds its own bundles from source with esbuild (`e2e/content/global-setup.ts`), so the spec ran on the current source.
- `node scripts/test-content.mjs -- e2e/content/tests/extraction/tests/social-read-discloses-kept.spec.ts --headed`:
  - The first version failed: the feed showed only 1 collapsed post, and the spec asked for 2. I restructured it into two reads.
  - Then: `1 passed (4.5m)`. Log line: `read-discloses-kept {"rows":4,"collapsedAtStart":1,"kept":3,"tookMs":5622,"disclosedRows":null}`. `disclosedRows` is null because the verb does not send it yet (patch 3).
- `node scripts/structure-audit.mjs` printed `2 violation(s)`. Both are another worker's:
  - `[directory-files] apps/extension/src/content/extraction/tests/: 26 source files`. The 26th is `infer-fields-row-control.test.ts`; I moved my test out of that folder.
  - `[file-lines] infer-fields.ts: 863 lines`.
  - My files appear only as warnings: `list-reader.ts` 772 lines, `read-request.ts` 474, `summary.ts` 495.

## Not verified

- The whole path through a model build. With `slot.ts` unchanged, a handle-form `extractList` carrying `discloseText` is refused `web.handle.malformed` at `["discloseText"]`. So the parameter is not yet usable by the builder.
- Whether Core's read-account text shows `disclosedRows` to the judge or builder. Core is read-only to me and has another unit's edits in that area.
- `disclosedRows` reaching the result's `extraction` summary. It needs patch 3.
- The full `pnpm check` and builds, which are blocked by the stale Core build and by packet.ts.
- The `tookMs` of 5.6 s for the second spec read was not broken down between the list waits and the press wait.
- A read continued across documents. `disclosedRows` counts per document and is not carried in the checkpoint (`continued-read/` is not owned). A Flow read reads one page, so it never continues.

## Open questions or contradictions found

Required edits outside my ownership (none of them touched by t749):

1. `domain/src/runtime/llm-evidence/structure/packet.ts` ~line 364, in `boundList`'s `present<...extractList>({...})`. Add after `sort: undefined`:
   `// Whether the read opens each kept row's own collapsed text is the plan's to say too.`
   `discloseText: undefined`
   This fixes the only typecheck error.
2. `domain/src/runtime/llm-evidence/plan-resolution/extraction/slot.ts`:
   - Add `"discloseText"` to `LIST_KEYS`.
   - After the `maxItems` copy (before `webAutomationExtractListRequestValue(request)`), add:
     `if (value.discloseText !== undefined) { if (typeof value.discloseText !== "boolean") return refused("web.handle.malformed", ["discloseText"]); if (value.discloseText) request.discloseText = true; }`
   - Mention it in the header's key list.
   - Without this, the catalog example's `discloseText: false` would also be refused once Core folds it in.
3. `apps/extension/src/content/actions/extract-list.ts`, in `summaryOf`, add:
   `...(outcome.disclosedRows === undefined ? {} : { disclosedRows: outcome.disclosedRows })`

Tests outside my ownership that assert the old two-read wording and now fail:

- `domain/src/runtime/llm-evidence/action-failure/tests/refusal.test.ts`:
  - Line 32: `/registered row-bound click/u` should become `/discloseText: true/u`.
  - The lines asserting `/without the field \`summary\`/u` and `/with the field \`summary\`/u` should become `/the field \`summary\`/u` and `/discloseText: true/u`.
- `domain/src/runtime/llm-evidence/node-run/tests/run.test.ts:576`: the old shape regex should become `/discloseText: true.*keep its conditions/u`.
- `apps/extension/e2e/content/tests/extraction/tests/social-read-completion.spec.ts` (lane t749; not edited):
  - Line 49 `/incomplete_text.*registered row-bound click/` will fail against the new refusal text.
  - Line 167 `/nonempty.*row-context.*For Each.*.../` will fail against the new next sentence.
  - Its test at line 90 exercises the retired two-read shape.
