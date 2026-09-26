# t138 — A local diagnostic for a provider call that failed

## Outcome

**Done, Lab-side only. No Core change was made, and none was needed to get the
decisive fact out.** The next run that dies the way
`run-muhs8hx3-6fd929e6` and `run-muhtuizo-c458e49c` died will leave
`test-runs/<runId>/provider-failures.local.json` naming Core's real failure
code, its refusal sentence, the measured request size against the run's own
token ceiling, and the tools the loop had called. A run whose provider calls
all succeed writes nothing at all.

One thing it will still not carry is DeepSeek's own response body, and that is
a Core limitation stated plainly below with the exact change that would lift
it. The file has the field waiting for it.

## The finding that changed the design

**The `httpStatus: 400` in those two bundles is not DeepSeek's status. It is
Core's.** `flow-lane/creation/build-proposal.ts:417` writes
`httpStatus: envelope.status`, and `envelope` is the Lab's own HTTP call to
Core's `generate-flow-bootstrap-adaptation` route. So "an intermittent 400 from
the provider" was never the right reading: Core refused the Lab's build request
with 400 and a diagnostic.

**And `flow_bootstrap.provider_transport_unknown` names nothing.** It is the
`default` arm of Core's projection
(`F:\!FluxIQ\...\runtime\flow-bootstrap\generation-failure.ts:647`), reached by
any `llm.*` code the switch above it does not recognise. The condition is
therefore *knowable* — the switch has the real code in hand — and is thrown
away one line later. Core's own comment at line 128 records the same problem
being fixed once already for a neighbouring code.

**The Lab already receives what was missing and drops it.**
`ExistingFluxIQControlClient.generateFlowBootstrapAdaptation` returns
`{ status, ok, payload }` and `refused()` runs `payload.diagnostic` through
Core's parser, keeping only `code`, `stage` and counts — correctly, because
that is what may enter the bundle. The whole refusal body, including its
`error` sentence and the `accounting` block, was in memory and then discarded.
That is the seam this work uses. No new transport, no Core change, no
environment variable.

**Why the body is still absent.** Core's DeepSeek adapter
(`runtime/llm/deepseek/provider.ts:238`) is:

```ts
if (!response.ok) throw new AutomationStudioLlmProviderError("llm.provider_http_error", "DeepSeek returned an unsuccessful HTTP status.", response.status >= 500, response.status);
```

The response is never read. No part of FluxIQ holds DeepSeek's reply on a
failure, so no Lab-side seam can produce it. The smallest change that would:
read a bounded prefix of `response.body` before that throw, carry it on the
error, and add it to the metadata that `runtime/llm/harness/run.ts:171` already
builds (`{ retryable, providerStatus }` → `+ providerBody`). It lands in
`accounting` and travels to the Lab with no change here — the sidecar reads
`accounting.providerBody` today and records `null` when it is absent. **I did
not make it**, because the brief forbids building either repository, Core's
`runtime/llm/tests/harness.test.ts:453-484` asserts that metadata object
exactly, and shipping an unvalidatable Core change into a live campaign is
worse than the gap it closes. It is a clean follow-up for whoever can build.

## What was built

`packages/test-runner/src/provider-failure/`, new, four source files and two
test files.

- `provider-failure-record.ts` — the record and its normalizer. `core` is
  Core's reply verbatim (bounded at 8 KB, with `bodyBytes` and `bodyTruncated`
  so a cut is visible); `provider` is read out of it by name: `code`, `stage`,
  `httpStatus` (DeepSeek's, from `accounting.providerStatus`), `invocation`,
  `response`, `provider`, `model`, `estimatedInputTokens`, `toolCallCount`,
  `toolIds`, `body`. `request` carries the Lab→Core request byte count and the
  run's declared bounds.
- `provider-failure-log.ts` — the per-run collector, plus
  `runProviderFailureLog` which builds it from what `run-scenario.ts` already
  has. Capped at 20 records, with `dropped` counting the rest.
- `write-provider-failure-sidecar.ts` — writes
  `provider-failures.local.json`, or nothing.
- `index.ts` — barrel.

Wiring, four lines in `run-scenario.ts`, one method on the control client, one
getter on `LiveLlmRun`:

- `existing-fluxiq-control.ts`: `generateFlowBootstrapAdaptation` now reads the
  reply as text and parses it, instead of `response.json()`. The returned
  envelope is byte-for-byte what it was. A refused envelope is handed to the
  log. `recordProviderFailuresTo(log)` is the only new method.
- `live-llm/live-llm-run.ts`: `providerRequestBounds` exposes the plan's model
  and token limits, so a size refusal reads against its own ceiling without a
  second file.
- `run-scenario.ts`: build the log, attach it after the control client is
  settled, write the sidecar after `bundle.finalize`.

## Why it cannot enter the published bundle

Checked, not assumed.

1. **The artifact index is a directory walk.**
   `packages/test-evidence/src/bundle.ts`, `buildArtifactIndex`, walks
   `stagingPath` and filters exactly two names. *Any* other file present at
   that moment is indexed, hashed into `bundle.complete.json`, and scanned by
   the attestation. The sidecar is written only after `finalize` has renamed
   the staging directory, so it cannot be in the walk.
2. **That ordering is enforced, not documented.**
   `writeProviderFailureSidecar` refuses a directory whose basename starts
   `.staging-`. A future caller that writes it too early gets an error instead
   of a silent publication. Test: *"writing into a bundle staging directory is
   refused, because the bundle would publish it"*.
3. **Proved against the real bundle.** A test finalizes a real
   `EvidenceBundle`, writes the sidecar into the finalized directory, and
   asserts the file is absent from `artifact-index.json` and that the sealed
   index is unchanged.
4. **`lab inspect` still verifies.** `inspect.ts` iterates only the indexed
   artifacts; it has no "no unlisted files" check, so an extra file cannot fail
   integrity.
5. **Git.** `git check-ignore -v test-runs/run-muhs8hx3-6fd929e6/provider-failures.local.json`
   → `.gitignore:15:test-runs/`. `git ls-files test-runs` is empty: nothing
   under `test-runs/` has ever been tracked. The file's name also says it:
   `.local.`.

The published guarantee is untouched. `publishable-step-value.ts`,
`redaction-attestation/` and `build-proposal.ts` are unchanged — no new field
enters the bundle, and nothing that was refused entry is now admitted.

## How secrets are kept out

Four things, in order.

1. **Nothing sensitive is collected.** The record copies exactly one piece of
   free text — Core's response body — plus a fixed list of scalars read out of
   it by name. No request headers, no environment, no request body; the request
   side keeps a byte count and the run's declared limits.
2. **A wider secret list than the bundle's.**
   `run-scenario.ts` deliberately keeps the provider credential *out* of the
   bundle's `secrets` so the redaction attestation can find a leak rather than
   have it scrubbed. Nothing scans the sidecar, so `runProviderFailureLog`
   redacts with `secrets` **plus** `live.redactionLiterals` — the credential.
3. **The same redactor the bundle uses.** `redactText` removes each configured
   secret, then the `Bearer …` and `password=…` patterns. Every string that
   reaches the record passes through it, including the fields read out of the
   raw body.
4. **Fail closed.** `assertNoSensitiveText` runs on the finished record with
   the run's real secrets. If anything survives, the record is dropped and
   replaced by `{ at, route, httpStatus, withheld: "redaction_failed" }`. A
   leak costs the diagnostic, never the guarantee. This path is tested with a
   redactor that removes nothing.

## Commands run and observed results

Nothing was built. `packages/test-runner/dist` was already absent and was not
created; the package was compiled to a throwaway directory
(`.provider-failure-check/`, deleted afterwards) so the live run in flight
could not be disturbed.

- `tsc -p packages/test-runner/tsconfig.json --noEmit` → exit 0, no output.
- `node --test` on the new module → **16 tests, 16 pass, 0 fail**, 181 ms.
- `node --test` on the whole compiled package → **1406 tests, 1406 pass, 0
  fail**, exit 0. Run three times on the final code, clean each time (27.9 s,
  38.3 s, 27.5 s).
- `node scripts/structure-audit.mjs` → 3 violations, **none of them mine**; see
  below. The three my first draft introduced —
  `failure-as-empty` on `provider-failure-record.ts` and on
  `existing-fluxiq-control.ts` (baseline 2, had gone to 3), and
  `swallowed-failure` on `run-scenario.ts` (baseline 14, had gone to 15) — were
  fixed, not baselined away, and the audit no longer reports them.
- `git check-ignore -v test-runs/<runId>/provider-failures.local.json` →
  `.gitignore:15:test-runs/`.

The written file's shape, produced by running the compiled module on a 400 with
a body (secrets redacted, abridged):

```json
{
  "schemaVersion": "0.1", "tier": "local", "published": false,
  "note": "Local diagnostic. Not part of the evidence bundle: ...",
  "runId": "run-muhs8hx3-6fd929e6", "failures": 1, "dropped": 0,
  "records": [{
    "at": "2026-09-26T03:49:11.032Z",
    "route": "generate-flow-bootstrap-adaptation",
    "request": { "controlRequestBytes": 214,
      "bounds": { "provider": "deepseek", "model": "deepseek-flash",
        "maxInputTokens": 48000, "maxOutputTokens": 8000,
        "maxTotalTokensPerRequest": 56000, "maxCallsPerRun": 48,
        "maxTotalTokensPerRun": 600000, "timeoutMs": 25000 } },
    "core": { "httpStatus": 400, "bodyBytes": 441, "bodyTruncated": false,
      "body": "{\"ok\":false,\"error\":\"Flow bootstrap generation failed.\",\"payload\":{\"diagnostic\":{...}}}" },
    "provider": { "code": "flow_bootstrap.provider_transport_unknown",
      "stage": "provider_request", "httpStatus": null, "invocation": "attempted",
      "response": "unknown", "provider": "deepseek", "model": "deepseek-flash",
      "estimatedInputTokens": 51200, "toolCallCount": 0, "toolIds": null,
      "body": null }
  }]
}
```

The same script on a log with no failure returned `undefined` and left the run
directory holding only `logs`.

## Telling the three cases apart

The brief asked for enough to separate "too large", "a tool schema was
rejected" and "a bad minute". With the file above:

- **Too large** — `provider.estimatedInputTokens` against
  `request.bounds.maxInputTokens`. The sample shows 51,200 against a 48,000
  ceiling, which is the answer on its own, and Core's own code for it
  (`llm.provider_input_budget_exceeded` →
  `flow_bootstrap.pre_provider_input_budget_exceeded`) is a code the projection
  does *not* collapse, so it would appear in `provider.code` too.
- **A tool schema rejected** — `provider.code` and `provider.toolIds`, plus
  Core's refusal sentence in `core.body`. DeepSeek's own wording would need the
  Core change above.
- **A bad minute** — `provider.httpStatus` (5xx) with `invocation: "attempted"`
  and `response: "received"`, against a `provider.code` that names a transport
  condition rather than a request one.

The case actually observed in those two runs is none of the three cleanly:
`invocation: "attempted"`, `response: "unknown"`, no provider status. The
sidecar will say which `llm.*` code produced it, which is the fact that decides
it.

## Not verified

- **No live run.** This cannot be exercised end to end without a campaign, and
  a run was in flight throughout. The wiring — log built, attached to
  `topology.control`, written after `finalize` — is type-checked and
  unit-tested at each seam, but no bundle produced by an actual `lab run` has
  been seen with this file beside it. **The first thing to check on the next
  live run is whether the file appears.**
- **The `existing` and `clone` targets.** The attach point sits after the
  `existing` branch reassigns `topology.control`, so both are covered by
  construction; neither was exercised.
- **The repair lane.** Only `generate-flow-bootstrap-adaptation` reports into
  the log. A repair failure during Flow playback does not travel back as an
  HTTP refusal with a diagnostic, so it has no equivalent seam and none was
  invented.
- **Core was read, never changed.** `F:\!FluxIQ` has no modification from this
  task.

## Three audit failures that are not mine

`node scripts/structure-audit.mjs` exits 1 on the current tree. All three
predate this work:

1. `file-lines packages/test-runner/src/run-scenario.ts: 812 lines exceeds the
   800-line limit.` **It was already failing.**
   `git show HEAD:packages/test-runner/src/run-scenario.ts | wc -l` → **808**,
   and the rule (`scripts/structure-audit/rules/file-lines.mjs`) is a raw line
   count against `LIMITS.fileLines: 800` with no baseline entry for
   `file-lines` at all. My four lines take it 808 → 812. I cut my footprint
   from 21 lines to 4 to keep it as small as possible; getting under the limit
   needs the file split, which is a unit of work of its own and not something
   to do to a file a live run is reading.
2. `imports scripts/lab/domain-build-staleness.mjs` — untouched by this task.
3. `working-docs docs/working/README.md is out of date` — caused by the
   already-modified `language-driven-flow-loop-plan.md` in the working tree,
   not by this task. `pnpm structure:baseline` regenerates it; that is the
   supervisor's file to touch.

## Open questions

- **Should the Core change be made?** Reading a bounded body before the
  `!response.ok` throw is about six lines across two Core files, and it is the
  only way to see DeepSeek's own words. It needs a Core build and an update to
  `runtime/llm/tests/harness.test.ts`, which is why it was not done here. The
  sidecar reads the field already.
- **Is `provider_transport_unknown` worth narrowing at the source?** The
  sidecar recovers what the projection discards, but every other reader — the
  panel, the bundle, the bench — still sees a code that names nothing. Core's
  own comment at `generation-failure.ts:128` describes splitting exactly this
  kind of catch-all, and the same argument applies here.
- **`run-scenario.ts` is over its hard limit and has been for some time.**
  Worth a task before it grows again.
