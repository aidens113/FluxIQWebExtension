# Superseded plan sections

Moved out of the plan on 2026-09-12, when a handoff took it past the 800-line
compaction threshold. Each section was accurate when written and is superseded
now: the waves it sequenced have run; several estimates were later measured
(the week1 corpus at `--repeat 3` is 130-205 minutes headed, not 45); and the
Phase 1.1 and 1.6a narratives describe work that landed in Waves 1 and 2. The
plan's `Current State` carries what remains.

### Phase 1.1 — Consolidate the web domain

Steps 1–4 landed in Wave 1; the step plan is archived at
[archive/2026-09-11-phase-1-1-plan.md](./mvp-week1-web-automation-reliability-plan/archive/2026-09-11-phase-1-1-plan.md).
Landed: the content script's `actions.ts` and `action-runtime.ts` split
into directories (44 of 44 moved bodies identical); mapping fixes (scroll
key, top-level `domainId`, unknown types rejected with `ACTION_REJECTED`,
one input→output mapper that keeps fingerprints); recorder hygiene; one
safety registry; dead exports removed; legacy aliases and the looser
content types gone. Step 5 (capability matrix, `extension-client.md`) is
with w1-capability-docs.

Exit checks at Wave 1 integration: T1 tests for steps 2–4;
`content/actions.spec.ts` on `basic-form`; `lab run basic-form --target
isolated`; `pnpm check`, `pnpm test`, `pnpm build`; structure audit with
no new finding. The alias grep is already empty.

Core: none.

### Phase 1.6a — FluxBench foundation

Steps 1–3 and 5–7 landed in Wave 1; the step plan is archived at
[archive/2026-09-11-phase-1-6a-plan.md](./mvp-week1-web-automation-reliability-plan/archive/2026-09-11-phase-1-6a-plan.md).
Landed: the T2 content-script harness (`test:content`); the runner asserting
what manifests declare; the scenario contract's workflows, variants,
extraction, and expected failures; the evaluation and benchmark contracts;
`pnpm lab bench` with the `week1` and `smoke` corpora and report comparison;
the registry-derived test-matrix catalog; ten new fixtures (22 in all). Step
4, the provider-free Flow lane, is Wave 2 (`w2-flow-lane` in
[briefs/wave-2.md](./mvp-week1-web-automation-reliability-plan/briefs/wave-2.md)).

Proof so far: the Scenario Lab suite green with 22 fixtures; `test:content`
31 passed; `FLUXIQ_TEST_ENV_FILES=none pnpm lab bench --corpus smoke --repeat
2 --target isolated` 4/4 passed with `compare --halves` `equivalent`. Still to
prove: `pnpm lab run basic-form --flow --target isolated` (Wave 2).

Core: none.

## Sequencing

Seven working days; waves are partitioned by file so workers run in
parallel; serial steps are marked.

| Wave | Days | Work | Workers |
| --- | --- | --- | --- |
| 1 | 1–2 | 1.1 step 1 (serial, first); 1.1 steps 2–4; 1.6a steps 1–3, 5, 6; 1.6a fixtures (10) | ~16 |
| 2 | 2–4 | 1.6a step 4 (Flow lane); 1.2 steps 1–5 (per action file); 1.3 steps 1–2 (capture side) | ~12 |
| 3 | 4–5 | paired Core document and user alert first; 1.3 steps 3–6; 1.4 steps 1–7 (step 7 Core); 1.5 steps 1–2 (Core) — C1–C3 form one Core work unit | ~9 |
| 4 | 5–6 | 1.5 steps 3–5; corpus manifests finalised with expected categories | ~5 |
| 5 | 6–7 | 1.6b | supervisor + 1 |

Supervisor-owned throughout: registry/type-tuple edits that every fixture
touches, verification of every claim, ledger, pushes, the architecture
docs.

## Risks

- **Trusted-input emulation** may not satisfy some widgets; the corpus
  (W02, W03) decides whether `chrome.debugger` is reconsidered — post-MVP
  unless it blocks a category.
- **Core coordination**: one Core work unit spanning C1–C3 (Phase 1.4
  step 7, Phase 1.5 step 2) including a minor bump; both `dev` branches
  move together; downstream
  live checks require a rebuilt Core `dist`.
- **Headed-only lanes** on the Windows host make the corpus ~45 min per
  three repeats; the content harness is headless and carries most of the
  per-phase proof. Xvfb remains a CI verification item.
- **Hot-spot files** (`actions.ts`, `action-runtime.ts`, `connection.ts`,
  `web-state.ts`, `llm-evidence.ts`) are decomposed before parallel edits;
  `structure:check` guards the result.
- **Scope**: shadow-DOM addressing, real sites, CDP input, and Core's
  `builtin.policy.expectation` stub are recorded, not fixed, this week.
