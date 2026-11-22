# P3 / t989 collection guidance

Outcome: Partial
Changed: Core answer-first version answer-first.3, evidence-decision prose, saved-result/action-selection format and nested-loop refusal; Down web-14 paging, retained-field catalog grammar and owning assertions.
Reason: old web text told exploration to defer remaining pages, and Core wording presented manual per-read processing instead of the declared automatic path.
Validation: git diff --check passed for Down source. Grammar measured681 characters with a five-digit maxItems value, within700; owning tests still required.
Preparation: paired task start in progress. Its Core build reported inputs changed while running and correctly did not stamp fluxiq; root source edits overlapped preparation. This is not accepted compilation; run a frozen build/check after final edits. Root has frozen Core while remaining preparation reads it.
Not verified: prompt composition/pins, owning tests, package types/audits, live prompt smoke. No paid call or browser run in this task.
Next: finish preparation, update Core semantic/composition assertions, regenerate changed pins through actual prompt producer, run narrow acceptance, update authored Core documentation and integrate after P2 compatibility.

## Focused checks
Validation: six-file Core guidance/prompt/loop batch with explicit producer pin refresh and Vitest snapshot update ->104/105 passed,52.22s; one candidate-loop assertion still expected the former site-filter wording. Corrected that expectation to preserve the real-source condition requirement. Normal (no regeneration/update flags) pin/default-prompt/candidate-loop rerun ->74/74 passed,28.43s; the other three unchanged owners had already passed. Only evidence_tool_decision pin changed (6506 to7025 characters); no pin case removed. Explorer snapshot changed; judge snapshots did not.
Validation: three Down owners ->45/46 passed initially; the sole failure expected the old equivalent across-run wording. Corrected that assertion; rerun ->46/46 passed,5,229.384ms, exit0. Final grammar is680 characters for actual maxItems1000, within700. Existing selection and action-safety assertions remain.
Validation pending: frozen Core package check, Down audit, Down package check/frozen libraries, Core audit and paired integration. New prose has not had a live model smoke. A wrong-working-directory prelude was corrected before the relevant queued invocation executed; no pass was inferred from it.
