# Audit — Phases 9, 10, 12 (`existing`, `clone`, `persistent-isolated` topologies)

Auditor: worker (read-only; no source file changed). Date: 2026-09-28.
Subject: `docs/working/automated-testing-facility-plan.md` — `Current State`
(lines 1-140) and Execution Log rows for Phases 9, 10 and 12 — checked against
the code as it stands today.

Verdict vocabulary: **claim true**, **claim false**, **could not verify**.

Status: COMPLETE.

Validation actually run:

- `pnpm --filter @fluxiq-web-extension/test-runner check` → passed, `tsc
  --noEmit` emitted nothing. No broken imports anywhere in the package.
- `pnpm --filter @fluxiq-web-extension/test-runner test` → `# tests 1470 /
  # pass 1470 / # fail 0 / # skipped 0 / # todo 0`, duration 57.1 s, exit 0.

---

## 1. Do all four targets exist, and where are they selected and validated?

**Claim true.** All four are first-class, selectable and validated in two
places — CLI argument parsing and environment resolution — and dispatched in a
third.

- Type union of all four:
  `packages/test-runner/src/target-config.ts:4`
  `export type FluxIQTargetMode = "isolated" | "persistent-isolated" | "existing" | "clone";`
- Per-mode configuration shapes: `target-config.ts:13` (isolated), `:18`
  (persistent-isolated), `:23` (existing), `:40` (clone).
- **CLI validation** — `packages/test-runner/src/commands.ts:278`:
  `if (target !== undefined && target !== "isolated" && target !== "persistent-isolated" && target !== "existing" && target !== "clone") throw new Error("--target must be isolated, persistent-isolated, existing, or clone");`
  with cross-option rules at `commands.ts:286-288` (`--workspace` requires and
  is required by `persistent-isolated`; `persistent-isolated` forbids `--flow`
  and `--fresh-login`).
- **Environment validation and conflict checks** —
  `target-config.ts:66` rejects an unknown `FLUXIQ_TEST_TARGET`;
  `target-config.ts:67` rejects `--target` conflicting with the env var;
  `target-config.ts:73` rejects existing-install keys on an isolated target;
  `target-config.ts:87` rejects `--workspace` on a non-persistent target;
  `target-config.ts:105` requires `FLUXIQ_TEST_PIN` for `existing`.
- **Dispatch** — `packages/test-runner/src/coordinator.ts:77` branches
  `persistent-isolated` to `allocatePersistentRun`, `coordinator.ts:84` routes
  `existing` to `startExistingTopology`; `packages/test-runner/src/run-scenario.ts:331`
  and `:350` are the `existing` and `clone` execution branches.

Also selectable interactively, with a deliberate relaxation for local sessions:
`target-config.ts:117` `resolveInteractiveTargetConfiguration`.

---

## 2. Phase 9 claims, one by one

| # | Claim | Verdict |
|---|---|---|
| a | `.env`/`.env.local` loading | claim true |
| b | Origin/user-scoped cookie cache under `test-runs/.auth` | claim true |
| c | `lab auth status\|clear` | claim true |
| d | `--fresh-login` | claim true |
| e | API-only control client | claim true |
| f | 30-second bounded requests | claim true (with drift, below) |
| g | Single-attempt cancellation | claim true, **but the result is discarded** |
| h | Strict final-state predicates | claim true |
| i | `BrowserContext` network containment | claim true |
| j | Windows ACL hardening | claim true |

### (a) `.env` / `.env.local` loading — claim true

`packages/test-runner/src/environment.ts` is the loader and is imported by the
CLI. Not re-quoted here; it was not in dispute and nothing contradicts it.

### (b) Origin/user-scoped cookie cache under `test-runs/.auth` — claim true

Scope is exactly origin + username, hashed:
`packages/test-runner/src/auth-session.ts:41-44`

```ts
pathFor(scope: AuthSessionScope): string {
  const normalized = normalizeScope(scope);
  const digest = createHash("sha256").update(normalized.origin).update("\0").update(normalized.username).digest("hex");
  return path.join(this.directory, `${digest}.json`);
}
```

Directory is `<runs>/.auth` — `auth-session.ts:32`:
`this.directory = path.join(path.resolve(runsDirectory), ".auth");`
and the runs directory defaults to `<repo>/test-runs` at
`packages/test-runner/src/coordinator.ts:74`.

A record whose stored origin/username does not match the requested scope is
refused rather than used — `auth-session.ts:101`:
`if (session.origin !== scope.origin || session.username !== scope.username) return { status: { state: "wrong-scope", ... } };`

Observed on disk: `test-runs/.auth/` holds exactly one entry
(`e93caffd…0db.json`, created 2026-09-17, expired 2026-09-17T12:28Z). Its
`origin` is a loopback `http://` origin, i.e. a local isolated Core, not an
external installation. `test-runs/.clone-cache` does not exist.

### (c) `lab auth status|clear` — claim true

Parsed at `packages/test-runner/src/commands.ts:74`:
`if (args.length !== 1 || (args[0] !== "status" && args[0] !== "clear")) throw new Error("Usage: lab auth status | auth clear");`
Executed at `packages/test-runner/src/cli.ts:34-36`, over the same
`WebPanelAuthSessionCache(runsDirectory)`. Implementation:
`packages/test-runner/src/auth-cli.ts:13` `executeAuthCommand`.
Gated to the right targets at `target-config.ts:150`:
`if (mode !== "existing" && mode !== "clone") throw new Error("auth status and clear require FLUXIQ_TEST_TARGET=existing or clone");`

### (d) `--fresh-login` — claim true

Parsed at `commands.ts:283-284` (and rejected more than once), forbidden on
`persistent-isolated` at `commands.ts:287`, carried into the target at
`target-config.ts:102`/`:112`, and actually honoured at
`packages/test-runner/src/run-scenario/persisted-flow-target/open-existing-fluxiq-control.ts:26`:

```ts
}, { sessionCache: new WebPanelAuthSessionCache(runsDirectory), ...(target.freshLogin ? { freshLogin: true } : {}) });
```

which bypasses the cache at `packages/test-runner/src/http-control/index.ts:53`:
`if (options.sessionCache && !options.freshLogin) { ... }`.

### (e) API-only control client — claim true

`ExistingFluxIQControlClient` is declared at
`packages/test-runner/src/existing-fluxiq-control.ts:135`
(`export class ExistingFluxIQControlClient extends FluxIQControlClient`). Its
imports (`existing-fluxiq-control.ts:1-11`) are `node:crypto`, two contract
packages, `./failure.js`, `./flow-lane`, `./http-control`, `./provider-failure`
— no `@playwright/test`, no `Page`, no `BrowserContext`. The base class talks
only over `fetch` (`http-control/index.ts:165-175`). It takes no page and no
filesystem path.

### (f) 30-second bounded requests — claim true, with drift worth recording

The default is exactly 30 s — `packages/test-runner/src/http-control/index.ts:270-274`:

```ts
function boundedTimeout(value: number | undefined): number {
  const resolved = value ?? 30_000;
  if (!Number.isSafeInteger(resolved) || resolved < 1 || resolved > FLUXIQ_HTTP_MAX_TIMEOUT_MS) throw new Error(...);
  return resolved;
}
```

and every request goes through `boundedFetch` (`http-control/index.ts:197`),
which installs an `AbortController` plus a `setTimeout` abort.

Both callers of the existing/clone executor pass **no** bounds
(`run-scenario.ts:338` and `run-scenario.ts:356` call
`executeExistingPersistedFlow(...)` with five arguments, omitting the sixth
`bounds`), so 30 s is what these two lanes really use.

**Drift:** the ceiling is now five minutes, not thirty seconds —
`http-control/index.ts:35` `export const FLUXIQ_HTTP_MAX_TIMEOUT_MS = 300_000;`
Other lanes (the LLM flow lane) do pass longer timeouts. The plan's flat "30-
second bounded requests" is true of Phase 9's own path but no longer describes
the module as a whole. A second undocumented behaviour sits at
`http-control/index.ts:176-179`: a 401/403 triggers one silent re-login and one
retry of the same request, so a request can occupy up to two bounded windows.

### (g) Single-attempt cancellation — claim true, but the verdict is thrown away

Single attempt, confirmed — `packages/test-runner/src/existing-flow-run.ts:139-146`:

```ts
async function attemptCancellation(control, projectId, runId, timeoutMs = 5_000) {
  try {
    const cancelled = await control.cancelRun(projectId, runId, "Test facility timeout or interruption", { timeoutMs });
    return cancelled?.status === "cancelled" ? "confirmed" : "unconfirmed";
  } catch (error) {
    if (error instanceof RunnerFailure && error.details?.status === 404) return "unsupported";
    return "failed";
  }
}
```

One call, no retry loop, own 5 s bound. The report is attached to the thrown
error through a `WeakMap` at `existing-flow-run.ts:42` and `:117`.

**However — nothing reads it.** `existingFlowCancellationReport`
(`existing-flow-run.ts:45`) has exactly one importer in the whole repository,
and it is its own test file (`packages/test-runner/src/tests/existing-flow-run.test.ts:4`).
Grep for `cancellation` across `run-manifest/` and `run-scenario/` returns
nothing. So the `confirmed | unconfirmed | unsupported | failed | not-attempted`
verdict is computed on every timeout and then discarded: it never reaches a
manifest, an evidence event, or an operator. The Execution Log row for Phase 9
lists "bounded cancellation" alongside "evidence provenance" as integrated;
the bounding is integrated, the **reporting of it is not**. See §6.

### (h) Strict final-state predicates — claim true

Four independent `!== "succeeded"` gates, each failing closed:

- `existing-flow-run.ts:89` — `if (result.session.runId !== runId || result.session.status !== "succeeded") throw new RunnerFailure("runtime.behavior", ...)`
- `existing-flow-run.ts:95` — `if (detail.summary.flowId !== target.flowId || detail.summary.status !== "succeeded") throw ...`
- `existing-flow-run.ts:97-98` — `const failed = actions.find(action => action.status !== "succeeded"); if (failed) throw new RunnerFailure("action.dispatch", ...)`
- The return type itself is narrowed: `existing-flow-run.ts:30` `status: "succeeded";`

Plus a panel-level final-state gate in the run path —
`run-scenario.ts:347` and `:363`:
`if (panelVerification.status !== "verified") throw new RunnerFailure("runtime.behavior", "FluxIQ panel could not verify the exact persisted Flow run");`

### (i) `BrowserContext` network containment — claim true

`packages/test-runner/src/network-guard.ts:36-38` takes a `BrowserContext` and
routes at context scope, not page scope:

```ts
export async function installDeterministicNetworkGuard(
  context: BrowserContext,
  policy: DeterministicNetworkPolicy,
): Promise<DeterministicNetworkGuard> {
```

`network-guard.ts:53` `await context.route("**/*", ...)`; an unallowed
destination is recorded and aborted `blockedbyclient` (`network-guard.ts:57-58`).
WebSocket routing is covered too (`network-guard.ts:20` `kind: "request" | "websocket"`).
The run wires it to exactly three origin families at
`packages/test-runner/src/run-scenario/browser-session/install-run-network-guard.ts:18-25`.

### (j) Windows ACL hardening — claim true

`packages/test-runner/src/windows-acl.ts:14` `hardenWindowsPrivatePath` strips
inheritance, grants only the current SID, then **verifies**:

```ts
await execute(icacls, [resolvedTarget, "/inheritance:r", "/grant:r", grant]);
await execute(icacls, [resolvedTarget, "/verify"]);
const listing = await execute(icacls, [resolvedTarget]);
verifyExclusiveAcl(listing.stdout, resolvedTarget, identity);
```

and fails closed at `windows-acl.ts:44-46`
(`throw new Error("Windows auth-cache ACL verification did not prove exclusive current-user access")`).
Called on the auth cache (`auth-session.ts:146-151`, the `secureMode` helper,
used for both the `.auth` directory at 0o700 and each session file at 0o600) and
on the persistent identity store (`persistent-identity.ts:118-124`).

> Note: this is Windows-path code that was exercised in the unit suite (1470
> passing tests include `windows-acl` coverage), but I did not observe a real
> `icacls` invocation in this audit. The *wiring* is verified; the *runtime ACL
> outcome on this machine* is **could not verify**.

---

## 3. Have the `existing` and `clone` lanes been live-certified since 2026-09-10?

**No. The situation is unchanged — claim still accurate, and now with positive
evidence of absence.**

Scanned every run manifest under `test-runs/` (342 `run.json` files) for
`fluxiqExecution.targetMode` — the provenance field Phase 9 Step 10 added:

| targetMode | manifests |
|---|---|
| `isolated` | 330 |
| `persistent-isolated` | 3 |
| absent (older schema) | 9 |
| **`existing`** | **0** |
| **`clone`** | **0** |

`test-runs/persistent-isolated/` holds five workspaces (`dropped-action-probe`,
`interactive-smoke`, `interactive-smoke-2`, `llm-dev`, `mvp-lamp`). There is no
`test-runs/.clone-cache` directory at all — the facility-wide clone cache has
never been populated. The single `test-runs/.auth` entry is a loopback origin.

Git history on the owned files since 2026-09-10 shows only incidental drive-by
changes from other efforts, none of them a certification:

| file | last commit |
|---|---|
| `existing-fluxiq-control.ts` | `6992b457` 2026-09-25 "A failed provider call leaves a local record beside the run" |
| `existing-flow-run.ts` | `84e44cef` 2026-09-22 "Give the ladder something to absorb…" |
| `isolated-flow-importer.ts` | `4d5c8a60` 2026-09-14 "fix: stabilize scripted scroll recording" |
| `auth-cli.ts`, `auth-session.ts`, `clone-cache.ts`, `clone-policy.ts`, `panel-verification.ts` | `5e9d97e7` 2026-09-04 (untouched since) |
| `clone-source-exporter.ts`, `persistent-identity.ts`, `workspace-lock.ts` | `dd963f79` 2026-09-05 (untouched since) |
| `process-supervisor.ts` | `488bb66f` 2026-09-07 |

Caveat: `test-runs/` is disposable and git-ignored, so absence there is strong
but not absolute proof that no such run was ever attempted. Combined with the
empty clone cache and the untouched clone modules, the plan's "Not done" entry
stands.

---

## 4. Core today — `/api/auth/session` and registered runtime cancellation

Both of the plan's Phase 9 Step 5 statements are **still true**. Neither has
been fixed elsewhere.

### `/api/auth/session` — still absent. Claim true.

`F:\!FluxIQ\apps\web\src\app\api\auth\` contains exactly two routes:

```
apps/web/src/app/api/auth/login/route.ts
apps/web/src/app/api/auth/logout/route.ts
```

No `session/` directory. A repository-wide search for `auth/session` in Core
returns one hit, and it is prose in a planning document
(`F:\!FluxIQ\docs\working\automation-studio-data-flow-refactor-plan.md:39`),
not a route.

The runner's fallback still works as designed —
`packages/test-runner/src/existing-fluxiq-control.ts:169-173`:

```ts
async validateCurrentSession(expectedUsername: string): Promise<{ identityEndpointAvailable: boolean; username?: string }> {
  const response = await this.authenticatedResponse("/api/auth/session", undefined, "GET");
  if (response.status === 404) {
    await this.listProjects();
    return { identityEndpointAvailable: false };
  }
```

so, exactly as the plan says, the adapter proves only *authenticated project
access* and cannot assert *which account* it is authenticated as. That matters:
`existing-flow-run.ts:20-25` surfaces `sessionIdentityVerified`, and against
today's Core that flag is always false, so the username check at
`existing-fluxiq-control.ts:180` is unreachable in practice.

### Runtime cancellation — declared, implemented in the service, still not registered. Claim true.

- **Declared** as an endpoint constant:
  `F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\api\contracts\endpoints.ts:146`
  `cancelRuntimeSession: "cancel-runtime-session",`
- **Implemented** as a service method:
  `F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\runtime\service.ts:2865`
  `async cancelRuntimeSession(projectId: string, runId: string, reason = "Cancelled by user."): Promise<AutomationStudioRuntimeSession | null> {`
- **Not registered as a handler.** `grep -rn "cancel" packages/fluxiq/src/programs/automation-studio/api/handlers/*.ts`
  returns nothing. Compare the sibling endpoints, which *are* registered —
  `api/handlers/runtime-execution.ts:13` (`startRuntimeSession`) and
  `runtime-execution.ts:23` (`runRuntimeSession`). `cancelRuntimeSession`
  appears in exactly three places in Core: the constant, the service method, and
  two service-level tests. Nothing bridges HTTP to it.

Consequence: the POST to `cancel-runtime-session` still 404s, and
`existing-flow-run.ts:144` maps that 404 to `"unsupported"`. Core's own web UI
calls it (`apps/web/src/features/automation-studio/runtime/run-commands.ts:21`)
and would hit the same 404, which is worth flagging to whoever owns Core.

---

## 5. Phase 12 — does the lock actually prevent concurrency, and what happens on a stale lock?

**Claim true for the lock; claim true for the identity store.** The exclusion is
real, and stale handling is deliberately conservative.

### It is a real mutex

Exclusive creation, not a read-then-write race —
`packages/test-runner/src/workspace-lock.ts:57`:

```ts
const handle = await open(lockPath, "wx", 0o600);
```

`wx` fails with `EEXIST` if the file exists, so two concurrent runs cannot both
succeed. A second live run is refused outright —
`workspace-lock.ts:78-80`:

```ts
const existing = await readOwner(lockPath);
if (await isProcessAlive(existing.pid)) {
  throw new Error(`Persistent workspace is already locked by live process ${existing.pid}`);
}
```

It is wired into the real path: `coordinator.ts:88-90`

```ts
if (target.mode === "persistent-isolated") {
  workspaceLock = await acquireWorkspaceOperationLock(persistentWorkspaceRoot!);
}
```

(also used for the shared Core web build at `core-web-build/prepare.ts:182` and
the demo workspace at `demo-workspace/workspace-state.ts:68`).

### On a crash: the lock is reclaimed, but only on proof

A crashed owner leaves the file behind. Liveness is probed with signal 0 —
`workspace-lock.ts:166-173`:

```ts
function nativeProcessIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return !hasCode(error, "ESRCH");
  }
}
```

Note the fail-closed default: only `ESRCH` ("no such process") counts as dead.
`EPERM` — a live process owned by another user — reads as *alive*, which is the
safe direction.

Reclamation is a rename-verify-delete, so a racing reclaimer cannot delete a
lock that changed under it — `workspace-lock.ts:105-118`:

```ts
const quarantinePath = `${lockPath}.stale-${randomBytes(12).toString("hex")}`;
try { await rename(lockPath, quarantinePath); } catch (error) { if (hasCode(error, "ENOENT")) return; throw error; }
try {
  const quarantined = await readOwner(quarantinePath);
  if (!sameOwner(quarantined, expected)) {
    await restoreChangedLock(quarantinePath, lockPath);
    throw new Error("Persistent workspace lock changed while stale ownership was being verified");
  }
  await rm(quarantinePath);
```

A malformed or oversized lock is **never** reclaimed — `workspace-lock.ts:134-136`:

```ts
if (!details.isFile() || details.size <= 0 || details.size > MAX_LOCK_BYTES) {
  throw new Error("Persistent workspace lock is malformed; refusing stale-lock reclamation");
}
```

Release is ownership-checked, so a process cannot release a lock it no longer
owns — `workspace-lock.ts:100-103`.

**Residual risk, honestly stated:** reclamation keys on PID alone
(`sameOwner` compares `pid`, `ownerToken`, `acquiredAt` of the *same* record, not
of a new process). If the OS recycles a crashed owner's PID onto an unrelated
live process, `isProcessAlive` returns true and the workspace stays locked until
the file is removed by hand — a deadlock, not a corruption. The plan's "No
automatic reset/delete command exists for a persistent workspace; removal
remains an explicit manual operation" (Current State line 106) is therefore also
the only recovery from this case.

### Strict identity store — claim true

`packages/test-runner/src/persistent-identity.ts:36` refuses any path escape
(`if (path.dirname(directory) !== root || path.dirname(target) !== directory) throw new Error("Persistent identity path escaped its workspace");`),
rejects symlinks and oversized files (`:67-69`), enforces exact key sets
(`:86-91`, `hasExactKeys`), and validates each field — password ≥ 12 chars, PIN
4-12 digits only (`:96-99`). It deliberately returns no loggable status object
(comment at `:26-28`). Writes are atomic temp-then-rename with 0o600 + ACL
hardening (`:50-58`).

---

## 6. Has this area rotted since 2026-09-10?

Mostly **no** — and better than the plan's own caveats would suggest. Four real
findings, one of them substantive.

### Clean

- **Broken imports: none.** `tsc -p tsconfig.json --noEmit` for the package
  emitted nothing.
- **TODO / FIXME / XXX / HACK / `@ts-ignore` / `@ts-expect-error`: zero** across
  every owned file and directory (`auth-cli.ts`, `auth-session.ts`,
  `existing-fluxiq-control.ts` and its directory, `existing-flow-run.ts`,
  `clone-cache.ts`, `clone-policy.ts`, `clone-source-exporter.ts`,
  `isolated-flow-importer.ts`, `persistent-identity.ts`, `workspace-lock.ts`,
  `panel-verification.ts`, `process-supervisor.ts`, `http-control/`,
  `sqlite-store-reader/`, `saved-flow-replay/`, `lab-control/`).
- **Skipped tests: zero.** `# skipped 0 / # todo 0` over 1470 tests. The only
  `skip` in the package is a conditional environment guard unrelated to these
  phases (`tests/secret-leak-attestation.test.ts:252`, `t.skip("symlink creation is unavailable")`).
- **Dead exports: one** (see Finding 1 for the scan and its triage).
- **Dead modules: none.** Every owned module has at least one non-test importer
  in the production path (`panel-verification` ← `run-scenario.ts`;
  `clone-cache`/`clone-policy`/`clone-source-exporter` ← `run-scenario/clone-target/`;
  `isolated-flow-importer` ← `run-scenario.ts`; `sqlite-store-reader` ←
  `secret-leak-attestation.ts`; `saved-flow-replay` and `lab-control` ← `cli.ts`
  / `run-scenario.ts`).

### Finding 1 (substantive) — a dead export that silently drops Phase 9's cancellation evidence

`packages/test-runner/src/existing-flow-run.ts:45`

```ts
export function existingFlowCancellationReport(error: unknown): ExistingFlowCancellationReport | undefined {
  return typeof error === "object" && error !== null ? cancellationReports.get(error) : undefined;
}
```

Its only importer in the repository is its own test
(`packages/test-runner/src/tests/existing-flow-run.test.ts:4`). No production
caller exists, and `cancellation` appears nowhere under `run-manifest/` or
`run-scenario/`. The cancellation outcome is therefore computed on every bounded
failure and then dropped on the floor.

This is not cosmetic. It means the one signal that would tell an operator
"Core refused cancellation with a 404, so the run may still be executing
server-side" is unreachable — and, given §4, `"unsupported"` is the outcome
*every* real `existing`-lane timeout would produce today. Recommend either
threading the report into the run manifest, or recording the decision not to.

**Scan method and full result.** I enumerated all 85 `export` declarations
across the twelve owned top-level files and searched 2148 source files
(`apps/`, `domain/`, `packages/`, excluding `node_modules/`, `dist/`,
`build/`, `.test-build/`, `.script-build/` — the compiled `.d.ts` files in
`dist/` otherwise mask every dead export). 28 exports have no consumer outside
their own file. Triaging those:

- **Genuinely dead runtime code: one.** `existingFlowCancellationReport` —
  not called inside its own file either (`cancellationReports.set` at
  `existing-flow-run.ts:117` is the only other touch of the WeakMap), so it is
  reachable solely from its test.
- **Over-exported but internally used: four.** `buildClonePackage`
  (`clone-source-exporter.ts:131`, used at `:107`),
  `buildFluxIQPanelVerificationUrl` and `automationStudioFlowTreeItemId`
  (`panel-verification.ts:58`, `:76`), `FluxIQPanelVerificationError`
  (`panel-verification.ts:35`). These work; the `export` keyword is simply
  wider than it needs to be. Low priority.
- **Exported types with no external namer: twenty-three.** e.g.
  `PersistedFlowSelection`, `ExistingRuntimeSession`, `CloneSourceExport`,
  `PersistentIsolatedCredentials`, `VerifyFluxIQPanelInput`. Most are parameter
  or return types that callers satisfy structurally with object literals and so
  never name — normal TypeScript, not rot. Not worth acting on.

So the dead-export answer is: **one real finding, not a rotting module.**

### Finding 2 — three raw control bytes make a source file unreadable to tooling

`packages/test-runner/src/existing-fluxiq-control.ts:659` contains literal
`0x00`, `0x1f` and `0x7f` bytes inside a regex character class (byte offsets
54732-54735), where the two-character escapes `\x00`, `\x1f`, `\x7f` were
plainly intended:

```ts
return parsed.replace(/[<NUL>-<US><DEL>]/gu, " ");   // rendered; the file holds the raw bytes
```

Consequences: `file` reports the source as `data`; `grep` declares it "Binary
file … matches" and suppresses all output, so plain `grep` over the package
silently skips the largest file in it (65 KB) unless `-a` is passed. It also
makes the file a poor diff/merge citizen. The behaviour is *correct* at runtime
— a character class of literal control chars matches the same set — so this is
a hygiene defect, not a bug. Introduced before 2026-09-10; last touched by
`6992b457` (2026-09-25).

### Finding 3 — documentation drift on the 30-second bound

Current State line 45 says "30-second bounded requests". True for Phase 9's own
path, but `http-control/index.ts:35` now permits up to `300_000` ms and the LLM
flow lane uses longer bounds. Additionally `http-control/index.ts:176-179`
re-authenticates and retries once on 401/403, so a single logical request can
span two bounded windows. Worth a one-line correction rather than a code change.

### Finding 4 — an always-false flag against today's Core

`sessionIdentityVerified` (`existing-flow-run.ts:24`, fed from
`existing-fluxiq-control.ts:169`) can only ever be `false` while
`/api/auth/session` is absent (§4). The username-mismatch guard at
`existing-fluxiq-control.ts:180` is consequently dead code against today's
Core — correct and intentional per the plan, but it means the `existing` lane
does **not** in fact verify that it authenticated as the configured user. The
plan states this; the code confirms it; it is listed here so a reader does not
assume the guard is active.

---

## Summary against the plan's own text

| Plan statement | Verdict |
|---|---|
| Four targets exist and are validated | claim true |
| Phase 9 items (a)-(e), (h)-(j) | claim true |
| "30-second bounded requests" | claim true for these lanes; module ceiling has drifted to 300 s |
| "single-attempt cancellation" | mechanism claim true; its report is a dead export, never surfaced |
| `existing` / `clone` never live-certified | claim true — 0 of 342 manifests, no clone cache |
| `/api/auth/session` absent in Core | claim true, unchanged |
| Cancellation declared but not registered in Core | claim true, unchanged (service method exists; no handler) |
| Phase 12 exclusive lock | claim true (O_EXCL; live-PID refusal; fail-closed stale handling) |
| Phase 12 strict identity store | claim true |
| Area has rotted | largely claim false — clean typecheck, 1470/1470 tests, no TODOs, no skips; four findings above |

### Could not verify

- Real `icacls` ACL outcome on this machine (wiring verified; no live Windows
  ACL invocation observed).
- Whether an `existing` or `clone` run was ever *attempted* and its run
  directory later deleted — `test-runs/` is disposable and git-ignored.
- `.env` / `.env.local` loading was accepted on the strength of
  `environment.ts` existing and being wired; I did not exercise it.
