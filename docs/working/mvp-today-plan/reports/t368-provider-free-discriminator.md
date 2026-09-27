# t368 — provider-free discriminator implementation

## Result

Implemented t365's content-free observations and exact assertions in the deterministic Core service fixture. The discriminator selects a Core draft-projection seam: the 4,000-byte projection begins withholding action inputs at decision 23 even though every retained step remains listed. No production code, provider, live artifact, shared plan, commit, or push was touched.

## Changed files

- `F:/!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime/tests/deepseek-bootstrap-exploration.test.ts`
- `F:/!FluxIQWebExtension/docs/working/mvp-today-plan/reports/t368-provider-free-discriminator.md`

The endpoint observations retain only iteration numbers, closed issue/reason codes, schema kinds, draft counts/byte measurements, and record-producer counts. They retain no provider output, instruction, page value, action id, input, selector, tool argument, or result.

## Discriminator results

The exhaustion branch proved before reaching the selected failure:

- decisions 11–26 retain only `bootstrap.cannot_answer_instruction` as completion feedback;
- decisions 11–25 offer exactly `complete`, `amend_draft`, `tool_call`, in that order;
- decision 26 offers exactly `complete`;
- all decisions 11–26 show a present draft with exactly `iteration - 4` listed steps (7 through 22), no unlisted steps, no `inputTooLarge` rows, and no over-budget entry;
- all decisions 11–26 resolve one registered record producer and expose that producer in the provider-visible node catalog.

Draft input completeness is the sole failed discriminator. Exact content-free measurements were:

| Decision | Listed steps | Bytes / 4,000 | Inputs withheld |
| --- | ---: | ---: | ---: |
| 11–22 | 7–18 | 2,223–3,893 | 0 |
| 23 | 19 | 3,990 | 4 |
| 24 | 20 | 3,978 | 10 |
| 25 | 21 | 3,995 | 15 |
| 26 | 22 | 3,991 | 21 |

The companion convergence branch passed every decision-11 discriminator: the same feedback code, exact three-kind grammar, seven complete steps within 4,000 bytes, and registered/visible producer counts of one.

## Selected Core seam

Yes. Per t365's predeclared failure-to-owner map, nonzero `withoutInput` selects the draft projection/packing seam owned by `flow-draft/entry.ts`, its `llm/evidence-loop/draft-shown.ts` measurement, and the configured 4,000-byte draft projection. It does **not** select completion-feedback retention, context-window retention, decision-schema construction, final-decision budgeting, catalog visibility, or answerability checking.

The focused next proof should preserve all 7–22 bounded fixture inputs through decision 26 using a more compact content-free draft projection within the existing 4,000-byte budget. This finding does not authorize raising provider-call, token, cost, time, evidence, or draft-byte ceilings.

## Validation

```powershell
pnpm --filter fluxiq exec vitest run src/programs/automation-studio/runtime/tests/deepseek-bootstrap-exploration.test.ts -t "reproduces|converges"
```

Expected discriminator result: FAIL — one file ran; the convergence branch passed, while the exhaustion branch failed at decision 23 because `withoutInput` was 4 rather than 0. All earlier exact feedback, grammar, catalog, and draft-shape assertions passed.

```powershell
pnpm --filter fluxiq check
```

PASS — `tsc --noEmit` exited 0.
