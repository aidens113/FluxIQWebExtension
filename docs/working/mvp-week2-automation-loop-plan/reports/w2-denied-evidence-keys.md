# `w2-denied-evidence-keys`: the declaration is required, and the packet fails closed

Path prefix: `AS/` is Core's `packages/fluxiq/src/programs/automation-studio/`.
Core is `F:\!FluxIQ`; downstream is `F:\!FluxIQWebExtension`.

## Outcome

**Partial — one line short, and the missing line is the point.**

The field is required, the packet builder fails closed, every call site is
updated, Core's `pnpm check` passes whole, and the Automation Studio LLM suite
is green at 14 files / 135 tests.

**One test fails, and it is the new check catching a real hole rather than a
regression in my edit.** Failing closed on `reusableContext` revealed that the
Flow Bootstrap path never forwards the domain's declared keys to the harness at
all, so a reusable-context record has been reaching the model through Bootstrap
with only Core's own `target` family denied — the domain's `selector`, `html`
and the rest were not enforced on that path. Closing it needs one line in
`AS/runtime/service.ts`, which this brief forbids me. It is written out below,
ready to paste.

| Piece | State |
| --- | --- |
| `deniedEvidenceKeys` required on the binding | **Done.** Held by a `@ts-expect-error` assertion, so it cannot quietly become optional again |
| Packet builder fails closed | **Done.** An absent declaration is refused for both `failureEvidence` and `reusableContext` |
| 8 call sites updated | **Done** for the 7 I own. The 8th, `recovery/tests/runtime-exploration.test.ts:237`, was fixed by another worker while I ran; Core's typecheck is green |
| A test proves the fail-closed path | **Done.** One new run-time test and one compile-time assertion |
| Core `pnpm check` | **Passes.** `CHECK_EXIT=0`, all four packages, audit passed |
| Automation Studio runtime tests | **One failure**, `service-bootstrap/tests/generation.test.ts`, caused by the missing `service.ts` line |

---

## The one line the supervisor needs to integrate

`AS/runtime/service.ts:1797-1801` is a thin wrapper that every Flow Bootstrap
provider call goes through:

```ts
  private async runFlowBootstrapLlmHarness(
    input: Parameters<typeof runAutomationStudioLlmHarness>[0]
  ): ReturnType<typeof runAutomationStudioLlmHarness> {
    return await runAutomationStudioLlmHarness(input);
  }
```

The last line becomes:

```ts
    return await runAutomationStudioLlmHarness({ ...input, ...(this.llmEvidenceRuntime ? { deniedEvidenceKeys: this.llmEvidenceRuntime.deniedEvidenceKeys } : {}) });
```

That is the whole fix, and it is a net zero line change. Both Bootstrap call
sites (`:1935`, the evidence-loop decision, and `:1977`, the plain generation
call) go through this wrapper, and `:1935` is the one that passes
`reusableContext`. The runtime-diagnosis path already forwards the keys, on the
existing lines at `:3035` and `:3063`.

**Do not write `?? []` instead of the conditional spread.** `?? []` puts the
default-open back for a host that runs evidence-guided Bootstrap with no domain
runtime bound — Core's builtin options alone make that reachable — which is the
exact shape of the hole this work removes. The conditional spread means "no
domain bound, so no domain declaration, so refuse to carry domain-shaped
context", which is the same rule the packet builder now applies everywhere else.

I verified the causation rather than assuming it: I temporarily narrowed the
check to `failureEvidence` only, ran `generation.test.ts` (6 passed), and
restored the full check. The failing assertion is `packs opted-in reusable
context only after a fresh creation inspection and records safe provenance`.

---

## What changed and why

### 1. `AS/runtime/llm/harness-options/binding.ts` — the field is required

One character, `?` deleted, and the doc comment above it rewritten: it used to
explain why the field was optional and now explains why `[]` is a claim and an
absent field is not. The two fields another worker added minutes before I
started, `harnessOptions` and `classifyRefusal`, are untouched and still there.

### 2. `AS/runtime/llm/harness/context-packet.ts` — the consumer fails closed

`const deniedEvidenceKeys = input.deniedEvidenceKeys ?? []` became
`declaredDeniedEvidenceKeys(input)`, a named function directly above
`sanitizeReusableLlmContextPacket`, which throws when the input carries
`failureEvidence` or `reusableContext` and no declaration arrived, and returns
`[]` only when the packet carries neither. A packet with nothing of the
domain's in it needs no declaration and is left alone, so no `flow_bootstrap`
or plain `evidence_tool_decision` request is disturbed.

**Both triggers are necessary, and that is not a style choice.** The two are
sanitized by the same declared list on purpose —
`containsReusableExecutableTarget`'s own comment says `selector` moved out of
Core and into the domain's keys "which arrive as `deniedKeys` and are checked
here beside Core's own". Failing closed on evidence but not on reusable context
would leave exactly one of the two doors open, and it is the door the Bootstrap
path currently walks through.

### 3. `AS/runtime/llm/harness/task-request.ts` — the doc comment only

The harness input field stays optional, because most task kinds carry neither
evidence nor reusable context and requiring it there would be noise. Its comment
now says what absence means: refused when the request carries either, not
"deny nothing".

### 4. The call sites

Seven, in three files, all mine:

- `tests/service-adaptation/tests/llm-diagnosis.test.ts:109` —
  `["html", "innerHtml", "outerHtml", "pageSource", "cookies", "headers"]`.
  **Not the full web list**, and this is the one place the report's prescribed
  diff was wrong. That fixture's evidence is
  `elements: [{ target: "target.1", tag: "button", selector: "#replacement", … }]`
  and the test asserts `requests[0].context.failureEvidence` equals it exactly.
  Declaring `selector` denied makes the sanitizer throw, the gate refuse, and
  the test fail. The fixture carries a `selector` deliberately, to prove a
  target override resolves from it. The sibling at `:182` declares the full
  seven and is the test that proves a declared key is refused, so the contract
  is still asserted — by the test written to assert it.
- `llm-diagnosis.test.ts:208, :239` — the full seven, matching `:182`. Their
  evidence carries none of them, so they assert the production declaration.
- `tests/service-bootstrap/tests/generation.test.ts:168, :204, :237` and
  `rejections.test.ts:79` — `[]`. These fixtures capture no failure evidence,
  so `[]` is the honest claim.

The eighth, `recovery/tests/runtime-exploration.test.ts`, is in a directory this
brief forbids me. It broke Core's typecheck for about forty minutes and another
worker fixed it at `:237` with `deniedEvidenceKeys: []` while I was running. I
did not touch that file; `git status` shows it modified by them, not me.

### 5. The tests that prove it

- **Compile time**, `llm/harness-options/tests/binding.test.ts`: a
  `@ts-expect-error` on a binding literal with no `deniedEvidenceKeys`. If the
  field ever becomes optional again, TypeScript reports the unused
  `@ts-expect-error` and `pnpm check` fails. This is the half that cannot be
  argued with: a domain that forgets the field never reaches a packet because it
  never builds.
- **Run time**, `llm/tests/harness.test.ts`, one new test with five assertions:
  evidence with no declaration throws; reusable context with no declaration
  throws; `[]` with each of them builds and round-trips the content unchanged;
  and a packet carrying neither still builds with no declaration.

Three existing tests in that file asserted the old default-open behaviour and
were updated to declare. That is worth naming plainly: **`packs compact context
…`, `bounds ephemeral failure evidence …` and `accepts bounded advisory
reusable context …` were each passing a packet with real evidence and no
declaration, and each was green.** They were the regression test for the hole.

---

## Commands run and observed results

Core, from `F:\!FluxIQ`:

```
pnpm check
  -> structure-audit: passed (140 warning(s), 254 baselined).
     packages/contracts check: Done
     packages/client-gateway-websocket check: Done
     packages/fluxiq check: Done
     apps/web check: Done
     CHECK_EXIT=0

npx tsc --noEmit -p packages/fluxiq
  -> TSC_EXIT=0, no output.
     (an intermediate run read exactly the 8 TS2741 errors the brief predicted,
      then 1 after I fixed my 7, then 0 once another worker fixed the eighth in
      recovery/tests/runtime-exploration.test.ts)

npx vitest run .../runtime/llm --root packages/fluxiq --no-file-parallelism
  -> Test Files  14 passed (14)
     Tests      135 passed (135)        (baseline 14 / 134)

npx vitest run .../runtime/tests/service-adaptation --root packages/fluxiq --no-file-parallelism
  -> Test Files  8 passed (8)
     Tests      33 passed (33)

npx vitest run .../runtime/tests/service-bootstrap --root packages/fluxiq --no-file-parallelism
  -> Test Files  1 failed | 5 passed (6)
     Tests      1 failed | 44 passed (45)
     FAIL generation.test.ts > packs opted-in reusable context only after a
          fresh creation inspection and records safe provenance
          AutomationStudioFlowBootstrapGenerationError:
          flow_bootstrap.provider_request_failed
     -> the missing service.ts line, above. Proved by narrowing the check to
        failureEvidence only: same file, 6 passed. Check restored.

node scripts/structure-audit.mjs
  -> structure-audit: passed (140 warning(s), 254 baselined).  AUDIT_EXIT=0
```

`llm/tests/harness.test.ts` is 522 lines, past the 400-line advisory. It was
already past it at about 503 before my 19 lines; no baseline moved and the audit
passes.

### The whole-runtime suite, and why I am not quoting a number for it

`npx vitest run .../runtime` was run three times and read 95 files / 876 tests,
then 95 / 876, then 97 / 882, with the failure list changing between runs. Other
workers added `recovery/annotation/` (including a `zz-debug.test.ts`) and edited
`recovery/structured-diagnosis.ts`, `recovery/tests/stages.test.ts` and
`service.ts` while I ran. The failures I saw in `recovery/**` are theirs —
`stages.test.ts` reading `modelFieldCount: 0, refusalCount: 1` is the
diagnosis-channel reader switch mid-flight, not anything of mine. I therefore
report the three suites I can attribute cleanly and not a whole-runtime figure.

## Not verified

- **No live provider and no live browser.** Nothing here was exercised against a
  real model or a real page.
- **The `service.ts` line is written but not executed.** I did not apply it even
  temporarily: `service.ts` is modified by another worker right now and a
  temporary edit plus revert could clobber them. Its correctness rests on my new
  test proving that the same packet builds once `deniedEvidenceKeys` is present,
  and on the narrowing experiment proving that its absence is what fails.
- **The whole `runtime` suite was never green in one run under my change**, for
  the churn reason above. `llm`, `service-adaptation` and `service-bootstrap`
  were each run to completion and are quoted exactly.
- **`sanitizeAutomationStudioLlmFailureEvidence` still has
  `deniedKeys: readonly string[] = []`**, a second default-open, left
  deliberately. Removing it breaks `service.ts:2972` (forbidden),
  `deepseek-provider.ts:378`, and two downstream test files. Both remaining
  callers are now dead paths for it: the service one always passes the binding's
  declaration, and the provider one is a bounds re-check of evidence the packet
  already sanitized. Worth closing later; not worth a cross-repository signature
  change today.
- **Downstream was not built or run.** Nothing changed there:
  `domain/src/runtime/llm-evidence/tools.ts` already declares the seven keys
  (`:123`) and already has the field required on its own type (`:81`). Downstream
  compiles against Core's `dist/`, which I did not rebuild, so its gates would
  have told me nothing about this change.
- **`pnpm test` and `pnpm build` were not run** in either repository.

## Open questions and contradictions found

1. **The Bootstrap path has never enforced a domain's declared keys on reusable
   context.** The same stored record is treated two ways today: refused in
   runtime diagnosis, sent in Bootstrap. Worth a line in the working document
   independent of this fix, because it means any reusable-context record written
   before today may contain a `selector` that a Bootstrap request would have
   sent to the model.
2. **The report I was handed prescribed the full seven keys for
   `llm-diagnosis.test.ts:109` and that is wrong**; it would have failed the
   test. Corrected above. Whoever reads `w2-harness-loose-ends.md` next should
   take this file's list, not that one's.
3. **The brief named `AS/runtime/llm/context-packet.ts`; the file is
   `AS/runtime/llm/harness/context-packet.ts`**, and its line 81 is now 92.
   Same file, moved.
4. **`binding.ts` keeps flipping between CRLF and LF on disk** — mine converted
   it once and I converted it back, and it is LF again now, so something else is
   rewriting it. `core.autocrlf=true` normalizes the index, `git diff` shows only
   the intended hunks, and the repository already mixes both (`service.ts` is
   LF, `evidence-loop.ts` is CRLF), so nothing is damaged. Recording it only so
   the next person does not chase a phantom whole-file diff.
