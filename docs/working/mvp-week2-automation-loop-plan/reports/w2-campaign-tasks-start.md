# w2-campaign-tasks-start — four campaign tasks that never started, and a pre-run failure that says what was missing

Worker report. Repository `F:\!FluxIQWebExtension`, branch `dev`, from commit
`5e583ef`. No commits made. No live provider run: every run below was
provider-free.

## Outcome

Partial.

- **The cause of all four "no-result" tasks is found, and it is one cause.**
  Each of the four scenarios declares replay secrets, and nothing supplied
  them, so the runner refused every run before its bundle existed. The
  campaign now supplies them from each scenario's own fixture.
- **The reason now reaches the log and the summary.** A refusal the runner
  itself wrote is carried on the message the command line prints, bounded and
  redacted, instead of the generic sentence. Tests came first and the old code
  failed them.
- **Two of the four reach the model now** (`auth-gate-account-summary`,
  `auth-gate-refuse-expired-session`), measured provider-free.
- **`sensitive-input-refuse-card-secrets` cannot be a repair task at all**, so
  I removed it from the catalog and recorded why. Its refusal happens while
  the Flow lane records, so no Flow ever exists for a model to repair.
- **`storefront-checkout-refuse-declined-card` is still blocked**, by two
  further defects in files another brief owns. Both are diagnosed, and the
  second was reproduced with the first one's fix applied to a throwaway copy.
  Exact diffs are below.
- **`member-directory-refuse-departed-member` is diagnosed**, and the finding
  is worse than a facility failure: the recorded Flow promoted a different
  member and reported success.

## 1. Why the four tasks produced no result

`runScenario` resolves a scenario's declared replay secrets before it creates
the evidence bundle (`run-scenario.ts:95`). On the Flow lane every secret the
scenario declares must be set; a created Flow needs the ones its workflow
types. Each value comes only from `FLUXIQ_TEST_SECRET_<ID>`
(`flow-lane/declared-secrets.ts:59-63`), and the declaration fails closed on
purpose: falling back to the recording is the very thing it prevents.

The campaign ran with `FLUXIQ_TEST_ENV_FILES=none`, and `.env.local` declares
no `FLUXIQ_TEST_SECRET_*` name at all (I read the variable names only, never a
value). So every run of a secret-declaring scenario was refused before a
bundle, which is exactly `runId: null`, `verdict: no-result`,
`failureCategory: environment.missing`.

Reproduced provider-free, before any change (the cause was invisible in the
log, so I read it from the thrown error's cause):

```
pnpm lab run auth-gate --variant expired --flow
  -> {"status":"failed","category":"environment.missing",
      "message":"Scenario attempt failed outside a finalized bundle"}
  cause: Scenario auth-gate declares the replay secret auth-gate-password,
         so FLUXIQ_TEST_SECRET_AUTH_GATE_PASSWORD must be set
storefront-checkout: ... so FLUXIQ_TEST_SECRET_STOREFRONT_CHECKOUT_PASSWORD must be set
sensitive-input:     ... so FLUXIQ_TEST_SECRET_SENSITIVE_INPUT_PASSWORD must be set
```

`sensitive-input-card-labels` ran in the campaign because a created Flow
resolves only the secrets its own workflow types, and that workflow types
none. The supervisor's candidate cause (`coordinator.ts:198`, the existing
target refusing isolated options) is **not** it: with no `FLUXIQ_TEST_TARGET`
set, the target is `isolated`, and that branch never runs. I changed nothing
in `coordinator.ts`.

**The fix.** The campaign now derives each task's secrets from the scenario's
own manifest: for every `secrets[]` declaration, the fixture value recorded on
the very step it names, in the primary script or a workflow's
(`lab-run/fixture-secrets.mjs`). They are passed to the Lab child, and every
`FLUXIQ_TEST_SECRET_*` the machine set is dropped first, so a run can never
pick up a value from this machine. A declaration the fixture cannot value is
left unset, so the Lab still refuses the run and names the variable.

A dry run now prints the names, never the values:

```
pnpm lab run auth-gate --variant expired --flow --live-llm ...
#   with FLUXIQ_TEST_SECRET_AUTH_GATE_PASSWORD from the auth-gate fixture
```

## 2. The reason now reaches the summary and the log

`ProjectedFacilityError` replaced every pre-bundle failure's message with one
generic sentence, and `cli.ts` prints only that message, so the real reason was
lost at the process boundary. The durable diagnostic was never the problem: it
is a closed vocabulary and stays exactly as it was.

Now, when the cause is a `RunnerFailure` — a message the runner itself wrote —
the printed message is the generic sentence plus that reason, on one line, at
most 240 characters, with credential-shaped text redacted by the evidence
rule and any long token that mixes letters and digits replaced. Any other
error keeps the generic sentence alone, because its text may be a library's or
a page's. Only the category and `facilityFailure` are ever persisted, and that
is unchanged.

A name like `FLUXIQ_TEST_SECRET_STOREFRONT_CHECKOUT_BILLING_CARD` is kept
whole: it has no digit, and it is the thing the reader needs. The campaign's
own `shortMessage` had the same 32-character rule and would have redacted it;
it now uses the same letters-and-digits test.

The summary row gained one more thing: a run that finished its bundle but
failed on the facility now carries that diagnostic in `runnerMessage`
(`http.timeout at control.request after 30000 ms (finalized-bundle,
scenario.execute)`), and the Markdown Failure column shows it.

Tests first, and they failed against the old code: the four new campaign tests
failed (67 of 71 passing), and the `ProjectedFacilityError` behaviour was
shown red by the reproduction above, where a `RunnerFailure` cause printed the
bare sentence.

## 3. What each task does now (all provider-free)

| Task | Where it gets to now |
| --- | --- |
| `auth-gate-account-summary` (create) | Reaches the build grant — the last step before the instruction goes to the model. `run-mu4zhnf8-adde7a9e`, stopped by the probe at `flow.361b5aef…`, `llm.calls 0`. |
| `auth-gate-refuse-expired-session` (repair) | Runs fully. `run-mu4zcr0x-14401456`, verdict **passed**: Flow built, typed the fixture password, signed in, and reported `auth_required / web.auth.required`, the declared failure a live run hands to recovery. The live-shaped probe reached the run grant (`run-mu4zhvus-1c308b6f`). |
| `storefront-checkout-refuse-declined-card` (repair) | Still blocked; see §4. |
| `sensitive-input-refuse-card-secrets` (repair) | Removed from the catalog; see §5. |

The "reaches the model" measurement is a probe, not a mock: the real
`LiveLlmRun`, planned from the campaign's own arguments, subclassed so that
its two grant authorizers throw instead of issuing a grant. It carries a
placeholder credential that is never sent, because `authorize()` is never
reached. The run therefore stops at the last step before the provider, and
the bundle records where. No key was read.

## 4. `storefront-checkout` — two more defects, in files I do not own

**(a) A 5-character expiry cannot satisfy an 8-character scan minimum.** The
run is refused before its bundle:

> Scenario storefront-checkout declares the secret
> storefront-checkout-card-expiry, but the step enter-card-expiry records no
> value of at least 8 characters for the redaction attestation to scan for

`scenario-redaction-literals.ts:42` refuses a declared value shorter than 8
characters, because a short literal makes the workspace scan report noise.
The fixture's expiry is `MM/YY`. The two rules are in direct conflict, and
this blocks **every** Flow-lane run of `storefront-checkout`, deterministic
ones included — this is not a live-only problem. (The same conflict is waiting
for any declared PIN or CVV; the rule's own test already pins a 4-digit PIN as
refused.)

Recommended fix, which keeps the security rule intact and changes one fixture
constant and one attribute (I verified the payment frame validates only that
the field is non-empty):

```diff
--- a/apps/scenario-lab/src/scenarios/storefront-checkout/manifest.ts
+++ b/apps/scenario-lab/src/scenarios/storefront-checkout/manifest.ts
@@ -8,7 +8,7 @@ export const syntheticCheckoutValues = {
-  cardExpiry: "12/34",
+  cardExpiry: "12 / 2034",
--- a/apps/scenario-lab/src/scenarios/storefront-checkout/payment-frame.ts
+++ b/apps/scenario-lab/src/scenarios/storefront-checkout/payment-frame.ts
@@ -39,1 +39,1 @@
-      <input id="card-expiry" data-testid="card-expiry" name="cc-exp" type="text" autocomplete="cc-exp" inputmode="numeric" maxlength="5" placeholder="MM/YY">
+      <input id="card-expiry" data-testid="card-expiry" name="cc-exp" type="text" autocomplete="cc-exp" inputmode="numeric" maxlength="9" placeholder="MM / YYYY">
```

Nothing else in the repository pins `12/34`, `MM/YY` or that `maxlength`.

**(b) With (a) applied, the run reaches Core and stops on the cookie banner.**
I applied that diff to a throwaway compiled copy of the scenario lab (an
ignored `.lab-instances` folder, since removed) and ran the task twice. Both
runs got past the redaction rule, the bundle, the topology and pairing, then
failed in the pre-recording Core action probe with `action.dispatch`
(`run-mu4zpi31-bcfcdcf1`, `run-mu4zpzpg-9074da89`):

> Core action did not succeed: failed: Action blocked: the point 439,360
> landed on div[data-testid="cookie-consent-scrim"], which covers the target;
> a modal dialog is open over the page, so a person has to answer it before
> the run can continue

Core is right; the probe chose a bad target. `proveCoreActionRoundTrip`
(`run-scenario.ts:632`) picks the first `type` step whose target is *visible*,
and Playwright's "visible" does not consider occlusion, so on a fixture whose
start page shows a consent overlay it always picks a covered field. Suggested
one-line fix, in a file the L-2 brief owns — a trial click runs Playwright's
full actionability check, including "receives events", without clicking:

```diff
--- a/packages/test-runner/src/run-scenario.ts
+++ b/packages/test-runner/src/run-scenario.ts
@@ -632,1 +632,3 @@
-  const choice = await selectCoreProbeStep(workflow.recordingScript, selector => page.locator(selector).first().waitFor({ state: "visible", timeout: PROBE_TARGET_VISIBLE_MS }).then(() => true, () => false));
+  // Visible is not enough: a consent overlay covers a visible field, and Core rightly refuses to type into it.
+  // A trial click runs the whole actionability check, including "receives events", and presses nothing.
+  const choice = await selectCoreProbeStep(workflow.recordingScript, selector => page.locator(selector).first().click({ trial: true, timeout: PROBE_TARGET_VISIBLE_MS }).then(() => true, () => false));
```

I did not apply or verify that diff: `run-scenario.ts` belongs to another
brief, and the instruction arrived while I was preparing to prove it on a
copy. Whether a further blocker waits behind it is unknown.

## 5. `sensitive-input-refuse-card-secrets` — corrected the task definition

Measured provider-free (`run-mu4zicud-5a23f269`): the Flow-lane run stops at
the first recording step, before any Flow exists:

> The extension refused to extract for step extract-cards-with-code
> (run_failed). The extract_list field "code" resolved to a sensitive control,
> so its value is never read.

That is the policy working. But a repair task needs a recorded Flow whose
*run* fails, so the model can be consulted on it; here the refusal happens
while recording, so there is no Flow, no failing run, and no consultation —
the task can never reach a model, in any campaign.

The recording-only lane of the same workflow passes (`run-mu4zhfxe-2a383245`),
because that lane reads the page itself rather than through the extension.
Worth noting separately: that read returned 3 records for a step whose whole
point is that it must be refused. It is recorded `status: not_expected`, so
nothing is judged on it, but the two lanes disagree about a policy refusal.
I did not investigate further; it is outside this brief.

So I removed the row from `LIVE_REPAIR_TASKS` and recorded it as an exclusion
with its reason in `tests/live-repair-tasks.test.ts`, which is what that test
requires of a deliberately failing row that is neither task kind. The
model-facing side of this fixture is already covered by the creation task
`sensitive-input-card-labels` ("Leave the unlock codes out entirely"), which
ran in the campaign. The repair catalog is now 13 tasks.

## 6. `member-directory-refuse-departed-member` — why, and a worse finding

**Why the campaign recorded `environment.missing` with `flowCreated false`.**
The live run's one request timed out. A live run cannot be given a run id
Core did not start, so `executeRecordedFlowRun` collapses start-then-run into
a single `run-runtime-session` request and learns the run id only from its
response (`flow-lane/persisted-flow-run.ts:226-245`). That request carries the
default 30-second HTTP bound. When it timed out there was no run id, so the
bounded-failure recovery had nothing to read back and the timeout stood —
hence no observation, `flowCreated false`, and the facility diagnostic
`http.timeout at control.request after 30000 ms`. The run's own record
confirms it: `snapshots/live-llm.json` says `settlement:
"run_not_identified"`. A deterministic run does not have this problem, because
it knows its run id from `startPersistedFlow` and recovers through
`awaitTerminalRunDetail`.

Why it exceeded 30 seconds: the Flow runs six actions on a 240-row directory,
and in my provider-free rerun they took 4651 + 4242 + 4171 + 4518 + 4393 +
4848 ms = **26.8 s** of action time alone, so any live overhead crosses the
bound. Suggested fix, in `flow-lane/` (another brief's file), is to stop
bounding a whole live run by a control call's default:

```diff
--- a/packages/test-runner/src/flow-lane/persisted-flow-run.ts
+++ b/packages/test-runner/src/flow-lane/persisted-flow-run.ts
@@
+/**
+ * A live run's single request carries the whole Flow and every provider call its
+ * recovery makes, and its run id comes back only when it ends, so a timeout leaves
+ * nothing to read back (`run-mu4y52hs-943d1c8d`). It gets the client's longest bound
+ * rather than a control call's 30 s default.
+ */
+const LIVE_RUN_REQUEST_TIMEOUT_MS = 300_000;
@@
     const result = await control.runPersistedFlow(input.llmExecution
-      ? { projectId: input.projectId, flowId: input.flowId, inputs, llmExecution: input.llmExecution, ...bounds }
+      ? { projectId: input.projectId, flowId: input.flowId, inputs, llmExecution: input.llmExecution, ...bounds, timeoutMs: Math.max(bounds.timeoutMs ?? 0, LIVE_RUN_REQUEST_TIMEOUT_MS) }
```

300 s is the HTTP client's own ceiling (`boundedTimeout`), so a longer live
recovery would need the second half of the fix: after a bounded timeout with
no run id, find the run through `listFlowRuns(projectId, flowId)` — the Flow
was just created and has exactly one — and then await its terminal detail,
which is what the deterministic path already does.

**The worse finding.** Fixing the timeout will not make this task reach the
model, because the Flow does not fail. Provider-free
(`run-mu4yrwgj-02fe85f7`), with the recorded member gone, all six actions
reported `succeeded`, the Flow reported **no** failure where the variant
declares `target_not_found`, and the fixture's own final-state check failed.
The failure screenshot shows why: the toast reads **"Priya Krause's role is
now Admin"**. The recorded member is Priya Hollis; with her row gone, the
recorded click landed on the next row and promoted a different member. Every
action's `targetResolution` is `unresolved_no_candidates`, yet each one
"succeeded" — the recorded target still matched something.

That is precisely the harm this refusal task exists to prevent, happening with
no model involved, so a live run cannot be consulted about it: recovery is
only invoked on a failure. This looks like the `xpathFor` id-anchor item
already queued in the plan's next steps (an identity that resolves
positionally rather than by the row's id). I did not confirm the recorded
selector itself — the isolated Core is gone with the run — so "positional" is
an inference from the outcome, not a read of the node.

Until that is fixed, the task correctly reports a failure rather than a
repair, and the campaign should read it as a product defect, not a facility
one.

## Files changed, and why each was needed

Campaign (owned by this brief):

- `scripts/lab/live-campaign/lab-run/fixture-secrets.mjs` **(new)** — derives
  `FLUXIQ_TEST_SECRET_<ID>` for a scenario from its own manifest. This is the
  fix for the four tasks.
- `scripts/lab/live-campaign/lab-run/environment.mjs` — the child environment
  takes those secrets and drops every one the machine set; refuses a fixture
  that tries to set anything else.
- `scripts/lab/live-campaign/lab-run/index.mjs` — barrel export.
- `scripts/lab/live-campaign/catalog.mjs` — loads the scenario manifests
  beside the task lists and returns `secretsFor(scenarioId)`.
- `scripts/lab/live-campaign/command-line.mjs` — passes `secretsFor` through;
  a dry run prints the variable names it will set, never values.
- `scripts/lab/live-campaign/runner.mjs` — each run gets its own scenario's
  secrets.
- `scripts/lab/live-campaign/row/facility-failure.mjs` **(new)** — renders a
  finished run's facility diagnostic as one line, from closed fields only.
- `scripts/lab/live-campaign/row/summarize-task.mjs` — carries that line in
  `runnerMessage`, and stops redacting identifier-shaped names.
- `scripts/lab/live-campaign/summary/markdown.mjs` — the Failure column shows
  the reason.
- Tests: `lab-run/tests/fixture-secrets.test.mjs` **(new)**,
  `tests/runner.test.mjs`, `tests/command-line.test.mjs`,
  `row/tests/summarize-task.test.mjs`.

Test runner — **`packages/test-runner/src/facility-failure/**` is not named in
my brief's "you own" list, and not in its "not yours" list either.** I edited
it because it is the only place the generic sentence exists, and step 2 of the
brief cannot be done anywhere else without changing `cli.ts`, which is held:

- `facility-failure/bounded-runner-message.ts` **(new)** — the bounded,
  redacted, single-line form of a runner-authored message.
- `facility-failure/projected-facility-error.ts` — carries that reason on the
  message the command line prints.
- `facility-failure/index.ts` — barrel export.
- `facility-failure/tests/bounded-runner-message.test.ts` **(new)** and
  `facility-failure/tests/projected-facility-error.test.ts` **(new)**.
- `run-evaluation/tests/runner-wiring.test.ts` — **one assertion**, which
  pinned the bare sentence for a runner-authored cause, now pins the sentence
  *and* its reason. Also outside both lists, and unavoidable: the old
  assertion contradicts the brief's step 2.

Scenario catalog (owned for these tasks):

- `apps/scenario-lab/src/scenarios/live-repair-tasks.ts` — removed
  `sensitive-input-refuse-card-secrets`.
- `apps/scenario-lab/src/scenarios/tests/live-repair-tasks.test.ts` — the
  exclusion and its reason, which that test requires for the removal.

I touched no file in `live-llm/`, `flow-lane/`, `run-scenario.ts`,
`commands.ts`, `cli.ts`, `coordinator.ts`, `product-catalog/`, the domain or
Core. Two throwaway copies I made under ignored `.lab-instances` folders
(`apps/scenario-lab/.lab-instances/wct-storefront`,
`packages/test-runner/.lab-instances/wct-runner`) are deleted.

## Commands run and observed results

All from `F:\!FluxIQWebExtension` at `5e583ef`, with
`FLUXIQ_TEST_ENV_FILES=none`, `FLUXIQ_CORE_ROOT=F:/fxlab/lab-core`,
`npm_config_workspace_concurrency=1`.

- `pnpm --filter @fluxiq-web-extension/test-runner test` -> `# tests 1118`,
  `# pass 1118`, `# fail 0`, exit 0. Includes all seven new tests and the
  reworded `runner-wiring` one (`ok 571`).
- `pnpm lab:test` (`node --test "scripts/lab/**/tests/*.test.mjs"`) ->
  `# tests 73`, `# pass 73`, `# fail 0`. Before the implementation the four
  new tests failed: `# tests 71`, `# pass 67`, `# fail 4`.
- `node scripts/structure-audit.mjs` -> `structure-audit: 1 violation(s)`,
  and the violation is another worker's **untracked** file,
  `domain/src/runtime/llm-evidence/tests/target-equivalence.test.ts`
  (`contract-spread`, line 214). No audit line names any file of mine. An
  earlier run of the same audit, before that file appeared, printed
  `structure-audit: passed (61 warning(s), 122 baselined)`.
- `apps/scenario-lab`: `pnpm build` exit 0, `node --test "dist/**/*.test.js"`
  -> `# tests 242`, `# pass 242`, `# fail 0`.
- `pnpm lab run auth-gate --variant expired --flow` (provider-free, with the
  campaign's environment) -> `run-mu4zcr0x-14401456`, **verdict passed**,
  reported `auth_required / web.auth.required`, actions `web.dom.type`,
  `web.dom.type`, `web.dom.click`.
- `pnpm lab run member-directory --variant member-left --flow`
  (provider-free) -> `run-mu4yrwgj-02fe85f7`, verdict failed,
  `runtime.behavior`, six actions all `succeeded`, `reportedVerdict passed`,
  oracle failed, screenshot shows the wrong member promoted.
- `pnpm lab run sensitive-input --workflow extract-card-secrets`
  (recording lane, provider-free) -> `run-mu4zhfxe-2a383245`, verdict passed.
- Provider-free probe (four tasks) -> results in §3, §4, §5.
- `node scripts/lab/live-campaign.mjs --dry-run --no-build ...` -> the secret
  names per task, `# 13 task(s)` for `--kind repair`, and
  `Unknown task id sensitive-input-refuse-card-secrets`.

## Not verified

- **No live provider run**, by instruction. That the two auth-gate tasks
  complete against DeepSeek is not shown; only that they reach the last step
  before the provider.
- **The `run-scenario.ts` probe diff in §4(b) is unverified** — proposed, not
  applied, not run.
- **The `persisted-flow-run.ts` timeout diff in §6 is unverified.**
- **Whether `storefront-checkout` reaches the model** once both of its
  blockers are fixed. Only the first blocker's fix was trialled, and it
  uncovered the second.
- **The `member-directory` recorded selector** was not read; "positional" is
  inferred from which member was promoted.
- The recording lane returning 3 records for a step the Flow lane refuses
  (§5) was observed once and not investigated.
- `pnpm check`, `pnpm test` and `pnpm build` at repository level were not run:
  other workers hold uncommitted changes in `flow-lane/`, `run-expectations/`
  and the domain, and one of them broke the shared `test-runner` build twice
  while I was running. I ran the narrowest suites that cover my files instead.
- Timings and single-run outcomes on this machine carry its known RAM fault as
  an error bar. No run above showed a RAM-fault signature.

## Open questions or contradictions found

1. **A short secret cannot be attested.** `MINIMUM_LITERAL_LENGTH = 8` and a
   `MM/YY` expiry (or a PIN, or a CVV) are irreconcilable as things stand, and
   the fixture change in §4(a) only sidesteps it for this one field. The
   alternative is to let the attestation record a declared-but-unscannable
   value as unattested rather than fail the run — a security-posture decision,
   not mine to take.
2. **A refusal that happens at record time has no place in the repair
   catalog.** I excluded the one row. If the loop is meant to test "the model
   must not find another way to read a secret", that needs a different shape:
   a Flow that can be built, whose *run* is refused.
3. **`member-directory` is a product defect the campaign was reporting as a
   facility one.** Both my changes and the two suggested diffs only make the
   defect legible; they do not fix it.
