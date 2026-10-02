# t174/F33: the draft names the control each step acted on

## Outcome

Done. Every node call's draft statement now carries `control`, the same words its
outcome carries. Core reads it on the execution-result parse path, copies it onto
the call record and the draft step, and prints it as `control` right after `input`
on each core.flow_draft step line. It is never written into the Flow's parameters.

## What changed and why

Domain (`C:/Users/osrs_/FluxStuff/fxwork/t174/!FluxIQWebExtension`):
- `domain/src/runtime/llm-evidence/capture.ts`: `WebLlmEvidenceToolExecution["draft"]`, which is where `WebNodeDraftStatement` comes from, gains `control?: string`.
- `domain/src/runtime/llm-evidence/node-run/run.ts`: on success, `control: outcome.control` (the outcome's own value, from `webObservedControl`). It is `undefined` (absent) for a look and for every refusal. A navigation has no handle, so it is absent there too. `standing` keeps `control.name`, so a press that hits a robot check and stands after Continue (`personDraft`) still names its control.
- `domain/src/runtime/llm-evidence/node-run/outcome.ts` (new): the `WebNodeOutcome` type moved out of run.ts, unchanged. HEAD's run.ts was exactly 800 lines, the hard `file-lines` limit, so the few added lines broke the audit at 809. run.ts is now 773.
- `domain/src/runtime/llm-evidence/node-run/tests/draft-control.test.ts` (new): four rows. A press carries "Not now", equal to the outcome's `control`, with input unchanged. A look, a navigation and a refused press carry none.

Core (`C:/Users/osrs_/FluxStuff/fxwork/t174/!FluxIQ`, under `packages/fluxiq/src/programs/automation-studio/runtime/`):
- `flow-draft/control-words.ts` (new, exported through the `flow-draft/index.ts` barrel): `automationStudioFlowDraftControlWords(value, evidence)` applies the gate's rule for a control's name. The words are carried only when this call's own evidence shows them (whitespace collapsed on both sides, and the whole name must be found before any cut), plain (no control characters or `<>`), and cut at 120 characters with `...`. Anything else is withheld (absent), never refused.
- `llm/evidence-loop-decision.ts` (`readCallRecord`): the exact key list accepts `control`, read only through that helper against `value.evidence`. This is the only place it is accepted.
- `llm/evidence-loop/tool-execution.ts`: `draft.control?: string`, documented.
- `llm/evidence-loop/call-record.ts`: copies `control`, which reaches the step through the existing `...record` spread in `draftRecord`.
- `flow-draft/step.ts`: `AutomationStudioFlowDraftStep.control?: string`, documented as page text and never a parameter.
- `flow-draft/entry.ts`: `stepLine` prints `control` right after `input`. The header no longer says "Nothing here is page content"; it now names `control` as the one field that is.
- Tests: `flow-draft/tests/control-words.test.ts` (new, 5 rows). `flow-draft/tests/entry.test.ts` (+1 row: `control` follows `input`, and is absent when a step has none). `llm/evidence-loop/tests/authored-draft.test.ts` (+6 rows):
  - the parse path reads `control`;
  - unshown, markup, non-string or empty words are withheld and the result is not refused;
  - long words are cut;
  - the call record copies `control`;
  - a loop run shows `control: "Not now"` on the core.flow_draft step;
  - `automationStudioFlowBootstrapDraftNodeStep` writes entries `["selector","consequences"]` and never "Not now".
  I first put these 6 rows in a new `llm/tests/` file, which broke two structure rules: `llm/tests` went over its 25-file limit, and one import skipped a barrel. So I folded them into authored-draft.test.ts.
- Docs: `docs/architecture/automation-studio/llm-flow-bootstrap.md` has a new paragraph, "Each step names the control it acted on (t174/F33)", next to the authored-draft section.

## Commands run and observed results

Failing-first:
- Domain, `T174_ONLY=draft-control.test.ts node .../t174-dir-tests.mjs <domain> t174-f33 runtime/llm-evidence/node-run/tests`, before the change: 4 tests, 3 pass, 1 fail ("a press's draft statement carries the words…": `undefined` !== `'Not now'`).
- Core, `heavy.sh "t174-f33 vitest-pre" pnpm --filter fluxiq exec vitest run <control-words, entry, new loop test>`, before the change: 3 files failed, 6 tests failed and 11 passed. control-words.ts did not exist; the entry row did not match; parse `control` was `undefined`; "Place order" was refused whole by `draft.unknown_key`, so `effectApplied` was `undefined`; record and loop rows were `undefined`. The writer-guard row passed beforehand, as expected for a guard.

After:
- Domain: `node .../t174-dir-tests.mjs <domain> t174-f33 runtime/llm-evidence/node-run/tests runtime/llm-evidence/tests` gave `# tests 326 # pass 326 # fail 0`.
- Domain: `node scripts/structure-audit.mjs` gave `structure-audit: passed (157 warning(s), 118 baselined)`. The run before I extracted `outcome.ts` had failed on run.ts at 809 lines.
- Core: `heavy.sh "t174-f33 check2" pnpm --filter fluxiq check` exited 0. The first run had failed on type errors in my test file only, which I then fixed.
- Core: `heavy.sh "t174-f33 vitest-final" pnpm --filter fluxiq exec vitest run` over `flow-draft/tests`, `llm/evidence-loop/tests`, `llm/node-tools/tests`, `flow-bootstrap/incomplete-draft/tests`, and `llm/tests/{evidence-loop-tool-failure,evidence-loop,evidence-loop-draft-shown,evidence-loop-seeded-draft,deepseek-evidence-preflight}.test.ts`: `Test Files 51 passed (51)`, `Tests 451 passed (451)`.
- Core: `heavy.sh "t174-f33 structure" pnpm structure:check` exited 0 with `structure-audit: passed (217 warning(s), 349 baselined)`.

## Not verified

- Domain typecheck: skipped, as the brief says (it needs Core's rebuilt dist). Every `present<WebNodeDraftStatement>` call site now names `control`, but tsc has not confirmed this. The domain test runner uses esbuild and does not typecheck.
- Core dist not rebuilt (the lead's job). Until it is, a domain build against the old dist would get `draft.unknown_key` from Core's exact draft key list on every press. The two sides must ship together.
- No live Lab run, and no whole suites.
- build-routing.test.ts was not run (known HEAD failure, outside my files).

## Open questions or contradictions found

- The incomplete-draft store (`flow-bootstrap/incomplete-draft/kept.ts`, not owned) copies kept steps whole apart from `callId`/`replayed`. A kept step's `control` is therefore saved in the incomplete-draft record, and `parse.ts` reads it back because it checks no unknown keys. This is not the Flow's parameters, but it is page text in local storage. If that is unwanted, kept.ts should `delete copy.control`.
- A refused press carries no `control`, because the domain has no outcome there. So a `did_not_work` step still shows only its handle. The brief tied the value to the outcome; extending it to refusals would need the domain to state `control.name` on refusals raised after resolution.
- The draft instruction text does not explain `control`; the key name matches the outcome's `control`, which the model already reads. The lead's system-instructions may want to mention it.
