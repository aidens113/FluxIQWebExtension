# `packages/agent-orchestrator` — what exists, what is missing for a branch-and-worktree workflow

Scope: read-only survey of `packages/agent-orchestrator` (README, all nine
`src/*.ts`, both `tests/*.test.mjs`, `package.json`), plus the two
`test-contracts` types its review gate consumes and a repository-wide search
for callers. No file was modified.

**One-line answer.** The package is a *pure policy and validation library*. It
decides whether a bounded agent task is well-formed, whether a candidate's
edits stayed in scope, and whether a result may be shown to a human. For the
branch-and-worktree workflow it contributes exactly one thing: a validated
three-command argv plan (`git worktree add` / `git status` / `git worktree
remove`). Everything that actually *runs* — git, installs, commits, diffing,
merging, cleanup, agent dispatch — is absent by design. It is also currently
dormant: nothing in the repository imports it.

---

## 1. What a "task packet" is

### Exact type

`packages/agent-orchestrator/src/types.ts:36-56`:

```ts
export type AgentTaskPacket = {
  schemaVersion: typeof AGENT_TASK_SCHEMA_VERSION;
  taskId: string;
  createdAt: string;
  humanTrigger: { requestedBy: string; approvalReference: string };
  role: AgentRole;
  objective: string;
  scope: {
    repository: RepositoryName;
    repositoryRoot: string;
    allowedRoots: string[];
  };
  scenario: { id: string; seed: number; command: CommandSpec };
  baseline: { runId: string; artifactIndexSha256: string };
  failingInvariantIds: string[];
  protectedInvariants: ProtectedInvariant[];
  budgets: TaskBudgets;
  prohibitedActions: ProhibitedAction[];
  requiredChecks: CommandSpec[];
  responseContract: { schemaVersion: "0.1"; format: "json" };
};
```

Supporting types (`types.ts:3-34`, `types.ts:58-72`):

```ts
export const AGENT_TASK_SCHEMA_VERSION = "0.1" as const;

export type AgentRole =
  | "coordinator" | "scenario" | "diagnosis"
  | "core-repair" | "extension-repair" | "reviewer";

export type RepositoryName = "facility" | "core";

export type CommandSpec = { executable: string; args: string[]; cwd: string };

export type TaskBudgets = {
  maxTurns: number;
  maxRuns: number;
  maxDurationMs: number;
  maxChangedFiles: number;
  maxChangedBytes: number;
  maxTokens?: number;
};

export type ProtectedInvariant = { id: string; definitionSha256: string; required: boolean };

export type ProhibitedAction =
  | "merge" | "publish" | "deploy" | "live-site-write"
  | "disable-test" | "weaken-expectation" | "edit-outside-scope";

export type CandidateEdit = {
  repository: RepositoryName;
  path: string;
  operation: "add" | "modify" | "delete";
  changedBytes: number;
};
```

### Required vs optional

**Every field of `AgentTaskPacket` is required.** The only optional member
anywhere in the packet is `TaskBudgets.maxTokens?` (`types.ts:27`). There is no
optionality on `scenario` or `baseline` — see the gap note in §6.

The *constructor* input relaxes five of them (`src/task.ts:9-13`):

```ts
export type CreateTaskInput = Omit<AgentTaskPacket,
  "schemaVersion" | "taskId" | "createdAt" | "prohibitedActions" | "responseContract"> & {
  taskId?: string;
  createdAt?: string;
  additionalProhibitedActions?: ProhibitedAction[];
};
```

`createTaskPacket` (`task.ts:15-34`) fills the five: `schemaVersion: "0.1"`,
`taskId ?? "task-" + randomUUID()`, `createdAt ?? new Date().toISOString()`,
`responseContract: { schemaVersion: "0.1", format: "json" }`, and
`prohibitedActions` as the de-duplicated union of the role's mandatory set and
any `additionalProhibitedActions` (`task.ts:30`). `failingInvariantIds`,
`protectedInvariants` and `requiredChecks` are shallow-copied.

### Validation enforced — `validateTaskPacket` (`task.ts:56-76`)

Returns `PolicyResult = { accepted: boolean; issues: PolicyIssue[] }`
(`types.ts:111-112`); `accepted` is simply `issues.length === 0`. It never
throws and never reads the filesystem.

| Issue code | Rule | Line |
| --- | --- | --- |
| `schema.version` | `schemaVersion === "0.1"` | 58 |
| `task.id` | `taskId` matches `/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/` (`SAFE_ID`, line 7) | 59 |
| `task.objective` | non-blank after `trim()` | 60 |
| `task.human-trigger` | **both** `requestedBy` and `approvalReference` non-blank | 61 |
| `scenario.seed` | safe integer, `0 <= seed <= 0xffff_ffff` | 62 |
| `baseline.hash` | `artifactIndexSha256` matches `/^[a-f0-9]{64}$/` (`SHA256`, line 6) | 63 |
| `scope.empty` | a writable role must declare at least one `allowedRoot` | 64 |
| `role.repository` | a role pinned to a repository must match `scope.repository` | 65-66 |
| `scope.root` | every `allowedRoot` is at-or-within `repositoryRoot` (lexical) | 67 |
| `prohibition.missing` | every mandatory prohibition for the role is present | 68 |
| `command.executable` / `command.cwd` / `command.argument` | scenario command and each required check: executable non-blank and free of `\0`, `\r`, `\n`; `cwd` non-blank; no argument contains `\0`, `\r`, `\n` | 36-40, 69-70 |
| `budget.invalid` | **every** entry of `budgets` is a positive safe integer (so `0` is rejected, and `maxTokens` is checked when present) | 42-44, 71 |
| `invariant.id` / `invariant.duplicate` / `invariant.hash` | invariant ids match `SAFE_ID`, are unique, and each `definitionSha256` is 64 lowercase hex | 46-54, 72 |
| `invariant.unknown-failure` | every `failingInvariantIds` entry is also a `protectedInvariants` id | 73-74 |

**Not validated:** `createdAt` is never parsed; `responseContract` is never
checked; `scenario.id` is not constrained; `scope.repositoryRoot` is **not
required to be absolute** (contrast the worktree planner, §2); no filesystem
existence check of any path.

### The response side — `validateTaskResponse` (`task.ts:82-112`)

Takes `unknown` and the packet. Enforces: object shape; `schemaVersion ===
"0.1"` and `taskId` equal to the packet's; non-blank `summary`; a `usage`
object whose `turns`/`runs`/`durationMs` (and `tokens` when `maxTokens` is set)
are non-negative safe integers not exceeding the corresponding budget;
`candidateRunIds` an array no longer than `maxRuns`; `changedFiles` an array;
`hypotheses`/`evidenceReferences`/`risks` string arrays; `status` one of
`completed | blocked | rejected`; every `requiredChecks` entry present in
`checks`, matched by `commandIdentity` — `sha256(JSON.stringify([cwd,
executable, args]))` (`task.ts:114-116`) — and, when `status === "completed"`,
each such check must be `"passed"` (`task.ts:110`).

`renderTaskMarkdown` (`task.ts:118-120`) turns a packet into the agent-facing
prompt. Commands are rendered as JSON argv arrays, never shell strings;
`orchestrator.test.mjs:88` asserts the rendering contains no `&&`.

---

## 2. What `worktree.ts` produces

### Input

`src/worktree.ts:4-21`:

```ts
export type WorktreeSafetyAttestation = {
  symlinksResolved: true;
  reparsePointsAbsent: true;
  verifiedBy: string;
  verifiedAt: string;
};

export type WorktreePlanRequest = {
  schemaVersion: "0.1";
  taskId: string;
  repositoryRoot: string;
  mainWorkspaceRoot: string;
  disposableBaseRoot: string;
  worktreeRoot: string;
  branch: string;
  startPoint: string;
  pathSafety: WorktreeSafetyAttestation;
};
```

Note the attestation members are the *literal* type `true`, so a TypeScript
caller cannot pass `false`; the runtime check repeats it anyway.

### Output

`src/worktree.ts:23-32`:

```ts
export type WorktreePlan = {
  schemaVersion: "0.1";
  taskId: string;
  repositoryRoot: string;
  worktreeRoot: string;
  branch: string;
  create: CommandSpec;
  inspect: CommandSpec;
  remove: CommandSpec;
};
```

`createWorktreePlan` (`worktree.ts:81-93`) revalidates and **throws** on
rejection (`worktree.ts:83`), then emits exactly:

| Member | argv | cwd |
| --- | --- | --- |
| `create` | `git -C <repositoryRoot> worktree add -b <branch> <worktreeRoot> <startPoint>` | `mainWorkspaceRoot` |
| `inspect` | `git -C <worktreeRoot> status --short` | `worktreeRoot` |
| `remove` | `git -C <repositoryRoot> worktree remove <worktreeRoot>` | `mainWorkspaceRoot` |

(`worktree.ts:90-92`; asserted verbatim at `tests/cli.test.mjs:127`.)

### Policy rules on paths and refs — `validateWorktreePlanRequest` (`worktree.ts:65-79`)

| Issue code | Rule | Line |
| --- | --- | --- |
| `worktree.schema` | `schemaVersion === "0.1"` | 67 |
| `worktree.absolute` | all four of `repositoryRoot`, `mainWorkspaceRoot`, `disposableBaseRoot`, `worktreeRoot` are strings and **absolute** | 68-70 |
| `worktree.disposable-root` | `worktreeRoot` is at-or-within `disposableBaseRoot` (equality allowed) | 71 |
| `worktree.repository-overlap` | `disposableBaseRoot` must not overlap `repositoryRoot` **in either direction** | 72 |
| `worktree.workspace-overlap` | `disposableBaseRoot` must not overlap `mainWorkspaceRoot` in either direction | 73 |
| `worktree.path-attestation` | `pathSafety` present, `symlinksResolved === true`, `reparsePointsAbsent === true`, `verifiedBy` non-blank, `verifiedAt` parses as a date | 74 |
| `worktree.branch` / `worktree.start-point` | both pass `safeGitRef` | 75-76 |
| `worktree.task` | `taskId` non-blank | 77 |

`safeGitRef` (`worktree.ts:59-63`): matches
`/^[A-Za-z0-9][A-Za-z0-9._\/-]{0,254}$/u`, and additionally forbids `..`, `//`,
`@{`, a trailing `/`, and any slash-segment that is empty, starts with `.`,
ends with `.`, or ends with `.lock`. Consequence: `agent/task-1`, `HEAD`,
`origin/dev`, `refs/heads/dev` are accepted; `HEAD~1`, `dev^`, `feature/..\x`,
`agent/unsafe.lock` are rejected (the last is asserted at
`orchestrator.test.mjs:208-212`).

Path comparison is **lexical only** and flavour-aware (`worktree.ts:34-57`,
mirrored in `path-policy.ts:5-26`): a path is treated as Windows if it matches
`/^[A-Za-z]:[\\/]/` or contains a backslash, otherwise POSIX; Windows paths are
lower-cased before comparison; and `atOrWithin` returns `false` outright when
the two paths are of different flavours.

### What it explicitly refuses to do

- **It never executes anything.** `src/` contains no `node:child_process`
  import at all (verified by grep; the only Node I/O imports in the whole
  package are `node:fs/promises` in `audit.ts:2` and `cli.ts:2`). The three
  `CommandSpec` objects are a plan for a separately authorized coordinator
  (README:55-57).
- **It never resolves symlinks or reparse points.** It *demands an attestation*
  that someone else did (`worktree.ts:74`; README:19-21). The package therefore
  does not protect against a junction/symlink escape — it only records that a
  named party claims to have checked.
- **It touches no filesystem.** It does not check that `repositoryRoot` is a
  git repository, that `worktreeRoot` is absent, that `branch` is unused, or
  that `startPoint` resolves.
- **No branch/commit/merge/install/cleanup verbs.** There is no `git fetch`, no
  `git commit`, no `git diff`, no `git branch -D`, no `git worktree prune`, no
  package install. `remove` carries no `--force`, so it fails against a dirty
  worktree; `create` uses `-b` (not `-B`), so a rerun with an existing branch
  fails.
- **No commit-SHA capture.** The plan records the `startPoint` *ref string*
  only; nothing resolves or records the SHA the branch actually started from,
  so no later audit record can prove the base commit.

---

## 3. What `review.ts` gates on

### The input it requires

`evaluateReviewGate(submission: CandidateSubmission)` (`review.ts:47-68`) over
`types.ts:100-109`:

```ts
export type CandidateSubmission = {
  packet: AgentTaskPacket;
  response: AgentTaskResponse;
  observedEdits: CandidateEdit[];
  baselineEvaluation: RunEvaluation;
  candidateEvaluation: RunEvaluation;
  comparison: CandidateComparison;
  candidateInvariants: ProtectedInvariant[];
  auditVerified: boolean;
};
```

In concrete terms the caller must already have produced, by its own means:

1. the original **packet** and the agent's **JSON response**;
2. an **independently observed edit list** — the package's README:19-21 says
   this must come from a trusted worktree diff with symlink escapes already
   rejected;
3. two **`RunEvaluation` objects** (baseline and candidate) from
   `packages/test-contracts`, i.e. two completed Testing-Lab runs;
4. a **`CandidateComparison`** between those two runs;
5. the **candidate's re-hashed protected invariants**, so removal/mutation can
   be detected;
6. a boolean saying the caller already verified the audit chain.

The two test-contracts shapes (`packages/test-contracts/src/evaluation.ts:246-256`
and `:175-245`):

```ts
export type CandidateComparison = {
  schemaVersion: typeof CANDIDATE_COMPARISON_SCHEMA_VERSION; // "0.1"
  baselineRunId: string;
  candidateRunId: string;
  safetyPassed: boolean;
  expectationSetEqual: boolean;
  evidenceComplete: boolean;
  metricDeltas: Record<string, number>;
  verdict: "improved" | "regressed" | "equivalent" | "rejected";
  reasons: string[];
};
```

`RunEvaluation` is schema **`"0.3"`** and carries roughly twenty-five required
members (`runId`, `verdict`, `facilityFailure`, `invariants`, `metrics`,
`scenarioId`, `workflowId`, `variantId`, `repeatIndex`, `lane`, `flowCreated`,
`oracleVerdict`, `reportedVerdict`, `automationFailureReported`,
`automationFailureExpected`, `harnessActivations`, `durationMs`, `actions`,
`evidence`, `llm`, `extraction`, `harnessRecovery`, plus the Week-2 adaptation
members). The review gate reads only three of them — `runId`, `verdict`,
`invariants` (`review.ts:53-61`) — and never calls a `test-contracts`
validator, so the package's own `.mjs` fixtures still pass a stale
`schemaVersion: "0.1"` shape (`tests/cli.test.mjs:92-93`,
`tests/orchestrator.test.mjs:72-73`). That drift was already recorded in
`docs/working/mvp-week1-web-automation-reliability-plan/reports/w1-eval-contracts.md:229-233`.

### The gates

Composed first from `validateCandidateResult` (`review.ts:19-31`), which is
`validateTaskPacket` + `validateTaskResponse` + `validateCandidateEdits` plus:

- `edits.observed-format` / `edits.reported-format` — both lists must parse as
  `CandidateEdit[]` (`review.ts:9-17, 22-25`);
- `edits.mismatch` — the agent's `changedFiles` must match the observed diff
  **exactly**, compared as sorted `repository\0path\0operation\0changedBytes`
  tuples (`review.ts:26-29`). Byte counts must agree to the byte.

then `detectExpectationWeakening` (`review.ts:33-45`):
`expectation.removed`, `expectation.changed` (definition hash differs),
`expectation.optional` (`required: true` became `false`).

then, in `evaluateReviewGate` itself:

| Issue code | Rule | Line |
| --- | --- | --- |
| `audit.invalid` | `submission.auditVerified` is true | 52 |
| `comparison.baseline` | `baselineEvaluation.runId === comparison.baselineRunId` | 53 |
| `comparison.candidate` | `candidateEvaluation.runId === comparison.candidateRunId` | 54 |
| `response.candidate-run` | the response's `candidateRunIds` includes the compared candidate run | 55 |
| `candidate.failed` | `candidateEvaluation.verdict === "passed"` | 56 |
| `evaluation.invariant-removed` | every baseline-evaluated invariant is present in the candidate evaluation | 57-60 |
| `evaluation.expected-changed` | each invariant's `expected` string is unchanged | 61 |
| `comparison.safety` | `comparison.safetyPassed` | 63 |
| `comparison.expectations` | `comparison.expectationSetEqual` | 64 |
| `comparison.evidence` | `comparison.evidenceComplete` | 65 |
| `comparison.verdict` | verdict is not `rejected` or `regressed` (so `improved` and `equivalent` both pass) | 66 |
| `response.status` | `response.status === "completed"` | 67 |

### What `approve-for-human-review` means

`types.ts:114-116`:

```ts
export type ReviewGateResult = PolicyResult & {
  verdict: "approve-for-human-review" | "reject";
};
```

The union has **two** members; there is no `approve`, `merge`, or `land`. The
verdict is computed as `issues.length === 0 ? "approve-for-human-review" :
"reject"` (`review.ts:68`). It means only: *every mechanical gate above passed,
so a human may now look at this.* `"merge"` is a mandatory prohibited action
for every role (`roles.ts:11`), and the README states the gate never returns an
automatic merge decision (README:16).

---

## 4. What `audit.ts` records

### Record shape

`src/audit.ts:5-17`:

```ts
export type AuditEventType =
  | "task.created" | "task.dispatched" | "response.received"
  | "candidate.compared" | "review.completed";

export type AuditRecord = {
  schemaVersion: "0.1";
  sequence: number;
  timestamp: string;
  event: AuditEventType;
  taskId: string;
  actor: string;
  payload: unknown;
  previousHash: string | null;
  hash: string;
};
```

The event vocabulary is a **closed union of five**, none of which describes a
worktree or branch lifecycle.

### File format

NDJSON: one `JSON.stringify(record)` per line, each terminated by `\n`
(`audit.ts:103`). `readAuditLog` (`audit.ts:64-73`) reads the file as UTF-8,
returns `[]` for a blank file or `ENOENT`, otherwise `trimEnd().split("\n")`
and `JSON.parse` per line. (The ENOENT-to-empty behaviour is a baselined
`failure-as-empty` structure-audit exception: `.structure-baseline.json` →
`rules/failure-as-empty` → `packages/agent-orchestrator/src/audit.ts: 1`.)

### Hash chain

- **Canonical form** (`audit.ts:19-27`): objects are serialized with keys sorted
  by `localeCompare`, arrays in order, primitives by `JSON.stringify`;
  non-finite numbers throw.
- **Record hash** (`audit.ts:48-50`): `sha256(canonicalize(record without
  "hash"))`, hex.
- **Linkage** (`audit.ts:97`): `previousHash` is the previous record's `hash`,
  or `null` for the first record.
- **Sequence** (`audit.ts:91`): 1-based, and verification requires
  `record.sequence === index + 1`.
- **Verification** (`verifyAuditRecords`, `audit.ts:52-62`): walks the array,
  checking sequence, `previousHash` linkage, and recomputed hash; any failure
  returns `false` for the whole chain. Note `verifyAuditRecords([])` returns
  `true` vacuously — the CLI adds a separate `audit.empty` issue
  (`cli.ts:47-50`), but the library does not.

### Append semantics — `AppendOnlyAuditLog` (`audit.ts:75-109`)

- Constructor takes the file path and an injectable clock (`audit.ts:78`).
- `append` chains onto a per-instance promise so concurrent calls on one
  instance are **serialized** (`audit.ts:76, 80-84`); `orchestrator.test.mjs:176-180`
  appends three records via `Promise.all` and asserts a valid three-record chain.
- Each append re-reads the whole log and **refuses to append to an invalid
  chain** (`audit.ts:88`, asserted at `orchestrator.test.mjs:188`).
- Payloads must be pure finite JSON: `assertJsonValue` (`audit.ts:29-37`)
  rejects `undefined`, functions, symbols, `NaN`/`Infinity` and circular
  references; `jsonSnapshot` (`audit.ts:39-46`) deep-clones through a JSON
  round trip so later mutation of the caller's object cannot alter the record.
- Writes with `open(path, "a")`, `writeFile`, then `handle.sync()` (fsync) and
  close (`audit.ts:100-107`); the parent directory is created with `mkdir
  -p`.
- **Not multi-process safe** — README:22-24 states the chain detects later
  mutation but is not a locking service.

---

## 5. What `roles.ts` and `path-policy.ts` constrain

### `roles.ts`

```ts
export type RolePolicy = {
  role: AgentRole;
  writable: boolean;
  repository?: RepositoryName;
  purpose: string;
  mandatoryProhibitions: readonly ProhibitedAction[];
};
```
(`roles.ts:3-9`.) `COMMON` (`roles.ts:11`) is **all seven** prohibited actions,
and every one of the six roles uses it, so `merge`, `publish`, `deploy`,
`live-site-write`, `disable-test`, `weaken-expectation` and
`edit-outside-scope` are prohibited for every role without exception.

| Role | `writable` | pinned `repository` |
| --- | --- | --- |
| `coordinator` | no | — |
| `scenario` | yes | `facility` |
| `diagnosis` | no | — |
| `core-repair` | yes | `core` |
| `extension-repair` | yes | `facility` |
| `reviewer` | no | — |

(`roles.ts:13-20`; the read-only set is asserted at `orchestrator.test.mjs:83`.)

### `path-policy.ts`

Two predicates and one validator.

- `isPathWithinRoot` (`path-policy.ts:15-22`) — **strict** containment: a path
  equal to the root returns `false`.
- `isPathAtOrWithinRoot` (`path-policy.ts:24-26`) — containment **or**
  equality; this is the one `validateTaskPacket` uses for `allowedRoots` vs
  `repositoryRoot`.
- `validateCandidateEdits(packet, edits)` (`path-policy.ts:28-42`):

| Issue code | Rule | Line |
| --- | --- | --- |
| `role.read-only` | a non-writable role submitted any edit | 31 |
| `role.repository` | the role's pinned repository matches `scope.repository` | 32 |
| `budget.changed-files` | `edits.length <= budgets.maxChangedFiles` | 33 |
| `budget.changed-bytes` | `sum(changedBytes) <= budgets.maxChangedBytes` | 34-35 |
| `scope.repository` | each edit's `repository` equals `scope.repository` | 37 |
| `scope.repository-root` | each edit path is **strictly within** `repositoryRoot` | 38 |
| `scope.allowed-root` | each edit path is **strictly within at least one** `allowedRoot` | 39 |
| `edit.changed-bytes` | `changedBytes` is a non-negative safe integer | 40 |

Path flavour handling is identical to `worktree.ts` (`path-policy.ts:5-13`):
Windows detection by drive prefix or any backslash, lower-casing before
comparison, and a hard `false` when candidate and root flavours differ.

**Two footguns worth recording for whoever drives this.**

1. `CandidateEdit.path` is **not required to be absolute**. `canonical` calls
   `resolve()` (`path-policy.ts:11`), so a *relative Windows-style* path such as
   `apps\extension\src\x.ts` is silently resolved against `process.cwd()`. If
   the coordinator's cwd happens to be the repository root, such a path passes
   the scope checks by accident. A relative POSIX-style path is rejected, but
   only incidentally, by the flavour mismatch.
2. Because `allowedRoots` are matched with the **strict** predicate, an edit to
   a file whose path is exactly an `allowedRoot` entry is rejected. Allowed
   roots must be directories, not files.

---

## 6. The precise gap for an *executing* branch-and-worktree coordinator

### What the package deliberately does not do

Grouped by the phase that needs it. Every item below has **no** code in this
package.

**Setup and branch creation**
- Spawn any process. There is no `node:child_process` import in `src/`; the
  package's only process-adjacent artifact is the `CommandSpec` argv triple.
- `git fetch` / update the start point before branching.
- Check that the branch does not already exist (`create` uses `-b`, so a rerun
  against an existing branch fails), or that `worktreeRoot` is absent.
- Resolve and record the **commit SHA** the branch started from. Only the ref
  string survives into the plan.
- Verify `repositoryRoot` is a git repository, or that git is on `PATH`.
- Resolve symlinks / detect Windows reparse points. This is demanded as a
  caller *attestation* (`worktree.ts:74`), so the coordinator must implement
  `realpath` plus reparse-point detection itself and then assert it.

**Making the worktree usable**
- `pnpm install` (or any dependency bootstrap) in the new worktree. A fresh
  `git worktree` has no `node_modules`; the plan has no install step and
  `WorktreePlan` has no slot for one.
- Copy or link untracked-but-required files (`.env.local`, `.fluxiq/`), or
  decide deliberately not to.
- Port/lock allocation so two concurrent agent worktrees do not collide.

**Running the work**
- Dispatch an agent. `renderTaskMarkdown` produces the prompt text; nothing
  sends it anywhere.
- Execute `packet.scenario.command` or any `packet.requiredChecks` entry,
  capture exit codes and stdout, and assemble the `CheckResult[]` the response
  validator then demands.
- Enforce the budgets it validates. `maxDurationMs`, `maxTurns`, `maxRuns` are
  checked against *self-reported* usage after the fact (`task.ts:89-98`); nothing
  imposes a timeout or a turn cap during execution.

**Collecting evidence**
- Produce `observedEdits`. The coordinator must run something like `git diff
  --numstat` / `--name-status` in the worktree and map it to `CandidateEdit[]`,
  including deciding what `changedBytes` *means* — and the agent must report
  the identical number, because `review.ts:26-29` compares the tuples exactly.
- Re-hash the candidate's protected invariants into `candidateInvariants`.
- Produce the two `RunEvaluation`s and the `CandidateComparison`. No producer
  for `RunEvaluation` exists in this repository
  (`.../reports/w1-eval-contracts.md:226-227`).
- Run `verifyAuditRecords` and pass the resulting boolean in. Nothing binds the
  audit file to the task: `auditVerified` is an unchecked caller assertion.

**Integration and teardown**
- Commit in the worktree: staging, message convention, author identity, signing.
- Merge, rebase, cherry-pick, push, or open a PR. `merge` is a prohibited
  action for every role and the gate tops out at `approve-for-human-review`.
- Delete the branch after integration (`git branch -D` / `-d`).
- `git worktree prune`, handling of a *dirty* worktree (`remove` has no
  `--force`), or deletion of the disposable directory tree.
- Any rollback or abort path.

**Coordination**
- Persistence or a state machine. There is no task store, no status query, no
  resume; the audit log is append-only evidence, not state.
- Multi-process locking. Explicitly out of scope (README:22-24), yet parallel
  agent worktrees is the whole point of the workflow.
- Cross-repository tasks. See the type-fit note below.

### Are the existing types a good fit to drive execution?

**Good fit, reuse as-is:**

- `CommandSpec { executable, args, cwd }` is exactly the right shape for
  `spawn(executable, args, { cwd })` with no shell. The validator already
  rejects NUL/CR/LF in the executable and arguments (`task.ts:36-40`), which is
  the injection surface that matters. Keep it.
- `PolicyResult` / `PolicyIssue` (`types.ts:111-112`) are a clean, composable
  error channel and the CLI already maps them to exit codes (`cli.ts:20-22`:
  `0` accepted, `2` rejected by policy, `1` unparseable).
- The `WorktreePlanRequest` path policy (disposable base isolated from both the
  repository and the main workspace) is exactly the invariant an executing
  coordinator wants, and is already tested.
- `AppendOnlyAuditLog` is directly usable as the execution journal, subject to
  the event-vocabulary change below.

**Needs extension (purely additive, low risk):**

- `WorktreePlan` carries only `create` / `inspect` / `remove`. Execution needs
  at least `install`, `diff`, `commit`, and `removeBranch` — new optional
  `CommandSpec` members, plus a `prune`/`forceRemove` variant for the dirty
  case.
- `AuditEventType` is a closed five-member union with no worktree lifecycle.
  Driving execution means adding events such as `worktree.created`,
  `worktree.removed`, `branch.created`, `checks.run`, `merge.requested`.
  Widening the union is additive but does touch every exhaustive switch over it
  (there are none today).
- `WorktreePlanRequest` has no slot for the resolved base SHA; add a
  `startPointSha` (or return it on the plan) so the audit record can prove the
  base commit.

**Needs changing (not additive — the real friction):**

- **`AgentTaskPacket` is welded to a Testing-Lab scenario repair.** `scenario:
  { id, seed, command }` and `baseline: { runId, artifactIndexSha256 }` are
  mandatory (`types.ts:48-49`) and `validateTaskPacket` enforces a uint32 seed
  and a 64-hex baseline hash (`task.ts:62-63`). A general agent task —
  "implement this feature on a branch" — has no scenario, no seed, and no
  baseline artifact index, and there is **no way to omit them**. Making the
  packet general means making those two members optional or splitting the type
  into a discriminated union, which is a breaking change to the packet schema
  (and so to `schemaVersion`).
- **One packet addresses exactly one repository.** `scope.repository` is a
  single `"facility" | "core"` and `scope.repositoryRoot` a single path
  (`types.ts:43-47`); `WorktreePlanRequest` likewise describes one repository.
  FluxIQ work routinely spans this repository and the Core sibling, and there
  is no type linking two packets or two worktrees into one unit of work.
- **The review gate is unusable outside the Testing Lab.** `CandidateSubmission`
  mandates two `RunEvaluation`s and a `CandidateComparison`
  (`types.ts:104-106`). For a branch-and-worktree task judged by `pnpm check` /
  `pnpm test` rather than a scenario run, there is nothing to put there —
  the fields cannot be omitted, and the gate reads only three members of each
  `RunEvaluation` anyway. Either the gate needs a second, evaluation-free
  entry point, or those three members need extracting into a small
  "candidate outcome" type that a check-based run can also produce.
- **`CandidateEdit.changedBytes` has no defined semantics** (added bytes? net
  delta? new file size?) yet must match between the agent's report and the
  coordinator's diff to the byte (`review.ts:26-29`). Either define it and
  document it, or relax the reconciliation to compare
  `repository/path/operation` and bound the bytes separately.
- **`CandidateEdit.path` should be required to be absolute** to close the
  `process.cwd()` resolution hazard in §5.

**Bottom line on fit:** the *worktree planner, path policy, role policy and
audit log* are a good foundation for an executing coordinator and want only
additive extension. The *task packet and review gate* are shaped for one
specific job — repairing a failing Testing-Lab scenario — and would need
breaking schema changes before they could describe a general
branch-and-worktree agent task.

---

## 7. Is it called by anything? Live or dormant?

**Dormant scaffolding.** Nothing in the repository imports it.

Ripgrep across the repository for both `agent-orchestrator` and
`fluxiq-agent-orchestrator` returns, outside the package's own directory:

| Hit | Nature |
| --- | --- |
| `package.json:8` | `"agent:orchestrator": "pnpm --filter @fluxiq-web-extension/agent-orchestrator build && node packages/agent-orchestrator/dist/cli.js"` — a manual root script; nothing invokes it |
| `pnpm-lock.yaml:81` | workspace membership only |
| `docs/architecture/testing-facility.md:203, 1674-1701, 1847` | ownership table row, the "Bounded agent workflow" section, and the documented test command |
| `.structure-baseline.json:63` | the `failure-as-empty` exception for `audit.ts` |
| `docs/working/**` (≈12 files) | planning notes and worker reports referencing it |

A targeted search for the import specifier
`@fluxiq-web-extension/agent-orchestrator` finds **zero** `import`/`require`
statements anywhere: only `package.json:8`, the package's own
`package.json:2`, and two historical worker reports. No script under
`scripts/`, no app, and no other package depends on it. The dependency arrow
points the other way — the package depends on
`@fluxiq-web-extension/test-contracts` (`package.json:22`).

What *is* live is the gate participation: because it is a workspace member
(`pnpm-workspace.yaml` → `packages/*`), its `build`, `check` and `test` scripts
run inside the root `pnpm -r build` / `pnpm check` / `pnpm test`
(root `package.json:10, 11, 58`). Its 16 assertions across
`tests/cli.test.mjs` and `tests/orchestrator.test.mjs` therefore execute in the
repository test gate and have been observed passing in prior sessions
(e.g. `docs/working/mvp-week1-web-automation-reliability-plan/archive/2026-09-12-finish-week1-ledger.md:3661`).

So: compiled, type-checked, tested, documented, and reachable through one
manual CLI entry point — but with no production caller. It is a designed
contract surface waiting for the executing coordinator that this plan would
build.

One incidental structural note, not acted on: the package's tests live at
`packages/agent-orchestrator/tests/*.test.mjs` — a package-root tree separate
from `src/` — which does not match the `AGENTS.md` rule that `a/b.ts` is
covered by `a/tests/b.test.ts`. This is pre-existing and was out of scope here.

---

## Commands run and observed results

- `pnpm --filter @fluxiq-web-extension/agent-orchestrator check` →
  `tsc -p tsconfig.json --noEmit`, exit `0`, no diagnostics. The package
  compiles cleanly today against the current `test-contracts` `.d.ts`.
- Repository search via ripgrep for `agent-orchestrator|fluxiq-agent-orchestrator`
  and for `@fluxiq-web-extension/agent-orchestrator` → results tabulated in §7.
- `grep -rn "node:child_process\|spawn\|execFile\|exec(\|node:fs" src/` →
  only `src/audit.ts:2` and `src/cli.ts:2`, both `node:fs/promises`. No process
  spawning anywhere in the package.
- Python read of `.structure-baseline.json` → the `agent-orchestrator` entry is
  under `rules/failure-as-empty`, value `1`.

## Not verified

- **The package's own test suite was not run.** `pnpm --filter ... test` runs
  `tsc -p tsconfig.json` first, which emits into `dist/`; the brief said not to
  modify any file, so only the `--noEmit` check was run. The tests were read in
  full and their assertions are cited above, but their current pass/fail state
  rests on prior sessions' ledger entries, not on an observation in this one.
- The CLI was not executed, so the exit-code contract (`0`/`1`/`2`) is read
  from `cli.ts:20-22, 60-68` and from `tests/cli.test.mjs`, not observed.
- `git worktree add -b ...` was not run; whether the emitted argv succeeds
  against this repository is untested here.
- I did not read the `test-contracts` validators (`evaluation-validation.ts`),
  so I cannot say exactly what `assertRunEvaluation` would reject — only that
  the orchestrator never calls it.

## Open questions or contradictions found

1. **`auditVerified` is an unchecked assertion.** `evaluateReviewGate` trusts a
   caller-supplied boolean (`review.ts:52`) and the submission carries no audit
   file path or head hash. Nothing binds the chain to the task being reviewed,
   so a coordinator could pass `true` with no log at all. If the audit chain is
   meant to be load-bearing, the submission should carry the log's head hash and
   the gate should recompute.
2. **`verifyAuditRecords([])` returns `true`.** The empty-chain rejection lives
   only in the CLI (`cli.ts:47-50`), not the library. A library consumer that
   verifies an absent log gets `true`.
3. **Stale evaluation fixtures.** The package's `.mjs` tests build
   `schemaVersion: "0.1"` `RunEvaluation` objects that no longer match the
   `"0.3"` type; they pass only because the orchestrator never validates
   evaluations. Already flagged in `w1-eval-contracts.md:229-233` and still
   true.
4. **README wording vs `-b`.** README:55-57 describes "create, inspect, and
   remove commands" without noting that `create` uses `-b` (fails on an
   existing branch) and `remove` has no `--force` (fails on a dirty worktree).
   Both matter to anyone writing the executor.
5. **`changedBytes` semantics are undefined** yet must match exactly between two
   independent producers. This looks like the most likely source of spurious
   `edits.mismatch` rejections in practice.
