# g-domain-mapping — an unusable parameter (B3), and W19's navigation (B6, withdrawn)

Worker: `g-domain-mapping`. The first attempt, at `HEAD 147fdb4`, stopped
Blocked on both items. The supervisor withdrew B6 pending a design decision. B3
resumed at `HEAD f4268fb` under the amended brief:
- **Owns added:** `codes.test.ts` and `docs/architecture/failure-taxonomy.md`.
- **Design:** the one proposed in the first attempt, accepted.
- **Not mine any more:** `input-model.ts`, which was not touched.

## Outcome

**B3: Done.** In plain terms:
- **What happens now.** A gateway command can arrive with one of the structured
  fields its action requires sent in a shape the parameter reader cannot read.
  The five such fields are `assert`, `extractList`, `upload`, `dialog` and
  `tab`. That command is now refused before anything reaches the page.
  - The refusal carries a new code from the closed set,
    `web.action.invalid_parameter`.
  - Its category is `graph_validation_or_unknown_node`. It is not retryable, and
    its stage is `dispatch`.
- **What happened before.** The field was silently left off the command, and
  the verb met a half-formed request.
- **What the refusal says.** Its message and failure record name the action and
  the field, never what was sent in it.
- **Optional fields.** A malformed optional field is still just left unapplied,
  and the command still dispatches.

**How it was proven:**
- **Core's real parser accepts the new record.** This was checked before any
  edit: a probe through the same `fluxiq/automation-studio` import the domain
  tests use, with a negative control (quoted below). It is now proven
  permanently by two domain tests that go through that parser:
  - `codes.test.ts`, `ok 207 - every code builds a record Core's parser accepts unchanged, bare and with descriptions`;
  - a new row in `gateway-mapping.test.ts` (`parseAutomationStudioFailureRecord`
    keeps the rejection's record whole).
- **Mutation of the refusal.** Disabling the refusal branch broke both gateway
  test files. Restored, the file is byte-identical (SHA-256 matched).
- **Mutation of the pin.** Removing the new row from the pinned table failed
  `not ok 205 - the closed set is exactly the table…`. Restored, byte-identical.
- **Domain gates.** `check` exit 0. `test` exit 0 (352 of 352), both before the
  mutations and after the restores.
- **No other pin.** No other allowlist or test outside my files pins the code
  set (see Commands).

**B6: withdrawn. Findings kept at the end, unchanged in substance.**

## What changed and why

- **`domain/src/runtime/failure/codes.ts`** (+9 lines). New closed-set member
  `INVALID_PARAMETER: "web.action.invalid_parameter"`, with a doc comment naming
  its producer. Its row in the definitions table is
  `{ category: "graph_validation_or_unknown_node", retryable: false, stage: "dispatch" }`.
  - **Why this category.** A required field that is present but malformed is a
    node authored wrong. Core defines this category as "The Flow is structurally
    invalid…" (`F:\!FluxIQ\packages\contracts\src\failure\adaptive-class.ts`).
    Core's orchestrator answers it with a Subflow edit and holds back LLM runtime
    repair (`adaptive-orchestrator.ts:158-159,210`).
  - **Why not `blocked_by_capability_or_policy`.** That category means a gate
    refused a valid request, and it would send an operator to policy
    (`:208`).
  - **Why not retryable.** Core forbids a retryable record in this category
    (`parse-record.ts:17-24,62`).
  - **Why `dispatch`.** Nothing ran. Only the two `target_*` categories are
    restricted to one stage (`parse-record.ts:28-31,63`).
- **`domain/src/client/gateway-action-parameters.ts`** (47 lines changed).
  - **New name and result.** The reader is now `webAutomationReadActionParameters`
    and returns `{ lifted, refused }`. `refused` lists the names of fields whose
    parameter was sent (`!== undefined`) but read as `undefined`.
  - **Where each field is looked up.** A private helper, `suppliedParameter`,
    uses the reader's own names and precedence (`browserTabId ?? tabId`,
    `browserFrameId ?? frameId`, every other field under its own name). So "sent
    but unreadable" is never confused with "never sent".
  - **The rename.** The only caller is `gateway-mapping.ts` (grep), and the
    `client/` barrel does not export this file.
  - **Doc.** The header comment now says what a refusal costs for optional and
    for required fields.
- **`domain/src/client/gateway-mapping.ts`** (46 lines changed).
  - **Where the check runs.** In `webAutomationActionFromGatewayCommand`, after
    the unknown-type check and the unmet-secret check.
  - **Which refusals count.** Refused fields are intersected with the action's
    schema `required` list. `requiredParameters` reads it from
    `webAutomationActionDefinitions` exactly as `io/input-model.ts` does, so the
    two cannot drift.
  - **The rejection.** A non-empty intersection returns the existing rejection
    shape:
    - message: `Not dispatched: <action> requires <fields>, and what was sent could not be read.`;
    - failure: `webAutomationFailureRecord(INVALID_PARAMETER, { expected: "<action> with a well-formed <fields>", actual: "<fields> could not be read, so the action was not dispatched" })`.
  - **One read.** The lifted fields now spread from that same reading, so the
    parameters are read once.
  - **Doc.** The comments on `WebAutomationActionRejection` and on the function
    now name all three refusals, in the order they are checked.
- **`domain/src/client/tests/gateway-command-parameters.test.ts`**
  (69 lines changed).
  - **New helper.** `refusedWhole(actionType, parameters, fields, why)` asserts
    the new code and the exact message, which names the action and the fields.
  - **Rows converted to rejection checks,** each of them a refused required
    field, as the first report named: `assert` ×2, `extractList` ×4, `upload`
    ×5, `dialog` ×1 and `tab` ×1.
  - **The "stays in options" row** moved to an optional field
    (`scroll: { mode: "down" }`).
  - **Rows kept as dispatches,** because the field is optional or absent, not a
    refused required one: `timeoutMs: 0` inside a valid assert, `web.dom.dialog`
    with no `dialog`, and `web.browser.download` with no `download`.
  - **New pin: the full matrix.** Every lifted parameter name (16 including the
    tab and frame aliases) is sent as `"unreadable"` to every action type. The
    pairs refused whole must be exactly the five: `web.browser.tab tab`,
    `web.dom.assert assert`, `web.dom.dialog dialog`,
    `web.dom.extract_list extractList` and `web.dom.upload upload`. A schema that
    starts or stops requiring a lifted field fails here.
- **`domain/src/client/tests/gateway-mapping.test.ts`** (+45 lines).
  - **The whole rejection.** `web.dom.assert` with
    `assert: { kind: "contains", expected: <sentinel> }` deep-equals the full
    rejection: code, category, retryable, stage, expected, actual and message.
  - **Through Core's parser.** `parseAutomationStudioFailureRecord` returns the
    record unchanged.
  - **No value leaks.** `JSON.stringify(rejection)` does not contain the
    sentinel.
  - **Optional fields.** A refused optional field still dispatches.
  - **Order.** An unmet secret request is reported ahead of an unreadable field.
- **`domain/src/runtime/failure/tests/codes.test.ts`** (+1 line). A
  `CODE_TABLE` row
  `["INVALID_PARAMETER", "web.action.invalid_parameter", "graph_validation_or_unknown_node", false, "dispatch"]`.
  The pin at `:47`, and the parser loop over every row, now cover the new code.
- **`docs/architecture/failure-taxonomy.md`** (13 lines changed).
  - "fourteen codes" is now "fifteen".
  - A table row for the new code.
  - The "Dispatch" producer bullet names `INVALID_PARAMETER`, why it has that
    category, and that a refused optional field is only left unapplied.

## Commands run and observed results

**Before editing:**
- **`git log 147fdb4..HEAD` and `git status`** on my paths: no output. My owned
  files were unchanged since the first read, and clean.
- **The Core parser probe.** A `node --input-type=module` script from `domain/`,
  importing `parseAutomationStudioFailureRecord` from `fluxiq/automation-studio`.
  Exit 0:
  ```
  category known: true
  bare: {"category":"graph_validation_or_unknown_node","code":"web.action.invalid_parameter","retryable":false,"stage":"dispatch"}
  described: {"category":"graph_validation_or_unknown_node","code":"web.action.invalid_parameter","retryable":false,"stage":"dispatch","expected":"a well-formed assert for web.dom.assert","actual":"assert was present but malformed, so the action was not dispatched"}
  negative control, retryable true: null
  ```

**Checking for other pins of the code set.** A grep for
`fourteen|14 codes|Object.values(WEB_AUTOMATION_FAILURE_CODES)|Object.keys(WEB_AUTOMATION_FAILURE_CODE|web.action.not_implemented`
found only these outside `codes.ts`, none of them a pin:
- `failure-taxonomy.md` (now owned);
- `codes.test.ts` (now owned);
- `classify.test.ts:27`, which loops over every code and does not pin the list;
- `adapter-redaction.test.ts:93`, an unrelated `commandId` that happens to
  contain "fourteen".

**Checking for exhaustive uses of the code type and for affected callers:**
- **`WebAutomationFailureCode` outside `runtime/failure/`:** only parameter
  types, a guard, and `page-identity.ts:111`'s chosen set of six. Nothing is
  exhaustive over the union.
- **Malformed required fields sent through the mapping outside my files.** A
  grep for such literals found:
  - `apps/extension/src/runtime/tests/command-options.test.ts:76`, which calls
    `tabRequestForAction` directly;
  - `domain/src/runtime/expectation/tests/conditions.test.ts:66`, which calls
    `webAutomationExpectationCondition` directly.

  Neither goes through the mapping.

**Validation (from `domain/`; output in scratch files):**
- **`pnpm check`:** exit 0 (`tsc -p tsconfig.json --noEmit && tsc -p tsconfig.test.json`).
- **`DOMAIN_TEST_BUILD_LABEL=g-domain-mapping node scripts/test-domain.mjs`:**
  exit 0, `# tests 352`, `# pass 352`, `# fail 0`.
  - Both gateway test files printed their pass line.
  - `ok 205`, `ok 206`, `ok 207` and `ok 212` are the four `codes.test.ts`
    subtests.
- **Mutation 1.** `gateway-mapping.ts`: `if (unreadable.length > 0)` became
  `> 99`. Test exit 1:
  ```
  Domain test entry failed to load: src/client/tests/gateway-command-parameters.test.ts
  AssertionError [ERR_ASSERTION]: web.dom.assert was dispatched: an unknown kind is no assertion
  Domain test entry failed to load: src/client/tests/gateway-mapping.test.ts
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  -   message: 'Not dispatched: web.dom.assert requires assert, and what was sent could not be read.',
  2 of 48 domain test entries failed to load:
  ```
  Restored. `sha256sum` gave
  `1569e388c163f304ea6e1a9cfb2721e1452707ae2481c57a5c744913ed7e3e31` before and
  after.
- **Mutation 2.** `codes.test.ts`: the `INVALID_PARAMETER` row was removed.
  Test exit 1, `# pass 351`, `# fail 1`:
  ```
  not ok 205 - the closed set is exactly the table the briefs quote, by vocabulary name and wire code
      ...
        'NOT_IMPLEMENTED',
    +   'INVALID_PARAMETER',
        'ACTION_FAILED',
  ```
  Restored. `sha256sum` gave
  `8652568cc7af6e7330e59a6634fcec1430c93df96898aba63354e28b28f87bff` before and
  after.
- **Final domain test after both restores:** exit 0, `# tests 352`, `# pass 352`,
  `# fail 0`.
- **`node scripts/structure-audit.mjs`** (repository root, read-only): exit 1.
  - The only FAIL is `[working-docs] docs/working/README.md is out of date`. That
    file is not mine, and I did not run `structure:baseline`.
  - Findings naming my files are advisory only:
    - `gateway-mapping.ts: 413 lines is past the 400-line advisory threshold`
      (it was 377);
    - `gateway-mapping.test.ts: 549 lines` (it was 504, already past 400).
- **Not run:** `pnpm build` and any `pnpm lab` command. No Core file was edited.
- **Single observations.** Each run above was observed once. No failure was
  uniform or impossible, and the two failing runs were the intended mutations.

## Not verified

- **The extension's `check` and `test`, and the test runner, were not run.**
  - The extension compiles against the domain's types, and the code union is now
    wider. Grep found nothing exhaustive over it, and nothing that sends a
    malformed required field through the mapping.
  - The only non-test caller, `apps/extension/src/runtime/result-mapping.ts:22`,
    already treats any `status: "rejected"` with a `failure` as a refusal
    (`f-w18-secret-leg` report). That is read, not run.
- **The tracked `domain/.test-build/` was not regenerated.** It still holds
  bundles from before the rename. The supervisor's unlabelled domain test at
  integration regenerates it.
- **How Core handles the record at run time,** beyond its parser (for example,
  whether the orchestrator reads the record's explicit category rather than its
  message heuristic at `adaptive-orchestrator.ts:128-138`), was not traced.
- **An absent required field** (for example `web.dom.assert` with no `assert`)
  still reaches the verb. The brief scoped B3 to refused fields.
- **What a Lab run must show.** No scenario in the corpus authors a malformed
  required field. Any Lab run should therefore show **no**
  `web.action.invalid_parameter`. If one appears, a Flow node is malformed, and
  the record should name only the action and the field.

## Open questions or contradictions found

1. **A stale doc paragraph I did not rewrite.** `failure-taxonomy.md` ("Two rows
   of the table are not produced by any of them today") says
   `USER_INTERVENTION_REQUIRED` has one producer and `PAGE_CHANGED` none. At
   HEAD, grep shows:
   - `USER_INTERVENTION_REQUIRED` is produced by
     `content/action-runtime/results.ts:192`, `domain/src/runtime/adapter.ts:121`
     and `domain/src/client/gateway-mapping.ts` (the unsupplied-value refusal);
   - `PAGE_CHANGED` is produced by `content/actions/page-identity.ts:96`.

   The paragraph was stale before B3, and fixing it is doc truth outside this
   brief. The Dispatch bullet also still omits the mapping's
   `USER_INTERVENTION_REQUIRED`.
2. **`gateway-mapping.ts` crossed the 400-line advisory threshold** (377 to 413).
   It is a warning, not a failure, but it is new. Splitting the three refusal
   builders out would bring it back under.
3. **The domain test count stayed at 352.** The two gateway test files are
   top-level assertion scripts, not `node:test` subtests, so they add to no
   count. Their proof is the printed pass line and the mutation failures above.
4. **The structure audit fails on `docs/working/README.md`.** That index is the
   supervisor's to regenerate.

## B6 (withdrawn) — findings from the first attempt

The navigation to `/account` never reaches the domain, so no mapping change in
`input-model.ts` can make it a Flow step.
- **How auth-gate navigates.** The fixture's submit handler calls
  `location.assign` after the recorded click (`auth-gate/pages.ts:36-45`).
- **The first drop.** The recorder ignores `link`, `form_submit` and `reload`
  commits
  (`apps/extension/src/background/connection/recorded-event-intake.ts:86`). That
  a script navigation arrives as `link` is Chrome's behaviour, not observed live.
- **The second drop.** The recorder drops any untyped navigation within 5 s of a
  click (`navigation-recorder.ts:48`).
- **The vocabulary.** The only transition value ever written is `"typed"`
  (`:108`). No source in either repository stamps `reason: "recording_start"`.
- **Even with a navigate step,** the expired replay would report
  `navigation_unexpected` (`apps/extension/src/runtime/action-runner.ts:145-148`),
  not `auth_required`.

The options for W19, in increasing number of files:
- **A:** check the recorded click's destination after the replayed click, which
  is Core's PB10b plus a recorder change.
- **B:** a `web.dom.assert` step appended by the Flow lane.
- **C:** the navigate verb classifies a redirect to a sign-in page, plus a
  recorder change.

Lab proof once fixed: `pnpm lab run auth-gate --flow --variant expired --target isolated`,
run 3 times, reports `auth_required` all 3 times.
