# t194-w65: chat card words (recall miss, list read in a test)

## Outcome

Done. Both card defects from `run-murwcmx2-a1c6edf7` are fixed, and failing tests were written before each fix.

## What changed and why

UI-1 (screenshot 00012, step 0036, `core.recall.not_found`):
- `src/ui/activity-action/types.ts`, `names.ts`, `icons.ts`: new kind `recall`, named "Recall result". It reuses the `scan-search` icon, so the downstream panel's `LUCIDE_ICON_NODES` (whose test pins it to exactly Core's icon set) needs no new icon.
- `src/ui/activity-action/action-of.ts`: `core.recall_result` now maps to `recall` instead of `look`. `core.describe_nodes` stays `look`. The card's target is still the quoted call name from the title ("Looking again at what “open store picker 1” found" gives "Recall result · open store picker 1"). When the recalled id is dotted (`core.flow_draft`, as in the run), the card reads "Recall result" with no target.
- `src/ui/activity-action/failure-reason.ts`: `CORE_REASONS` gives Core's own codes their own words, matched by the whole code. Separately, any `core.*` code is now checked against `CORE_CODE_REASONS`, which is `REASONS` without its page-miss entry. A Core code can therefore never read "it wasn't on the page", whether through its code or a refusal reason.
  - These codes used to read "it wasn't on the page" and now have their own words:
    - `core.recall.not_found` → "no earlier result goes by that name"
    - `core.check.authorization_absent` → "checking had not been turned on for this Flow"
    - `core.repair.authorization_absent` → "repair had not been allowed for this Flow"
    - `core.result.required_values_missing` → "the result was missing values the request needs"
    - `core.result.verdict_absent` → "no verdict came back"
  - I found no other `core.*` literal in Core src that matches the not_found regex (`not_found|missing|unobserved|no_match|absent|gone`). The one templated `core.replay.${status}` goes through `replay-failing.ts` first. Any future `core.*.missing`-style code now gets no reason (`null`, so the card reads a bare "Didn't work") rather than a page miss.
  - Non-Core codes are unchanged: `web.target.not_found` still reads "it wasn't on the page".
- `R/activity/wording/core-tool.ts`: not changed. The title "Looking again at what … found" already says it is a recall; only the card name came from the kind.

UI-2 (screenshot 00016, steps 0026-0031, `web.output.dom-extract_list`):
- Cause: the test-run card's subject comes from the curly-quoted name in the title (`action-of.ts` `targetOf`). The title comes from `R/activity/wording/action.ts`, which said a list read as the plain "Reading the list" with no name. The step has no `element`, and downstream `describeCall` returned nothing for it.
- Downstream `domain/src/runtime/llm-evidence/node-run/call-words.ts`: a `web.output.dom-extract_list` call is now named by the field names it reads, taken from the keys of `extractList.fields` (or a list of names), with `_`/`-` turned into spaces. Example: "name, price, rating and 3 more". The selectors behind the fields and the values read are never included.
- Core `R/activity/wording/action.ts`: the read verb's `also` (list) now has `named`, giving "Reading the list of “name, price, rating and 3 more”", so the card reads "Test run · name, price, rating and 3 more". A new `byWords` flag keeps the name coming only from the domain's words, never from `parameters.element`, because a read's subject is not a control.

## Commands run and observed results

- Failing first: `npx vitest run src/ui/activity-action src/programs/automation-studio/runtime/activity` (packages/fluxiq) → 12 failed (the new failure-reason, action-of, names, icons and wording tests), for example `expected 'it wasn't on the page' to be 'no earlier result goes by that name'`.
- After the fix, the same command → `Test Files 24 passed (24)`, `Tests 308 passed (308)`.
- Downstream call-words test on its own, before the fix (esbuild bundle of `tests/call-words.test.ts` into a scratch label dir, then `node --test`) → `# tests 6 # pass 5 # fail 1`. After the fix → `# tests 6 # pass 6 # fail 0`.
- Downstream narrow tests: all 109 `src/runtime/llm-evidence/**/tests/*.test.ts`, bundled the same way as `scripts/test-domain.mjs` (into the scratch dir `t194-w65-llmev`, deleted afterwards) → `# tests 691 # pass 691 # fail 0 # cancelled 0`. `repository-layout.md` documents no path-filtered domain test command, which is why I bundled the files myself.
- `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t194-w65 pnpm check fluxiq" pnpm check` → exit 1 with a single error: `service/runtime-adaptation/tests/step-failure-port.test.ts(93,5): error TS18048: 'detail.actionAttempts' is possibly 'undefined'`. That file is not mine; another worker has uncommitted edits to it in this tree. No error was reported in any file I own.
- `pnpm --filter @fluxiq-web-extension/domain check` → the src tsconfig passed. The test tsconfig failed with only `src/runtime/tests/host-runtime.test.ts(99,24)/(107,23): Property 'from' does not exist on type 'AutomationStudioHostStateSnapshotRef'`. That file is not mine and is edited concurrently, together with Core `host-runtime.ts`.

## Not verified

- No live or browser check of the cards.
- I did not run the extension's own tests (`card-words`, `action-card-view`, `lucide-icon`) against the new kind. They fall back via `?? ...other`, and the icon set is unchanged.
- I did not confirm that `describeCall` is wired on the dry-run path for list reads in a live run. I inferred it from `observer.ts` `executeTool`, which passes `described` to `toolActivity` for every call, including `dryrun.*` ids.
- The executor playback card (`activity/step.ts`) has no domain words, so a playback list read still says "Read list" with no target. That was outside this brief.

## Open questions or contradictions found

- The two typecheck failures above come from other workers' in-flight edits in the shared t194 trees. They need re-checking once those edits land.
- `core.describe_nodes` still uses the generic "Look" name, with its target naming the step looked up. A dedicated name may be wanted under the same rule.
