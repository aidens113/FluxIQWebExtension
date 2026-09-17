# Work Ledger, 2026-09-16 (early)

Moved out of `mvp-week2-automation-loop-plan.md` on 2026-09-16 under the
800-line compaction rule. These entries are settled: their work is built
and supervisor-verified. The first one was pushed in both repositories; the
later ones are committed locally and go out with the next push. The plan's
Current State summarizes them.

### 2026-09-16 — First live DeepSeek reply; pushed in both repositories
- Agent: supervisor; workers `w2-deepseek-preflight-refusal`,
  `w2-lab-repair-outcome`, `w2-per-call-records`, `w2-remove-max-calls-setting`,
  `w2-core-contracts-and-docs`, `w2-fluxiq-0-6-0`, `w2-flow-creation-iterates`,
  `w2-adaptation-certificate-calls`
- Changed: Core `5300d47`, `0b3ba93`; this repository `e9e69f0`, `fcd7dc9`.
  Pushed: Core `0e0e2d6..0b3ba93`, this repository `ea0a2ec..fcd7dc9`.
- Why no live run had ever reached DeepSeek: the DeepSeek adapter's
  `validateDeepSeekRequest` kept its own copy of the fields a recent action may
  carry, and it lacked `failureCategory`, which the context packet adds from a
  `target_not_found` record. Every runtime recovery request was refused before
  sending, at any token limit, under the single code
  `llm.provider_configuration_invalid`. Found only after the Lab began keeping
  Core's per-call issue codes and control refusal reasons. The adapter now uses
  the packet's own compile-checked check; its 17 pre-send refusals have distinct
  codes; tests put real recovery requests through the real adapter.
- Validation: supervisor-run. Live
  `FLUXIQ_TEST_ENV_FILES=none pnpm lab run identity-drift --variant save-and-exit --flow --live-llm --llm-task adapt --llm-max-calls 26 --llm-max-cost-usd 0.25 --llm-max-input-tokens 42000 --llm-max-output-tokens 8000 --llm-max-total-tokens 50000 --llm-max-run-tokens 600000`
  -> `run-mu4nxysj-3234c535`, verdict `passed`, `snapshots/live-llm.json`
  observed calls: `runtime_diagnosis` stage `gather` `validationOk: true`,
  3,182 in / 559 out, $0.00213796; `runtime_patch` stage `implement`
  `validationOk: true`, 3,274 in / 527 out, $0.0021362; accounting 7,542 tokens,
  $0.00427416, 0 breaches; redaction attestation `passed`. Core `pnpm check`
  exit 0; `vitest run src/programs/automation-studio/runtime` -> "Tests 991
  passed (991)"; web `vitest run src/features/automation-studio` -> "Tests 1073
  passed (1073)". This repository `pnpm check` exit 0; test-runner "# pass
  1003", "# fail 0"; test-contracts "# pass 97", "# fail 0"; audit passed.
- Repair outcome, from the next live run (`run-mu4ovip2-b15551d3`, same
  command, after `fcd7dc9`): `harnessRecovery` shows a validated diagnosis and a
  validated `runtime_patch` reply proposing a `temporary_target_override`,
  refused at preflight with `runtime_patch.target_override_rejected`; no
  adaptation, no change proposal; two calls, $0.00407132; redaction `passed`.
  That is the **correct** outcome: the variant's manifest says Save is gone, a
  decoy stands in its slot, and the run must refuse it. No existing Lab
  scenario lets a correct repair succeed -- every other identity-drift variant
  resolves deterministically, and `llm-target-drift`'s renamed target does
  nothing when pressed -- so a successful live repair needs a new variant
  (`w2-repairable-drift-scenario`, dispatched).
- Not verified: a repair that is accepted and makes the task succeed; whether an
  iterating recovery gathers evidence live (this
  run's diagnosis needed none); repeatability. The machine's RAM fault killed
  roughly half of today's build attempts, so single observations stay single.
- Open: any failed provider call revokes the whole grant, so one bad reply ends
  an iterating recovery, patch included. The adapter's 3-bytes-per-token
  estimate can refuse requests the harness allows under an 8k input limit.

### 2026-09-16 — Iteration replaces fixed call counts (in progress)
- Agent: supervisor; workers `w2-iterating-recovery-session`,
  `w2-guards-not-call-counts`, `w2-lab-iterating-calls`,
  `w2-demo-iterating-calls`, `w2-grant-budget-integration`; in flight at the
  time of writing: `w2-adaptation-certificate-calls`,
  `w2-flow-creation-iterates`, `w2-core-contracts-and-docs`
- Why: the user's decision recorded in Current State. A Claude Code crash
  stopped the first two workers mid-task with two workers running — well
  under the recorded five-worker limit, so not a load crash; both were resumed
  from their transcripts with their partial work intact.
- The same fixed limit turned up in seven places, each of which alone would
  have stopped an iterating recovery: Core's two-call runtime purpose; Core's
  per-mode grant constants; the web panel's runtime request; the web panel's
  Flow-creation request (4 calls) and Core's Flow Bootstrap loop (4, capped at
  8); the Lab's contract ceiling and live-run planner; six demo scripts and the
  adaptation certificate; and -- the least visible -- grant expiry, checked on
  every call, defaulting to 60 s and capped at 5 minutes, which would have cut
  a recovery off regardless of its deadline. A saved per-Flow `maxCalls: 1`
  written by the authoring defaults was a further trap: honouring it would have
  pinned every adapting run to a single call, so the panel no longer uses it
  for adapting runs.
- Model now in the tree: iterating purposes default to 26 calls (a diagnosis,
  a patch, and exploration's 24-decision default) with a 64 backstop; a grant
  token budget `maxTotalTokensPerRun` (default min(per-call x calls, 100,000))
  on which the high-token confirmation is judged; a call and a token/cost
  margin held back for the patch; `explore_and_adapt` given its grant's budget
  rather than the $0.25 no-grant one; a 600 s recovery deadline; a
  no-progress guard with its own outcome; and a grant `ttlMs` that is only a
  claim window, with claimed grants under a 600 s lease that exchanges expired
  key authorizations one for one. Worst case for one default recovery: 26
  calls, 100,000 tokens, $2.00 estimated, 600 s; about $0.09 at DeepSeek peak
  prices.
- Validation: supervisor-run, not taken from reports. The grant-lifetime design
  was reviewed as authorization behaviour before acceptance. Its seven tests
  pin that an unclaimed grant expires and is revoked, a claimed grant is
  refused at the end of its lease, the exchange never reveals more keys than
  the call count, revocation wins at any point, the grant dies with the
  actor's session and Secret Keys unlock (the test asserts refusal,
  `activeGrantCount() === 0` and zero reveals), and a revocation racing a mint
  revokes the fresh authorization. `vitest run .../execution-grant-lifetime.test.ts`
  -> "Tests 7 passed (7)". Web panel: `vitest run
  src/features/automation-studio/runtime` -> "Tests 44 passed (44)",
  `tsc --noEmit` exit 0. Lab: `test-contracts` -> "# pass 94", "# fail 0";
  `test-runner` -> "# pass 976", "# fail 0"; audit passed. Core
  `.structure-baseline.json` lowered `service.ts` 6468 -> 6434.
- Not verified yet: no live provider run since the change; no browser; Core
  must be rebuilt before a Lab run because the Lab loads Core's compiled
  output, which still carried the old limits mid-task.

### 2026-09-16 — Four workers integrated; the exploration runs and two holes close
- Agent: supervisor, integrating workers `w2-r0-service-exploration`,
  `w2-denied-evidence-keys`, `w2-diagnosis-channel`, `w2-import-cycle`
- Changed: Core `AS/runtime/recovery/annotation/**` (new), `recovery/index.ts`,
  `recovery/structured-diagnosis.ts`, `recovery/tests/{plan,stages,runtime-exploration}.test.ts`,
  `service.ts`, `llm/harness-options/{binding.ts,index.ts}`,
  `llm/harness/{context-packet.ts,intervention.ts,task-request.ts}`,
  `llm/evidence-loop.ts`, `runtime/loop-limits/**` (new), `llm/tests/**`,
  `tests/service-adaptation/**`, `tests/service-bootstrap/**`,
  `.structure-baseline.json`, `scripts/structure-audit/{config.mjs,rules/imports.mjs,rules/tests/imports.test.mjs}`;
  this repository `scripts/structure-audit/rules/imports.mjs` and its test
  (mirrored from Core, which was identical at HEAD before today)
- Supervisor's own integration work, not a worker's: the two fixture helpers in
  `recovery/tests/{plan,stages}.test.ts` that still built the abandoned
  `metadata` route (the diagnosis worker was forbidden to touch them and
  returned Partial); the Flow Bootstrap forwarding fix; and moving that fix out
  of `service.ts` into `automationStudioHarnessInputWithDeniedEvidenceKeys` in
  `binding.ts`, because six lines in `service.ts` breached the freshly lowered
  6468 baseline and the audit refused them — which is the ratchet working.
- Validation: supervisor-run, after all four landed. Core `pnpm check` -> exit 0
  (audit passed, all four packages typecheck). Core
  `vitest run src/programs/automation-studio/runtime` -> "Test Files 97 passed
  (97)", "Tests 884 passed (884)". This repository `pnpm check` -> exit 0;
  `test-runner` -> "# pass 940", "# fail 0"; `structure-audit` -> passed.
  The import rule was verified adversarially, not read: the exact cycle was
  reintroduced as a value import, the audit failed naming it, and it was
  reverted. Restoring the probe also revealed that `git checkout --` on that
  file had discarded the worker's comment edit; it was restored from a backup
  taken before the probe.
- Not verified: no live provider run and no browser. The user asked on
  2026-09-16 to stop for review before the real DeepSeek step, so that is a
  deliberate stop, not a blocker.
- Open, needs the user: the run budget's default of 2 provider calls leaves no
  allowance for an exploration, so a real recovery that explores would record
  `budget_exhausted`. The recommendation is an explicit exploration allowance
  rather than borrowing from the diagnosis/patch pair. Raised at the review gate
  because it changes what a live run costs.

### 2026-09-16 — The binding contract, two swallowed causes, and compaction
- Agent: supervisor (not delegated; four Core workers dispatched in parallel
  alongside this and still in flight at the time of writing)
- Changed: Core `AS/runtime/llm/harness-options/binding.ts`; downstream
  `domain/src/runtime/llm-evidence/tools.ts`,
  `packages/test-runner/src/secret-keys-ui.ts`,
  `scripts/setup-demo-llm-key.mjs`; this document and its new `archive/`
- Why: hunks 1 and 2 of `w2-3-bounded-exploration` are the contract every other
  pending diff depends on, so the supervisor kept them rather than serializing
  four workers behind one file. `deniedEvidenceKeys` was deliberately left
  optional here so that a single worker owns the breaking moment end to end
  rather than leaving Core red for the other three.
- Also: the two bare `catch` blocks `w2-live-provider` identified as the reason
  `pnpm demo:llm:setup` reports one uninformative sentence now carry the cause.
  The first attempt put the cause in the failure's message and broke the test
  "rejects secret-bearing or unsafe response metadata without echoing it" —
  which is a real property, not a stale assertion: that test pins the message to
  its exact constant so untrusted snapshot metadata can never reach it. The
  message is therefore fixed again and the redacted detail travels on `cause`
  and `details`, with `setup-demo-llm-key.mjs` walking the chain to surface it.
- Validation: supervisor-run. Core `npx tsc --noEmit -p packages/fluxiq` ->
  exit 0. Downstream `npx tsc --noEmit -p domain` and `-p packages/test-runner`
  -> exit 0. `node --check scripts/setup-demo-llm-key.mjs` -> ok.
  `pnpm --filter @fluxiq-web-extension/test-runner test` -> "# pass 940",
  "# fail 0" (939/1 before the message was pinned back).
  `node scripts/structure-audit.mjs` -> "passed (57 warning(s), 17 baselined)".
- Compaction: recording the four briefs took this document to 803 lines and the
  audit refused to baseline a compaction-threshold violation, which is the rule
  working as intended. Phase D's five approved fixes and the initial scoping
  briefs are settled, so both moved to
  `archive/settled-phase-d-and-initial-scoping.md`; 803 -> 707 lines.
- Not verified: nothing about the exploration actually running, which is the
  four workers' subject; and no live provider run — the user asked on
  2026-09-16 to stop for review before the real DeepSeek step, so that run is
  held deliberately rather than blocked.
