# t589 lab-core-refusal-reason: worker report

## Outcome

Done. A Lab control request that Core answers with a 4xx now projects to a new closed facility-failure reason, `core.refused`. It carries `endpoint`, `httpStatus` and an optional screened `refusal` sentence. Every existing reason and its tests are unchanged.

## What changed and why

- `packages/test-contracts/src/evaluation.ts`: adds `"core.refused"` to `facilityFailureReasons` (just before `unclassified`). Adds the optional fields `httpStatus?: number` and `refusal?: string` to `FacilityFailureDiagnostic`, and the constant `FACILITY_FAILURE_REFUSAL_MAX_LENGTH = 240`.
- `packages/test-contracts/src/facility-failure-refusal.ts` (new, exported from the barrel): `isScreenedFacilityRefusal(value, maxLength = 240)` returns true only for a trimmed, single-line string of 1 to maxLength characters that has:
  - no Cc/Zl/Zp characters and no double spaces;
  - no `Bearer <tok>`, and no password, passwd, pairing/access token, secret, cookie, authorization or api key assignment;
  - no `[REDACTED]`;
  - no run of 32 or more identifier characters that mixes letters and digits.

  The first two patterns mirror the evidence `redactText` rule, widened. `test-evidence` depends on `test-contracts`, so `test-contracts` cannot import it.
- `packages/test-contracts/src/evaluation-validation.ts`: adds `httpStatus` and `refusal` to the allowed facility-failure keys, and a new `checkCoreRefusal`:
  - `core.refused` requires `endpoint` and an integer `httpStatus` from 400 to 499.
  - It forbids `operationStage`, `causeCode` and `timeoutMs`.
  - `refusal` must pass `isScreenedFacilityRefusal`.
  - `httpStatus` and `refusal` are rejected on every other reason.
  - `endpoint` is now allowed on `http.*` or `core.refused`.
- `packages/test-runner/src/facility-failure/core-refusal-failure.ts` (new, internal): `coreRefusalFailure(error)`.
  - It follows `RunnerFailure` causes up to 4 levels to find `details.path` (which must match `FACILITY_FAILURE_ENDPOINT_PATTERN`) and an integer 4xx `details.status`. That is the details shape `FluxIQControlClient.request` throws and `existing-fluxiq-control`'s `contractRefusal` rewraps.
  - It takes Core's sentence from `details.reason` and collapses it to one line.
  - It keeps the sentence only if `redactText` leaves it unchanged and `isScreenedFacilityRefusal` passes on the whole uncut sentence. Only then is it cut to 240 characters, ending in `…`, and screened again. A sentence that fails is dropped whole.
- `packages/test-runner/src/facility-failure/project-facility-failure.ts`: calls `coreRefusalFailure` through the existing `safeProjection`, after the readiness, transport and bounded-HTTP checks and before the known-wait and errno fallbacks. A hostile getter therefore still fails closed to `unclassified`. The structure audit's `failure-as-empty` rule refused a local try/catch, so it was not used.
- Tests:
  - `packages/test-runner/src/facility-failure/tests/project-facility-failure.test.ts` has 3 new tests:
    - The `update-flow-settings` 400 with "LLM execution limit is invalid." becomes `{reason:"core.refused", endpoint, httpStatus:400, refusal}`. The same holds with no sentence, when wrapped once more, and when a long sentence is bounded to 240 characters and still passes contract screening.
    - Six secret-shaped sentences are dropped, and SENTINEL never appears in the output.
    - A 500, a 399, a non-API path, a fractional status and a hostile details proxy all stay `unclassified`.
  - `packages/test-contracts/tests/evaluation-contracts.test.mjs`: the reason-examples table gets a `core.refused` entry. One new test covers the valid shapes and 18 rejected mutations, plus the "only on core.refused" rejections and a digit-free long environment-variable name being accepted.
- `docs/architecture/testing-facility.md`: a new paragraph after the "A 400 from Core..." paragraph (around line 1527) describes the reason, its fields, the screening and the `run-mv85un8j-beb734f5` motivation.

## Commands run and observed results

- `pnpm --filter @fluxiq-web-extension/test-contracts check` printed `test-contracts:check ... stored in the shared store`, exit 0.
- `pnpm --filter @fluxiq-web-extension/test-contracts test` printed `# tests 170 # pass 170 # fail 0`.
- `pnpm --filter @fluxiq-web-extension/test-runner check`: the first run failed with TS2379 (exactOptionalPropertyTypes) in my new test helper. After the fix the check exited 0 with `test-runner:check ... stored in the shared store`.
- `node ../../scripts/build-cache/cli.mjs test-runner:build`, then `node --test dist/facility-failure/tests/*.test.js dist/run-scenario/tests/*.test.js dist/run-evaluation/tests/*.test.js dist/bench/tests/run-bench.test.js` printed `# tests 155 # pass 155 # fail 0`. The facility-failure files alone printed 18/18 pass, including the 3 new tests.
- `pnpm structure:check`: the first run failed on `[failure-as-empty]` in `core-refusal-failure.ts:41`. After the fix it printed `structure-audit: passed (194 warning(s), 639 baselined).`

Nothing reached a model provider, and no Lab run was started.

## Not verified

- I did not run the whole test-runner suite (`pnpm --filter test-runner test`), only the directories named above.
- No live or Lab run checked that a real refusal reaches `evaluation.json` this way.
- I did not run `pnpm check`, `pnpm test` or `pnpm build`.

## Open questions or contradictions found

- The Lab's verdict and summary lines are rendered outside my ownership, and neither prints the new fields yet:
  - `scripts/lab/live-campaign/row/facility-failure.mjs` (`describeFacilityFailure`) will print `core.refused (finalized-bundle, scenario.execute)` without the endpoint, status or sentence.
  - `scripts/lab/live-campaign/lab-run/attempt-failure.mjs` builds `where` from boundary, stage, reason and operationStage only.
  - `scripts/lab/live-guards/run-outcomes.mjs` (`facilityFailureBeforeProvider`) keeps only stage, reason and endpoint.

  To make "the verdict line says why", a follow-up brief should have `describeFacilityFailure` append `httpStatus` and `refusal`. The refusal is already screened by contract, but that script should re-check it with `isScreenedFacilityRefusal` or a length and charset guard.
- I did not bump the evaluation schema version (0.3). The new reason and fields are additive, so old records still validate. A pre-t589 validator would reject a record that carries `core.refused`.
- Core's 401/403 answers after a failed re-login also count as `core.refused`, because any 4xx on a Core route qualifies. Narrow this to 400 only if the supervisor prefers.

## Follow-up: the Lab's verdict lines print the refusal

### Outcome

Done. The coordinator widened my ownership to the three Lab scripts and their tests. The coordinator decided to keep every 4xx as `core.refused` and to keep the schema at 0.3.

### What changed and why

- `scripts/lab/live-campaign/row/facility-failure.mjs`:
  - New `coreRefusalOf(diagnostic)`. For `core.refused` with a Core API route and an integer 4xx, it returns `{ endpoint, httpStatus, refusal? }`. It keeps `refusal` only if `isScreenedFacilityRefusal` passes again. Any other input returns null.
  - `describeFacilityFailure` now prints `core.refused 400 at /api/... (finalized-bundle, scenario.execute): "LLM execution limit is invalid."`. A sentence that fails screening is left out. Other reasons print exactly as before.
  - The screening function is loaded at module start from `packages/test-contracts/dist/facility-failure-refusal.js`, only if that file exists. With no build, the stand-in rejects every sentence, so the line drops the sentence: fail closed, with no try/catch.
- `scripts/lab/live-campaign/row/index.mjs`: re-exports `coreRefusalOf`. The structure audit's `imports` rule requires `live-guards` to import through this barrel. This one-line barrel edit was not in the named files, but it is needed to use the helper.
- `scripts/lab/live-campaign/lab-run/attempt-failure.mjs`: a local `coreRefusal(facility)` gives `400 /api/...: "sentence"`, with the sentence re-screened the same way.
  - It is appended to `where`, which is part of the fingerprint.
  - The description puts `core.refused <status> <route>[: "sentence"]` ahead of the bundle's first failure.
  - It is a local copy, not an import, because `row` imports `lab-run`, so importing `row` here would make a cycle.
- `scripts/lab/live-guards/run-outcomes.mjs`: `facilityFailureBeforeProvider` now keeps `httpStatus` and the re-screened `refusal` for `core.refused`, read through `coreRefusalOf`. The typedef was updated to match.
- Tests:
  - New `scripts/lab/live-campaign/row/tests/facility-failure.test.mjs` (3 tests): the line prints status, route and sentence. Six bad sentences are dropped while status and route still print. An invalid route or status, or another reason, is not read as a refusal, and an `http.timeout` line is unchanged.
  - `lab-run/tests/attempt-failure.test.mjs` has 2 new tests: the exact description and fingerprint, and a secret-shaped sentence kept out of both.
  - `live-guards/tests/facility-failure-run.test.mjs` has 1 new test: with no provider call, the finish carries status and sentence, and a `Bearer` sentence is dropped.

### Commands run and observed results

- `node --test scripts/lab/live-campaign/row/tests/*.test.mjs scripts/lab/live-campaign/lab-run/tests/*.test.mjs scripts/lab/live-guards/tests/*.test.mjs` printed `# tests 98 # pass 98 # fail 0`. The 6 new tests are listed as `ok`.
- `pnpm lab:test` printed `# tests 209 # pass 208 # fail 0`; the one test that did not pass was not reported as a failure.
- `pnpm structure:check`: the first run failed on `[imports]` because `run-outcomes.mjs` imported `../live-campaign/row/facility-failure.mjs` directly. After routing the import through the barrel it printed `structure-audit: passed (194 warning(s), 639 baselined).`

### Not verified

- No live campaign or guard run shows these lines on a real run.
- The two scripts depend on a built `test-contracts` dist to print a sentence. On a clean clone, before `dist` is built (for example, the lab tests at the start of `pnpm check`), the sentence is dropped. That case is not tested: the tests ran with `dist` present.

### Open questions

- The run-outcomes `ENDPOINT` pattern for non-refusal reasons (`/^\/api\/[a-z0-9/-]{1,120}$/`) is narrower than the contract's: it does not allow `_`. I left it unchanged.
