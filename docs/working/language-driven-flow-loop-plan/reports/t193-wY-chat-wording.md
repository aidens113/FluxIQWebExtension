# t193-wY: chat wording (cause 14 of `run-muqiojz4-04a7a8fc`)

Worker t193-wY, 2026-10-02. Brief "t193-wY-chat-wording". Trees: Core `fxwork/t193/!FluxIQ`, downstream
`fxwork/t193/!FluxIQWebExtension`. `R/` = Core `packages/fluxiq/src/programs/automation-studio/runtime/`,
`U/` = Core `packages/fluxiq/src/ui/activity-action/`. Nothing committed.

## Outcome

**Partial.** All four fixes are made and tested in the owned files, and every check the brief names passes. One
thing is left for the supervisor: (b) adds an action kind, `result_check`, and Core's **`apps/web`**, which is not
in my ownership, has an exhaustive icon map that no longer typechecks (details under "Open questions"). It needs one
line of fix, plus a test expectation and an optional wording line.

## What changed and why

**(a) Permission question in plain words.** The cause was `R/action-permissions/cross-check.ts` `sentenceFor`. It
now writes each class through the existing `AUTOMATION_STUDIO_ACTION_CONSEQUENCE_PHRASES` (`consequences.ts`) and
writes no counts:

- undeclared: "Your instruction asks to change something that already exists and create something new that stays,
  but no step of this Flow said it would do that, so the Flow may not do what you asked."
  `R/flow-bootstrap/action-permissions.ts:270` (not owned, unchanged) adds " Apply it as it stands?", so the "it"
  refers to the Flow the sentence ends on.
- beyond_instruction: "This Flow would delete or remove something, which your instruction does not ask for."
- agreed: "What this Flow does matches what your instruction asks for."
- not_comparable: "This Flow took no step at all, so there is nothing to compare with your instruction."

The structured fields (`verdict`, `declared`, `instructed`, `undeclared`, `beyondInstruction`, `actions`,
`declaredNothing`, `quotes`) are unchanged. Readers of `sentence`:

- `R/flow-bootstrap/action-permissions.ts:270`: the question text, which still reads correctly.
- `R/action-permissions/tests/declared.test.ts`: updated.
- The test-runner's `crossCheckOf` (`packages/test-runner/src/flow-lane/creation/build-proposal.ts`) copies the
  structured fields only, not `sentence`.
- No reader in the Lab, the extension or `docs/architecture` quotes the old text (grep below).

**(b) A result check is no test run.** The cause was `U/action-of.ts`, where `detail.kind === "check"` or the
`verifying` phase always meant `test`. I added the kind `result_check`:

- `U/types.ts`: the new kind.
- `U/names.ts`: name "Check result".
- `U/icons.ts`: icon `scan-search`. I reused the look icon so neither client needs new icon path data, because
  `apps/extension/src/panel/icons/lucide-nodes.ts` is not owned.
- `U/action-of.ts`: the classifier picks it for a `check` row whose title starts "Result check". Those are the titles
  of `R/result-verification/verify.ts:138,158` ("Result check started", "Result check"), which I did not touch.

Unchanged: the completion check ("Completion check"), dry-run steps (`verifying`) and `core.dry_run` are still
`test`, so the dry-run cards still read "Test run". The extension renderer needed no source change. `card-words.ts`
takes the name from `ACTIVITY_ACTION_NAMES` and shows "Passed"/"Didn't pass" because of `card.check`. The card reads
"Check result: Passed: the result was judged to answer the request." This holds in builds as well as runs, because
the judge in both cases checks a result and is not a test run.

**(c) A refusal's own reason says why.** **The reason did not reach U.** The observer (`R/activity/observer.ts`) saw
`resultReason: "target_not_a_handle"` on the `llm_evidence_tool_execution` result, but put only `Result:` and `Node:`
into the row's raw record (`detail.text`). I did not widen the event type: `ClientGatewayActivity` and
`ActivityActionEvent` are unchanged. The reason is carried as a third part of the raw record that already exists:
"Result: <code> · Reason: <reason> · Node: <node>". The observer adds it only when it is code-shaped
(`/^[A-Za-z0-9_.:-]{1,100}$/`) and a result code exists. **The supervisor should confirm this counts as "not
widening the event"**; if it does not, revert `observer.ts`'s `resultOf`. U still works without it. The other parts:

- `U/record.ts` reads `reason`.
- `U/failure-reason.ts` takes an optional `reason`. A small generic table decides first:
  - `not_a_handle`, `malformed_handle`, `handle_in_wrong_parameter` give "it didn't name a control from the page".
  - `no_longer_on_page` gives "it was no longer on the page".
  - `nothing_changed`, `unchanged` give "nothing on the page changed". This stops the code table's `changed` from
    reading `nothing_changed_while_waiting` as "the page changed before it could".
  - Then the existing code-word table is applied to the reason.
  - Then the code, as before. Neither the code nor the reason is ever shown.
- `U/action-of.ts` passes `record.reason`.

The extension needed nothing: `words.ts` `ONLY_CODES` still treats the record as codes, and `action-card.ts`
`DOTTED_ID` drops it.

**(d) The navigate card names its page.** The target comes from the title's curly quotes (`U/action-of.ts`
`targetOf`). The title comes from `R/activity/wording/action.ts`, the shared wording used for run steps (`step.ts`)
and for tool rows (`tool-call.ts` calls it, and I did not touch `tool-call.ts`). The navigate phrase now has
`named`, and a new `pageName(parameters)` reads `parameters.url` as follows:

- It shows the address path with no host, query or fragment ("Opening “/ip/napkins”").
- The site root, or `~/`, reads "Home page".
- It handles the page-start shorthand `~/…`, root-relative paths and absolute URLs. Absolute URLs are parsed by
  regex rather than by `new URL` in a try/catch, because the structure audit's `failure-as-empty` rule refused the
  catch.
- Percent-encoded segments are decoded.
- A segment that reads as a key (16+ characters of letters and digits, with no word breaks) becomes "…".
- A path over 60 characters keeps its end: "…/ip/valueridge-everyday-dinner-napkins/418831402".
- A value that is not an address keeps "Opening a page".

`U/action-of.ts` `targetOf` now accepts an address path ("/help/index.html", "…/ip/x") as a navigate's target, even
though it is dotted. For every other kind, a dotted name is still never a target.

`apps/extension/src/panel/chat/stream/step/card-words.ts` needed no change. Run s11 (url = the scenario root) will
read "Open page · /scenarios/bigbox-retail", because that is its true path on the Lab host. The repair navigate will
read "Open page · …/ip/valueridge-everyday-dinner-napkins/418831402".

### Files

- Core:
  - `R/action-permissions/cross-check.ts`
  - `R/action-permissions/tests/declared.test.ts`
  - `R/activity/observer.ts`
  - `R/activity/tests/wording.test.ts`
  - `R/activity/wording/action.ts`
  - `R/activity/wording/tests/wording.test.ts`
  - `U/{action-of,failure-reason,icons,names,record,types}.ts`
  - `U/tests/{action-of,failure-reason,icons,names,record}.test.ts`
  - `docs/reference/framework-reference.md`, regenerated. Line numbers moved. The declaration count rose from 2973 to
    2977 because of other workers' exports; I added no exported name.
- Downstream (tests only):
  - `apps/extension/src/panel/chat/view/tests/action-card-view.test.ts`
  - `apps/extension/src/panel/chat/stream/step/tests/card-words.test.ts`

## Commands run and observed results

- Failing first. All tests were written before any source change.
  `heavy.sh "t193-wY-red" npx vitest run src/ui/activity-action src/programs/automation-studio/runtime/action-permissions/tests src/programs/automation-studio/runtime/activity`
  gave **20 failed**, each for the reason the brief names. For example:
  - `expected [ 'test', '', 'working', '' ] to deeply equal [ 'result_check', '', 'working', '' ]`
  - `Expected: "it didn't name a control from the page" Received: "it wasn't on the page"`
  - `expected null to be '/help/index.html'`
  - `Received: "The instruction asks for modify_existing and create_new, and none of this run's 61 actions said it would cause that; 61 of them said they would cause nothing lasting."`
  - The observer's record test.
  - The `Opening a page` expectations.
  - The pinned names and icons.
- The same vitest command after the fix (`t193-wY-green`): `Test Files 28 passed (28)`, `Tests 360 passed (360)`.
  The two failure-reason cases added afterwards (`nothing_changed_while_waiting`, `page_unchanged_after_action`)
  are included in that run.
- Core `packages/fluxiq`: `heavy.sh npx tsc --noEmit -p .` gave exit 0.
- Core root, `node scripts/structure-audit.mjs`:
  - First run: 1 violation, `[failure-as-empty] … wording/action.ts … line 125` (the `new URL` catch). I fixed it.
  - Rerun: `structure-audit: passed (218 warning(s), 349 baselined).`
- Core root, `node scripts/docs-reference.mjs --check`:
  - First run: "docs/reference/framework-reference.md is stale".
  - Regenerated with `node scripts/docs-reference.mjs`.
  - Then: "Deterministic framework reference is current."
- Core libs: `heavy.sh pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/client-gateway-websocket build`
  gave `fluxiq build: … "build-cache":"build" … Done`. contracts and client-gateway-websocket were reused from
  stamps.
- Extension tests beside the changes: a scoped copy of `apps/extension/scripts/test-extension.mjs`, at
  `scratchpad/t193-wY-test-extension.mjs`, label `t193-wy`, over `panel/chat`, `shared/activity` and `panel/icons`.
  Result: `34 test files`, `# tests 243`, `# pass 243`, `# fail 0`. These include "a navigate card names its page,
  and a refusal says its own reason" and the `result_check` row of "a card for each kind".
- `apps/extension`: `npx tsc -p tsconfig.json --noEmit` gave exit 0, and `npx tsc -p tsconfig.test.json --noEmit`
  gave exit 0.
- Downstream root, `node scripts/structure-audit.mjs`: `structure-audit: passed (157 warning(s), 118 baselined).`
- Core `apps/web` (not owned, run to measure the impact): `heavy.sh npx tsc --noEmit -p .` gave exit 2, with
  `action-icons.ts(27,14): error TS2741: Property 'result_check' is missing in type … Readonly<Record<ActivityActionKind, LucideIcon>>`.
- I grepped for the old sentence ("said it would cause", "nothing to compare with", "declared matches") across both
  repositories' `packages`, `apps`, `domain/src` and `docs/architecture`. Only `cross-check.ts` and its test had it.

## Not verified

- The extension tests had no red run of their own. They depend only on Core behaviour, there was no extension source
  change, and Core had already been rebuilt when they were written. The Core red run covers the same behaviour.
- No live or browser run (the brief forbids the Lab). I did not see the cards in the panel.
- Core `apps/web` tests were not run. `messages.test.ts:95` expects `[["test", "failed"]]` for a "Result check" row,
  and will now get `result_check`.
- I did not check whether a domain's `describeCall` returns a `target` for a navigate. If one does, its words take
  precedence over the page path (`input.words?.target` first).

## Open questions or contradictions found

1. **Core `apps/web` needs a follow-up (not owned):**
   - `apps/web/src/features/automation-studio/conversation/components/action-card/action-icons.ts`: add
     `result_check: ScanSearch`. ScanSearch is already imported.
   - `apps/web/.../activity/steps/outcome.ts:25`: change to
     `const test = action.kind === "test" || action.kind === "result_check";` so a result check reads "Passed" or
     "Didn't pass" there, as it does in the extension.
   - `apps/web/.../activity/steps/tests/messages.test.ts:95`: change the expectation to
     `[["result_check", "failed"]]`.
   - Check `ConversationActionCard.test.tsx:47` (`kind === "test" ? "Passed" : "Done"`) for the same reason.
2. For (c), the reason travels in the existing raw-record string, not a new event field. The brief said to report
   rather than widen the event, so this needs the supervisor's acceptance.
3. The permission question's trailing " Apply it as it stands?" lives in `R/flow-bootstrap/action-permissions.ts`
   (must not touch). The new sentence is written to read well before it. If the supervisor wants one sentence
   without the suffix, the change goes in that file.
