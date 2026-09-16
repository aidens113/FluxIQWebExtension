# Work Ledger, 2026-09-15 and earlier

Moved out of `mvp-week2-automation-loop-plan.md` on 2026-09-16 under the
800-line compaction rule. These entries are settled: their work is built,
verified and pushed, and the plan's Current State summarizes it.

### 2026-09-15 — Stage protocol, de-webbed sanitizers, and the test split
- Agent: supervisor; workers `s-stage-protocol`, `w2-test-split`, `h-harness-registry`
- Changed: Core `AS/runtime/llm/stages/**` (new), `llm/harness/**`,
  `deepseek-provider.ts`, `evidence-loop.ts`, `service.ts`,
  `AS/runtime/tests/**` (split into four subject subfolders),
  `.structure-baseline.json`; downstream `domain/src/runtime/llm-evidence/tools.ts`
- Why: L15 (a fixed order of work the domain extends but cannot reorder), the
  last of Phase T's leftovers (Core's sanitizers carried web nouns), and the
  runtime test directory sitting at exactly its 25-file budget, which blocked
  every remaining loop phase from adding a test
- Validation: the supervisor ran each itself. Core `npx tsc --noEmit` -> exit 0.
  `vitest run .../runtime/llm --no-file-parallelism` -> "Test Files 12 passed",
  "Tests 127 passed". `vitest run .../runtime/tests/service.test.ts` -> 108
  passed. Full `vitest run .../runtime` after the split -> "Test Files 84
  passed", "Tests 726 passed", no timeouts. `node domain/scripts/test-domain.mjs`
  -> 490 passed. Both structure audits pass
- Outcome: Accepted
- **Three pushes of mine were defective and each was caught by a worker reading
  the result, not by me.** A broad `git add` of a *directory* swept another
  phase's in-flight files three separate times; the third left HEAD unable to
  build from a clean checkout, because a swept file imported a directory that
  was still untracked. It compiled locally only because the directory existed in
  a working tree. Staging explicit file paths prevents this; a directory
  argument does not, because it takes whatever happens to be inside it
- The de-webbing had a real interim cost, recorded because it is the kind of
  thing that gets forgotten: Core stopped refusing `html`, `cookies` and the
  rest by name before anything passed the domain's declaration, so raw page
  payload could reach the provider on that path. Closed by wiring three
  `service.ts` sites and the domain's declaration
- Two deliberate choices in that list: `snapshot` is no longer denied, because
  it is Core's own noun and Core's own state-snapshot option produces one — the
  nested `html` is what is refused. `selector` is denied, because it is the
  domain's word for a target and stopped being Core's business when the repair
  target became opaque
- **Still to do, deferred rather than forgotten:** `deniedEvidenceKeys` is
  optional on Core's binding, and `context-packet.ts:81` defaults a missing
  declaration to `[]` — deny nothing. That is the same silent-no-protection
  shape this plan keeps finding, so the field should be required and the default
  should fail closed. Deferred because it breaks nine call sites across three
  files and Phase 2.2 is mid-edit in two of them; forcing an all-or-nothing
  change into an active file is what broke the build during Phase P
- The test split raised per-test contention and pushed two 10,000-item cases
  past the suite's 15s timeout. They now carry their own 60s budget: raising the
  global one would blunt a hang-detector for 700-odd tests to accommodate two,
  and those two assert their own speed explicitly (under 500ms per page and
  search), so the timeout was never what held performance honest

### 2026-09-15 — Endpoint classification landed; two supervisor corrections
- Agent: supervisor; workers `p-pin-classification`, `x4f-extraction-docs`
- Changed: Core `_shared/{api,runtime,docs-generators}.ts`, all 26 `*/api/**`
  registration files, `programs/tests/endpoint-classification.test.ts` (new),
  `_shared/tests/api.test.ts` (new), `persistence.md`; this repository's
  `docs/architecture/{extension-client,web-capabilities,sensitive-values}.md`
- Why: L16 — the PIN guards destruction, not authorship — and the extraction
  feature was built without its authored documentation following
- Validation: the supervisor ran the classification suites itself ->
  "Test Files 2 passed", "Tests 14 passed". The worker's `pnpm check` -> exit 0
  and `pnpm --filter fluxiq test` -> 1445 passed / 6 failed, of which one is the
  stale assertion below and five pass when their file runs alone
- Outcome: Accepted, with one known-red assertion and the push withheld
- **The commit is deliberately not pushed.** Making `review-flow-adaptation`
  authoring leaves a test in `AS/runtime/tests/service-flow-bootstrap-adaptation.test.ts:383`
  still expecting a PIN. It is stale rather than wrong-headed, and the worker
  owning that file is correcting it; `AGENTS.md` forbids pushing a unit that
  includes something known to be broken
- **Supervisor correction, recorded because it reverses an earlier decision of
  mine.** I previously classed `save-project-hierarchy` and
  `delete-project-hierarchy-node` as destructive, from the inventory's
  description. Reading `service.ts:4972` shows they touch only
  `customHierarchyNodes`: no flow, recording, project or dataset is removed, so
  the user's work survives and merely becomes unfiled. They destroy
  organization, not data, and the granular one is an **autosave** path that
  fires while the user drags items around — gating it would put a PIN prompt in
  the middle of ordinary editing, which trains reflexive PIN entry and weakens
  the PIN everywhere it actually matters. Both are now `authoring`, and they
  move together because leaving the bulk save gated while the granular delete is
  not would simply be a bypass
- `delete-run-datasets` keeps its PIN: it really does delete captured rows. The
  Data window's delete is correctly refused today, and the fix is in the panel,
  which must collect a PIN rather than route around the gate
- Four findings from the docs worker, none fixed: there is **no mechanical
  link or anchor check for `docs/architecture/`** (only `docs/working/` has
  one); both documents had stale action-input counts, now corrected;
  `web.user.value_extraction_defined` is registered but unreachable, since the
  worker refuses a `value` pick at two points; and `PICKER_PREVIEW_MAX_ROWS` and
  `EXTRACTION_PREVIEW_MAX_ROWS` are two constants that must agree, both 20, with
  no test holding them equal

### 2026-09-15 — Graph rollback inverse fixed and verified
- Agent: supervisor; worker `g-rollback-inverse`, resumed after the crash
- Changed: Core `automation-studio/storage/project/graph-store.ts` and its tests
- Why: a `delete_node` inverse omitted cascaded edges, so rolling back a
  deletion did not restore the graph it removed. Rollback is the safety net
  every later loop phase leans on — an autonomous change is only safe to propose
  if a bad one can be truly reverted
- Validation: the supervisor ran
  `pnpm --filter fluxiq exec vitest run src/programs/automation-studio/storage/project/tests/graph-store.test.ts`
  itself -> "Test Files 1 passed (1)", "Tests 9 passed (9)", including the row
  "restores the graph exactly for every patch operation's inverse"
- Claimed but not independently reproduced: the worker ran the same suite with
  `graph-store.ts` restored from HEAD and reported 3 failed / 4 passed. That
  would show the tests catch the defect rather than passing either way, but the
  supervisor did not re-run it, so it is the worker's claim and not evidence
- Outcome: Accepted
- Follow-up: the worker **rewrote the inherited rollback test**, which asserted
  bookkeeping before it ever compared the graph and so would have passed without
  proving the fix — worth noting as the same failure mode this plan exists to
  correct, found in the plan's own test. It generalized to a table-driven
  round-trip across all eight operation inverses (only `delete_node` failed on
  HEAD) and fixed a second instance of the class in `restoreSnapshot`, which
  restored only x/y and parameters while silently dropping label, definitionId,
  ports, metadata, disabled and sizes. `restoreSnapshot` has no production
  callers, so that change is exercised only by tests

### 2026-09-15 — Identity Access credential recheck fixed and verified
- Agent: supervisor; worker `sec-create-session`, resumed after the crash
- Changed: Core `identity-access/{api/contracts.ts, api/handlers.ts,
  api/tests/handlers.test.ts (new), runtime/service.ts,
  runtime/tests/service.test.ts}`
- Why: `create-session` minted a session for any user id with no credential
  recheck, at the handler and in the service alike. The worker found a second
  defect in the same area: a user with **no credential record** unlocked the
  vault with nothing proved, because `requireCredential` mints an empty
  credential
- Validation: the supervisor ran
  `pnpm --filter fluxiq exec vitest run src/programs/identity-access` itself ->
  "Test Files 3 passed (3)", "Tests 35 passed (35)", including the new
  `api/tests/handlers.test.ts` (6 tests). The tests were read, not just counted:
  each asserts the refusal (`ok:false, requiresRecheck:true`) **and** that the
  side effect did not happen (`sessions` still length 1), so a refusal that
  still minted a session would fail. Passwords in them are dummy values at a
  test-only weak KDF setting
- Outcome: Accepted
- Follow-up: the same class survives in `create-user`, which mints a brand-new
  **admin** with a chosen password and no recheck — worse than the original,
  because the account outlives the session that made it — and in
  `begin-totp`/`confirm-totp`, which re-enroll another user's authenticator.
  Both are being closed now, with scope widened to the one web view they touch
- Supervisor decision, so it is not re-argued: `revoke-session` and `lock-vault`
  are **not** destructive and must never require a PIN. They remove access
  rather than persisted user data, and gating revocation slows cutting off a
  compromised session at the moment speed matters most. Phase P classifies them
  as authoring

### 2026-09-15 — Machine crash killed nine workers; partial work triaged
- Agent: supervisor
- Changed: reverted `_shared/api.ts` and `_shared/runtime.ts` in Core; five
  workers re-dispatched to resume, not restart
- Why: the machine crashed with nine workers in flight. None wrote a report, so
  none completed, but ~418 lines survived in Core and ~408 in the extension.
  Phase P's partial edit was the dangerous one: it had made `classification` a
  **required** field on `register()`, which is the right design but is
  all-or-nothing — every one of the ~223 registration sites must gain the field
  in the same change, so half-applied it stopped Core compiling and would have
  buried three freshly dispatched Core workers in type errors in files they do
  not own. Its design work is preserved as a patch rather than discarded, at
  `<scratchpad>/phase-p-partial.patch` (131 lines), and Phase P must be redone
  as ONE atomic change
- Validation: `git diff --stat` -> 418 insertions across 9 Core files before the
  revert; `git status --short` after the revert -> only worker-owned files
  remain modified; the patch file is 131 lines. Core type check run separately
- Outcome: Accepted
- Follow-up: Phase P re-dispatched atomically from the saved patch; T, X4-B and
  the pooled-rate fix still to restart, none of which left anything on disk
- Note: concurrency is now **five** workers, not nine. Two crashes have both
  occurred with nine heavy workers running, and this machine has a known memory
  fault, so the correlation is treated as a real resource limit rather than
  caution

### 2026-09-15 — User gave the go; four Core phases dispatched, inventory verified
- Agent: supervisor; worker `w2-d-write-endpoint-inventory`, then `d-five-fixes`,
  `sec-create-session`, `p-pin-classification`, `g-rollback-inverse`
- Changed: this document (Status detail, Current State, Phases T/H/S/G/P/SEC,
  Open Questions)
- Why: the user said to continue and to use maximum parallelism. The phase table
  named findings it assigned to no phase — L2's opaque target, L14's harness
  registry, L15's stage protocol, and the rollback defects — so each got one
- Validation: `grep -rn "registry\.register(" packages` excluding tests -> 223,
  and `authorizeProgramPin` sites -> 58, against the worker's 220/57; the
  qualitative claim held, every site being under `programs/automation-studio`
  or `_shared`. Read `identity-access/api/handlers.ts:121-130` directly:
  `create-session` calls `service.createSession` with no recheck, and
  `runtime/service.ts:291-306` adds none. `runtime/roles.ts:3-20` -> only
  `admin` holds `identity.manage`, so the defect is admin-only to reach.
  `persistence.md:515-521` confirmed to state the PIN rule the code violates
- Outcome: Accepted; the worker's counts corrected rather than adopted
- Follow-up: verify each dispatched worker's claim before treating it as done

### 2026-09-15 — Phased loop plan written from both scoping reports
- Agent: supervisor; workers `w2-scope-context-recovery`,
  `w2-scope-repair-reuse`
- Changed: this document (Current State, Decisions L2-L11, Phases, Execution
  partition, Validation, Risks, Open Questions); its new Core pair
- Why: the user asked for the rest of Week 2 to be planned and reviewed before
  building; the reports found no exit criterion met and five defects by reading
- Validation: not validated; planning documents only, no code changed
- Outcome: Accepted
- Follow-up: the user's review; then phase D and R0

### 2026-09-15 — Plan created; scoping investigations dispatched
- Agent: supervisor; workers `w2-scope-context-recovery`,
  `w2-scope-repair-reuse`
- Changed: this document
- Why: the user pointed out that Week 2 is for refining the automated loop,
  while every worker was on extraction and Core credential hardening and the
  loop phases had no plan
- Validation: not validated; planning document only
- Outcome: Partial
- Follow-up: write the phased plan from both reports
