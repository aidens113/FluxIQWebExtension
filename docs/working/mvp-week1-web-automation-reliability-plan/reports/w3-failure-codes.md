# Report: w3-failure-codes

Worker: `w3-failure-codes`. Wave 3, serial first: Phase 1.5 step 3, the shared
half — the closed set of web-automation failure codes and the classifier that
lands an outcome on one of them.

## Outcome

**Done**, with one seam the brief did not include. The module is built, typed
and tested: domain `check` and `test` pass, every code is covered by a test, and
the structure audit is clean with the new files staged. What is missing is the
export seam. `domain/src/runtime/failure/` is reachable today only by a relative
import from inside `domain/src/`, because no barrel I own exports it and the
`@fluxiq-web-extension/domain` package exposes only `.` and `./client`. The
content script, the resolver and the test runner all need the codes and cannot
reach them yet. The exact lines are in
[The export seam the brief left out](#the-export-seam-the-brief-left-out).
Nothing I wrote is inert on the domain side: `adapter.ts` can import `./failure`
as it stands.

## The code set

**This is the section the other briefs quote.** Import the codes from
`domain/src/runtime/failure` and read them off `WEB_AUTOMATION_FAILURE_CODES` by
the vocabulary name in the first column. Do not retype the wire string at a call
site, and do not invent a code that is not here: the set is closed, and the
test-runner allowlist derives from it.

| Vocabulary name | Wire code | Core category | Retryable | Stage |
| --- | --- | --- | --- | --- |
| `ACTION_REJECTED` | `web.action.rejected` | `blocked_by_capability_or_policy` | no | `execution` |
| `TARGET_NOT_FOUND` | `web.target.not_found` | `target_not_found` | yes | `target_resolution` |
| `TARGET_AMBIGUOUS` | `web.target.ambiguous` | `target_ambiguous` | no | `target_resolution` |
| `OUTPUT_NOT_OBSERVED` | `web.validation.output_not_observed` | `output_not_observed` | yes | `verification` |
| `STATE_MISMATCH` | `web.validation.state_mismatch` | `unexpected_state` | no | `verification` |
| `NAVIGATION_UNEXPECTED` | `web.navigation.unexpected` | `navigation_unexpected` | no | `confirmation` |
| `PAGE_CHANGED` | `web.page.changed` | `page_changed` | yes | `execution` |
| `TIMEOUT` | `web.action.timeout` | `timeout` | yes | `execution` |
| `AUTH_REQUIRED` | `web.auth.required` | `auth_required` | no | `confirmation` |
| `USER_INTERVENTION_REQUIRED` | `web.intervention.required` | `user_intervention_required` | no | `execution` |
| `UNSUPPORTED_TYPE` | `web.action.unsupported_type` | `blocked_by_capability_or_policy` | no | `dispatch` |
| `NOT_IMPLEMENTED` | `web.action.not_implemented` | `blocked_by_capability_or_policy` | no | `dispatch` |
| `ACTION_FAILED` | `web.action.failed` | `action_failed` | yes | `execution` |
| `UNKNOWN` | `web.action.unknown` | `ambiguous_or_unknown` | no | `execution` |

Fourteen codes. The brief named eleven; three more are here because they are
already on the wire and the set would not otherwise be closed:

- `web.action.unsupported_type` is produced today by
  `domain/src/client/gateway-mapping.ts` for a refused action type.
- `web.action.not_implemented` is produced today by
  `content/action-runtime/validation-outcome.ts` for a registered verb with no
  implementation.
- `web.action.failed` gives Core's `action_failed` category a code. It is the
  honest answer for an action that ran, failed, and said why in words, which
  `UNKNOWN` ("the producer could not determine a cause") would misreport.

`web.action.timeout` and `web.validation.output_not_observed` are the strings
the content script already emits, kept exactly so nothing regresses on the wire.

### How to produce a code

```ts
import { WEB_AUTOMATION_FAILURE_CODES, webAutomationFailureRecord } from "../failure";

return webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.TARGET_AMBIGUOUS, {
  expected: "one Save control",
  actual: "three controls scored within the margin"
});
```

`webAutomationFailureRecord(code, comparison?)` is the only way to build a
record. The category, retryable flag and stage come from the table, so a
producer decides only which failure happened and what it can say about it, and
a record can never contradict Core's parser. `comparison` takes `expected`,
`actual` and `evidenceDigest`, all optional. Text is collapsed to one line and
bounded to Core's 1,024-character record limit; a description that collapses to
nothing, or a digest that is not a lowercase 64-character SHA-256 hex string, is
dropped rather than passed on — losing one optional field beats losing the whole
record, which is what Core's parser does with an out-of-bounds one.

Also exported: `WEB_AUTOMATION_FAILURE_CODE_DEFINITIONS` (the table itself,
frozen, keyed by wire code) and `isWebAutomationFailureCode(value)`.

### How to classify when you do not know the code

```ts
import { classifyWebAutomationFailure } from "./failure";

const failure = classifyWebAutomationFailure(error, { status, actionType, validation, message, failure: reported });
```

`classifyWebAutomationFailure(error, outcome)` returns an
`AutomationStudioFailureRecord`, or `undefined` when the outcome names no
failure. A producer that already knows its code does **not** come through here —
it calls `webAutomationFailureRecord` directly. This is for a caller holding an
outcome and an error and no opinion about either, which is the domain hop in
`adapter.ts`.

`WebAutomationActionOutcome` is `{ status, actionType?, validation?, failure?,
message? }`; only `status` is required, because a command that went unanswered
has nothing else.

The rules, in order, strongest evidence first:

1. `outcome.failure` present → returned **unchanged**. The producer stood
   nearest the page; the classifier never overwrites it.
2. A `WebAutomationRuntimeError` whose `code` is in the set → that code. The
   class is matched structurally as well as by `instanceof`, so an error raised
   against a bundled copy of the class still classifies.
3. A `WebAutomationRuntimeError` with any other code → `UNKNOWN`, carrying
   `unrecognized web automation failure code: <code>` in `actual`.
4. `status === "timed_out"` → `TIMEOUT`. Read before the validation, because a
   wait that ran out of time also leaves a failed validation behind and
   `timeout` is the better name for it.
5. `validation.status === "failed"` → `STATE_MISMATCH` when `actionType` is
   `web.dom.assert`, otherwise `OUTPUT_NOT_OBSERVED`, carrying the validation's
   `expected` and `actual`.
6. Any other thrown value → `ACTION_FAILED`, with the error's message as
   `actual`.
7. `status` `failed` or `unknown` → `ACTION_FAILED` when `message` says
   something, `UNKNOWN` when it does not.
8. Otherwise `undefined`: an action that succeeded with its post-condition
   intact, and a cancelled command, whose meaning Core's
   `failureForCommandStatus` derives from the command status alone.

## Decisions the other briefs must not silently re-make

- **`STATE_MISMATCH` maps to `unexpected_state`, not `expected_state_missing`.**
  A failed authored assertion means the page is in a state other than the
  asserted one, which is what `unexpected_state` names. `expected_state_missing`
  stays Core's transition-comparison category and has no web code.
- **`ACTION_REJECTED` is one code, not one per reason.** The plan says "one
  shape". The reason — disabled, hidden, covered — rides in `expected`/`actual`.
  This supersedes `rejectionFailure(code, validation)` in
  `content/action-runtime/validation-outcome.ts`, which builds
  `web.action.${code}` from a free-form suffix and has no call sites today;
  `w3-failure-producers` owns that file and should replace the suffix with the
  single code.
- **Four Core categories deliberately have no web code**:
  `expected_state_missing`, `missing_router_or_subflow_target`,
  `graph_validation_or_unknown_node`, `external_side_effect_denied`. They are
  Flow-level failures the browser path cannot produce. Do not invent codes for
  them to make a table look complete.
- **Stage vocabulary, applied consistently**: `target_resolution` while deciding
  which element to act on; `dispatch` before anything ran, for a verb the client
  will not run at all; `execution` while the action ran; `confirmation` while
  confirming the action itself landed; `verification` while checking a
  post-condition or an authored assertion.
- **`retryable` answers only Core's question** — whether retrying the same action
  unchanged can succeed without a person or a Flow edit. Core forbids six
  categories from ever being retryable, so those rows have no choice. The judged
  ones: `TARGET_NOT_FOUND` is retryable because an element may appear once the
  page settles; `TARGET_AMBIGUOUS` is not, because it stays ambiguous until the
  Flow says which it meant; `NAVIGATION_UNEXPECTED` is not, because a landed URL
  repeats on retry unless something else changes.

## The export seam the brief left out

The brief's Owns is `domain/src/runtime/failure/` and its tests, so I could not
add these. Each is one line, and without them the consumers below cannot reach
the code set at all.

1. **`domain/src/runtime/index.ts`** — add `export * from "./failure";`.
   Without it the codes are absent from `@fluxiq-web-extension/domain`.
2. **`domain/src/client/index.ts`** — add `export * from "../runtime/failure";`.
   This is the barrel `apps/extension/src` imports, and the content script needs
   the codes for `w3-resolver` (`TARGET_NOT_FOUND`, `TARGET_AMBIGUOUS`) and
   `w3-failure-producers` (`results.ts`). It is safe for the browser bundle:
   `codes.ts` imports only a *type* from `fluxiq/automation-studio` plus
   `WEB_AUTOMATION_VALIDATION_TEXT_MAX_LENGTH` from `../../actions/types`, which
   the client barrel already exports, and `classify.ts`'s only runtime import is
   `../errors`, which has no dependencies. No Core runtime module enters the
   content bundle.
3. **`packages/test-runner/package.json`** — `w3-runner-alignment` must generate
   its allowlist from the domain codes, but the package does not depend on
   `@fluxiq-web-extension/domain` at all (its deps are `test-contracts`,
   `test-evidence`, `@playwright/test`, `fluxiq`). It needs
   `"@fluxiq-web-extension/domain": "workspace:*"` plus item 1 or 2 above.
   Note the domain's `exports` map has only `.` and `./client`, so there is no
   subpath to import — it must go through a barrel.

`domain/src/runtime/adapter.ts` needs none of this: it is a sibling of
`failure/` and can `import { classifyWebAutomationFailure } from "./failure";`
today. The structure audit allows it, because a directory import goes through
that directory's own barrel.

## What changed and why

Five new files, all under `domain/src/runtime/failure/`:

- `codes.ts` — the closed set, the code→(category, retryable, stage) table, the
  type guard, and `webAutomationFailureRecord`. The binding of code to category
  is the point of the module: Core's parser drops an inconsistent record whole
  rather than repairing it, so a record assembled by hand at a call site can
  vanish and take the failure with it. A record built from a code cannot.
- `classify.ts` — `classifyWebAutomationFailure` and
  `WebAutomationActionOutcome`, with the precedence above.
- `index.ts` — the barrel.
- `tests/codes.test.ts` — the code table restated independently of `codes.ts`,
  so a silent edit to a category, a retryable flag or a stage fails the test
  rather than reaching the wire; every code then built and run through Core's
  `parseAutomationStudioFailureRecord`, bare and with descriptions, asserting
  the parser returns it unchanged. Plus the text bound (asserted equal to Core's
  own `AUTOMATION_STUDIO_FAILURE_RECORD_LIMITS.textMaxLength`), truncation,
  whitespace collapsing, empty-text dropping, digest validation, and the guard.
- `tests/classify.test.ts` — one test per precedence rule, plus a loop that
  classifies a `WebAutomationRuntimeError` for **every** code in the set and
  asserts the record comes back with that code. Every record any test produces
  is also run through Core's parser.

Nothing outside `domain/src/runtime/failure/` was touched.

## Commands run and observed results

`DOMAIN_TEST_BUILD_LABEL=w3-failure-codes` was set for both package commands.
Exit status was captured by redirecting to a file and echoing `$?`, never
through a pipe.

- `pnpm --filter @fluxiq-web-extension/domain check` → **exit 0**. Output:
  `> tsc -p tsconfig.json --noEmit && tsc -p tsconfig.test.json`, no
  diagnostics.
- `pnpm --filter @fluxiq-web-extension/domain test` → **exit 0**.
  `# tests 90 / # suites 0 / # pass 90 / # fail 0 / # cancelled 0 / # skipped 0
  / # todo 0`. The seventeen new subtests are numbered 40–56 in that run
  (`ok 40` through `ok 56`), all passing: ten in `classify.test.ts`, seven in
  `codes.test.ts`.
- `tsc -p tsconfig.test.json --noEmit --listFiles` in `domain/` → **exit 0**,
  and all five new files appear in the file list. Run because pnpm printed a
  stray `No projects matched the filters` line alongside the passing check, and
  a type check that silently skipped the new files would prove nothing.
- `node scripts/structure-audit.mjs` with a scratch `GIT_INDEX_FILE` (a copy of
  `.git/index` with `domain/src/runtime/failure` added; the real index was never
  written) → **exit 0**, `structure-audit: passed (31 warning(s), 19
  baselined)`. No finding names any file under `domain/src/runtime/failure/`;
  all 31 warnings are pre-existing and in files I do not own. Re-run with this
  report staged as well → **exit 0**, same 31 warnings, no new finding.
- `git status --short` → the only change of mine is the untracked
  `domain/src/runtime/failure/`.

## Not verified

- **Nothing calls this yet.** No producer imports the module, so it has no
  behaviour in a real run. That is by design for a serial-first brief, but it
  means the code set is proven only against its own tests and Core's parser, not
  against a browser.
- **No live browser validation**, no `pnpm build`, no `pnpm lab` run — all three
  are the supervisor's, per the brief.
- **Extension and test-runner packages were not checked.** I own no file in
  either, and both are untouched.
- **The three seam lines were not applied or compiled.** The claim that
  `export * from "../runtime/failure"` is safe for the content bundle is
  reasoned from the import graph (type-only Core import in `codes.ts`, no-op
  `../errors` in `classify.ts`), not from a built bundle.
- **`ambiguous_or_unknown` vs `action_failed`** for a bare thrown exception is a
  judgement call, argued above but not validated against corpus data. The
  bench's classification-accuracy metric in Phase 1.6b is what would settle it.

## Open questions or contradictions found

- **The seam is the brief's one defect**, and it is exactly the shape the wave's
  binding rules warn about: ownership drawn around a directory rather than
  around the change. Three consumers named in other Wave 3 briefs
  (`w3-resolver`, `w3-failure-producers` on the content side,
  `w3-runner-alignment`) cannot import what this brief produced. The supervisor
  should apply the three items above before dispatching them, or widen one of
  those briefs to include the barrel it needs.
- **`WebAutomationRuntimeError` has no producer anywhere in the repository.** It
  is declared in `domain/src/runtime/errors.ts`, exported, and thrown by nothing.
  The classifier honours it, so it is now useful, but whichever brief starts
  throwing it should know it is establishing the first use — and that its `code`
  field is typed `string`, not `WebAutomationFailureCode`. Narrowing that type
  would make an out-of-set code a compile error instead of a runtime `UNKNOWN`;
  `errors.ts` is outside my Owns, so I left it alone.
- **`rejectionFailure` in `content/action-runtime/validation-outcome.ts` builds
  `web.action.${code}` from a caller-supplied suffix.** It has no call sites, so
  nothing is broken today, but it is a second place a code can be invented and
  it contradicts the closed set. `w3-failure-producers` or `w3-redaction` should
  retire the suffix; neither brief names `validation-outcome.ts` under Owns,
  though `w3-failure-producers` owns its caller `results.ts`.
