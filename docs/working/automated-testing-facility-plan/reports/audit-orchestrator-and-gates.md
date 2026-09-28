# Audit: Phases 6, 7, 8 of the Automated Testing Facility Plan

Status: Complete
Auditor: worker (read-only audit). No source file was changed, in this
repository or in `F:\!FluxIQ`. Nothing was executed: every test count below is
by inspection of test declarations, never by running a suite.
Date: 2026-09-28

Sources read: `docs/working/automated-testing-facility-plan.md` lines 1-140
(`Current State`) and the Execution Log rows for Phases 6, 7 and 8
(lines 173-175), plus the phase descriptions at lines 1325-1346.

---

## Summary of verdicts

| # | Claim | Verdict |
| --- | --- | --- |
| 1 | Phase 6 is primitives only; the package does not invoke agents or mutate worktrees | **Claim true** |
| 2 | Six role policies, trusted-diff reconciliation with gates, 16/16 tests | **Claim true** |
| 3 | Phase 8 safeguards 7/7; no target or secret configured; no real site contacted | **Claim true, but materially narrower than it reads** |
| 4 | Phase 7 `defer` verdict | **Claim true and still re-derivable**; the gate is in practice unsatisfiable |
| 5 | `pnpm agent:orchestrator` reachable, CLI entry exists | **Claim true** |
| 6 | Rot since 2026-09-10 | **No rot.** The code is frozen, compiles, and carries one baselined debt entry |

Two findings deserve the supervisor's attention and are not visible from the
plan's own wording: **F-1** (the Phase 8 "safeguard" has zero runtime
consumers and enforces nothing) and **F-2** (the Phase 7 promotion gate counts
repositories, so it can never be satisfied from inside this repository). A
third, **F-3**, is a coverage gap in the deterministic network guard.

---

## Q1 — Phase 6: "primitives only; no automatic dispatch or merge" — CLAIM TRUE

`packages/agent-orchestrator` cannot dispatch an agent or mutate a worktree.
It has no capability to do either.

**No process spawning.** Every import in `src/` is filesystem, path, crypto or
URL:

- `src/audit.ts:1-3` — `node:crypto`, `node:fs/promises`, `node:path`
- `src/cli.ts:2-3` — `node:fs/promises`, `node:url`
- `src/path-policy.ts:1`, `src/task.ts:1-2`, `src/worktree.ts:1-2` — `node:path`, `node:crypto`
- `src/roles.ts:1`, `src/review.ts:1-2`, `src/types.ts:1` — types only

A search of `src/` and `tests/` for `child_process`, `spawn`, `execSync`,
`exec(`, `fetch(`, `node:http`, `node:net`, `undici`, `axios`, `simple-git`,
`worker_threads`, `vm.` and `eval(` returns exactly two hits, both in a test
harness that invokes the package's own CLI as a subprocess:

- `tests/cli.test.mjs:2` — `import { spawnSync } from "node:child_process";`
- `tests/cli.test.mjs:54` — `const result = spawnSync(process.execPath, [cliPath, ...args], { encoding: "utf8" });`

**No git mutation.** The only `git` in `src/` is the string `"git"` written
into argv that is returned, never run. `src/worktree.ts:90-92`:

```ts
create: { executable: "git", args: ["-C", request.repositoryRoot, "worktree", "add", "-b", request.branch, request.worktreeRoot, request.startPoint], cwd: request.mainWorkspaceRoot },
inspect: { executable: "git", args: ["-C", request.worktreeRoot, "status", "--short"], cwd: request.worktreeRoot },
remove: { executable: "git", args: ["-C", request.repositoryRoot, "worktree", "remove", request.worktreeRoot], cwd: request.mainWorkspaceRoot },
```

`createWorktreePlan` returns a `WorktreePlan` whose `create`/`inspect`/`remove`
are `CommandSpec` records (`src/worktree.ts:23-32`, `81-93`). The two other
mentions of git, `src/worktree.ts:75-76`, are validation of a branch name
against `SAFE_REF` (`src/worktree.ts:59-63`). Nothing executes.

**No network.** No `fetch`, no `http`/`https`, no socket module anywhere in
`src/`.

**The CLI has no dispatch verb.** `src/cli.ts:28-57` accepts exactly five
operations and nothing else, falling through to `usage()`:

- `task create`, `result validate`, `review evaluate`, `audit verify`,
  `worktree plan` (`src/cli.ts:30, 35, 40, 45, 52`)
- `src/cli.ts:25` — `"usage: fluxiq-agent-orchestrator <task create|result validate|review evaluate|audit verify|worktree plan> <json files>"`

**Supporting detail.** `src/audit.ts:5` declares an audit event type
`"task.dispatched"`:

```ts
export type AuditEventType = "task.created" | "task.dispatched" | "response.received" | "candidate.compared" | "review.completed";
```

This is vocabulary for *recording* a dispatch that a human performed
elsewhere. Nothing in the package emits it; the package only appends whatever
a caller hands `AppendOnlyAuditLog.append` (`src/audit.ts:80-84`). This is
consistent with the claim rather than against it.

**Conclusion.** The plan's wording at lines 36 and 98 is accurate. There is no
material finding here.

---

## Q2 — Six role policies, trusted-diff reconciliation, 16 tests — CLAIM TRUE

**The six roles exist**, at `src/roles.ts:14-19`, one per line:

| Role | Writable | Repository | Line |
| --- | --- | --- | --- |
| `coordinator` | no | — | `roles.ts:14` |
| `scenario` | yes | `facility` | `roles.ts:15` |
| `diagnosis` | no | — | `roles.ts:16` |
| `core-repair` | yes | `core` | `roles.ts:17` |
| `extension-repair` | yes | `facility` | `roles.ts:18` |
| `reviewer` | no | — | `roles.ts:19` |

All six carry the same mandatory prohibition set, `src/roles.ts:11`:

```ts
const COMMON: readonly ProhibitedAction[] = ["merge", "publish", "deploy", "live-site-write", "disable-test", "weaken-expectation", "edit-outside-scope"];
```

**Trusted-diff reconciliation exists**, at `src/review.ts:19-28`. The agent's
self-reported edit list is compared against an independently observed diff
supplied as a third input, and a mismatch is an issue:

- `src/review.ts:22` — `issues.push({ code: "edits.observed-format", message: "Trusted observed edits must be a CandidateEdit JSON array" })`
- `src/review.ts:28` — `issues.push({ code: "edits.mismatch", message: "Agent-reported edits do not match the independently observed diff" })`

The identity used for the comparison is
`` `${edit.repository}\0${edit.path}\0${edit.operation}\0${edit.changedBytes}` ``
(`src/review.ts:27`), sorted on both sides, so order does not matter but the
byte count does. The CLI wires three files into it at `src/cli.ts:36-37`.

**Gates exist.** The observed edits are additionally run through the path/role
policy (`src/review.ts:23` calling `validateCandidateEdits`, defined in
`src/path-policy.ts`), and the review gate composes packet validation, result
validation and invariant checks (`src/review.ts:49`).

**Test count: 16, matching the claim.** Counted from test declarations, not
from a run.

`tests/orchestrator.test.mjs` — 10 tests at lines 80, 91, 103, 121, 128, 146,
160, 170, 192, 199.

`tests/cli.test.mjs` — 6 tests at lines 59, 69, 85, 103, 116, 140.

10 + 6 = **16**. No `.skip`, `.only` or `.todo` in either file.

---

## Q3 — Phase 8 real-site safeguards — CLAIM TRUE, materially narrower than it reads

### 3a. "No target or secret is configured and no real site was contacted" — CLAIM TRUE

`git ls-files | grep -i "real-site\|realsite\|real_site"` returns only the
package's own seven files:

```
packages/real-site-policy/README.md
packages/real-site-policy/package.json
packages/real-site-policy/src/cli.ts
packages/real-site-policy/src/index.ts
packages/real-site-policy/src/policy.ts
packages/real-site-policy/src/tests/policy.test.ts
packages/real-site-policy/tsconfig.json
```

No policy document exists anywhere in the tree, tracked or untracked: a
filesystem `find` for `*real-site*` outside `node_modules` and `.git` returns
only the package directory itself. No allowlist, no target origin, no secret
reference is configured. The claim holds.

### 3b. "Safeguards pass 7/7" — test count CLAIM TRUE

`packages/real-site-policy/src/tests/policy.test.ts` declares exactly 7 tests,
at lines 22, 24, 30, 36, 42, 48 and 54. No skips. Matches the plan's 7/7.

What they assert is the refusal behaviour of a *document validator*: wildcard
origins and paths (`:24`), unsafe actions and incomplete deny lists (`:30`),
literal-looking secrets and synthetic-account markers (`:36`), expired
approval (`:42`), public or unredacted artifacts and excessive rates (`:48`),
and a CLI refusal exit status (`:54`).

### F-1 (material finding) — the Phase 8 safeguard enforces nothing

`packages/real-site-policy` has **zero runtime consumers**. A repository-wide
ripgrep for `evaluateRealSitePolicy`, `RealSiteProbePolicy` and
`real-site-policy`, excluding `dist/`, returns only:

- the package's own `src/policy.ts`, `src/cli.ts` and `src/tests/policy.test.ts`
- the root script `package.json:56` — `"real-site:policy": "pnpm --filter @fluxiq-web-extension/real-site-policy build && node packages/real-site-policy/dist/cli.js"`
- working-document prose

No package declares it as a dependency. Nothing imports
`assertRealSitePolicyAuthorized` (`src/policy.ts:85`). There is no code path
that takes an authorized `RealSiteProbePolicy` and configures a browser, a
guard, a rate limiter or an artifact retention policy from it.

The repository's own architecture document already says so, at
`docs/architecture/testing-facility.md:246`:

```
| Real-site allowlist and operational review checks | `packages/real-site-policy` | Web-specific safety policy; it does not browse or execute probes. |
```

So the plan's "Phase 8 real-site safeguards pass 7/7" is true as a statement
about a validator's unit tests, and false as a statement about containment.
Nothing today would stop a real-site probe, because nothing consumes the
policy. The claim is not wrong, but a reader planning to enable Phase 8 would
reasonably infer enforcement exists, and it does not. **If Phase 8 is ever
un-deferred, the enforcement layer has still to be written.**

### 3c. Does the network guard block non-allowlisted origins, and at which layer?

The guard that *does* exist is the **deterministic** guard for loopback runs,
`packages/test-runner/src/network-guard.ts`. It is a different mechanism from
the real-site policy and is not what Phase 8's 7/7 refers to.

**Enforcement point: Playwright request interception on the `BrowserContext`.**
Two handlers, both in `installDeterministicNetworkGuard`:

- `network-guard.ts:54` — `await context.route("**/*", async (route: Route) => {`
- `network-guard.ts:62` — `await context.routeWebSocket(/.*/u, async (route: WebSocketRoute) => {`

It does block, and fails closed at the wire. `network-guard.ts:56-60`:

```ts
if (await isAllowedRequest(request.url())) await route.continue();
else {
  violations.push({ kind: "request", destination: sanitizedDestination(request.url()), resourceType: request.resourceType() });
  await route.abort("blockedbyclient");
}
```

WebSockets are closed with code 1008 (`network-guard.ts:66`). The abort happens
whether or not the caller later calls `assertNoViolations()`
(`network-guard.ts:71`), so a caller that forgets to assert still gets the
block — it only loses the test failure.

The allowlist itself is exact-origin, not prefix or wildcard
(`network-guard.ts:111-112`), and origins with embedded credentials are
rejected at compile time (`network-guard.ts:119`).

This is **Playwright's route layer**, which Playwright implements over the CDP
`Fetch` domain. It is *in-browser*. It is not a proxy, not an OS firewall, and
not a process-level restriction.

### Ways around the guard

**(i) Four protocols bypass the origin check entirely.**
`network-guard.ts:4` and `network-guard.ts:110`:

```ts
const INTERNAL_PROTOCOLS = new Set(["chrome-extension:", "data:", "about:", "blob:"]);
...
if (INTERNAL_PROTOCOLS.has(url.protocol)) return true;
```

These are checked before any allowlist test. They do not reach the network, so
this is low risk, but `chrome-extension:` is a broad unconditional allow.

**(ii) Service-worker-originated requests are not intercepted — and the runner
never disables service workers.** Playwright 1.51.1's own type documentation,
at
`node_modules/.pnpm/playwright-core@1.51.1/node_modules/playwright-core/types/types.d.ts:3926-3927`:

```
* intercept requests intercepted by Service Worker. See [this](https://github.com/microsoft/playwright/issues/1090)
* issue. We recommend disabling Service Workers when using request interception by setting
```

The recommended mitigation is `serviceWorkers: 'block'`. The scenario runner
never sets it — `packages/test-runner/src/run-scenario/browser-session/launch-browser.ts:17`
passes `headless`, `env`, `locale`, `timezoneId`, `viewport`, `colorScheme`
and `args`, and no `serviceWorkers` option, so it defaults to `"allow"`. The
subject under test is an MV3 extension whose background **is** a service
worker, and the runner reaches for it explicitly elsewhere
(`interactive-session.ts:230`, `demo-workspace/browser-session.ts:275`,
`ui-e2e/topology.ts:352`).

Honest qualification: this is a documented Playwright limitation about
page-scoped Service Workers. Whether Chromium's CDP `Fetch` interception also
misses an *extension* background service worker's requests I could not confirm
— that would require running a browser, and this audit executed nothing.
Treat it as an untested exposure, not a proven hole.

**(iii) F-3 (material finding) — two lanes launch Chromium with no guard at
all.** `installDeterministicNetworkGuard` is called from exactly three places:

- `packages/test-runner/src/run-scenario/browser-session/install-run-network-guard.ts:19` (scenario runs)
- `packages/test-runner/src/interactive-session.ts:221`
- `packages/test-runner/src/saved-flow-replay/replay-browser.ts:44`

`packages/test-runner/src/demo-workspace/browser-session.ts` launches
persistent contexts at lines 51, 60 and 135 and contains **no reference to the
guard whatsoever** — a grep for `NetworkGuard`, `network-guard` and `route(`
in that file returns nothing. `packages/test-runner/src/ui-e2e/topology.ts`
launches at line 323 and its only `route(` call, line 346, is an API stub for
`**/api/programs/automation-studio/${endpoint}`, not a containment guard.

These are the `demo:*` and `demo:llm:*` lanes, which are the lanes the live
campaign actually drives. They run unguarded.

**(iv) Browser-only scope.** The guard constrains the browser context and
nothing else. The Node runner process, the Core process it starts, and the
gateway are all outside it. There is no process-level or proxy-level
enforcement anywhere in the facility.

**(v) Runtime allowlist widening — sound, noted for completeness.**
`network-guard.ts:51` adds an origin to the live allowlist:

```ts
allowed.pageOrigins.add(origin);
```

This is bounded: only loopback `127.0.0.1`/`localhost` http(s) origins are
eligible (`network-guard.ts:90-95`), and admission requires a proof hook that
is signed with the allocation's controller token
(`install-run-network-guard.ts:23`). A run with no proof hook treats an
unlisted loopback port as a violation, which the test at
`packages/test-runner/src/tests/network-guard.test.ts:84` covers. This one is
not a way around the guard.

---

## Q4 — `packages/boundary-audit`: does it still run, what does it assert, is `defer` re-derivable?

### Does it still run — yes

- Reachable from the root: `package.json:9` — `"boundary:audit": "pnpm --filter @fluxiq-web-extension/boundary-audit build && node packages/boundary-audit/dist/cli.js --repository ."`
- Also in `pnpm -r check` and `pnpm -r test` (`package.json:59`, `package.json:68`).
- `packages/boundary-audit/dist/` was rebuilt **2026-09-27 00:02**, seventeen days after its last source change, so it compiles today.
- 6 tests declared in `src/tests/audit.test.ts` at lines 8, 19, 25, 31, 37, 43 — matching the plan's 6/6. No skips.

### What it asserts

Two gates, defined at `src/audit.ts:19-22` and evaluated at `src/audit.ts:48-69`:

1. **`domainNeutralVocabulary`** — the candidate's sources must contain none of
   the forbidden terms. `src/audit.ts:2-4`:
   ```ts
   export const forbiddenVocabulary = [
     "browser", "dom", "url", "selector", "tab", "extension", "playwright", "web-automation",
   ] as const;
   ```
   Matching is token-based after camelCase splitting and lowercasing
   (`src/audit.ts:30-41`), so it is case-insensitive and reports file and line.

2. **`independentConsumers`** — at least `requiredConsumers` (default **2**,
   and rejected below 2 at `src/audit.ts:49-50`) **distinct repositories** must
   consume the candidate. The counting is at `src/audit.ts:52`:
   ```ts
   const consumerDomains = new Set(consumers.map(consumer => consumer.repository));
   ```

The recommendation is `promote-eligible` only when both pass, otherwise
`defer` (`src/audit.ts:67`).

### Is the `defer` verdict re-derivable today — YES, and doubly so

The CLI's defaults (`src/cli.ts:10-12`) make the candidate
`packages/test-contracts` / `@fluxiq-web-extension/test-contracts`, and scan
both this repository and `../!FluxIQ` (`src/cli.ts:17-18`).

**Consumer gate — still fails.** Four packages in this repository declare the
dependency:

- `packages/agent-orchestrator/package.json:22`
- `apps/scenario-lab/package.json:14`
- `packages/test-runner/package.json:18`
- `packages/test-evidence/package.json:19`

All four are tagged with the repository name `"fluxiq-web-extension"`
(`src/cli.ts:17`), so `consumerDomains.size` is **1** against a required 2.

**FluxIQ Core has zero consumers.** A ripgrep of `F:\!FluxIQ` for
`fluxiq-web-extension` returns 5 files, none of them an import or a manifest
dependency. The only package-shaped hit is a string literal in a test fixture,
`F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\runtime\flow-bootstrap\plan\tests\web-domain-definitions-fixture.ts:91`:

```ts
source: { kind: "importer", domainId: "web-automation", packageId: "@fluxiq-web-extension/domain", implementationKey: output.outputId },
```

That is a domain identifier carried as data, referring to
`@fluxiq-web-extension/domain` and not to `test-contracts`. The other four hits
are `scripts/structure-audit/config.mjs`, a test file name, and two working
documents. **No second consumer has appeared.**

**Vocabulary gate — also still fails.** Counting occurrences of the forbidden
terms in `packages/test-contracts/src/**/*.ts`: `browser` 5, `dom` 36, `url`
14, `selector` 29, `tab` 7, `extension` 24, `playwright` 1. The gate would
report findings and fail.

So `defer` is over-determined: both gates fail. The plan's Phase 7 row
("one domain consumer, zero Core consumers, and four browser/extension-specific
fields") remains directionally accurate; the consumer count in *packages* has
grown from 1 to 4, but the count that the gate uses — repositories — is
unchanged at 1.

### F-2 (material finding) — the promotion gate cannot be satisfied from inside this repository

Because the gate counts repositories and not packages
(`src/audit.ts:52`), and because this is deliberate — the package's own test at
`src/tests/audit.test.ts:37` is named *"two infrastructure packages in one
domain repository count as one consumer"* — growing from one consumer package
to four, or to forty, can never flip the verdict.

The only way to reach `found >= 2` is a consumer in FluxIQ Core or in a third
repository. But `AGENTS.md` forbids exactly that under the Automated Testing
Facility Boundary: *"`packages/test-contracts` is private and
repository-local"* and *"Core must never import this repository."*

The plan therefore records Phase 7 as "gated on a second consumer"
(line 123) when the gate, as configured, has no reachable satisfying state.
The gate is not broken — it is doing what it was written to do — but the
plan's framing implies a condition that could plausibly arrive on its own, and
it cannot. Either the candidate should change (a genuinely neutral subset
extracted from `test-contracts` rather than the whole package), or Phase 7
should be recorded as closed-by-design rather than deferred-pending-an-event.

---

## Q5 — Is `agent-orchestrator` reachable, and does its CLI entry exist? — CLAIM TRUE

**Reachable.** `package.json:8`:

```json
"agent:orchestrator": "pnpm --filter @fluxiq-web-extension/agent-orchestrator build && node packages/agent-orchestrator/dist/cli.js",
```

The script builds before running, so a stale or missing `dist` is regenerated
rather than being a failure mode. The package is inside the workspace
(`pnpm-workspace.yaml` globs `packages/*`), so `pnpm -r check`, `pnpm -r test`
and `pnpm -r build` (`package.json:59`, `68`, `10`) all include it.

**CLI entry exists.**

- Source: `packages/agent-orchestrator/src/cli.ts`, with a shebang at line 1
  (`#!/usr/bin/env node`) and a main guard at line 71
  (`if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) void main();`).
- Declared as a bin: `packages/agent-orchestrator/package.json` —
  `"bin": { "fluxiq-agent-orchestrator": "./dist/cli.js" }`.
- Built artifact present: `packages/agent-orchestrator/dist/cli.js`, 3,493
  bytes, executable bit set, timestamped **2026-09-27 00:02**.
- `tsconfig.json` sets `"outDir": "dist"`, `"rootDir": "src"` and
  `"include": ["src/**/*.ts"]`, so `cli.ts` is compiled.

**Caveat, not a defect.** Nothing in the codebase *imports*
`@fluxiq-web-extension/agent-orchestrator`. The only references are the root
script above, the package's own manifest, and working documents. It is a
human-operated CLI with no programmatic caller — which is exactly what
"dispatch remains human-triggered" (plan line 174) describes, so this is
consistent rather than contradictory. A prior report,
`docs/working/agent-git-workflow-plan/reports/orchestrator-gap.md:670,677`,
independently reached the same conclusion.

---

## Q6 — Has this area rotted since 2026-09-10? — NO

**Nothing has changed, and what is there still compiles.**

Last commit touching each owned path:

| Path | Last commit |
| --- | --- |
| `packages/agent-orchestrator` | 2026-09-10 `70e03aa3` Relocate every co-located test into a tests/ subfolder |
| `packages/boundary-audit` | 2026-09-10 `70e03aa3` (same) |
| `packages/real-site-policy` | 2026-09-10 `70e03aa3` (same) |
| `packages/test-runner/src/network-guard.ts` | 2026-09-11 `f8885b82` Wave 1: benchmark harness, scenario contract, and the recording-start fix |
| `packages/test-runner/src/trusted-input` | 2026-09-11 `f8885b82` (same) |
| `packages/test-runner/src/windows-acl.ts` | 2026-09-04 `5e9d97e7` |

`git log --since=2026-09-10` over the three packages shows exactly one commit,
`70e03aa3`, which only moved test files. The area is frozen, not decaying.

**Broken imports: none.** Every barrel resolves to files that exist:
`agent-orchestrator/src/index.ts:1-7` re-exports seven modules, all present;
`boundary-audit/src/index.ts` re-exports `audit.js` and `repository-scan.js`,
both present; `real-site-policy/src/index.ts` re-exports `policy.js`, present.
All three `dist/` directories were rebuilt **2026-09-27 00:02**, i.e. a
`pnpm -r build` compiled them sixteen days after the last source change.

**Dead CLI entries: none.** All three CLIs exist in source and in `dist`, and
all three root scripts (`package.json:8`, `:9`, `:56`) point at files that are
present.

**TODO / FIXME / HACK / XXX / `@ts-ignore` / `@ts-expect-error` /
`eslint-disable`: none.** A grep across `packages/agent-orchestrator/src`,
`packages/agent-orchestrator/tests`, `packages/boundary-audit/src`,
`packages/real-site-policy/src`, `packages/test-runner/src/network-guard.ts`,
`packages/test-runner/src/windows-acl.ts` and
`packages/test-runner/src/trusted-input` returns zero hits.

**Skipped, `.only` or `.todo` tests: none.** Same grep across all owned test
files returns zero hits. Test inventory for the owned paths, by inspection:

| File | Tests |
| --- | --- |
| `packages/agent-orchestrator/tests/orchestrator.test.mjs` | 10 |
| `packages/agent-orchestrator/tests/cli.test.mjs` | 6 |
| `packages/boundary-audit/src/tests/audit.test.ts` | 6 |
| `packages/real-site-policy/src/tests/policy.test.ts` | 7 |
| `packages/test-runner/src/tests/network-guard.test.ts` | 5 |
| `packages/test-runner/src/trusted-input/tests/select-option.test.ts` | 7 |
| `packages/test-runner/src/trusted-input/tests/upload-file.test.ts` | 3 |

`packages/test-runner/src/tests/windows-acl.test.ts` exists, so every owned
source file has a co-located test.

### Two minor observations, neither a regression

**One baselined structural debt.** `.structure-baseline.json:62`:

```json
"packages/agent-orchestrator/src/audit.ts": 1,
```

This entry sits inside the `failure-as-empty` rule block (lines 25-85 of the
baseline; the next rule, `imports`, begins at line 86). It corresponds to
`packages/agent-orchestrator/src/audit.ts:69-72`:

```ts
} catch (error) {
  if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
  throw error;
}
```

A missing audit log reads as an empty chain. The CLI compensates by raising an
`audit.empty` issue when the record count is zero
(`src/cli.ts:48`), so the swallowed failure does not silently pass a verify.
This is ratcheted, acknowledged debt, not new rot.

**Test placement inconsistency.** `agent-orchestrator`'s tests live at the
package root, `packages/agent-orchestrator/tests/*.test.mjs`, and import the
built artifact (`tests/cli.test.mjs:8` — `import { AppendOnlyAuditLog, createTaskPacket } from "../dist/index.js";`).
The other two packages were moved to `src/tests/` by `70e03aa3`. `AGENTS.md`
states tests live in a `tests/` subfolder of the directory that owns their
subject, which for `src/audit.ts` would be `src/tests/`. The deviation looks
deliberate — these are `.mjs` tests of the compiled output, which cannot live
under `rootDir: src` without being compiled themselves — but it is worth
recording as a known, unflagged exception.

---

## Not verified

- **Nothing was executed.** No `pnpm check`, no `pnpm test`, no `pnpm build`,
  no CLI invocation, no browser. Every "16/16", "7/7", "6/6" above is a count
  of declared tests, not an observed pass. The plan's *pass* claims are
  therefore unconfirmed by this audit; only the *counts* are confirmed.
- **Whether Chromium's CDP `Fetch` interception covers an MV3 extension's
  background service worker.** Playwright's documented limitation concerns
  Service Workers generally; confirming the extension-background case needs a
  live run. Stated above as an untested exposure.
- **Whether `pnpm -r check` passes today.** The `dist` timestamps of
  2026-09-27 are evidence a build succeeded then, not that one succeeds now.
- **`F:\!FluxIQ` consumer search** used ripgrep with default ignore rules, so
  a consumer inside a gitignored directory in Core would not appear. Given
  Core cannot depend on a private repo-local package, this is a small risk.

## Open questions for the supervisor

1. **F-1.** Should Phase 8 be re-recorded to say that the safeguard is a
   document validator with no enforcement layer? As written, "safeguards pass
   7/7" reads as containment that does not exist.
2. **F-2.** Phase 7's gate ("a second consumer") is unsatisfiable while the
   candidate is the whole of `test-contracts` and the counting unit is a
   repository. Close it by design, or change the candidate?
3. **F-3.** The `demo:*` and `demo:llm:*` lanes — the ones the live campaign
   drives — launch Chromium with no deterministic network guard. Is that
   intentional, or a gap worth a follow-up task? Setting
   `serviceWorkers: 'block'` at `launch-browser.ts:17` would additionally close
   the documented Playwright interception gap for the guarded lanes, if
   blocking service workers is compatible with an MV3 extension under test —
   which it may well not be, since the extension's background *is* one.
