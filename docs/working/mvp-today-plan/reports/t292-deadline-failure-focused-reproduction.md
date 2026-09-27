# t292 — Deadline failure focused reproduction

Status: **Complete — failure not reproduced**

## Verdict

The deepseek bootstrap deadline failure is not deterministic in the focused scope. The exact deadline case passed in five independent isolated Vitest processes and passed again in a three-file 42-test retry/provider/bootstrap set. No source was changed between runs.

This evidence is consistent with an intermittent full-suite load/timing failure. It does not prove that the earlier root-suite failure was harmless, but it rules out a reliably failing deadline path on the current settled tree.

## Exact target

File:

`src/programs/automation-studio/runtime/tests/deepseek-bootstrap-exploration.test.ts`

Test:

`creating a Flow through an exploration, under a real grant > asks again after a decision that runs past its deadline`

The fixture gives the request a 3,000 ms deadline, deliberately hangs the first provider decision until abort, then expects the same grant to continue through a tool decision and completion. The test ceiling is 30,000 ms.

## Isolated repetitions

Each repetition ran in a new Vitest process with:

```powershell
pnpm --filter fluxiq exec vitest run `
  src/programs/automation-studio/runtime/tests/deepseek-bootstrap-exploration.test.ts `
  -t 'asks again after a decision that runs past its deadline' `
  --reporter=verbose
```

| Repetition | Result | Test-body time | Process wall time |
| --- | --- | --- | --- |
| 1 | PASS | 5,677 ms | 11,688 ms |
| 2 | PASS | 6,064 ms | 12,273 ms |
| 3 | PASS | 5,912 ms | 11,933 ms |
| 4 | PASS | 6,066 ms | 12,151 ms |
| 5 | PASS | 5,680 ms | 11,910 ms |

Result: **5/5 passed, 0 failures**. Test-body range was 5,677–6,066 ms, a 389 ms spread. Every run remained more than 23 seconds inside the 30-second test ceiling.

## Small relevant combined set

Command:

```powershell
pnpm --filter fluxiq exec vitest run `
  src/programs/automation-studio/runtime/tests/deepseek-bootstrap-exploration.test.ts `
  src/programs/automation-studio/runtime/llm/tests/deepseek-provider.test.ts `
  src/programs/automation-studio/runtime/llm/provider-retry/tests/call.test.ts `
  --reporter=verbose
```

Result:

- **3/3 files passed**;
- **42/42 tests passed**;
- target deadline case passed in **5,599 ms**;
- Vitest duration **64.56 s**;
- measured process wall time **65,819 ms**.

The neighboring provider timeout/caller-abort normalization cases and retry deadline/accounting/cancellation cases all passed in the same invocation.

## Failure shape and flakiness evidence

No focused failure shape was produced: there was no assertion failure, timeout, leaked grant, or `unknown provider transport` result in any of the six target executions. The settled focused evidence is therefore:

- deterministic focused failure: **not observed**;
- isolated process sensitivity: **not observed across five processes**;
- small relevant-set order/load sensitivity: **not observed**;
- earlier root-suite-only failure: **intermittent or load/order-associated remains plausible**.

The observed target body times cluster around the fixture's expected two 3-second-scale phases and remain far below the 30-second Vitest ceiling. A future reproduction should preserve the full root-suite concurrency/load context and capture the exact typed diagnostic; lowering the fixture deadline would test a different condition and is not warranted by this evidence.

## Boundary confirmation

Validation only. No Core or downstream source/shared document, production generated output, run artifact, browser, provider, Lab, commit, or push action was changed or performed. This report is the only write.
