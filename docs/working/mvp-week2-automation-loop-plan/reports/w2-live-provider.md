# w2-live-provider — the Testing Lab runs against the real DeepSeek provider

## Outcome

Done. `pnpm lab run ... --live-llm` now reaches the real DeepSeek API. A run
was executed end to end and its `evaluation.json` records `"llm": {"mode":
"live", "profileId": "lab-diagnose", "calls": 1}` with verdict `passed`. The
API key does not appear anywhere in the run directory, verified two ways.

The verified command and run:

```
FLUXIQ_TEST_ENV_FILES=none pnpm lab run identity-drift --variant save-and-exit --flow \
  --live-llm --llm-profile lab-diagnose --llm-provider deepseek --llm-model deepseek-chat \
  --llm-task diagnose --llm-max-calls 1 --llm-max-cost-usd 0.25
```

Run id `run-mu3we5jm-38461449`, exit code 0, in
`F:\!FluxIQWebExtension\test-runs\run-mu3we5jm-38461449`.

I used `identity-drift --variant save-and-exit` rather than the `data-table
--variant column-reorder` in the brief. `column-reorder` is a variant the Flow
is expected to **pass** — extraction by header survives the reorder — so it
produces no failed action, and a `diagnose` task has nothing to diagnose: that
command could only ever have reported zero provider calls. `identity-drift
--variant save-and-exit` is the deterministic negative variant (Save is gone
and a decoy stands in its slot; expected failure `target_not_found` /
`web.target.not_found`), which is what a live diagnosis needs.

## What changed and why

### 1. The path was never wired, so it was built

`packages/test-runner/src/cli.ts:85` threw whenever `command.llm?.mode ===
"live"`, and the `runScenario(...)` call one line below never received
`command.llm`. Both are gone; the parsed profile is now carried through, and
the fail-closed guard is replaced by three real refusals (below).

New module `packages/test-runner/src/live-llm/`, which owns everything between
a parsed `--live-llm` command line and an attested provider call:

| File | What it owns |
| --- | --- |
| `live-llm-plan.ts` | Reconciles the Lab's budget vocabulary with Core's, downward only |
| `provider-credential.ts` | Where the key comes from, and the refusal when it is absent |
| `secret-key.ts` | Installs/reuses the encrypted Secret Key in the run's own Core |
| `flow-settings.ts` | Pins the generated Flow to the provider, key and limits |
| `execution-grant.ts` | Preflights and takes out Core's one-use execution grant |
| `authorize-flow.ts` | The three above, in the only order that works |
| `observed-usage.ts` | What the run actually spent, read back from Core |
| `budget.ts` | Holds the run to its caps; fails a run that reached no provider |
| `live-llm-run.ts` | The facade the runner sees: begin, authorize, settle |

Threading, in the order a run meets it:

- `cli.ts` — `beginLiveLlmRun(...)` before the run starts, so a bad profile or a
  missing key is a message an operator can read rather than a sanitized
  facility failure from inside a run that had already launched a browser.
- `run-scenario.ts` — takes `live?: LiveLlmRun`, adds its credential to the
  redaction literals, hands the Flow lane an authorizer, and settles the
  accounting after the Flow run.
- `flow-lane/run-flow-lane.ts` — optional `authorizeLiveLlm(flowId)`, called
  after the Flow is approved and immediately before it runs (Core binds the
  grant to that Flow's settings revision and expires it within the minute).
- `flow-lane/persisted-flow-run.ts` — a live run creates its own session.
  Core **refuses** an explicit-LLM run that carries a pre-started run id, an
  authorized domain, or an idempotency key, so the deterministic lane's
  start-then-run collapses into one call and the run id comes back from it.
- `existing-fluxiq-control.ts` — `runPersistedFlow` sends `adaptiveMode:
  "manual_approval"`, `runIntent` and `llmExecutionGrantId`; new
  `secretKeysCall`; `getRunDetail` now also reads `metadata.llmGate` and its
  `costAccounting`.
- `run-evaluation/*` — `RunEvaluation.llm` is no longer hard-coded to
  `{disabled, null, 0}`; it carries what the run observed.

### 2. Two real defects found and fixed along the way

**a. The grant was refused with a bare 400 on a perfectly configured Flow.**
A FluxIQ session carries a Secret Keys *unlock* computed at login, over the
keys that existed then (`apps/web/src/app/api/auth/login/route.ts` →
`secretKeys.unlockSession`). `createKey` does not add the new key to live
session unlocks, and `createSessionRevealAuthorization` throws "Secret key
session unlock is unavailable" for a key the session cannot decrypt. So a
session that had just installed a key could never take out a grant against it.
Fixed in this repository, not Core: `FluxIQControlClient.reauthenticate()`
replaces the session, and `authorizeFlowLiveLlmExecution` calls it when — and
only when — it installed the key itself.

**b. The settings read-back believed the wrong response.**
`update-flow-settings` answers with a SQL projection
(`getFlowMetadataDetail`), whose `settings.llm` shape differs from the
canonical Flow's `metadata`, and which is `null` when the project has no
database pool. The verification now reads the canonical Flow back through
`get-flow` instead, so "did Core store these exact limits" does not depend on
something unrelated to whether it did.

### 3. The key, under isolation (brief item 2)

`FLUXIQ_TEST_ENV_FILES=none` is the documented way to keep a machine's saved
existing-install configuration out of an isolated run, and it dropped
`DEEPSEEK_API_KEY` with it. The two are not actually in conflict: what must
stay out is the *target configuration*, not the credential.
`provider-credential.ts` therefore reads the process environment first, and
otherwise takes **exactly one name** — `DEEPSEEK_API_KEY` — out of `.env` /
`.env.local`, whatever `FLUXIQ_TEST_ENV_FILES` says, and only when
`--live-llm` was given. Every other assignment in those files is discarded.
The verified run above used `FLUXIQ_TEST_ENV_FILES=none` and the run's
`snapshots/live-llm.json` records `credentialSource: {name:
"DEEPSEEK_API_KEY", from: ".env.local"}`.

The credential still never reaches a child process: `withoutProviderSecrets`
already strips it from Core's and the scenario lab's environment, and it is
unchanged. The key travels once, over loopback, into Core's encrypted Secret
Keys store; everything downstream carries only the opaque key id.

### 4. The budgets are now enforced (brief item 3)

Three layers, all live:

1. **Pushed down.** The plan's limits are written into the Flow's
   `llmExecutionSettings` and into the preflight/grant request, so Core
   enforces them and counts the grant's uses down.
2. **Checked on the way in.** `execution-grant.ts` refuses a grant Core issued
   for more calls, more cost per call, more total cost, or a longer timeout
   than this run asked for.
3. **Checked after the fact.** `budget.ts` judges the run against the
   operator's own `--llm-max-*` numbers using Core's per-run accounting
   (`metadata.llmGate.costAccounting`: calls, input/output/total tokens,
   estimated cost, and Core's own `budgetBreaches` counter). Any breach fails
   the run as `performance.budget`, before the lane's expectations are judged.

`live-llm-plan.ts` only ever clamps **downward**: Core's ceilings are 25s
timeout, 0.25 USD, 50k tokens, and `diagnosis_only` is exactly one call. A cap
the operator typed can bind harder, never less, and a profile that cannot run
inside its own stated bounds is refused with a message naming the option
(`--llm-max-calls 1 cannot authorize the 2 provider call(s) --llm-task adapt
requires`).

### 5. Fail closed (brief item 4)

- No credential → `Live LLM execution needs a provider credential:
  DEEPSEEK_API_KEY is not set in the environment and no .env or .env.local in
  <root> declares it`. Before a topology starts.
- No `--flow` → refused: the Flow lane is what builds the Flow a provider is
  authorized against.
- `--target existing`/`clone` → refused: a live run needs a Core the runner owns.
- Unexecutable budget (e.g. `--llm-max-cost-usd 0`) → refused before the key is
  even read.
- **Zero provider calls → the run fails.** `assertLiveLlmProviderWasReached`
  fails a `--live-llm` run that Core completed without reaching the model,
  quoting Core's own `llmGate` reason and code. This is the anti-fake-pass
  guard: a deterministic green result can no longer wear a live run's clothes.

## Commands run and observed results

**The live run** (fifth attempt; the first three failures are explained below):

```
FLUXIQ_TEST_ENV_FILES=none pnpm lab run identity-drift --variant save-and-exit --flow \
  --live-llm --llm-profile lab-diagnose --llm-provider deepseek --llm-model deepseek-chat \
  --llm-task diagnose --llm-max-calls 1 --llm-max-cost-usd 0.25
-> exit 0
```

`test-runs/run-mu3we5jm-38461449/evaluation.json`, verbatim excerpt:

```json
"verdict": "passed",
"lane": "flow",
"flowCreated": true,
"oracleVerdict": "passed",
"reportedVerdict": "failed",
"automationFailureReported": {"category":"target_not_found","code":"web.target.not_found"},
"automationFailureExpected": {"category":"target_not_found","code":"web.target.not_found"},
"harnessActivations": 2,
"llm": {"mode": "live", "profileId": "lab-diagnose", "calls": 1}
```

`test-runs/run-mu3we5jm-38461449/snapshots/live-llm.json`, `observed` block:

```json
{
  "calls": 1,
  "interventions": 2,
  "observedCalls": [
    {"provider": null, "model": null, "promptVersion": null, "validationOk": false,
     "inputTokens": null, "outputTokens": null, "totalTokens": null, "estimatedCostUsd": null},
    {"provider": "deepseek", "model": "deepseek-chat",
     "promptVersion": "automation-studio.runtime-diagnosis.v1+stage.gather",
     "validationOk": false, "inputTokens": null, "outputTokens": null,
     "totalTokens": null, "estimatedCostUsd": null}
  ],
  "totalEstimatedCostUsd": 0.25,
  "accounting": {"calls": 1, "inputTokens": 8000, "outputTokens": 2000, "totalTokens": 10000,
                 "estimatedCostUsd": 0.25, "budgetBreaches": 0, "pendingCalls": 0},
  "gate": {"invoked": true}
}
```

Read honestly: **the provider was reached** — Core's own gate says `invoked:
true`, its accounting says one call, and the intervention carries
`deepseek`/`deepseek-chat` with a real prompt version. Two caveats worth the
supervisor's attention, neither a defect in this wiring:

- `validationOk: false` on both interventions, and `promptVersion` ends
  `+stage.gather`. The model asked to gather more evidence, which needs a
  second call; `--llm-task diagnose` authorizes exactly one
  (`diagnosis_only`), so the staged diagnosis could not complete. A complete
  diagnosis needs `--llm-task adapt` (two calls, `diagnose_and_adapt`), which
  I did not spend money on. The run is a real call, not a completed diagnosis.
- The accounting reports 8000/2000/10000 tokens and 0.25 USD. Those are Core's
  **reservation**, charged at the cap because the provider did not report
  usage on this response, not a measurement of real spend. Actual DeepSeek
  cost for one 10k-token-budget call is a fraction of a cent. The budget check
  passes at exactly the cap (0.25 is not greater than 0.25), which is correct;
  but a supervisor reading the number should know it is a ceiling, not a bill.

**Secret leak verification (brief's redaction requirement).** Two independent
checks, both on the run directory:

1. Core/the runner's own attestation,
   `test-runs/run-mu3we5jm-38461449/snapshots/redaction-attestation.json`:
   `{"status": "passed", "literalCount": 1, "findingCount": 0, "findings": []}`
   over two scopes — `bundle` (6 files, 13,904 bytes, 3 binary files skipped)
   and `workspace` (30 files, 2,051,695 bytes). `literalCount: 1` is the
   DeepSeek key: this run added it to the scanned literals, which is the change
   that makes the attestation cover it at all.
2. My own scan, independent of that code: a Python walk of every file in
   `test-runs/run-mu3we5jm-38461449`, reading each as **bytes** and searching
   for the key in UTF-8 and UTF-16LE. `files scanned: 19, bytes: 134741, hits:
   NONE`. All 19 files, including the three PNG screenshots, `logs/core.log`,
   `events.ndjson`, `evaluation.json`, `report.html` and every snapshot, were
   read — none skipped.
3. Belt and braces: the same byte scan over the whole `test-runs` tree —
   328,228 files, 12,343,246,693 bytes — found **0 UTF-8 and 0 UTF-16
   literal hits**. 6,120 files could not be read because a concurrent run
   deleted them mid-walk; all were transient artifacts under the shared
   `.core-web-build/` Next.js cache, none in a run bundle.

The key was never printed, echoed or written to a scratch file during any of
this; the scan script read it from `.env.local` into memory and printed only
its length.

**Gates:**

```
node scripts/structure-audit.mjs   -> structure-audit: passed (57 warning(s), 17 baselined)
pnpm check                         -> exit 0 (structure tests, lab tests, audit, and every package's tsc)
pnpm --filter @fluxiq-web-extension/test-runner test
                                   -> exit 0; # tests 940 # pass 940 # fail 0
```

A final audit run, minutes later, reported **2 violations that are not mine**:

```
FAIL [contract-spread] domain/src/runtime/llm-evidence/harness-options/execute.ts: 1 property spread ... at line 140
FAIL [contract-spread] domain/src/runtime/llm-evidence/harness-options/tests/options.test.ts: 1 property spread ... at line 179
```

`domain/src/runtime/llm-evidence/harness-options/` did not exist when the audit
passed above; its files were written at 02:11-02:15 while I was working, by
another worker. Nothing under `packages/test-runner/` is flagged. Flagging it
here so it is not mistaken for fallout from this change.

`pnpm build` was not run as a separate command; `pnpm lab` builds scenario-lab,
the e2e extension, domain, test-contracts, test-evidence and test-runner before
every run, and did so five times.

**The three failed attempts before the green one**, because they are the
evidence for the two fixes:

1. `run-mu3w24qg-1885de08` — `Core web panel production build did not succeed`,
   `logs/core-web-build.log` ends `[exit] code=3221225477` after
   `✓ Compiled successfully`. That is a Windows access violation, the known
   signature of this machine's faulty RAM. Not investigated further; it retried
   clean.
2. `run-mu3w426c-ab5afe98` — `Live LLM Flow settings refused: Core returned no
   Flow metadata after the settings save`. Fix (2b) above.
3. `run-mu3w75qh-bafcc31f` — `FluxIQ control request failed:
   /api/programs/automation-studio/issue-llm-execution-grant (400)`. Fix (2a)
   above.

## `pnpm demo:llm:setup` — same cause or not?

**Not the same cause, and not the shorter route.** Diagnosed by reading, not by
running, for a reason given below.

`scripts/setup-demo-llm-key.mjs` drives a *different* path: the persistent demo
workspace (`test-runs/web-extension-demo`), its own long-lived Core on
127.0.0.1:3300, a real browser, and the Secret Keys **UI** via Playwright. Its
opacity is by construction, at two levels:

- `ensureDeepSeekKeyViaUi` (`src/secret-keys-ui.ts:76`) ends
  `} catch { throw new RunnerFailure(...) }` — a bare `catch` that discards the
  cause. Every UI failure inside it, from a missing button to a rejected
  response, arrives as one sentence.
- `setup-demo-llm-key.mjs` then wraps the whole script in
  `catch { ... "DeepSeek Secret Keys UI setup failed" ... }`, discarding even
  that. So "no further detail" is the script working as written.

The session-unlock defect I fixed cannot be why it fails: that path creates the
key in one process and issues its grant in a **later** process
(`pnpm demo:llm:diagnose`), which logs in fresh after the key exists — which is
exactly why the demo path never hit the bug and the Lab path did.

I did not run it. It starts a persistent Core on 127.0.0.1:3300 and would
collide with, or disturb, a FluxIQ panel the user may have running there; the
repository's rules reserve panel management for an explicit request. If the
supervisor wants it diagnosed, the one-line change that makes it possible is to
carry the cause into the two catch blocks (both outside my owned paths:
`scripts/setup-demo-llm-key.mjs` and `packages/test-runner/src/secret-keys-ui.ts`).

## Not verified

- **A complete, validated diagnosis.** The live call was made and Core
  validated its shape as `false` because the model staged the request and the
  one-call budget stopped there. `--llm-task adapt` (two calls) is the
  untested path that should produce a validated diagnosis; it costs a second
  call, so I left the decision to the supervisor.
- **Real token and cost figures.** Core reserved and charged the cap because
  the provider did not report usage on this response. The per-call token
  limits in `budget.ts` therefore had `null`s to judge and fell through to the
  run-level accounting, which was at, not over, the cap. A run where DeepSeek
  reports usage would exercise the per-call arm for the first time.
- **`--llm-task adapt` / `diagnose_and_adapt`** end to end. Planned, typed and
  unit-tested; never executed against the provider.
- **The `persistent-isolated` target**, where the Secret Key is reused rather
  than created and `reauthenticate()` is deliberately skipped. The reuse branch
  of `ensureLiveLlmSecretKey` has not run against a real Core.
- **Any target but `isolated`.** `existing` and `clone` are refused by design.
- **A budget breach actually firing on a live run.** The breach paths are
  unit-tested with synthetic accounting only; no real run exceeded its caps.
- **Repeat stability.** One green live run, not a series. Given this machine's
  faulty RAM, treat a single observation as a single observation.

## Open questions / contradictions found

1. **The brief's command could not have worked even fully wired.**
   `data-table --variant column-reorder` is a variant the Flow is expected to
   pass, so `--llm-task diagnose` has nothing to diagnose and the run would
   report `calls: 0` — which, under the new fail-closed rule, now *fails* with
   "Live LLM run reached no provider". That is the intended behaviour, but the
   supervisor should know the brief's exact command will fail for that reason,
   and `identity-drift --variant save-and-exit` is the one to quote.
2. **Reserved cost is reported as spent.** Core's `costAccounting` charges the
   full authorized cost when the provider reports no usage. Any cost figure the
   Lab publishes is therefore an upper bound. If Week 2 wants real spend
   tracking, that is a Core change (`AS/runtime/llm/run-budget.ts`) and I did
   not touch it — two workers are active in that tree.
3. **Generated files in the working tree.** `domain/.test-build/**` shows as
   modified and has a new `runtime/llm-evidence/harness-options/` directory. I
   did not hand-edit any of it; it is tracked generated output that the builds I
   ran regenerated. The supervisor owns the decision whether it belongs in this
   commit.
4. **Core was untouched.** I read Core extensively (grants, secret keys, flow
   settings, runtime service) and changed nothing in `F:\!FluxIQ`. Both
   defects found had a correct fix on this side of the boundary. The
   forbidden paths `AS/runtime/recovery/**` and `AS/runtime/llm/**` were read
   but never edited.
