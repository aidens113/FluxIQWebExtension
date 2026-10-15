# t640 navigate-needs-address: worker report

## Outcome

Partial. A navigate whose `url` has no value is now refused before anything is sent, in the domain and in the extension runner, with a missing-value failure and a new closed reason. One part of the brief cannot be done without changing Core: quoting the binding the step read (`$input.<name>`). See "Open questions".

## What changed and why

- `domain/src/output-nodes/native-runtime.ts`. The navigate branch now refuses a `url` that is missing, `null`, or an empty or whitespace string. It does this before dispatch: `effects: []`, and the record is built with `webAutomationFailureRecord(INVALID_PARAMETER, …)`. That gives category `graph_validation_or_unknown_node`, `retryable: false`, stage `dispatch`. The record's `actual` starts with the closed words `no value: url …`, and it holds no value and no address (and not the word "address", which Core's model-facing screen drops). `outputs.error.issues` is `[{ code: "web.action.invalid_parameter.parameter_has_no_value", field: "url" }]`, which Core's trial feedback (`candidate-trial/step-issues.ts`) lists under the step. Core's `happened` sentence for this category is now "The step's node refused the step as written…" instead of "A permission or policy refused the step". A `url` that is present but not text is refused under the same code, without the leading words, so it reads as `parameter_not_readable`. A navigate with a url dispatches unchanged.
- `domain/src/runtime/llm-evidence/tool-rejection.ts`. Added the reason `parameter_has_no_value` to `WEB_LLM_TOOL_REJECTION_REASONS`, with its documentation. No existing reason was true: `parameter_not_readable` means a shape the client could not read, and `missing_input_keys` means the call's keys.
- `domain/src/runtime/llm-evidence/action-failure/refusal.ts`. On `INVALID_PARAMETER` only, an `actual` matching `^no value: <identifier>(?=\s|$)` becomes `invalid_input` with detail `{ reason: "parameter_has_no_value", missing: ["<identifier>"] }`. This uses the same leading-word convention as `covered:`. Any other code or sentence keeps its old answer.
- `apps/extension/src/runtime/action-runner.ts`. A `web.browser.navigate` whose `url` is not non-empty text is answered right away with the same INVALID_PARAMETER record (same `expected` and `actual`). It is never sent to the content script, and no tab is driven or pinged. It no longer falls through to `content/actions/execute.ts`'s UNSUPPORTED_TYPE. Chrome/Edge and Firefox share this runner.
- `payloads.ts` is unchanged. It is the recording path, and a recorded navigate with no url compacts to no parameters and stays evidence. The runtime refusal belongs in `native-runtime.ts`, which the brief allowed.
- Tests:
  - `output-nodes/tests/native-runtime.test.ts`: an empty, blank, null or absent url is refused. The test checks the exact record, that Core's parser keeps it, the issues, and that the refusal maps to `parameter_has_no_value` with `missing: ["url"]`. A non-text url is refused as unreadable. A url dispatches.
  - `action-failure/tests/refusal.test.ts`: the reader's edge cases.
  - `apps/extension/src/runtime/tests/action-runner.test.ts`: a url-less navigate is answered with the record. Nothing is sent, pinged or injected, and nothing mentions permission, policy or unsupported.

## Commands run and observed results

- `node domain/scripts/test-domain.mjs output-nodes runtime/llm-evidence/action-failure` → `# tests 255 # pass 255 # fail 0`, including the three new navigate tests and the new refusal test.
- `node domain/scripts/test-domain.mjs runtime/llm-evidence` (reasons enumerated across it) → `# tests 1127 # pass 1127 # fail 0`.
- `npx tsc -p tsconfig.json --noEmit` (domain) → exit 0. `npx tsc -p tsconfig.test.json --noEmit` (domain) → exit 0.
- `node scripts/check-extension.mjs` (from apps/extension) → exit 0, no output.
- `EXTENSION_TEST_BUILD_LABEL=t640 node scripts/test-extension.mjs src/runtime/tests` → `# tests 266 # pass 266 # fail 0`. With the filter `runtime/tests/action-runner runtime/tests/navigate-action` → 64/64.
- `pnpm structure:check` → `structure-audit: passed (195 warning(s), 639 baselined).`

## Not verified

- No live run, as the brief says. I did not run the trial-feedback path end to end through Core's executor. The claim that Core shows `issues` and the category's `happened` sentence comes from reading `candidate-trial/feedback.ts`, `step-issues.ts` and `happened.ts`, not from running them.
- Full package suites were not run.

## Open questions or contradictions found

- **The binding cannot be quoted from this repository.** Core resolves `$state` bindings in `runtime/executor/node-execution/attempt.ts` and replaces `node.parameterValues` with the resolved values. Only then does it call the native runtime (`runtime/native-node-runtime.ts`), whose `AutomationStudioNativeNodeContext` carries only `parameters` (resolved), `inputs` and `host`. The authored `{"$state":{"path":…}}` never reaches the domain, so the domain cannot honestly name `$input.itemUrl`. The refusal names the parameter (`url`) and says the value it reads was empty. To name the binding, Core would have to do one of two things:
  - hand the authored binding paths to native implementations, for example `context.bindings: { url: "<path>" }`, or
  - fail in Core itself when a resolved binding is an empty string on a required parameter. Core's `executor.parameter.unresolved_state_path` already names paths, but only for paths that are missing, not paths that are empty.

  That is a Core-boundary change for the supervisor to decide on.
- The two producers (domain node and extension runner) write the same `expected`/`actual` text without sharing a constant. The extension imports only `domain/client`, which does not export `output-nodes`, and the barrels were outside my ownership. Each side's test pins the exact text.
