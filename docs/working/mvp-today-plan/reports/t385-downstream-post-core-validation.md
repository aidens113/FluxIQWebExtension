# t385 — downstream post-Core validation

Status: **GO — all non-worktree gates pass; task fixture environmentally blocked**

## Boundary and prepared order

This worker prepared the downstream-only, provider-free validation against the current sibling
`F:\!FluxIQ`. Per supervisor coordination, Core completion is not inferred from timestamps. No
build, check, test, Lab, browser, panel, provider, or live command will start until the supervisor
explicitly signals that t379's Core build and gates are complete.

After that signal, the serial order is:

1. capture both statuses/revisions, `git diff --check`, Core junction and runtime-resolution identity;
2. rebuild downstream domain and web-panel host outputs against that exact Core;
3. build test-runner and run the four focused progress/privacy/accounting files;
4. run domain, test-runner, and extension package checks/tests/builds from the t373 matrix;
5. rebuild the full downstream output dependency closure in the corrected order
   (`domain -> test-contracts -> Scenario Lab -> test-evidence -> extension -> test-runner`);
6. run downstream `pnpm check`, `pnpm test`, and `pnpm build`, applying only the documented root
   task-fixture exception if the exact known `git worktree add` spawn failure recurs;
7. recapture linkage/runtime identity, statuses/revisions, required marker presence, and six strict
   tracked-source/dependency-to-output freshness comparisons.

The focused test files are:

- `dist/existing-fluxiq-control/tests/publishable-step-value.test.js`
- `dist/existing-fluxiq-control/tests/adaptation-evidence-loop.test.js`
- `dist/flow-lane/creation/tests/build-proposal.test.js`
- `dist/live-llm/tests/build-usage.test.js`

The six freshness owners are test-contracts, test-evidence, domain, extension E2E Chromium content,
Scenario Lab, and test-runner. Every generated output must be strictly newer than its newest tracked
source/config input and named built dependency; equality is failure. The extension E2E manifest is
an existence/identity marker, not a timestamp freshness marker. The host bundle is separately
required to exist after `pnpm fluxiq:host:build` and remain preserved through later domain builds.

## Results

The first supervisor release reported t379 GO for its Core package/focused validation, but t386
corrected the ordering because Core root gates were still pending. The active downstream package
matrix was allowed to finish and this worker held. The supervisor later released downstream work
after final Core evidence of **5,437 passed, 1 intentional skip, 0 failed**, plus Core check,
docs check, build, and stable production sources. After later timeout-test edits, the supervisor
reported Core `pnpm check` passing again before downstream root build.

### Focused and package proof

The final Core build invalidated the interim artifact binding, so the full downstream dependency
closure and focused tests were rerun rather than reused:

```text
pnpm --filter @fluxiq-web-extension/domain build
pnpm fluxiq:host:build
pnpm --filter @fluxiq-web-extension/test-contracts build
pnpm --filter @fluxiq-web-extension/scenario-lab build
pnpm --filter @fluxiq-web-extension/test-evidence build
pnpm --filter @fluxiq-web-extension/extension build
pnpm --filter @fluxiq-web-extension/test-runner build
node --test <the four focused compiled test files listed above>
```

Every command exited 0 and the focused progress/privacy/accounting result was **49/49 passed**.
Before the corrected hold, package-level checks and tests had also passed against the then-current
Core outputs: domain **847/847**, test-runner **1,470/1,470**, extension **832/832**. The final root
test below reran all three against final Core and subsumes those interim results.

### Root gates and exact exception

- `pnpm check` — exit 1 only at `pnpm task:test`: **89/120 passed, 31 failed**. Every failure was
  the documented machine exception while a repository fixture invoked `git worktree add`; the
  exact stderr was `error: cannot spawn git: Exec format error` and Node reported
  `code: 'ERR_TEST_FAILURE'`. The separately required `pnpm task:test` produced the same exit 1,
  count, and exception. No different task-fixture failure occurred.
- `pnpm structure:test` — exit 0.
- `pnpm lab:test` — exit 0.
- `node scripts/structure-audit.mjs` — the first fallback attempt saw a concurrently authored t401
  draft with broken links and a stale working-doc index, so it stopped as a real blocker. The
  supervisor fixed the links, regenerated only the working-doc baseline, and reran the complete
  audit: **0 violations, 109 warnings, 121 baselined**.
- `pnpm -r check` — exit 0 across all 10 participating workspace packages.
- `pnpm test` — exit 0 across all workspace packages. Named final package totals were domain
  **847/847**, extension **832/832**, Scenario Lab **571/571**, and test-runner **1,470/1,470**.
- `pnpm build` — exit 0 across all 10 participating workspace packages.

Per t373, the root-check result is therefore exactly: **all non-worktree gates pass; task fixture
environmentally blocked**. It is not reported as an unqualified `pnpm check` pass.

After root build, the same corrected serial closure was rebuilt once more. The domain host was
rebuilt after the domain, Scenario Lab performed the final test-contracts write before
test-evidence, and test-runner was last. All commands exited 0.

### Freshness and output identity

All six strict comparisons use `output.LastWriteTimeUtc > newest tracked source/config or built
dependency`; equality is not accepted.

| Owner | Output UTC | Newest input/dependency | Input UTC | Result |
| --- | --- | --- | --- | --- |
| test-contracts | `2026-09-27T06:57:26.8133351Z` | Core contracts `dist/index.js` | `2026-09-27T06:30:37.5423475Z` | PASS |
| test-evidence | `2026-09-27T06:57:32.9087543Z` | test-contracts `dist/index.js` | `2026-09-27T06:57:26.8133351Z` | PASS |
| domain | `2026-09-27T06:57:21.8827346Z` | Core gateway `dist/index.js` | `2026-09-27T06:30:49.9570561Z` | PASS |
| extension E2E Chromium content | `2026-09-27T06:57:37.4847764Z` | domain `dist/index.js` | `2026-09-27T06:57:21.8827346Z` | PASS |
| Scenario Lab | `2026-09-27T06:57:31.1382401Z` | test-contracts `dist/index.js` | `2026-09-27T06:57:26.8133351Z` | PASS |
| test-runner | `2026-09-27T06:57:47.3257971Z` | test-evidence `dist/index.js` | `2026-09-27T06:57:32.9087543Z` | PASS |

Presence was **12/12** for the four Core markers plus test-contracts, test-evidence, domain, web
panel host, extension content, extension manifest, Scenario Lab, and test-runner. The host exists at
`domain/dist/host/web-panel-host.mjs`, written at `2026-09-27T06:57:23.1936693Z`. SHA-256 identity
between `apps/extension/manifest.e2e.json` and the E2E Chromium output manifest passed exactly; the
manifest timestamp was correctly not used as extension freshness evidence.

### Final source/link identity

- downstream HEAD: `5b8429c543fdc27eb892c225641717aed43c5dc4`;
- Core HEAD: `d035e1b7d17977951a2a2ec6b5e51570e3f2c537`;
- final dirty-path counts: downstream 95, Core 179; these are the understood uncommitted MVP unit,
  not clean commit-level proof;
- both final `git diff --check` commands exited 0 (line-ending conversion warnings only);
- `domain/node_modules/fluxiq` and `domain/node_modules/@fluxiq/client-gateway-websocket` are
  junctions into `F:\!FluxIQ\packages\...`;
- runtime resolution is exactly under `file:///F:/!FluxIQ/packages/`: `fluxiq/dist/index.js`,
  `fluxiq/dist/core/index.js`, and `client-gateway-websocket/dist/index.js`.

## Verdict

**GO for provider-free local downstream closure, with the documented environmental exception.**
The progress projection, privacy screening, accounting invariance, package behavior, root tests,
builds, linkage, output identity, and strict freshness checks pass against the finalized sibling
Core. The only non-green command is the known worktree-spawn fixture boundary above. This does not
provide live/browser/provider MVP proof and does not authorize a live run.

## Prohibited scope

No live Lab, browser, panel, provider, credential, raw run-artifact, or recorded-page-data access.
No source/shared-document edits, commits, or pushes. This worker report is the only authored file.
