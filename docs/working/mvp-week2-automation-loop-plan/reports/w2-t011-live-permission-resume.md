# t011 live permission resume

Status: **browser-domain wording proven live; created-lane result verification is the next blocker.**

## Scope and method

Worked only in `F:\fxwork\t011-exploration-reveal-safety`, against the isolated
Lab target (`FLUXIQ_TEST_TARGET=isolated`, instance `t011`) and the real
DeepSeek provider. The API key was loaded from `.env.local` without printing
it. I ran only `social-scheduler-schedule-post`; no corpus and no unit suite.

Evidence below is counts, closed statuses, and tool ids only. No recorded page
data, provider content, credentials, or permission authority text is copied.

## Pre-change live evidence

The first attempt, `run-mua7u9ck-b0df96da`, stopped before exploration with
`lab.generation_http_400`: one provider attempt but no recorded call, tokens,
tool step, permission request, or proposal. This is the intermittent empty 400
already seen in the earlier t011 report, so it was not a behavior baseline.

The identical retry, `run-mua7yzln-7c8d0a9d`, was usable:

- 5 provider calls, 50,692 tokens, $0.02345464.
- Tool sequence: `web.detect_repeating_structure`,
  `web.inspect_current_page`, `web.press_control`.
- Build outcome `proposed`; the press raised no permission request and the
  proposal recorded no instructed consequence. This sample therefore already
  treated the opener as `[]`; it did not reproduce the earlier over-declaration.
- Playback then failed at the client boundary:
  `http.timeout`, `control.request`, 30,000 ms,
  `/api/programs/automation-studio/run-runtime-session`.

The run took 719,464 ms because the initial 30-second request timeout was
followed by the granted-run readback window. It did not stop at the build.

## Smallest change

Changed only the two descriptions that present the press contract:

- `domain/src/runtime/llm-evidence/tools.ts` (Flow authoring)
- `domain/src/runtime/llm-evidence/harness-options/options.ts` (runtime recovery)

Both now say deterministically that opening, showing, revealing, expanding, or
ticking only to expose controls **always** declares `consequences: []`, even
when the Flow authored afterwards will create, modify, send, or publish. No
classifier, word list, permission logic, schema, or test was changed.

## Post-change live evidence

`run-mua8g4li-6a746736` used the same command and scenario:

- Build outcome `proposed` in 3 provider calls, $0.01293776.
- Tool sequence: `web.detect_repeating_structure`,
  `web.inspect_current_page`, `web.press_control`.
- The opener again produced no permission request and no instructed
  consequence: the live model followed the strengthened `[]` contract.
- The isolated project store shows the created playback itself reached
  `succeeded`: 9 actions, all 9 action summaries succeeded, zero errors, about
  58 seconds of runtime.
- Its stored run summary has no `resultVerification`. Because this is a
  granted run, `executeRecordedFlowRun` requires a verdict before accepting a
  `succeeded` status. It therefore keeps polling for the whole Core grant lease
  and ultimately preserves the original 30-second request timeout. The
  finalized bundle confirmed that exact endpoint and bound after 708,291 ms.

This isolates the next blocker more precisely than the earlier report: the
Flow is not hung and the actions are not failing. Core finishes the playback,
but no result-verification record arrives, so the Lab cannot return the run or
reach its fixture oracle. The relevant downstream behavior is
`packages/test-runner/src/flow-lane/persisted-flow-run.ts`: all granted runs set
`awaitVerdict`, while the created lane issues `diagnose_and_adapt` through
`live.repairAuthorizer`, whose comments state that the same grant covers
`loop_verification`.

## Validation and limits

The live run rebuilt the extension, domain host, domain, contracts, evidence,
and test runner successfully before launching. Afterwards,
`pnpm --filter @fluxiq-web-extension/domain check` passed (source and test
TypeScript only). No unit test or full suite was run. The post-change fixture
oracle cannot be reported because the missing verification prevents the lane
from returning even though its persisted run succeeded.
