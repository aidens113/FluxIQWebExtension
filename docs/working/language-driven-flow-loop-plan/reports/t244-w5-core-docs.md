# t244-w5 — Core docs for partial runs and the full judged gate

## Outcome

Done. Core tree `C:/Users/osrs_/FluxStuff/fxwork/t244/!FluxIQ`, docs only; no source or tests touched; nothing committed.

## What changed and why

`docs/architecture/automation-studio/llm-flow-bootstrap.md`
- Repair-progress bullet: "carried steps now judged" replaced by `judged_after_unjudged` (progress.ts renamed the measure and widened it to any not-judged verdict).
- Decision-history paragraph: `reused_clean` is now "an earlier clean replay of the same Flow, by its Flow signature".
- Purse section: a `not_judged` verdict from a refused judge call finishes nothing; it goes to repair or ends at budget with the Flow kept (phases.ts no longer finishes on it).
- Three-phase / dry-run paragraph: replaced the replay-signature caching and "judged again from earlier replays' outcomes ... pass records reused_clean" text (removed in dry-run-gate.ts) with Flow-signature keying (fields listed from flow-signature.ts), refusal repeated but never passed from earlier replays, the made-optional pass keyed on the post-change signature, and the replay signature's remaining role (progress, `seedSignature`).
- New `#### Running part of the Flow`: `core.run_flow` input, no reset, same replay calls (D1), stop rules, `not_run_in_this_build`, result/refusal codes, cost/counting, chat words, never the Flow's test, exactly where it is offered (run-flow.ts binding conditions).
- New `#### A whole run judged success, on the Flow as it stands`: report `signature` + build-judge `flowSignature` stamp; phases finish only on yes about this signature, everything else `judged_wrong` repair, no "finished unverified"/"Flow not verified"; `llm_evidence_loop.full_run_required` with its three words and the `fullRunRequired`/`requireLibrarySteps` conditions; re-author/extend consequence (`standsFor`, `routeSignatures`, apply only after judged success), one history line.

`docs/architecture/automation-studio.md`
- New `### A repair is accepted only after a whole run judged success` after the result-judging section: the rule; re-author holds it (links the new bootstrap section; apply only after a finished build; `standsFor`/routeSignatures; extend still not revertible); the patch ladder's open state (no core.run_flow, trial from changed node, mid-run auto-apply by `maybePromoteRuntimeAdaptation`, needs executor `stopAfterNodeId` plus a deferred apply; shipped app's automatic promotion applies nothing).

Generated: `docs/reference/framework-reference.md`, `packages/fluxiq/docs/reference/framework-reference.md` (regenerated from source JSDoc).

## Commands run and observed results

- `node scripts/docs-reference.mjs` -> "Wrote docs/reference/framework-reference.md and packages/fluxiq/docs/reference/framework-reference.md (2982 public declarations).", exit 0.
- `node scripts/structure-audit.mjs` -> "structure-audit: passed (220 warning(s), 349 baselined)." (also "1 baseline entries can be lowered").
- `grep -rni unverified docs/architecture packages/fluxiq/docs | grep -iE "carried|re-author|reauthor|finish|extend|build"` -> only run-result verification hits (persistence.md:918, automation-studio.md:394, reference rows for result-verification skip codes and repair outcome); none says a carried/re-authored Flow or a build finishes unverified.

## Not verified

- Markdown anchor `#a-whole-run-judged-success-on-the-flow-as-it-stands` not render-checked.
- Whether the failed-step route also goes through the re-author (the brief's design says so); I documented only the refuted-answer route and "improve", which reauthor.ts and client-gateway.md state.
- Other docs outside docs/architecture (e.g. docs/working) not searched.

## Open questions or contradictions found

- None in source. The structure audit reports one baseline entry that can be lowered (not mine to change).
