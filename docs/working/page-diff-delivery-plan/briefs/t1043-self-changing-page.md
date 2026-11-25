# Brief t1043: a press is never credited with what the page changes by itself; Core never projects its own placeholder as page state

**Goal.** Fix at the cause a race that holds a right answer unconfirmed forever. It was found by t1041's Opus
retry (`docs/working/page-diff-delivery-plan/reports/t1041.md`, "Retry (Opus)"; on `dev` once t1041 merges).
- **What happened.** Run `run-mww6euuw-ecdb20f8` attempt 1 pressed "Accept all" on a cookie banner. The
  home-page carousel changed slides during the press (it rotates every 4 s). The press's answer listed the
  carousel's changed text lines as `how: "reads"`.
- **How it failed.** Each step below is a defect:
  1. Domain `node-run/press-effect/change/statement.ts:58` credits a changed text line to the press, even when
     the page changed it on its own.
  2. Core `answer-first/act-record/gate/read-answer.ts:81` treats any `reads` line as a lasting change.
  3. Core `act-record/seed.ts:70` carries the act into attempt 2.
  4. `run-attempt.ts:226` and `witnesses/witnesses.ts:127` build a before-side placeholder `{note: notHeld}`.
  5. `result-verification/judge-evidence/summary.ts:107` sends Core's own placeholder through the domain's
     judge-evidence projector (`domain judge-evidence/project.ts:107`), which cannot read it
     (`witnesses.before`, `evidence_unrecognized`).
  6. The judge's yes is held unconfirmed with no way out.
- **Why it matters.** This can hit any run on any site with a carousel, a ticker, a clock or a live region. The
  user's rule: a task ends only with its result or its budget.

**Do, at the cause, generally (no site, scenario or task named anywhere; AGENTS.md "Model guidance never
teaches to the test"):**
1. **Domain.** A press is credited only with changes it caused. Tell the page's own changes apart from the
   press's, using signals that are honest on any site:
   - the page's own markers for content that changes by itself (live regions, timers, carousels and slides by
     role or roledescription, `aria-live`, marquee);
   - and, within the run, the elements the run has already seen change with no act between two captures (stable
     handles make that identity reliable).

   A change on a self-changing element is still shown to the model as a page change, never as the press's
   effect or a lasting change. Never add a fixed wait or a timeout as the fix (user rule: never cap the symptom).
2. **Core.** Its own witness placeholder (`notHeld`, `takenAfter`) is Core's metadata, never page state. It
   must not go through the domain projector. A not-held before-side is reported to the judge in Core's own
   words, and the completion check does not hold a yes unconfirmed for want of a before-state that Core itself
   chose not to take. Keep W1's rule: a before-state is needed only after a lasting act this attempt made or
   declared.
3. **Tests.** Prove both causes, and the run-level effect, with a provider-free test:
   - a press during a self-change is credited only with its own effect;
   - a carried undeclared act whose before was not held never makes the judge evidence unreadable;
   - the judge's yes is then confirmed.

**Proof.** The race is timing-dependent, so prove the fix where the race can be forced. Add a unit or
integration test that changes a self-changing element during a press. Then run the scripted bigbox run
(`--attempts 4`, headed, with the watcher, Lab slot 4, `FLUXIQ_LAB_INSTANCE=t1043-lab`) three times. All
three must pass 4 of 4.

**Owned paths.** Domain `domain/src/runtime/llm-evidence/node-run/press-effect/**`,
`domain/src/runtime/llm-evidence/judge-evidence/**`, and the content-script change detection the press uses
if the signal must come from the page (`apps/extension/src/content/**` change or snapshot files only). Core
`framework/automation-service/service/answer-first/{witnesses,act-record}/**`,
`runtime/answer-first/act-record/**`, `runtime/result-verification/judge-evidence/**`. Plus the tests
beside each, and `docs/architecture/page-evidence.md`.
**Must not touch.** W3's files (Core `runtime/flow-authoring/**`, `runtime/llm/evidence-loop.ts`,
`loop-configuration.ts`, `evidence-loop-decision.ts`, `decision-handlers/amendment.ts`,
`draft-amendment-feedback/**`, `evidence-loop/held-amendments.ts`, `answer-first/completion/result-columns.ts`).
The scripted model. No git, no paid runs, no `node -e`.

**Checks.** Core (heavy gate): `pnpm --filter fluxiq check`; vitest groups (parallel, real-sql) over
`src/runtime/answer-first src/runtime/result-verification src/framework/automation-service/service/answer-first`;
Core audit; Core libraries build. Domain: `test-domain.mjs llm-evidence runtime/tests`; domain check;
`pnpm --filter @fluxiq-web-extension/extension test` if content files changed; downstream audit; model-text.

**Report.** `docs/working/page-diff-delivery-plan/reports/t1043.md`, ending with the return contract.
