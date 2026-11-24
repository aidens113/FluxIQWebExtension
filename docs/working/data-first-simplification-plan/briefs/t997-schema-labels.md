# Stored column labels carry no page values; a renamed column keeps its site key (t997)

Lead: Claude Code session, 2026-11-23. Tier: worker-heavy.
Tree: `C:/Users/osrs_/FluxStuff/fxwork/t997-schema-labels` (downstream; the shared Core beside it is read-only).
Read: this brief; `docs/architecture/retained-extraction.md`; `domain/src/runtime/llm-evidence/structure/{packet.ts,field-sample.ts}`; the extraction slot and alias resolution under `domain/src/runtime/llm-evidence/plan-resolution/extraction/`; Core's binding, read-only, in the shared Core's `packages/contracts/src/record-sets/process/binding/bind.ts`; and the open questions 1-2 in `docs/working/data-first-simplification-plan/reports/t990-recorded-oracle.md`.

Defects, found by t990:
1. `structure/packet.ts` (~465-471) writes the stored `recordSchema` field label from `field.shown.label`. That is the model-facing readable label, built from the first item's value when the page's own label is a generated class path (`field-sample.ts`, e.g. `link: '<a product title>'`). Page values then land in stored dataset schemas and in answer column headers, which contradicts `retained-extraction.md` (the binding holds "no parsed sample or captured row").
2. When the model renames a detected column that reads the same attribute (for example `plus` for a detected `brightaisle_plus`), only the model's key survives. A declaration naming the site's detected key then cannot bind.

Lead's decision:
- A stored schema label is the page's own column words when the detection has non-generated ones (screened). Otherwise it is the field key. The readable, sample-built label stays only in what the model is shown (the packet's `shown`).
- When the model renames a detected column, the stored field's id is the model's name and its label is the detected key, or the page's column words when they exist. Core binds an exact id first, then a unique label, so a declaration may name either, with no Core change. Confirm this against `bind.ts`. If a label could then collide with another field's id or label, resolve it explicitly and test it; never let a page value reach a label.
- Duplicate-label suffixing keeps working, without values.

Steps:
1. Find every path that writes a stored schema label or a retained field id/label (packet, slot, alias resolution, saved bindings, replay).
2. Implement the decision in the owning modules, one exported thing per file.
3. Write tests in the owners' `tests/` folders:
   - a generated-class-path column stores its key, never its sample;
   - a column with page words stores those words;
   - an aliased column binds by alias and by detected key;
   - saved-binding round trip;
   - the model-facing packet is unchanged.
   Update tests that pinned value-bearing labels.
4. Update `docs/architecture/retained-extraction.md`.
5. Proof: rerun t990's recorded-read for earbuds run-mwocg0zw (unfiltered, p1 twice, p2, p3) with a declaration naming `brightaisle_plus`. t990's copied inputs were removed with its worktree, so copy that run's step folder and trace store from the originals (the t959/t960 campaign trees under `C:/Users/osrs_/FluxStuff/fxwork/` and `C:/Users/osrs_/FluxStuff/lab-runs/<day>/<run>`) into ignored `test-runs/t997-*`. Write the input in the shape `read-oracle/command.ts` parses; the step numbers are in `reports/t990-recorded-oracle.md`. Never edit the originals. Report whether the `model-aliases.ts` rewrite is still needed for binding (it should not be).

Checks, through `node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run <label> -- <cmd>`, one at a time:
- `DOMAIN_TEST_BUILD_LABEL=t997 node scripts/test-domain.mjs <fragments>` (from `domain/`) on structure, plan-resolution/extraction and every importer of the changed files;
- `pnpm --filter @fluxiq-web-extension/domain check`;
- `node scripts/structure-audit.mjs`.
No full suites, no git mutations, no `node -e`, no provider or paid calls, no browser unless step 5 needs the sandboxed snapshot (visible, provider-free). Model guidance never mirrors a realistic scenario. Never print page data.

Owned: `domain/src/runtime/llm-evidence/structure/**`, `domain/src/runtime/llm-evidence/plan-resolution/extraction/**`, their tests, `docs/architecture/retained-extraction.md`, `packages/test-runner/src/recorded-attempt-replay/read-oracle/**`, and your brief and report.
Must not touch: Core, other worktrees, `docs/working/data-first-simplification-plan.md`, `docs/working/README.md`.
Report: `docs/working/data-first-simplification-plan/reports/t997-schema-labels.md`. End with the return contract.
