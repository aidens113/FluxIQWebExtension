# x3a-domain-inference: the domain share of X3.3

## Outcome

Done.

- **Check:** the domain type check passes (exit 0).
- **Tests:** the labelled domain tests pass, 440 of 440. The 23 new extraction
  rows are among them, every script's pass line printed, and no entry failed to
  load.
- **Audit:** the structure audit exits 1 on one violation, which is not in a file
  this brief owns: `[working-docs] docs/working/README.md is out of date`. It
  failed identically on the first run and on the one rerun, x1 reported the same
  failure, and nothing in `domain/src/extraction/` or either barrel was flagged.
- **Mutations:** ten, all on the real source. Each went red on the rows it
  targets and was restored; a SHA-256 comparison confirmed every file is
  byte-identical to its original. The permission classifier refused nothing.

## What changed and why

### The new `domain/src/extraction/` directory

This is the pure half of C4 inference. The page (X3-C) and the picker (X4) will
import it.

- **`signature.ts`** holds `webAutomationItemSignature({ tagName, role, testId, classes })`,
  `webAutomationIdentifierShape(value)`, and the parts type
  `WebAutomationItemSignatureParts`.
  - Both functions reproduce `apps/extension/src/content/evidence/repeating.ts:68-77`
    exactly:
    - the tag is lower-cased;
    - the role is trimmed and lower-cased, and is empty when absent;
    - in the test id, each run of digits becomes `#`;
    - the classes are sorted, the first 3 kept, and joined with `.`;
    - the four parts are joined with `|`.
  - `role` accepts `string | null | undefined`, so
    `element.getAttribute("role")` fits as is. `classes` accepts any
    `Iterable<string>`, so `element.classList` fits too.
  - `repeating.ts` is not edited. X3-C swaps its local copies for these.
- **`label-key.ts`** holds `webAutomationExtractionFieldKey(label, taken)`. It is
  the one function that turns a label into a key (D16, correction 3):
  - it lower-cases the label and drops accents (NFKD, then removes combining
    marks);
  - each run outside `[a-z0-9_-]` becomes one `_`, and none is left at either
    end;
  - the result is cut to 100 characters, or is `field` when nothing is left;
  - a prototype name gets `_field` appended;
  - a key already taken gets the first free suffix (`_2`, `_3`, and so on),
    with the base cut so the suffix still fits in 100.
- **`dataset-id.ts`** holds `webAutomationDatasetId(label, nonce)`, which returns
  `<name>:<nonce>`.
  - **The name:** the label, lower-cased and with accents dropped. Each run
    outside `[a-z0-9._-]` becomes one `-`, the name is cut so the whole id fits
    200 characters, and it falls back to `dataset`.
  - **The nonce is kept whole.** It is never cut or rewritten, because two
    nonces cut to the same text would give two recordings one id. A nonce that
    is not 1 to 64 of `A-Z a-z 0-9 . _ -` throws a `RangeError`, whose message
    does not repeat the nonce. A random UUID qualifies.
- **`proposal.ts`** holds three types: `WebAutomationExtractionProposal`,
  `WebAutomationExtractionProposalField` and
  `WebAutomationExtractionProposalFieldSpec`.
  - The shape is the report's: container, item, itemCount, fields (key,
    label, spec, coverage), an optional pagination, and confidence.
  - One deliberate difference, open question 2: a proposed spec is
    `Omit<WebAutomationExtractFieldSpec, "element">`.
- **`index.ts`** is the barrel.

`git diff` shows exactly one added line in each of the two barrels:

- `domain/src/client/index.ts` gains `export * from "../extraction";`;
- `domain/src/index.ts` gains `export * from "./extraction";`.

Before writing, a Grep over `domain/src`, `apps/extension/src` and `packages`
found none of the new exported names, so nothing collides.

### The field key: reuse, not move

I reused x1's predicate. `label-key.ts` imports `isWebAutomationExtractFieldKey`
through the `actions/extraction` barrel and asks it whether a derived key is a
prototype name. The pattern and the three reserved names are therefore still
written only in x1's `actions/extraction/field-key.ts`, and every derived key
passes the same predicate the parameter lift refuses by.

The 100-character bound is restated as a private constant, because the
derivation must cut to it. x1's file keeps its own copy private.

I did not move the predicate, for two reasons:

- **The layers would point at each other.** `actions/extraction`, the request
  contract, would import from `extraction/`, the inference layer, while
  `extraction/proposal.ts` imports the request types from `actions/extraction`.
- **It would edit files x1 has not committed:**
  `client/gateway-action-parameters.ts` and `actions/extraction/summary.ts`.

The new file is named `label-key.ts`, not the report's `field-key.ts`, so the
repository never holds two `field-key.ts` files (x1's open question 5). x1's
file, its barrel line and its importers are untouched.

### Tests (`domain/src/extraction/tests/`, 23 rows)

- **`label-key.test.ts`**, 8 rows:
  - the report's rows: "Product name" gives `product_name`; "" gives `field`;
    `__proto__` is never returned; "Price" after "price" gives `price_2`; a
    150-character label gives 100 characters.
  - trimming of dropped runs, accents, and `field` for labels that are
    non-Latin or control characters only.
  - the first free suffix, including filling a gap and comparing case exactly.
  - the suffix width change from `_9` to `_10`.
  - an every-output row over 24 labels, each taken twice. Every key must:
    - match the restated Core pattern (pointer `record-sets/schema.ts:19`,
      confirmed by Grep as `fieldIdPattern`);
    - not be a prototype name;
    - pass `isWebAutomationExtractFieldKey`;
    - not already be taken.
- **`signature.test.ts`**, 7 rows:
  - `row-1`, `row-2` and `row-12` share a shape, and ids with several numbers
    are reduced;
  - an absent or empty id gives an empty shape;
  - the exact `tag|role|shape|classes` strings;
  - role and tag casing;
  - classes are sorted, capped at 3, and independent of order;
  - a `Set` of classes;
  - rows of one numbered template sign alike, and a different template does not.
- **`dataset-id.test.ts`**, 6 rows:
  - exact ids, and the `dataset` fallback;
  - a new nonce gives a new id, including a nonce that differs only in case;
  - a 64-character nonce is kept whole and makes an id of exactly 200
    characters;
  - six refused nonces with a sentinel absent from the message, plus the
    longest accepted nonce;
  - an every-output row against Core's `datasetIdPattern`, restated with the
    pointer `record-sets/output.ts:11`, confirmed by Grep.
- **`proposal.test.ts`**, 2 rows:
  - a proposal's fields, mapped key to spec, type-check as a
    `WebAutomationExtractListRequest` and keep their keys and `exclude`;
  - a `@ts-expect-error` pins that a proposed spec cannot carry `element`.

## Commands run and observed results

Every command ran from `F:\!FluxIQWebExtension`, one at a time.

1. `pnpm --filter @fluxiq-web-extension/domain check`: exit 0, with no output from
   either `tsc`.
2. `DOMAIN_TEST_BUILD_LABEL=x3a pnpm --filter @fluxiq-web-extension/domain test`:
   exit 1; `# tests 438`, `# pass 437`, `# fail 1`.
   - The failing row was
     `not ok 39 - a long label is cut to 100 characters, and a suffix still fits`:
     actual `a×97_10`, expected `a×97_11`.
   - The fault was my test's setup, not the function. I had built the taken set
     with `a×98_10`, but a two-digit suffix is one character wider, so the
     function correctly cut the base to 97 characters, where `a×97_10` was free.
   - I rewrote the row to spell each taken key the way the function does. It
     now also asserts that `_10` takes 97 characters and that every taken key
     is 100 characters long.
3. `node scripts/structure-audit.mjs`: exit 1, printing
   `structure-audit: 1 violation(s) across 1 rule(s).` The only failure was
   `FAIL [working-docs] docs/working/README.md is out of date with the documents' header blocks.`
   A Grep of the output for `extraction`, `client/index` and `src/index` matched
   no finding line.
4. The check, after the test fix: exit 0.
5. The labelled test, after the fix: exit 0; `# tests 440`, `# pass 440`,
   `# fail 0`, `# cancelled 0`. All four script pass lines printed, and no entry
   failed to load.
6. **Mutations**, run by the scratch driver `...\scratchpad\x3a-mutate.mjs`
   between 2026-09-15T22:41:25Z and 22:42:41Z. For each one, the driver
   confirmed the search text matched exactly once (`MATCHES=1`), applied the
   replacement, ran the command, and restored the original in a `finally`
   block.

   | ID | Mutation | Command | Result (exit, failed rows) |
   | --- | --- | --- | --- |
   | M1 | spaces allowed in keys, the report's target | test | exit 1, `# fail 6`: `not ok` 33, 34, 35, 36, 37, and the key-pattern row 40 |
   | M2 | the prototype-name suffix line removed | test | exit 1, `# fail 2`: 37 `a prototype name is never returned`, and 40 |
   | M3 | the key not cut to 100 | test | exit 1, `# fail 2`: 39 and 40 |
   | M4 | the `field` fallback removed | test | exit 1, `# fail 2`: 36 and 38 |
   | M5 | classes not sorted | test | exit 1, `# fail 3`: 47, 48 and 49 |
   | M6 | class cap 3 raised to 4 | test | exit 1, `# fail 1`: 47 `classes are sorted and capped at 3` |
   | M7 | `\d+` changed to `\d` | test | exit 1, `# fail 2`: 43 `numbered test ids share one shape`, and 49 |
   | M8 | nonce pattern accepting anything | test | exit 1, `# fail 1`: 31, the nonce refusal |
   | M9 | the dataset name not cut to fit 200 | test | exit 1, `# fail 2`: 30 and 32 `every id returned is one Core accepts` |
   | M10 | proposal spec widened back to carry `element` | check | exit 2: `src/extraction/tests/proposal.test.ts(44,5): error TS2578: Unused '@ts-expect-error' directive.` |

   - M4 passes row 40 on its own. The empty base falls into the prototype-name
     branch and becomes `_field`, which is still a valid key, so row 36 is the
     one that catches it by name.
   - The driver then printed `restore <file>: identical` for `dataset-id.ts`,
     `label-key.ts`, `proposal.ts`, `signature.ts` and `index.ts`, followed by
     `all restored identical: true`, and exited 0.
7. **Final runs** on the restored source:
   - check: exit 0;
   - labelled test: exit 0; `# tests 440`, `# pass 440`, `# fail 0`,
     `# cancelled 0`. All 23 extraction rows (`ok 27` to `ok 49`) passed, all
     four script pass lines printed, and no entry failed to load.
   - structure audit (the one rerun): exit 1, identical to run 3, with the same
     single `working-docs` violation and 0 finding lines naming
     `extraction`, `client/index` or `domain/src/index`.
8. `git status --short -- domain` lists my changes as `M domain/src/client/index.ts`,
   `M domain/src/index.ts` and `?? domain/src/extraction/`. Everything else it
   lists is x1's or another worker's (for example `io/manifest-definitions.ts`
   and `output-nodes/definitions.ts`), and `domain/.test-build/` is not listed.
   `git diff` on the two barrels shows exactly one added line each, and warns
   `LF will be replaced by CRLF`.

No crash or failure appeared that only one observation supports. The one
failure, row 39, was a real assertion diff and has been explained and fixed.

## Not verified

- **The extension was not type-checked, tested or built.** Nothing imports the
  new functions yet; that is X3-C.
  - The claim that `webAutomationItemSignature` matches `repeating.ts` rests on
    reading its code and pinning the literal strings that code produces. It was
    not checked by running both on a real DOM.
  - Whether `@fluxiq-web-extension/domain/client` carries the new barrel into
    the extension bundle was not built.
- **Whole-repository `pnpm check`, `pnpm test` and `pnpm build` were not run.**
  Neither was the domain `build` script (the `dist` output).
- **Core was compared by Grep only, not run.** Grep found `fieldIdPattern` at
  `packages/contracts/src/record-sets/schema.ts:19` and `datasetIdPattern` at
  `packages/contracts/src/record-sets/output.ts:11`.
- **D3 is enforced by type only for `element`.** Nothing stops a string in a
  proposal (a label, selector or header) from holding page text. That is a
  page-side rule for X3-C, stated in the type's doc comments.
- **The report's two other mutation targets were not run.** An item selector
  matching a superset, and removal of the exclude pre-selection, are X3-C
  extension code outside this brief.

## Open questions or contradictions found

1. **The key function's file name and placement (judgement call).** The
   function is in `extraction/label-key.ts` and reuses x1's predicate. The
   report named the file `extraction/field-key.ts`. X3-C's and X4's briefs
   should import `webAutomationExtractionFieldKey` from the domain client
   barrel.
   - If no restated bound is wanted at all, x1's `field-key.ts` could export
     its 100-character bound, a one-line change to a file this brief did not
     own.
2. **The proposal spec leaves out `element` (a deviation from the report's
   type, for D3).**
   - `WebAutomationElementFingerprint` carries `text`, `value` and `href`
     (`actions/types.ts:80-101`). A proposal typed with the full spec could
     carry page values across the message channel before the user has decided
     which columns are sensitive.
   - X4.1's recorded definition should attach `element` when the extraction is
     recorded.
3. **Labels for text-leaf fields.** X3.3's `infer-fields` proposes "remaining text
   leaves as `text`". Such a field's `label` must come from structure (a test id,
   the tag or the selector), never from the leaf's contents, or D3 breaks. The
   doc comment says so, and the X3-C brief should say so too.
4. **The dataset id nonce is strict (judgement call).** A nonce that is not 1 to
   64 of `A-Z a-z 0-9 . _ -` throws a `RangeError` rather than being rewritten.
   X4 must pass one, for example `crypto.randomUUID()`. The label must be the
   dataset's given name, not page text.
5. **The Core pointer for dataset ids.** The pattern in D16 is right, but it
   lives in `record-sets/output.ts:11` (`datasetIdPattern`), not in
   `record-sets/schema.ts`. The field id pattern is at `record-sets/schema.ts:19`,
   as the report says.
6. **Beyond the report's key rule (judgement call).** Two additions, both pinned
   by tests:
   - accents are folded (NFKD), so "Prénom" gives `prenom`, not `pr_nom`;
   - punctuation runs at either end are dropped, not turned into `_`.
7. **Mutations ran on the shared source** while other workers were active in
   `domain/`. The window was 22:41:25Z to 22:42:41Z, 6 to 11 seconds per
   mutation. A domain test or check that another worker ran inside that window
   may have shown a red `extraction/tests` row, or `TS2578` in
   `proposal.test.ts`. That red came from these mutations, not from their work.
8. **The `working-docs` audit failure is not from this brief.** Its remedy is
   `pnpm structure:baseline`, which is the supervisor's to run.
