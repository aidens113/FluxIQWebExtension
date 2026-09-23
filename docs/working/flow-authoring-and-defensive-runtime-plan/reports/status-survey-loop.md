# Status survey — the automation loop and the campaign that measures it

Worker: `status-survey-loop`, 2026-09-22. Read-only; no source or shared document
was edited. Sources: the `## Current State` and last two ledger entries of the six
named documents, plus targeted source checks in both repositories to test whether
the documents' code-level claims still hold on `dev` today.

**Headline.** Exactly one document in this set is backed by end-to-end live
evidence of the thing it claims (Week 1). The Week 2 loop's only honest live
measurement is E1 round 1 on 2026-09-21, and it says **not one
instruction-built Flow reached a passing deterministic replay**. Everything
since is unit-gate evidence or source-level repair. Separately, the Week 2 exit
plan's Current State is now materially stale: `dev` has moved through t081,
t082, t084, t087, t088 and t089 since it was written, and three of the four
code blockers its gap audit cites have been changed in Core source.

---

## week2-exit-plan.md (Active, updated 2026-09-21; last ledger 2026-09-22)

**1. Claimed done, and how backed.** Two kinds of claim. The 2026-09-22 entry
("The Week 2 Core batch landed in both repositories") is well evidenced but only
by gates, and the supervisor re-ran them rather than trusting the worker: Core
`pnpm check` passed, `pnpm -r --no-bail test` printed `Test Files 323 passed
(323)` / `Tests 2795 passed | 1 skipped (2796)`, `pnpm build` exit 0; downstream
gates exit 0 with `test-runner # pass 1280 # fail 0`; merges `c32d664`
(downstream) and `7952512` (Core, 25 commits). That is compilation-and-tests
evidence of an integration, not evidence that the loop works.
The live claim is E1 round 1 (all five lanes, ten sites, 2026-09-21) and it is a
negative result, stated plainly in the document: about **70 creation attempts
built one Flow** (lane B, everything-store, through the real panel) and **it
failed on replay (P17)**; provider-free recorded Flows passed **3 of about 35**
runs, all on `social-network-feed`; **no permission-request ending was ever
observed**; about $2.6 spent, no HTTP 429s, `build.providerCalls ==
observed.calls` in every build. Reports `reports/w2x-e2e-lane-{a..e}.md`.

**2. Left, concretely.** E2 (the same campaign on the fuller product); the five
tasks cut off mid-flight on 2026-09-21 with uncommitted worktree work — P20
(t071), N1 (t072), P13a (t066, worker reported Partial, four of six proven),
P22 (t074), P23 (t073); the t033 re-merge; t029 (JavaScript node) held on three
review findings; the `week2` corpus, which does not exist; the 2.9 adaptation
metrics, all `null`; the 2.5 exploration reduction, computed and discarded; the
2.6 replay recorder, with no caller; the Lab approve/apply/replay lane, wired
only to recorded Flows; and three journeys with no product UI at all (improving
an existing Flow — the authoring panel refuses non-blank Flows,
`blank-flow-authoring-model.ts:98-104`; a permission request from a run or
repair; a structural repair diff).

**3. Blocked.** The document says "Blockers: none", and that is fair: further
live measurement is **paused by the user's own direction on 2026-09-22** behind
`flow-authoring-and-defensive-runtime-plan.md`, with E2 to run after that plan's
workstreams A and B. Nothing is blocked on a third party.

**Staleness, important.** The Current State was written 2026-09-21 and describes
t027 landing and fourteen fix workers. Since then `dev` carries t081
(`d3be870`), t088 (`674aeb5`), t087 (`bea6e93`) and t089 (`58286ad`) downstream
plus the matching Core merges, ending at `6b16e1e` "Record the wave that made the
ladder recover and the gate ask". Treat its gap audit as a snapshot of
2026-09-21, not of today.

---

## mvp-week2-automation-loop-plan.md (Active, updated 2026-09-20)

**1. Claimed done, and how backed.** Mixed, and the document is careful about
which is which. Genuinely live with an id: `run-muabdpmu-6c1f639d` returned in
160,663 ms, 9 actions, 3 creation calls, 0 recovery calls, persisted
`resultVerification: "no_result"`. t027's real-panel instruction run completed a
**4/4 oracle**, recording survived a full Core/browser restart and replayed with
zero LLM activity, picker-to-dataset produced 8 rows with exact oracle and
non-empty CSV/JSON, and a clean 4-action run went from 14.774 s to 8.165 s
(**-44.7%**). t025 and t026 are **Chromium content-harness runs with scripted
provider decisions** (`live-state-digest.spec.ts` and
`field-entry-target-stability.spec.ts`, each "1 passed"), so they prove the
browser path, not the model. The repair claim is the weak one and the document
says so: the real provider repair run "made two calls: diagnosis followed by
evidence exploration, **not a patch call**; diagnosis marked the run unachievable
and patch unnecessary", and a later attempt "stopped before dispatch because the
preserved workspace has zero applied bootstrap adaptations".

**2. Left, concretely.** Its own numbered list of ten: a fresh current-t027
workspace plus one bounded repair seeking proposal/apply/restart/reuse; the
result check that disagrees with itself at temperature 0; repair-as-revised-Flow
with a diff shown to the person (designed, not built); the recovery path not
receiving the permitted set; a side-effecting repair dropped rather than escalated
(`recovery/annotation/patches.ts:142`); 85.5 MiB session stores; the constant
`targetResolution: unresolved_no_candidates` fed to the repair model as
`failed_target`; all-optional extract fields disarming the required-field check;
a structure-audit rule; and the t021 batching follow-ups. Explicitly **not
started: 2.9, X6, and the third entry point (improving an existing Flow)**.

**3. Blocked.** "Blockers: none." One question stays open and is unrelated:
whether an excluded dataset column means never stored or only absent from the
dataset and export.

---

## llm-production-automation-plan.md (Active, updated 2026-09-10 — the oldest here)

**1. Claimed done, and how backed.** This one carries the best-cited live run
ids in the set, and they are twelve days old. The first runtime adaptation was
certified 2026-09-09: run `5be70f05-3849-4bb9-87b5-800aad3cb525`, exactly two
DeepSeek calls, 3,328 tokens, about $0.00181544, proposing
`[data-testid="instruction-name-adapted"]`, **manually applied**, with validation
run `80414559-fd2b-4b8f-bb92-f4b66e0b5068` executing all six actions at zero
provider calls. Parameterized `basic-form`: one call, 5,764 tokens, applied
`adaptation.bootstrap.2bc9525d-...`, provider-free run
`ada55134-c470-4e25-a36d-d78667801743` passed the registered oracle. Real, but it
is a single-node selector patch on a fixture with a human in the apply step —
not the automatic, full-context repair the product now requires.

**2. Left, concretely.** Reusable sanitized evidence is built but unusable in
production: no key custody / content-protection provider injection downstream, no
harness caller populating `relevantRuns`/`relevantAdaptations` or a
`reusableContext` packet; sequence steps 3 (retrieval population), 4 (creation
integration), 5 (adaptation integration) and 6 (UI rollout) all remain; the
token-efficiency benchmark and the Focused Validation Plan's tests are not
reported as run. Phase 4 deferred, Phase 5 (existing Flow editing) pending, all
eight Phase 7 hardening lanes pending, and the scenario ladder beyond
`basic-form` not started.

**3. Blocked.** "None recorded as open." Reuse is *gated*, not blocked, on
approved project key custody through Core's protection boundary plus the
downstream evidence-to-selection callback. Practically, this document is
background: its active phase is not on the Week 2 exit path, and it predates the
whole Week 2 architecture.

---

## mvp-week1-web-automation-reliability-plan.md (Complete — confirmed)

**1. The Complete status holds, and it is the only document here whose central
claim is backed by a measured, repeated campaign.** Acceptance is the
production-Core confirmation pair A `bench-mu2i36f9-ea262b66` and B
`bench-mu2i36jy-ddf2e39f`, both pinned at downstream `118aeb7` / Core `54ae663`:
each ran 189 evaluated plus 12 skipped, **180 passed and 9 failed, all ruled-out
variants**, no startup or facility failure. The official comparison
(`cf-prod-final-comparison`) printed `compare exit=0`, `comparisonPassed: true`,
identical topology, **0 differing results and 0 differing runs**, 23/23 tolerance
metrics equivalent, persistence discards 0. All six exit criteria have named
evidence: recording unarmed 18/18 and Flow unarmed 16/16; evidence packets p95
5,934 B with max under 6,000 and 0 redaction findings; deterministic fallback
5/5 without the harness; required failure classes 15/15; 0 outside tolerance at
repeat count 3; blockers ranked in `cb-blocker-ranking-final`.

**2. Left.** Seven follow-ups, explicitly not Week 1 blockers: a closed failure
stage for the TCP gateway wait; tolerating a byte-identical writer temporary at
merge; the duplicate-create `EEXIST` path; retuning the slot gate's 3 GiB per
cell; `isrFlushToDisk: false` and pruning failed builds; `workspace-lock.ts`
writing its owner before linking; and never deleting a runs root with a tool
that follows junctions.

**3. Blocked.** None. **The caveat that matters for Week 2:** Week 1 proves
*recorded and deterministic* web-automation reliability and bench repeatability.
It says nothing about model-authored Flows, so none of its evidence carries over
to the nine exit stages.

---

## bootstrap-no-proposal-investigation.md (Active, updated 2026-09-20)

**1. Claimed done, and how backed.** Live and specific: one identical rerun after
the read-once sanitizer fix reported `flow_bootstrap.permission_required` with one
provider invocation, three decisions and tool calls, two successful evidence
actions, 2,087 evidence bytes and **zero proposals**; a later fresh
panel/extension/provider run persisted **exactly one durable proposed, unapplied
adaptation** after one provider call and one evidence action, in isolated bundle
`demo-llm-explore-2026-09-21T03-39-51-674Z-b87d9c`, with no auto-apply. Focused
tests 8/8 and panel focused 25/25 back the permission-dialog work.

**2. Left.** The document names its own gap honestly: "that provider response did
not request permission, so the dialog's Cancel/reopen/exact-grant behaviour
remains **proven provider-free rather than by a provider-triggered browser
journey**", and its follow-up is to retain that as an explicit live-coverage gap.
That matches E1's finding that no permission-request ending was ever observed.

**3. Blocked.** Its stated blocker — "t027 contains the earlier default-16
multi-action implementation; it must not reach `dev` ahead of t033's live proof"
— is **stale**; see the disagreement below. Existing-store adoption still needs
explicit user approval and was never part of this task.

---

## manual-panel-test-findings.md (Active, updated 2026-09-20)

**Open and unfixed.** PANEL-001 (login HTTP 500 without an importer root) is
Closed. **PANEL-002** (project creation refused: "Program document transactions
require FluxIQ storage layout v2") is *In progress*: the implementation is
complete and on both pushed `dev` branches with an offline adoption command
proven by byte-identical database hashes, but **the user's own marker-less root
is still unmigrated** and needs an approved panel stop, a verified private
backup, adoption, a hash check and a restart. **PANEL-003** (every form triggers
username/password autofill) is *Ready for retest*: fixed on t027 with 7/7 focused
controls, but the retest must happen **in the user's saved-password browser
profile** and has not. No finding has been added since 2026-09-20, so nothing here
reflects the current build.

---

## What stands between today and the Week 2 exit criteria

Judged only on what these six documents record, plus source checks on today's
`dev`. The exit bar is one chain on
`identity-drift-rename-redesigned-after-creation`, judged by oracle and by
`build.providerCalls == observed.calls`, then the same chain through the real
panel, then the third entry point, then the corpus with 2.9 metrics populated.

**Proven live (3 of 9), but only on the isolated target that deletes the Flow:**
- **Fail** — E1 proved it in abundance; the one created Flow failed replay (P17).
- **Diagnose** — live on a created Flow (`w2x-exit-loop-gap-audit`); also the
  2026-09-09 run `5be70f05`.
- **Explore** — live on a created Flow; plus t025/t026 in the content harness and
  the bootstrap run's two evidence actions.

**Built but unproven (4 of 9):**
- **Generate Repair** — has live evidence per the gap audit, but the only recorded
  end-to-end provider repair produced *no patch*; no document here records a
  model-written repair generated, validated and applied on a created Flow.
- **Recover** and **Resume** — the 2026-09-21 audit said both were *impossible* in
  production Core. That is no longer true of the source: `service.ts:2686` now
  forces only `adaptiveMode: "manual_approval"` and drops
  `authorizedExternalSideEffects: false` for a grant that may act
  (`runtime-session-grant.ts:66-68`: `diagnose_and_adapt`, `explore_and_adapt`);
  `service.ts:2723-2727` keeps a granted run's authorized domains; and
  `service.ts:2834-2841` comments "A verified repair resumes a granted run too",
  which is exactly the audited defect. `live-patch.ts` now lets
  `sideEffectPermission === "permitted"` bypass the policy flag. So the code
  blockers are closed; **no document I read records a live run proving it.** The
  newest downstream commit is `6b16e1e` "Record the wave that made the ladder
  recover and the gate ask", so that evidence, if it exists, is in the plan the
  supervisor holds.
- **Validate** — the 2.5 deterministic patch gate is landed; no run id anywhere
  shows an adaptation reaching `validated` on a created Flow.

**Effectively absent (2 of 9, plus the UI and the measurement):**
- **Persist** — proven for a *bootstrap proposal* (bundle `...b87d9c`) and for a
  2026-09-09 manual apply, never for a model-written repair of a created Flow;
  the Lab's approve/apply/replay lane is wired only to recorded Flows.
- **Re-run deterministically** — solid for recorded Flows (zero-LLM replay across
  a full restart, 4/4 oracle, and all of Week 1's bench). **Never once achieved
  for an instruction-built Flow.** This is the single hardest line on the page.
- **Through the real panel:** there is no `ui:e2e` script — `package.json` has
  only `panel:golden` (line 55), which covers t027 only, declares five of twelve
  stages `unverified` in code, and has **0 of 9 passes on its repair stage**.
  Exit criterion 2 therefore has no command to run.
- **The measurement:** no `week2` corpus (a grep for `week2` under
  `packages/test-contracts/src` matches only `bench-report-validation.ts` and
  `evaluation-validation.ts`), and the 2.9 metrics are `null`. The last full
  corpus, 2026-09-18, passed **4 of 36** by oracle and predates t010-t027.
- **Third entry point (improving an existing Flow):** not started; the authoring
  panel still refuses non-blank Flows.

**So, in one sentence:** the loop's front half is live-proven, its back half is
built and — as of the last thing anyone measured — unproven, and the product has
never once turned an instruction into a Flow that replays deterministically.

---

## Where the documents disagree

- **t027 and t033.** `bootstrap-no-proposal-investigation.md` (2026-09-20) and
  `mvp-week2-automation-loop-plan.md` (2026-09-20) say t027 is in progress and
  must not reach `dev` before t033's live proof; `week2-exit-plan.md`
  (2026-09-21) says t027 landed with the batch surface removed and t033's A/B
  passed. **The exit plan is more recent**, and git confirms the landings.
- **Recover/Resume.** The exit plan's gap audit (2026-09-21) says they cannot
  happen in production Core for any model-written repair, citing four file:line
  sites; `mvp-week2-automation-loop-plan.md` (2026-09-18 entry) claims
  "created-Flow repair" landed. Neither matches today's Core source, where three
  of the four cited sites have been deliberately rewritten. **The source is the
  most recent artifact**; I have not resolved which document is right about the
  live behaviour, and I ran nothing.
- **Repair era.** `llm-production-automation-plan.md` certifies a *manually
  applied* adaptation as the product's repair lane; the later documents require
  repair to be automatic and fully contexted. Not a factual conflict — the older
  document is superseded — but its "Active" status overstates its currency.
