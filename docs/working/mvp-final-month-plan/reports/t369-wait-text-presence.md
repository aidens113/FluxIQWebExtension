# t369 report: a failed wait for text says whether the text is hidden or absent, and what is visible nearby

Worker: t369-text-presence. Worktree `C:\Users\osrs_\FluxStuff\fxwork\t369\!FluxIQWebExtension`, branch `task/t369-wait-text-presence`. Core not edited. Nothing committed.

## Outcome

Done. When a `web.dom.wait_for_text` with condition `present` (the default) or `visible` times out, or a `web.dom.assert` of kind `text` does not hold (STATE_MISMATCH or TIMEOUT), the content result now carries:

- `textPresence: "hidden" | "absent"`: `hidden` when the document's text nodes (scripts, styles and templates left out) hold the text but the page does not show it; `absent` when they do not hold it.
- `visibleNear: string[]`: at most 3 shown snippets, at most 80 characters each, ranked by resemblance to the awaited text.

When the page shows the text somewhere (for example, a scoped assert failed on its element), neither field is sent. A successful wait does not ask for the sighting and its result is unchanged. A wait for text to go (`absent`), `url` and `stable` are unchanged too.

On the real crossborder-marketplace page, with the closed mini-cart reading "Cart (0)":
- waiting for "Cart (0)" gave `textPresence: "hidden"`, `visibleNear: ["Cart", "…cure, remember your cart, measure performance and show you personalised deals.…"]`
- waiting for "Cart (5)", with injected lines, gave `absent`, `["Cart (4)", "Cart", "Cart (4) code"]`, with none of the sensitive injected text.

## Where the detail reaches Core (for t368)

The detail is **not** on the failure record. Core's `parseAutomationStudioFailureRecord` rejects a record with any unknown key, so adding fields there would drop the failure entirely. The two fields reach Core in two places:

1. **`FluxIQRuntimeCommandResult.metadata.failureDiagnostics.textPresence` / `.visibleNear`**: the adapter's failure detail, beside `url`, `title`, `failedTarget` and `evidenceDigest` (`domain/src/runtime/adapter.ts`, `failureDiagnostics`). This is only set on a non-succeeded command.
2. **`FluxIQRuntimeCommandResult.payload.result.textPresence` / `.visibleNear`**: the client's gateway payload, which the adapter passes on.

In both places, any snippet that the secret screen (`screenedWebLlmText`: Core's credential shapes plus card numbers) would change is **dropped**, not rewritten. A malformed pair is removed.

## What changed and why

Content (extension):
- `apps/extension/src/content/action-runtime/text-sighting/sight-text.ts` (new): reads the DOM once, after the wait has failed:
  - "shown" means it appears in `body.innerText` (whitespace collapsed); "held" means it appears in the text nodes.
  - Snippets come from shown text nodes (`checkVisibility` with opacity and visibility, or a box-and-style fallback), widened to their inline run.
  - It skips any text inside a control that `isSensitiveFormControl` marks (password, one-time code, card field, `data-sensitive`).
  - A run that contains such a control falls back to the node's own text. Field values are never read.
- `.../text-sighting/nearest-snippets.ts` (new, pure): the resemblance score is the share of the awaited words found (words of 2 or more characters) plus a lowercase-bigram Dice coefficient.
  - A snippet that shares no word must reach a Dice score of at least 0.35 to count.
  - Results are deduplicated, capped at 3, and longer snippets are cut to 80 characters around the first awaited word, with `…` marking each cut.
- `.../text-sighting/index.ts` (new barrel).
- `apps/extension/src/content/actions/types.ts`: new dependency `sightText(text)`.
- `apps/extension/src/content/action-runtime/execute-action.ts`: wires it in.
- `apps/extension/src/content/actions/wait-for-text.ts` and `assert.ts`: ask for the sighting only on the failure path, and pass it as `evidence.textSighting`.
- `apps/extension/src/content/action-runtime/results.ts`: `ActionResultEvidence.textSighting`. `buildResult` copies it to `result.textPresence` / `result.visibleNear` only on non-succeeded results.

Domain:
- `domain/src/actions/text-sighting.ts` (new): the types, the bounds (3 items, 80 characters) and `webAutomationTextSightingValue`, which keeps a known presence and well-formed snippets and drops over-long or non-string entries.
- `domain/src/actions/types.ts`: two optional fields on `WebAutomationActionResult`.
- `domain/src/client/index.ts`: exports the new module.
- `domain/src/client/gateway-mapping.ts`: `webAutomationActionResultPayload` copies the pair through the value function, only on a non-succeeded result.
- `domain/src/runtime/adapter.ts`: screened pair in `failureDiagnostics`; `dispatchPayloadWithScreenedSighting` applies the same screen to `payload.result`.

Tests:
- `apps/extension/src/content/action-runtime/text-sighting/tests/nearest-snippets.test.ts` (new)
- `apps/extension/src/content/actions/tests/wait-for-text.test.ts` (new)
- `apps/extension/src/content/actions/tests/assert-text-sighting.test.ts` (new)
- `apps/extension/src/content/actions/tests/assert.test.ts`: the stub now supplies `sightText: () => undefined`, because the stub throws on any dependency it was not given.
- `domain/src/client/tests/gateway-mapping-text-sighting.test.ts` (new)
- `domain/src/runtime/tests/adapter-text-sighting.test.ts` (new)
- `apps/extension/e2e/content/tests/text-sighting/tests/text-sighting.spec.ts` (new, T2 harness on crossborder-marketplace).

## Commands run and observed results

- Fail-first check: I temporarily put the HEAD copies of `wait-for-text.ts`/`assert.ts` back and ran the new extension unit tests (bundled with the same esbuild options as `scripts/test-extension.mjs`, then run with node:test): `not ok` for 1, 2, 7, 8 (the hidden, absent and both assert-sighting rows), `# pass 5 # fail 4`. With the change: all pass.
- Fail-first check, domain: I temporarily put back the HEAD `gateway-mapping.ts`/`adapter.ts` and ran the new domain tests: `# pass 2 # fail 7`. With the change: `# pass 9 # fail 0`.
- Narrow extension units: `nearest-snippets`, `wait-for-text`, `assert-text-sighting`, `assert`, `execute`, `action-runtime/results`, `wait-conditions` -> `# pass 39 # fail 0`.
- Narrow domain units: the new tests plus `gateway-mapping`, `adapter`, `adapter-check-wait`, `adapter-redaction` -> `# pass 59 # fail 0`.
- `pnpm test:content -- --workers=2 text-sighting.spec.ts waits.spec.ts check-assert.spec.ts` -> `33 passed (22.8s)`. Earlier on, the sensitive spec failed once on a ranking expectation ("Cart (4) lookalike" ranked fourth). I changed the injected line to `Cart (4)`, and it then passed.
- `pnpm --filter @fluxiq-web-extension/extension check` -> exit 0 (build-cache stored).
- `pnpm --filter @fluxiq-web-extension/domain check` -> exit 0.
- `pnpm --filter @fluxiq-web-extension/extension build` -> `chrome: verified 22 files`, `firefox: verified 22 files`, `e2e-chromium: verified 22 files`.
- `node scripts/structure-audit.mjs` -> `structure-audit: passed (177 warning(s), 257 baselined)`.
  - The first run failed `[failure-as-empty]` on a try/catch helper that turned a throwing `sightText` into "no sighting". I removed it, so a throw now propagates like any other verb error.
  - The only warnings on touched files are the existing file-lines advisories for `results.ts`, `gateway-mapping.ts` and `adapter.ts`, which are a few lines longer now.

## Not verified

- I did not run the full `pnpm test` or `pnpm check` suites (narrow checks only, per repository policy).
- Firefox content harness: not run (Chromium T2 only).
- No live Lab run and no provider calls.
- The build's evidence-loop node-run path (`runtime/llm-evidence/node-run`) does not carry the fields. Only the runtime adapter path, which trials use, carries them.
- Shadow-root text is not searched. The sighting reads `document.body`, as `pageText()` does.

## Open questions or contradictions found

- The brief says "on the failure detail". The failure record cannot hold the fields (see above), so "failure detail" here means `metadata.failureDiagnostics`, with `payload.result` as well. t368 needs to read one of these from the attempt; I did not check whether the attempt trace exposes `metadata`.
- "Unchanged" versus "screened": snippets are carried as sent, except that any snippet the secret screen would alter is dropped.
- When `sightText` throws, the verb's error propagates (as required by the structure audit's failure-as-empty rule). For an assert, this turns the result into the verb's own failure rather than STATE_MISMATCH. This is not expected in practice, because the read only uses DOM APIs that do not throw on a live document.
