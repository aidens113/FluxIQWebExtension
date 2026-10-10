# t419: target matching ignores id and selector tokens absent from the page

## Outcome

Partial. The structural fix is in and tested, and the crossborder recovery-matrix case passes. Four content-harness
rows fail only on exact score pins, in `e2e/content/tests/`. Those pins sit outside my owned paths, so they still need
the supervisor to update them (details below). Every behavioural assertion that ran before a pin passed.

## What changed and why

- `apps/extension/src/content/identity/score.ts`: `comparableFingerprint` now applies two filters, cheap one first.
  1. The existing shape rule: a generated id or selector that no candidate in the pool carries is dropped.
  2. New: the page is asked. A recorded id that no element on the page carries is dropped whatever its shape, and so
     is a recorded selector that quotes any identifier no element carries. A dropped token neither supports nor
     contradicts any candidate. A token that some element still carries is handed to Core exactly as before.
  - `CandidateSelection` gains an optional `dropped: DroppedToken[]`, with entries like
    `{ signal: "id" | "selector", token, because: "absent" | "generated" }`. This is the measurement that records
    which tokens were set aside. `DroppedToken` is exported from the identity barrel. The module header documents R4a.
- `apps/extension/src/content/identity/page-tokens.ts` (new): `pageTokens(element)` answers whether the page carries a
  token. It asks the candidate's `ownerDocument` first (`getElementById`, or `querySelector('[attr="v"]')`). Only when
  the document says no does it walk the open shadow roots (`composedRoots`), lazily and at most once per scoring. A
  document that cannot be asked (the unit tests' stand-ins) answers `undefined`, and the token keeps today's meaning.
  It does not use `CSS.escape`, so it also runs in Node.
- `apps/extension/src/content/selector/quoted-anchors.ts` (new): `quotedAnchors(selector)` reads a selector string back
  into the identifiers it is addressed through: `#id`, plus `[id|data-testid|data-test|data-cy|name="v"]`, with CSS
  escapes undone. It ignores classes, structure, prefix matches and a `#` inside a quoted value. Exported from the
  selector barrel.
- `volatile-identifier.ts` is unchanged (brief item 2). The R4a debug report's "3+ alternations" probe rule flags
  `mp3player`, `ipv4addr` and `x86-64`, which are real words, and still misses 43% of the scenario's ids. That is not
  a clear rule, so I did not widen it.
- `resolve-target.ts` is unchanged. Its selector stage already treats an absent token as a miss, because the selector
  matches nothing. Its miss text is pinned verbatim by `identity-resolution.spec.ts:228`, `resolve-target.spec.ts:127`
  and `scroll.spec.ts:114`. Scoring covers both the Level 2 path and the veto (`scoreTargetCandidate`), so there was
  nothing to add there.
- Tests:
  - `identity/tests/page-tokens.test.ts` (7 rows): the R4a case rebuilt from the crossborder item markup (the
    quantity box with recorded `#fb1l6ufkg`, the page now drawing `fb8y7yz1`, and the search and chat inputs as the
    family). Without page access it reproduces the run's refusal under the floor. With page access it resolves the
    quantity box, compares neither id nor selector, and reports `dropped`.
  - The other rows cover: a real id still present wins; a token carried by a different element still contradicts
    (and scores lower than when it is absent); a selector is dropped or kept by the anchor it quotes; a generated id is
    dropped without asking the page.
  - `selector/tests/quoted-anchors.test.ts` (4 rows).

## Commands run and observed results

- `cd apps/extension && EXTENSION_TEST_BUILD_LABEL=t419 node scripts/test-extension.mjs content/identity content/selector action-runtime`
  printed `# tests 441 # pass 441 # fail 0`. After a lint fix to the new test, the page-tokens test re-ran:
  `# pass 7 # fail 0`.
- `npx tsc -p tsconfig.json --noEmit` (apps/extension) exited 0 with no output, run twice: before and after the last
  edit.
- `pnpm build` (apps/extension): chrome, firefox and e2e-chromium each printed `verified 22 files`.
- `node scripts/structure-audit.mjs | grep -E "FAIL|structure-audit:"` first printed one FAIL, `statement-packing` in
  my new test at line 156. After the fix it printed `structure-audit: passed (184 warning(s), 651 baselined)`. None
  of the warnings are in changed files.
- `node scripts/test-content.mjs identity-resolution` gave 24 passed and 2 failed. Then
  `node scripts/test-content.mjs identity resolve-target large-page-resolution` gave 62 passed and 4 failed. All four
  failures are exact score pins:
  - `identity-resolution.spec.ts:322`, reworded-aria. Status is `succeeded` and it resolves the right Save, but
    `bestScore` is 0.602 against the pinned 0.389.
  - `identity-wire-chain.spec.ts:93`, both shapes. Status is `succeeded`, but `bestScore` is 0.602 (pinned 0.389) and
    `confidence` is 0.566 (pinned 0.366).
  - `identity-resolution.spec.ts:232`, renamed-redesign. It is still refused `TARGET_NOT_FOUND` as `fingerprint` with
    2 candidates and confidence 0, but `bestScore` is -0.085 against the pinned -0.104.

  Cause: the recorded `#save-settings` and its id are gone from the drifted page. Before, Core charged them as a
  missing identifier (-0.1 each, the constant those rows pin). Now they are not compared.
- `FLUXIQ_TEST_ENV_FILES=none pnpm lab recovery-matrix --case 1` exited 0 and printed
  `"cases":[{"caseId":"1","verdict":"passed","reasons":[]}]` (matrix run `rmx-2026-10-10T17-44-06-562Z-a1e96c`).

## Not verified

- The four failing rows stop at their first pin, so these assertions never ran:
  - renamed-redesign: its `runnerUpScore` (pinned -0.36), its Flow message `scoring -0.10`, and its no-click and
    final-state assertions.
  - reworded-aria: its `confidence` pin and its final-state poll.
  - wire-chain: its final-state poll.

  The pins need new values: reworded-aria and wire-chain take 0.602 / 0.566. renamed-redesign takes -0.085, and its
  runner-up and message still have to be measured.
- No live or paid run. I did not check whether R4a's real trial now resolves. The rebuilt case relies on the
  recorded descriptor carrying label "Quantity" (`nearbyLabel`, t229). The run never dumped that descriptor.
- Firefox content harness: not run.

## Open questions or contradictions found

1. **The wire.** The brief asks that the dropped tokens be recorded "in the resolution measurement". The wire
   resolution (`WebAutomationTargetResolution`, `domain/src/actions/types.ts`) is deliberately closed to page-derived
   strings, and a domain test pins its shape. So `dropped` currently lives on the content-side `CandidateSelection`
   only, and nothing reports it outward yet. Two options:
   - add a closed-enum field such as `droppedSignals?: ("id" | "selector")[]` to the domain type and gateway mapping;
   - append the tokens to the not-found or ambiguous failure record's `actual` in `resolve-target.ts`, which is
     outside its selector stage.

   I did neither, because each is outside my owned paths or stage.
2. **The floor's separation argument.** `TARGET_SCORE_FLOOR`'s doc says the drift case sits at 0.389 and the
   near-miss at 0.088 with contradicted ids. When a near-miss's own id is gone from the page, the near-miss is no
   longer contradicted. That now rests on `corroboration.ts`, as the doc already says it does for id-less near-misses.
   The veto and ambiguity specs all passed. The doc's numbers are now stale and could be refreshed with the pins.

## Follow-up: score pins updated (coordinator, same task)

**Outcome is now Done.** The coordinator gave me ownership of the two specs. Each pin was re-pinned to its new value,
with a one-line comment giving the reason: absent tokens no longer count against a candidate (t419). No other
assertion was loosened.

| Pin | Before | After |
| --- | --- | --- |
| `identity-resolution.spec.ts` renamed-redesign `bestScore` | -0.104 | -0.085 |
| renamed-redesign `runnerUpScore` | -0.360 | -0.256 |
| renamed-redesign Flow message, `scoring ...` | -0.10 | -0.09 |
| `identity-resolution.spec.ts` reworded-aria `bestScore` | 0.389 | 0.602 |
| reworded-aria `confidence` | 0.366 | 0.566 |
| `identity-wire-chain.spec.ts` `bestScore` (both shapes) | 0.389 | 0.602 |
| wire-chain `confidence` (both shapes) | 0.366 | 0.566 |

I also corrected the renamed-redesign comment's figures: -0.085 and -0.256, and 0.435 under the floor.

Older prose elsewhere in the file still quotes 0.389 (lines ~38, 52, 149, 344, 430-442, and the wire-chain header at
line 22). Those are comments, not assertions, and I left them as they were.

Commands, all run after the re-pin:

- `node scripts/test-content.mjs identity resolve-target large-page-resolution --reporter=list` printed
  `66 passed (1.0m)`. That includes every assertion after the pins: renamed-redesign's runner-up, its message and the
  absence of a click, and the final state of reworded-aria and of both wire-chain shapes.
- `node scripts/structure-audit.mjs` printed `structure-audit: passed (184 warning(s), 651 baselined)`.
