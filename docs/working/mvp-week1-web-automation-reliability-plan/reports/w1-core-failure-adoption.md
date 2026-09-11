# Report: w1-core-failure-adoption

Worker: `w1-core-failure-adoption`. Brief:
`### Brief: w1-core-failure-adoption` in
[briefs/wave-1.md](../briefs/wave-1.md).

## Outcome

**Partial.** All five brief items are implemented and validated, and every
gate passes except the two the brief's own "Must not touch" list makes
impossible: `pnpm --filter @fluxiq-web-extension/test-runner check` and
`test`. They fail on **seven type errors, every one inside
`packages/test-runner/src/bench/`**, which I may not edit. The exact patch is
below; it is six literal string replacements.

Everything else: test-contracts (53 tests), scenario-lab unit (118) and the
four page specs (19), extension `check`/`test` (64)/`test:content` (31)/
`build`, domain `check`/`test` (26), and a clean structure audit.

## What changed and why

### 1. One category list, Core's (brief item 1)

`packages/test-contracts/src/failure-category.ts` no longer lists names. It
re-exports Core's list, guard, record type, and parser from
`@fluxiq/contracts/automation-studio`:

- `AUTOMATION_STUDIO_ADAPTIVE_FAILURE_CLASSES`
- `isAutomationStudioAdaptiveFailureClass`
- `parseAutomationStudioFailureRecord`
- `AutomationStudioAdaptiveFailureClass`, `AutomationStudioFailureRecord`

The old names `scenarioFailureCategories` and `ScenarioFailureCategory` are
gone rather than aliased: an alias would have hidden whose taxonomy it is, and
the point of D11 is that there is exactly one. The package barrel already
re-exported this module, so every facility package reaches Core's taxonomy
through `@fluxiq-web-extension/test-contracts` without adding a dependency on
`@fluxiq/contracts` of its own (test-runner and scenario-lab have none).

Followers, each only where it named the category:

| File | Change |
| --- | --- |
| `src/scenario.ts` | `ExpectedFailure.category`; JSON Schema `$defs.failure.category.enum` |
| `src/validation.ts` | the failure validator uses Core's guard |
| `src/run.ts` | `RunAutomationFailure.category` |
| `src/run-validation.ts` | `$.automationFailure.category` enumeration |
| `src/evaluation.ts` | `automationFailureReported.category`; the two-taxonomies comment |
| `src/evaluation-validation.ts` | both automation-failure checks; the message now says `ambiguous_or_unknown` |

`bench-report.ts` and `bench-report-validation.ts` needed no change: they name
no category.

The test-rig taxonomy (`failureCategories` / `FailureCategory` in
`evaluation.ts`) is untouched and still distinct; the contract tests still
prove a rig category is rejected as an automation category and the reverse.

### 2. Fixtures on Core's values (brief item 2)

| Fixture | Was | Now |
| --- | --- | --- |
| `auth-gate` (W19 `expired`) | `AUTH_REQUIRED` | `auth_required` |
| `intermediate-state` (W24 `unannounced`) | `OUTPUT_NOT_OBSERVED` | `output_not_observed` |
| `modal-flows` (W14 `armed`) | `USER_INTERVENTION_REQUIRED` | `user_intervention_required` |
| `multi-tab` (W15 `popup-blocked`) | `OUTPUT_NOT_OBSERVED` | `output_not_observed` |

Manifest, `tests/scenario.test.ts`, and `e2e/<id>.spec.ts` for each, including
the prose that named the old value (an `auth-gate` manifest comment, an
`auth-gate` spec comment, a `multi-tab` test title).

### 3. The rejection carries Core's record (brief item 3)

**Domain** (`domain/src/client/gateway-mapping.ts`). The rejection and the
normalization result drop `code: "ACTION_REJECTED"` and carry a
`failure: AutomationStudioFailureRecord` instead:

```json
{
  "category": "blocked_by_capability_or_policy",
  "code": "web.action.unsupported_type",
  "retryable": false,
  "stage": "dispatch"
}
```

Why that category: Core's report maps `ACTION_REJECTED` to
`blocked_by_capability_or_policy` — a client refusing an action type it does
not implement is a capability refusal, not the failure of an action that ran.
Why those fields: Core forbids that category from ever being `retryable`, and
the record is a frozen module constant rather than a per-command object, so
nothing unbounded (the requested action type can be any length) can reach
`expected`/`actual` and make Core's parser drop the record whole. The
requested type still travels unaltered in the result's `metadata`, and in the
rejection's own `actionType`.

The record type is a **type-only** import from `fluxiq/automation-studio`, so
no Core runtime enters the browser bundle. Verified on the built background
bundle: `blocked_by_capability_or_policy` appears once, `fluxiq/automation-studio`
zero times.

**Extension** (`apps/extension/src/runtime/result-mapping.ts`).
`gatewayActionResultFromRejection` now sends
`failure: rejection.failure` on Core's field and `metadata:
{ requestedActionType }` — `metadata.code` is gone.
`isWebAutomationActionRejection` recognises a rejection by
`status === "rejected"` plus the presence of `failure`.
`ClientGatewayActionResult` already carries `failure?` (it comes from
`@fluxiq/contracts/client-gateway` through `@fluxiq/client-gateway-websocket`
and `shared/protocol.ts`), so no protocol file needed changing.
`background/connection/gateway-session.ts` is unchanged: both helper
signatures are the same.

### 4. The runner reads Core's record (brief item 4)

`packages/test-runner/src/run-manifest/automation-failure.ts`:

- a `failure` that `parseAutomationStudioFailureRecord` accepts wins, category
  and code taken from the parsed record;
- otherwise the looser fields (`failureCategory`, `category`,
  `error.category`) are accepted only when they are Core category names;
- no category at all: `timeout` when the action timed out, else
  `ambiguous_or_unknown`.

The old "a code that is itself a category name is the category" rule is
removed. It existed because the domain's rejection code `ACTION_REJECTED` was
also a category name; codes are now producer-owned (`web.action.unsupported_type`)
and can never collide with Core's lower-case category names, so conflating the
two would only misclassify.

The evaluation types already follow through `RunAutomationFailure` and
`RunEvaluation.automationFailureReported`.

### 5. Documentation (brief item 5)

- `docs/architecture/web-capabilities.md`: the Action Type Resolution section
  now shows the rejection shape with `failure`, the record as JSON, why the
  category is never retryable, and that the wire has no `rejected` status so
  the record — not the status — names the refusal. The "until Core's
  structured `failure` field lands (decision D3, Wave 3)" caveat is gone.
- `docs/architecture/extension-client.md`: the same correction, one paragraph.

### Every test that builds a failure record parses it

The brief's binding rule is covered in all three producers:

- domain `client/tests/gateway-mapping.test.ts`: every rejected type's record
  is compared to the expected record **and** round-tripped through
  `parseAutomationStudioFailureRecord`;
- extension `runtime/tests/result-mapping.test.ts`: the wire result's
  `failure` is round-tripped through the parser;
- runner `run-manifest/tests/automation-failure.test.ts`: the accepted records
  are asserted to survive the parser, and one test asserts the opposite
  direction — `{ category: "auth_required", retryable: true }` is dropped by
  Core (never-retryable rule) and the reader falls back to the looser fields.

## Commands run and observed results

All from `F:\!FluxIQWebExtension`.

| Command | Result |
| --- | --- |
| `pnpm --filter @fluxiq-web-extension/test-contracts test` | `# tests 53 / # pass 53 / # fail 0` |
| `pnpm --filter @fluxiq-web-extension/domain check` | exit 0 (source and tests) |
| `DOMAIN_TEST_BUILD_LABEL=w1-core-failure-adoption ... domain test` | `# tests 26 / # pass 26 / # fail 0` |
| `pnpm --filter @fluxiq-web-extension/extension check` | exit 0 |
| `EXTENSION_TEST_BUILD_LABEL=w1-core-failure-adoption ... extension test` | `# tests 64 / # pass 64 / # fail 0` |
| `pnpm --filter @fluxiq-web-extension/extension test:content` | `31 passed (5.9s)` |
| `pnpm --filter @fluxiq-web-extension/extension build` | exit 0; bundles rewritten |
| `pnpm --filter @fluxiq-web-extension/scenario-lab test` | `# tests 118 / # pass 118 / # fail 0` |
| `npx playwright test -c e2e/playwright.config.ts` on the four fixture specs | `19 passed (10.1s)` |
| `pnpm --filter @fluxiq-web-extension/test-runner check` | **exit 2, 7 errors, all in `src/bench/`** |
| `node scripts/structure-audit.mjs` | `passed (27 warning(s), 19 baselined)` — identical to the run before my change |

The structure audit also printed `1 baseline entries can be lowered` **both
before and after** my change, so it is pre-existing, not mine. Per the
concurrency note I did not run `pnpm structure:baseline`.

**The runner test I own, validated around the bench blocker.** Because the
package cannot build, `pnpm ... test-runner test` cannot run at all. I
compiled my test alone into an ignored scratch directory inside the package
(so its `@fluxiq-web-extension/test-contracts` import resolves) and ran it:

```text
npx tsc src/run-manifest/tests/automation-failure.test.ts --outDir .test-build-scratch/w1-core-failure-adoption \
  --module nodenext --moduleResolution nodenext --target ES2022 --strict \
  --exactOptionalPropertyTypes --noUncheckedIndexedAccess --skipLibCheck --types node
node --test .test-build-scratch/w1-core-failure-adoption/tests/automation-failure.test.js
# tests 6 / # pass 6 / # fail 0
```

The scratch directory was deleted afterwards (`packages/test-runner` has no
`.test-build-scratch` entry in `.gitignore`, unlike `domain` and
`apps/extension`); `git status --short packages/test-runner` shows no
untracked file from me.

**The seven errors, verbatim locations:**

```text
src/bench/evaluate-run.ts(127,42)                  "UNKNOWN"
src/bench/tests/aggregate-report.test.ts(45,105)   "AUTH_REQUIRED"
src/bench/tests/aggregate-report.test.ts(45,190)   "AUTH_REQUIRED"
src/bench/tests/aggregate-report.test.ts(46,107)   "TIMEOUT"
src/bench/tests/aggregate-report.test.ts(46,186)   "UNKNOWN"
src/bench/tests/evaluate-run.test.ts(40,143)       "TARGET_NOT_FOUND"
src/bench/tests/evaluate-run.test.ts(59,90)        "AUTH_REQUIRED"
```

`src/bench/tests/week1-corpus.test.ts:27-29` additionally holds three
upper-case names in a **runtime** map of corpus rows to expected categories
(`W14`, `W19`, `W24`). Those are not type errors — the map is typed as
strings — but they now disagree with the fixture manifests, so that test fails
at runtime until they change too.

**The patch, applicable as one command:**

```bash
sed -i 's|"UNKNOWN"|"ambiguous_or_unknown"|g; s|"AUTH_REQUIRED"|"auth_required"|g; s|"TIMEOUT"|"timeout"|g;
        s|"TARGET_NOT_FOUND"|"target_not_found"|g; s|"USER_INTERVENTION_REQUIRED"|"user_intervention_required"|g;
        s|"OUTPUT_NOT_OBSERVED"|"output_not_observed"|g' \
  packages/test-runner/src/bench/evaluate-run.ts \
  packages/test-runner/src/bench/tests/aggregate-report.test.ts \
  packages/test-runner/src/bench/tests/evaluate-run.test.ts \
  packages/test-runner/src/bench/tests/week1-corpus.test.ts
```

`evaluate-run.ts:127` is **source**, not a test: until it changes, a bench run
of an uncategorised failure writes `{ category: "UNKNOWN" }`, which
`assertRunEvaluation` now rejects at runtime. This is the one place where the
blocker is a live defect rather than a stale test.

**The upper-case grep the definition of done asks for.** Outside
`packages/test-runner/src/bench/` there is no occurrence of any of the eleven
names as a category value anywhere in `apps`, `domain`, `packages`, `docs`, or
`scripts`. Two remaining places, neither mine to edit:

1. the four bench files above;
2. `docs/architecture/testing-facility.md:690,691,693,695` — the fixture table
   names `USER_INTERVENTION_REQUIRED`, `OUTPUT_NOT_OBSERVED` (twice), and
   `AUTH_REQUIRED` in prose. My brief names only `web-capabilities.md` and
   `extension-client.md`.

No upper-case name survives as a domain `code` value: the one code the domain
produces is `web.action.unsupported_type`.

## Not verified

- **`pnpm --filter @fluxiq-web-extension/test-runner check` and `test`.** They
  fail for the bench reason above. Every other runner file type-checks: the
  seven errors are the complete list, and all are in `src/bench/`.
- **No live browser run of the rejection path.** The wire change
  (`failure` instead of `metadata.code`) is covered by unit tests on both
  sides and by the extension bundle inspection, but no paired extension
  answered a real Core `execute_action` with an unknown type in this work. The
  Lab's recording lane only dispatches `web.browser.navigate` and
  `web.dom.type`, both known types, so `pnpm lab run` would not exercise it.
- **Core's side of the round trip.** That Core keeps this record through
  `client-gateway-transport.ts` is asserted by Core's own tests (per its
  report), not re-proven here.
- **No `pnpm install` was run**, and none is needed: I added no dependency.
  The domain and the extension reach Core's names through the `fluxiq` link
  they already declare (type-only in source, a value import in two test
  files), and only `packages/test-contracts` — where the supervisor added the
  link — imports `@fluxiq/contracts` directly.
- **`pnpm check` / `pnpm test` / `pnpm build` at the repository root** were not
  run; I ran the per-package gates the brief names.

## Open questions or contradictions found

1. **The brief's own contradiction.** "Must not touch … `bench/`" cannot hold
   together with "test-runner (`check`, `test`) pass" once the category type
   changes: `bench/` names six upper-case values. `w1-bench` has reported, so
   nobody is editing `bench/` now — the supervisor can apply the sed above in
   one step, then run `pnpm --filter @fluxiq-web-extension/test-runner test`.
2. **`week1-corpus.test.ts` is a corpus-to-category map**, so after the sed it
   asserts Core's names against the fixture manifests — worth a read rather
   than a blind rename, though the three values map one to one.
3. **`docs/architecture/testing-facility.md`** needs the same four prose
   renames to stay true; it is outside my brief.
4. **`ExpectedFailure.code` is unconstrained.** Core bounds a record's `code`
   to 200 characters of `[A-Za-z0-9._:-]`; a scenario's expected `code` is
   validated only as a non-empty string. No fixture sets one today. If a
   scenario ever expects a code, it should be validated with Core's pattern,
   or an expectation could be written that no valid record can ever satisfy.
5. **Two stages were a judgement call**, both defensible from Core's report
   but worth confirming: `stage: "dispatch"` for the rejection (Core uses
   `dispatch` for its own `output_dispatch.rejected`), and the code
   `web.action.unsupported_type` (Core's convention is
   `<area>.<condition>`, e.g. `output_dispatch.rejected`).
6. **The rejection record is a shared frozen constant.** Every rejection sends
   the same object. If a future caller wants the requested action type inside
   the record (`actual`), it must be truncated to 1024 characters first, or
   Core's parser drops the whole record — that is why it is in `metadata`
   instead.
