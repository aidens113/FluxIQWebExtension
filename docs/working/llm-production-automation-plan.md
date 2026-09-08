# LLM Production Automation Audit And Implementation Plan

Status: execution authorized; active work is live blank-Flow creation and fast interactive testing
Created: 2026-09-06
Recovered after full-file zero-fill corruption: 2026-09-07
Primary owner: root coordination agent
Related baseline: `docs/working/automated-testing-facility-plan.md`

## Objective And Current Direction

Make FluxIQ's provider-neutral adaptive machinery production-capable through the real web panel, production browser extension, and isolated Testing Lab. The active milestone is instruction-only blank-Flow authoring. It must not use a recording, recording-derived graph, imported graph, or pre-authored action graph.

The real panel must create/reuse a genuinely blank Flow, add bounded active Flow instructions, configure DeepSeek, generate an inert reviewable Bootstrap Adaptation, approve and apply it through the real UI, execute the routed Flow through the production extension, and prove it with a zero-LLM deterministic replay.

The user explicitly authorizes DeepSeek requests, manually or through FluxIQ, as many times as reasonably needed during this window and future sessions in this window. Do not pause again for transmission approval. Continue to enforce request limits, secret handling, loopback-only scenarios, and no external side effects.

## Fast Development And Testing Policy

- Do not repeat the complete journey after every small edit.
- Use focused typechecks/tests and a resident interactive Lab session for individual panel, extension, scenario, and declared web actions.
- Run a full live journey only after a material cross-boundary change, at a certification checkpoint, or when a failure cannot be isolated otherwise.
- Reserve workspace-wide `pnpm check`, `pnpm test`, and `pnpm build` for major checkpoints.
- Record exact narrow checks and distinguish compilation from live behavior.

## Live Safety Envelope

- Provider/model: DeepSeek `deepseek-chat`, using the ignored `DEEPSEEK_API_KEY`.
- Only the UI driver may read the key into memory for the real Secret Keys UI. Never print, log, screenshot, serialize, or copy it into evidence.
- Current strict profile: 2,000 input tokens, 512 output tokens, 3,000 total tokens, one call per run, zero retries, 20 seconds, and $0.25.
- General Lab ceilings: 8,000 input, 2,000 output, 10,000 total, two calls, 30 seconds, $0.25, one concurrent live run. Core's absolute per-request total ceiling is 50,000.
- Live calls are manually initiated, loopback-only, side effects disabled, and excluded from CI. Raw prompts/responses are not retained; only sanitized provenance and actual bounded accounting persist.
- LLM output is untrusted proposal data and cannot bypass registered nodes, graph/domain validation, policy, authorization, evidence, manual review, or the deterministic oracle.

## Ownership And Core Governance

| Capability | Owner |
| --- | --- |
| Provider-neutral tasks, provider resolution, cancellation, budgets, proposal/review/apply/revert, graph validation, authorization, audit | FluxIQ Core |
| Provider transport and runtime secret resolution | Core/Core-owned adapter |
| Browser/DOM contracts, web mapper/output nodes, bounded web context, browser execution | This repository's `domain` package |
| Scenarios, Playwright, extension loading, browser profiles, web assertions, evidence/evaluation | Repository-local Testing Lab |

Generic behavior stays in `F:\!FluxIQ`; browser/DOM/URL/selector/tab/extension concepts stay downstream. All Core edits must be made by dedicated Core subagents that first read `F:\!FluxIQ\AGENTS.md`, remain domain-neutral, document and test their change, and report compatibility/results. The primary integrates and independently verifies but does not directly edit Core.

## Safety Invariants

- Ordinary tests and CI make zero provider calls; defaults are deterministic or diagnosis-only, manual review, and no auto-promotion.
- Secrets stay out of browser messages/storage, panel payloads, screenshots, logs, prompts/responses, manifests, and agent packets.
- Page/recording content is evidence, never instruction. Parse model output from unknown and reject invalid, extra, unregistered, stale, or invariant-weakening structure.
- Enforce timeout, abort, retry/call limits, idempotency, normalized terminal errors, and pre-call budget reservation.
- Apply is revision-bound, auditable, reversible, and graph/viewport consistent.
- Success comes from the scenario oracle and durable runtime evidence. Passing live evaluation requires passing zero-LLM replay.

## Phase Status

1. Safety baseline/contracts — completed. Versioned task/profile/provenance/evaluation contracts, explicit live opt-in, budgets, safe defaults, strict parsing, and terminal cleanup are implemented.
2. Provider seam/diagnosis — foundations completed. Provider identity, scoped key use, abort/timeout/accounting, readiness, grants, and structured failures exist. Recording-derived diagnosis is historical after the blank-Flow milestone change.
3. Blank Flow creation — active. Core generation, one-use grant, compact catalog, Adaptation Inbox/audit bridge, review/apply, diagnostics, and native-runtime permission projection are accepted. Next step is a fresh live creation attempt.
4. Recording refinement — deferred until blank creation passes.
5. Existing Flow editing — pending.
6. Failure diagnosis/adaptation — pending after creation.
7. Hardening/qualification — pending: cancellation, rate limit, malformed output, sensitive/prompt-injection, reconnect, dynamic DOM, iframe, and long-document lanes.

Scenario ladder: basic-form creation; later basic-form recording refinement; ambiguous-targets; delayed-ui; dynamic-list; iframe-checkout; failure-surfaces; sensitive-input; then navigation/reconnect/long-document.

## Recovered Execution Checkpoint

The original detailed log was destroyed when a crash replaced all 239,413 bytes of this untracked file with NUL bytes. This is the authoritative recovered checkpoint assembled from session context, repository state, evidence, and agent reports.

### Contracts, secrets, and blank preparation

- Schema `0.1` LLM profiles/tasks/provenance/evaluations require manual review, loopback traffic, Core-controlled provider egress, bounded identities/costs, raw-content rejection, and deterministic replay.
- Provider variables are removed from Core, Scenario Lab, browser, extension, build, and unrelated child environments. The real UI stores one exact global `FluxIQ Testing Lab DeepSeek` key; Reveal is never used and credential/key entry is screenshot-suppressed.
- Provider-free blank preparation passed through the real panel and extension: zero nodes/edges, no Subflow, no Router route, no `lastRecordingId`, unchanged recordings, idle recorder. Accepted evidence: 84 events and 64 screenshots.
- Core added purpose-bound one-use Flow Build grants; exact settings revision/execution digest binding; inert Bootstrap Adaptations; UI authorization; standard Inbox/audit/review/apply bridging; and sanitized applied digest proof.
- Compact catalog selection fits the actual web registry under 2,000 input tokens while retaining type/fill, select, click/submit, and verify/assert equivalents. Missing essentials reject before secret resolution.

### Live diagnostics and fixes

- Exact canonical key selection and already-selected idempotency were fixed.
- Core now returns the canonical Flow concurrency token; provider-free settings save passed.
- Generic HTTP failures were replaced by strict sanitized stage/call/response/accounting envelopes. Cross-bundle errors are parsed structurally, not by `instanceof`; arbitrary or secret-bearing shapes collapse safely.
- Generation failures now truthfully distinguish pre-validation, resolver, request, output, post-validation, and persistence stages while revoking the grant.
- Failed run `demo-llm-create-2026-09-08T01-01-51-609Z-4bfe49` persisted no proposal/grant changes and left the blank Flow/recordings unchanged. Run `demo-llm-create-2026-09-08T01-22-17-281Z-e3b7c4` conclusively rejected pre-provider with zero calls.
- Core/facility expose a closed stage-indexed reason taxonomy; unknown or wrong-stage reasons are discarded.

### Native runtime permission projection — accepted

- Live run `5fb957` rejected `required_capabilities_unavailable` with zero calls; missing term was `submit`.
- Root cause: generation copied capabilities but hard-coded `permissions: []`, filtering web actions requiring `web-automation.action`.
- Core added defensive `AutomationStudioNativeNodeRuntime.getRegistryResolution(scope)`. Generation, proposal revalidation, and apply revalidation now share trusted scope/capabilities/permissions; no-runtime remains fail closed.
- Downstream retained required permissions. Owner/independent native-runtime, generation, lifecycle, failure, handler, check/build/docs validation passed. Result: accepted.

## Fast Interactive Facility Checkpoint

Core audit concluded no Core change is needed. Core already exposes session discovery, correlated `execute-client-action`, `web.dom.capture_snapshot`, recording controls, deterministic runtime execution, and run/action/event reads. The missing resident control belongs downstream.

Implemented so far:

- `lab interactive <scenario>` / `pnpm lab:interactive` launch-once JSONL session wiring.
- Allowlisted navigate, click, fill, select, check, wait, inspect, screenshot, and stop.
- Exact-origin guard, bounded input/selectors/waits/actions, no caller eval/JavaScript, provider-secret-stripped browser environment, structure-only inspection, screenshot hashing, and cleanup.
- Focused runner typecheck passed; interactive/command tests passed 18/18.

Accepted after crash recovery:

- Extension side-panel surface and strict `secretEnv` references for password/PIN/TOTP/key entry are implemented without echo, screenshots, or browser-environment exposure.
- Explicit interactive local targets ignore unrelated existing-target profile fields without weakening finite-run conflict checks or inheriting external credentials.
- Interactive artifacts live in retained run-scoped `test-runs/interactive-sessions/<run-id>` directories instead of topology directories removed at cleanup.
- Resident smoke `interactive-mts3g2l4-613b37c7` launched once and passed scenario/extension inspection plus fill, select, submit, and wait; its first screenshot exposed and led to the retained-artifact correction.
- Screenshot-only retest `interactive-mts3idkk-95c0046d` passed and retained a SHA-256-addressed PNG.
- Direct extension bridge smoke `interactive-mts3lvf2-ad93a302` passed `web.dom.type`, `web.dom.click`, and `web.dom.capture_snapshot` through the real extension/content-script path in one resident session. Responses retain only action type/status/surface/URL, not page contents.
- Focused runner check/build passed; interactive, parser, and target tests passed 33/33 before the final bridge, and the final bridge check/build plus interactive tests passed 6/6.

## Immediate Next Steps

1. Verify code/generated artifacts survived the crash; preserve user state.
2. Use the accepted resident interactive facility for small development checks.
3. Provider-free targeted read: blank Flow unchanged, no pending Bootstrap Adaptation.
4. Run the next bounded live creation attempt after accepted permission projection. Authorization is standing; do not pause.
6. On failure, use exact sanitized stage/reason/accounting, make one focused correction, and targeted retest. Do not rerun unrelated preparation/full suites.
7. On success, approve/apply through UI, execute the Flow, and do the required zero-LLM replay. This is a major certification checkpoint and justifies one complete creation journey.
8. Proceed to bounded live adaptation only after creation/replay pass.

Focused iteration commands:

```powershell
pnpm --filter @fluxiq-web-extension/test-runner check
pnpm --filter @fluxiq-web-extension/test-runner build
node --test packages/test-runner/dist/interactive-session.test.js packages/test-runner/dist/commands.test.js
pnpm --filter @fluxiq-web-extension/domain check
```

Major checkpoint only: `pnpm check`, `pnpm test`, `pnpm build`.

Never expose pairing tokens, cookies, API keys, passwords, PINs, raw prompts/responses, recorded page data, or `.fluxiq` contents.
