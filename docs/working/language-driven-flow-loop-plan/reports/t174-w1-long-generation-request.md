# t174-w1: long generation request

## Outcome

Done. The Flow bootstrap generation request is now held open up to the
build's own deadline (675 s) on `node:http`, so Core's answer reaches
`buildCreatedFlowProposal`, whether it is a proposal or a failure diagnostic.
Every other request keeps the 300 s cap and keeps using `fetch`.

## What changed and why

- `packages/test-runner/src/http-control/long-request.ts` (new, one export
  `longRequestFetch`) sends one request with `node:http`/`node:https`
  (`agent: false`) and returns a WHATWG `Response`. It waits only as long as the
  caller's `AbortSignal` allows, because undici's 300 s headers timeout cannot
  be raised without importing undici. It reads the whole body before it
  resolves, so the caller's timer covers the reply too. The body is capped at
  32 MiB. A reply that closes early rejects, and 204/205/304 get a null body.
  Its errors carry only a transport code, which `boundedFetch` keeps. It
  discards everything else, as it does for `fetch`.
- `packages/test-runner/src/http-control/index.ts`:
  - `FluxIQHttpOptions` gains `longRequest?: boolean`.
  - `authenticatedResponse` sends through `longRequestFetch` when the option is
    set, and through `fetch` otherwise.
  - `boundedTimeout` validates against `LONG_REQUEST_MAX_TIMEOUT_MS` (900 s,
    not exported) for a long request and against `FLUXIQ_HTTP_MAX_TIMEOUT_MS`
    (300 s, unchanged) for everything else.
  - The constructor takes an optional second argument,
    `limits = { maxTimeoutMs, longRequestMaxTimeoutMs }`, which defaults to
    those two constants. It exists so tests can shorten the caps.
  - A new `ordinary()` helper removes `longRequest` from the bounds of a login
    or session validation. A re-login triggered by a 401 is therefore never a
    long request.
  - The bounded timeout and abort failures are unchanged: same message, same
    details shape (`bounded`, `operationStage`, `timeoutMs`, route-only
    `path`), and they carry no cookie or body.
- `packages/test-runner/src/flow-lane/creation/build-proposal.ts`:
  - Removed `GENERATION_REQUEST_TIMEOUT_MS`.
  - The generation call now passes
    `{ timeoutMs: wait.requestTimeoutMs ?? wait.deadlineMs ?? GENERATION_DEADLINE_MS, longRequest: true, signal? }`.
  - `awaitProposal` now always polls at least once. The request's timeout
    equals the deadline, so without this, a request that timed out would leave
    zero time for the poll fallback. The bounded-failure semantics are
    otherwise unchanged: a bounded timeout still leads to polling and then to
    `lab.generation_unfinished`. With a timeout at clock 0, the poll count is
    identical to before (the existing test still sees 5 polls).
  - The earlier uncommitted t177 hunks in this file and its test (providerThrow
    and incompleteDraft) were left intact.

## Commands run and observed results

- `pnpm --filter @fluxiq-web-extension/test-runner build`: exit 0.
- `node --test --test-concurrency=2 dist/http-control/tests/{auth,wait,long-request}.test.js dist/flow-lane/creation/tests/{build-proposal,lane}.test.js` (run from `packages/test-runner`): `# tests 51 # pass 51 # fail 0`. The same set without `lane` passed 37/37 three times in a row.
- Checks that the new tests fail before the change. My hunks were temporarily
  reverted, then restored and checked with `git diff --stat`:
  - With HEAD's `http-control/index.ts`: "a long request receives an answer
    that arrives after the ordinary cap" and "a long request that outlives its
    own bound is still a bounded timeout" both failed.
  - With the old `build-proposal.ts` logic: "the build request is held open, as
    a long request, until the build's own deadline", "a build that fails after
    the ordinary request cap is recorded with Core's own diagnostic" and "a
    build request that times out at the deadline still looks once for a
    proposal" all failed (19/22 passed).
  - "a long request can be interrupted by its caller" passes before and after.
    It guards against a regression and is not a fail-first test.
- `node scripts/structure-audit.mjs`: `structure-audit: passed (114 warning(s), 120 baselined)`. Only advisory line-count warnings appear, for build-proposal.ts (516) and its test (490). The baseline was not lowered and `structure:baseline` was not run.
- Undici fingerprint check (a one-off `node -e` sending a global `fetch` to a local server): the server logged `sec-fetch-mode: cors`. The long-request test asserts this header is absent to prove the request did not go through undici.

## Not verified

- The real 300 s undici headers timeout was not reproduced; that would need a
  run lasting several minutes. The tests shorten the client's caps through
  injection. The `sec-fetch-mode` assertion is how they show undici was not the
  transport.
- `https:` origins through `longRequestFetch` were not tested; only `http:` on
  127.0.0.1 was.
- No live Lab run was made, as the brief required. Core's server-side limits on
  an 11-minute response (proxy or server timeouts) are unknown.
- The full `pnpm test`, `pnpm check` and repo-wide suites were not run.

## Open questions or contradictions found

- One combined test run failed at the file level with `ERR_MODULE_NOT_FOUND`
  for `node_modules/fluxiq/dist/programs/automation-studio/index.js`. The
  shared sibling Core's dist was missing at that moment, and was present again
  moments later. Another agent was most likely rebuilding Core at the same
  time. This was not caused by this change, but it can produce false failures
  in parallel validation.
- `CreatedFlowBuildWait.requestTimeoutMs` is still honoured, but no production
  caller sets it.
