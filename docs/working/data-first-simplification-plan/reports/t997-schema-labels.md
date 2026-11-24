# t997: stored column labels carry no page values; a renamed column keeps its site label

Worker report, 2026-11-23. Brief: `briefs/t997-schema-labels.md`. Tree: `fxwork/t997-schema-labels`. No git mutation, no provider or paid call, and no Core edit. Every browser was visible and held to the snapshot sandbox.

## Outcome

**Partial.** Defect 1 is fixed: a stored schema label no longer carries a page value. Defect 2 is fixed as the lead decided it. The proof found that this decision does not cover the very column that motivated it, so the `model-aliases.ts` rewrite is **still needed** for `brightaisle_plus`:

- The detection labels `brightaisle_plus` with the page's own words, `Brightaisle Plus` (the badge's `aria-label`).
- Under the decision ("label = detected key, or the page's column words when they exist"), the model's `plus` is stored with label `Brightaisle Plus`.
- Core folds only case and whitespace when it binds, so `brightaisle_plus` binds nothing.

This needs a lead decision; see open question 1.

## What changed and why

**Stored labels: page words or key, never a sample** (defect 1)
- `structure/generated-label.ts`: new. Holds `webLlmGeneratedLabel`, moved unchanged out of `field-sample.ts` so that the packet and the stored label use one test for a generated class path. `field-sample.ts` now imports it; the model-facing behaviour is unchanged.
- `structure/stored-label.ts`: new. `webLlmStoredColumnLabel(key, pageLabel)` returns the screened page label when it is not a generated class path, and otherwise the key. A link-address label (`<path> url`, the page side's `LINK_LABEL_SUFFIX`) is tested without its ` url`, so a generated path stays generated.
- `structure/stored-labels.ts`: new. `webLlmUniqueStoredLabels` gives one label per field and adds no value. A label that folds (Core's rule: case and whitespace) to a label already given, or to **another** field's id, becomes `<label> (<id> <n>)`; this is the existing suffix format. A field may carry its own id as its label.
- `structure/packet.ts`: `boundList` builds the binding's `recordSchema` labels from `stored`, never from `shown.label`. The packet (`shown`) is unchanged.

**A renamed column keeps the site label** (defect 2)
- `plan-resolution/extraction/retained-schema.ts`: a field that reads the same detected column keeps that column's stored label under the model's id, and other fields use their id. Labels then pass through `webLlmUniqueStoredLabels`.
- I checked this against `bind.ts`, which binds an exact id first and then a unique folded label. So a declaration may name either the id or the label, with no Core change.
- `plan-resolution/extraction/retained-output.ts`: renaming for the record output re-runs the uniqueness check against the new ids.

**Saved bindings and replay**
- `plan-resolution/extraction/saved-list.ts`: a binding saved before t997 may hold labels built from a sample. Its reader replaces each such label with the field key, recognised by `structure/sampled-label.ts`. Replay resolves through `resolveWebPlanNode`, so it takes these labels as well.
- `structure/index.ts` exports `webLlmUniqueStoredLabels` and `webLlmSampledLabel`.

**Test-runner** (`read-oracle/command.ts`): the input may set `declarationAsWritten: true`, which skips the `model-aliases.ts` rewrite so that Core's own binding is what is proved. It is off by default, so t990's inputs behave as before, and the report records it.

**Tests:**
- New:
  - `structure/tests/stored-labels.test.ts` (5) and `sampled-label.test.ts` (2).
  - 3 new tests in `field-sample.test.ts`:
    - a generated class path stores its key, never its sample;
    - page words are stored as they are;
    - the model-facing packet is pinned unchanged.
  - `plan-resolution/extraction/tests/retained-labels.test.ts` (6):
    - alias binds by alias and by detected key;
    - alias with page words binds by alias and by those words;
    - collision between a detected key and another field's id;
    - alias reading another attribute;
    - saved-binding round trip through a fresh store;
    - legacy sampled labels.
  - `read-oracle/tests/collect.test.ts` (+1): Core's real data stage binds `member_badge` (as a label) and `badge` (as the id) to the same field.
- Updated, because they pinned a class-path label that is now stored as the key:
  - `structure/tests/record.test.ts`;
  - `plan-resolution/tests/one-record.test.ts`, **outside my owned paths**. Line 88 changed from the label `"span.x1s0c7au.x1xkdpo7.xdd3vo9"` to `NOTE` (the key). I made it under step 3's "update tests that pinned … labels"; revert it if that was not intended.

**Docs:** `docs/architecture/retained-extraction.md` gained the paragraph "A stored label carries no page value (t997)".

## Commands run and observed results

Every heavy command ran through `heavy-slot.mjs run`, one at a time. Logs are in `test-runs/t997-logs/`.

- `DOMAIN_TEST_BUILD_LABEL=t997 node scripts/test-domain.mjs llm-evidence/structure/ plan-resolution/extraction/`:
  - first run: 170/171, failing only on `record.test.ts`'s pinned class-path label;
  - after the update: **187/187 pass**.
- `… test-domain.mjs runtime/llm-evidence/ runtime/route-state/ runtime/hash/` (every importer of the changed modules): 1794/1795. The one failure was `one-record.test.ts`'s pinned class-path label. After the update, `… plan-resolution/tests/one-record` gave **3/3**.
- `pnpm --filter @fluxiq-web-extension/domain check` → **exit 0**.
- `node scripts/structure-audit.mjs` → **exit 0**, "passed (259 warning(s), 551 baselined)". None of the warnings is new for my files: `packet.ts` already had its file-lines advisory.
- `pnpm --filter @fluxiq-web-extension/test-runner build`:
  - first run: exit 2, because `browser-host` was not built in this worktree (as t990 saw);
  - after `pnpm --filter @fluxiq-web-extension/browser-host build` (exit 0): **exit 0**.
- `node --test --test-concurrency=1` on the four `read-oracle` dist test files:
  - first two runs: failed only on `command.test.js`, because the `test-contracts` and `test-evidence` dist were missing;
  - after `test-contracts:build` and the Lab prelude: **10/10 pass**.
- **Proof** (`FLUXIQ_LAB_ALLOW_BEHIND_CORE=1 node scripts/lab/run-lab.mjs recorded-read everything-store --task everything-store-plus-earbuds-under-50 --input test-runs/t997-oracle/<input>.json --out …`), with steps 0012 (p1), 0042 (p1 again), 0046 (p2) and 0051 (p3):
  - **Evidence:** copied from `lab-runs/2026-11-19/run-mwocg0zw-298c705d` and from the t959 campaign `.attempt-work/.../fluxiq-root/.fluxiq` (`artifacts`, `config.json`, `global.sqlite` only; no host secrets) into `test-runs/t997-evidence/`. `diff -rq` against the originals showed none. The runs used a fresh copy in `test-runs/t997-work/`.
  - **r1–r3 were setup failures, not results:**
    - the Lab refused a Core behind `dev`;
    - `recorded_read_fixture_receipt_mismatch`, because the run folder must keep its run id as its name;
    - `recorded_read_live_source_required`, because `global.sqlite` was missing.
  - `earbuds-mwocg0zw-aswritten-r4.json` (declaration as written, naming `brightaisle_plus` and `data-ad-id`):
    - all 4 reads admitted (control parity, item match, D37 clean, requested cells unchanged), each retaining 27-28 fields;
    - readiness `missing-evidence`, `answer_first.processing_binding_missing`, "brightaisle_plus (missing)";
    - `data-ad-id` **did** bind, by its stored label `data-ad-id` (attribute-name words) on the model's `sponsored`;
    - 0 answer rows. Model, provider and external calls were 0.
  - `earbuds-mwocg0zw-runterms-r5.json` (with the rewrite):
    - readiness `ready`; 62 rows collected, 2 repeats, 11 kept;
    - 11/11 expected records matched, in order, with 44/44 fields;
    - 2 of 13 are missing because they sit on pages the run never read. This is t990's result unchanged, so there is no regression.

## Not verified

- **Core version.** The proof ran against the shared Core at 6318fac, 3 commits behind `dev`; the missing commits are t993's absent-cell processing. I am not allowed to sync it. Core's binding (`bind.ts`) is not among the changed files; t993 changes processing and readiness only. The r5 numbers may still differ on a synced Core.
- **Existing datasets.** Datasets Core already stored keep their old labels, because `mergeAutomationStudioRecordSchemas` keeps the existing field labels. Nothing here migrates them.
- **Unit-test binding.** The domain unit tests check binding with a copy of Core's rule (`boundBy`), because the domain cannot import Core's binder. Real Core binding is proved only by the test-runner `collect` test and the Lab proof.
- **Input validation.** There is no unit test for the new `declarationAsWritten` check in `command.ts`.
- **Scope.** No full suites, no live run, no Firefox.

## Open questions or contradictions found

1. **The decision does not fix defect 2 for `brightaisle_plus`.** That column has page words (`Brightaisle Plus`), so the renamed `plus` is labelled with them, and a declaration naming the key cannot bind. The rewrite stays needed. Options:
   - **(a)** Label a **renamed** column with its detected key always. The change is one line in `retained-schema.ts`, `label: metadata?.label ?? id` → the source key when `id !== source`. The cost: the answer header then reads `brightaisle_plus`, and the words no longer bind.
   - **(b)** Keep the decision, and keep `model-aliases.ts` for run-independent declarations.
   - **(c)** Have Core's label folding also treat `_` and `-` as spaces. That is a Core change.

   I recommend (a) if declarations are expected to name site keys. If they name instruction words, both readings already bind the model's id.
2. **`one-record.test.ts` is outside my owned paths.** I changed one pinned label there (above).
3. **Labels that are positional paths.** A non-generated label such as `span:1` or a readable class path is still stored, because it is not a value. If the lead wants only "column words", `stored-label.ts` is the one place to narrow it.
