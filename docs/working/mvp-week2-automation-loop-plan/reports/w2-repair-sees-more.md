# A repair that can look, knows its own plan, sees the values, and is shown no locator

Core `9d7cc24` (dev), extension `a67a8f0` (dev). No live provider call was made.
No commit. Two other workers were editing Core and the domain throughout; every
check below separates their files from mine.

## Outcome

Done, for all four findings. Three are finished end to end in Core; the fourth
(the evidence budget) is finished as far as the constants I own reach, and the
last third of it needs two one-line changes in `recovery/annotation/annotate.ts`,
which another worker holds. Those are written out as exact diffs below.

---

## 1. What a repair may explore with, and under which policy

**What a repair may now do.** Under *any* policy it is offered three
observations — `web.recovery.inspect`, `web.recovery.wait_for_change`,
`web.recovery.detect_repeating_structure`. `inspect` still takes its one free
look before the model is asked anything, and it is now offered again on every
decision after that. What stops the model simply re-asking is the loop's own
duplicate-request check: the same tool with the same input is answered from the
look already taken, so looking again has to ask something new.

Only when the run's policy sets `allowExternalSideEffects: true` is it offered
the other three — `web.recovery.reveal`, `web.recovery.act_safe`,
`web.recovery.navigate_in_scope`. The adaptive preset sets that false, so a
repair under the adaptive preset gets three of the six, not six. **That is the
answer, and it is deliberate**: a repair runs against a live page, a mutating
tool changes that page, and the policy is what says whether this run may. It
stays fail-closed — `sideEffectAllows` is untouched, a call that no policy
governs still needs an explicit `allowSideEffectsWithoutPolicy`, and a
destructive option is never offered to anyone.

So the count goes 2 → 3 under the adaptive preset, and 3 → 6 the moment the run
is allowed side effects. The three that remain withheld are a policy decision,
not a defect.

**What was actually wrong.** The audit named `registry.ts:248-253`, and that
line is only half of it. The registry already dropped an explicit
`repeatPolicy: "after_mutation"` when nothing offered could mutate, for the
right reason — "not again until something changes" is "never again" when
nothing can change. But the evidence loop reads `initialObservation` as the same
rule stated implicitly (`requiresMutationBeforeRepeat`), and the web domain's
`inspect` declares both. So dropping the explicit policy in the registry
achieved nothing: the free look registered the tool's observation for epoch
zero, the epoch could never advance, and `inspect` was shut for the rest of the
recovery. Two of six.

**The fix.** `requiresMutationBeforeRepeat` now takes the offered list as well
as the tool, and applies the rule only where a mutation is reachable
(`evidence-loop.ts`). A mutating tool is never itself mutation-gated, so nothing
about the gated case changes: with a mutation reachable, `inspect` is still held
shut until one is applied, and re-offered the moment one is.

I chose this over the alternative available entirely inside `registry.ts`, which
was to drop `initialObservation` along with `repeatPolicy`. That would have cost
the free look, and the free look is the only page the exploration's first
decision has — the decision request carries `recoveryContext` and, on purpose,
no failure evidence (`exploration.ts` explains why), and the recovery sets no
`minToolCalls`, so a model could complete having seen no page at all. Losing it
would also have cost one extra provider call per exploration.

**Disclosed:** `evidence-loop.ts` is not on my brief's "you own" list, though it
is not on the "must not touch" list either, and no other worker is in it. One
consequence to weigh: `eligibleTools` can no longer be empty (a gated tool now
implies a mutating tool in the list, and a mutating tool is never gated), so the
`llm_evidence_loop.repeat_without_progress` branch at the top of the iteration
and the complete-only decision schema it produces are no longer reachable
through `validTools`. I left the guard in place rather than delete it. The test
that asserted the old one-shot behaviour
(`evidence-loop.test.ts`, "allows completion from an implicit one-shot initial
observation when no tools remain eligible") is rewritten to assert the new rule
and to show the duplicate-request check doing the work the gate used to.

## 2. The diagnosis reaches the patch request

The patch stage's instruction is "carry out the plan you just stated", and the
request did not contain the plan. It does now, as `context.diagnosis`, for a
runtime patch and no other task.

It is copied field by field, never spread (`packDiagnosisFields` in
`context-packet.ts`): the seven keys of the diagnosis channel, each text cut to
`AUTOMATION_STUDIO_LLM_DIAGNOSIS_TEXT_MAX_LENGTH` (500), each verdict one of
`yes`/`no`/`unknown`, each flag a boolean, an unrecognized key dropped, and no
slot at all when nothing survives. Any task kind other than `runtime_patch`
carrying it is refused when the packet is built, the way exploration evidence
is. Cost: about 400 bytes on the patch call only.

The harness input now takes `diagnosis?: AutomationStudioLlmDiagnosisFields`.
**Nothing passes it yet** — the caller is `annotate.ts`. Diff below.

## 3. What a repair is shown of the page

**Where the constants live** (the brief asked):

| Constant | File | Before | After |
| --- | --- | --- | --- |
| `AUTOMATION_STUDIO_LLM_MAX_FAILURE_EVIDENCE_BYTES` | Core `runtime/llm/harness/failure-evidence.ts` | 3,000 | **6,000** |
| `WEB_LLM_EVIDENCE_BYTE_BUDGETS.failure` | domain `runtime/llm-evidence/limits.ts` | imports Core's | imports Core's (so 6,000) |
| `WEB_LLM_EVIDENCE_BYTE_BUDGETS.exploration` / `.ceiling` | same file | 6,000 / 12,000 | unchanged |
| `WEB_LLM_EVIDENCE_BOUNDS` (elements 40, text 300, …) | same file | — | unchanged |
| `AUTOMATION_STUDIO_RECOVERY_CONTEXT_MAX_BYTES` | Core `runtime/recovery/context.ts` | 4,000 | unchanged (comment corrected) |
| the per-call *shares* of the input allowance | Core `runtime/recovery/annotation/annotate.ts`, literals at `:167` and `:415` | 0.2 and 0.5 | **not mine — diffs below** |

The rule is now: a repair sees the same amount of the same page that authoring a
Flow sees. There was never a reason for the two halves of one loop to differ,
and the difference was the whole finding.

**Why `elements: 40` was not raised.** At a 6,000-byte budget the bytes bind
before the count does — the campaign's own product-catalogue capture was 5,848
bytes at 37 elements — so raising the count would change almost nothing and
would churn the truncation flags. The byte budget is the lever; the count is not.

**What I cut to pay for it.** Nothing on the diagnosis request, and the
explored packets on the patch request. The arithmetic, at the default limits
(`maxInputTokens` 8,000, `maxOutputTokens` 2,000, `maxTotalTokens` 10,000, so an
8,000-token input allowance ≈ 32,000 bytes by Core's own chars/4 estimate):

- Diagnosis request, measured by the audit: 9,978 B. With failure evidence at
  6,000 it becomes ≈ 13,000 B ≈ 3,250 estimated tokens. That is 40% of the
  allowance; nothing needed to give.
- Patch request, worst case today: 9,978 + 12,000 B of explored packets
  ≈ 22,000 B. With the bigger failure packet and the diagnosis slot it would be
  ≈ 25,400 B, which thins the margin more than I want. Dropping the explored
  packets' share from one half to three eighths (12,000 → 9,000 B) puts it back
  at ≈ 22,400 B — the same request size it is today, with the page it failed on
  doubled and the pages it explored afterwards one quarter smaller.

**What this does and does not fix.** It fixes `product-catalog` and
`infinite-feed`: the rows that are carried now arrive with their prices, ratings
and timestamps, which is what tells one record from another. It does **not** fix
`member-directory`. 3,448 elements reduced to 40 is a ranking problem, not a
budget problem — no budget inside this token allowance shows a 240-row list, and
the remedy is which 40 the capture ranks first, which lives in the content
script and the domain's `sanitize.ts`, neither of which I own.

One further saving I deliberately did **not** take: the `omitted` bookkeeping in
`recoveryContext` is ~555 B of the 1,441 and could be compacted to ~90 B
(audit recommendation 8). It changes a public type that `context-summary.ts`,
`recovery-context-packet.test.ts` and `annotate.ts` all read, two of which
another worker holds, and the budget did not need it.

## 4. No locator reaches the model

`context.ts:270-273` claimed `expected` and `actual` were "contractually short
and free of page content". They are a domain's sentences, and the web domain's
read, verbatim:

```
an element matching selector [data-testid="detach-target"], visual target
379,116 (refused main scoring -0.29), element fingerprint (refused
button[data-testid="dead-link"] "Link that goes nowhere" scoring -0.29)
```

That is simultaneously the most informative thing in the request and a raw CSS
selector handed to a model that must never write one. A denied key is screened
by key name, so `selector` inside a free-text field walked straight through.

**Fixed at the source.** New module `runtime/recovery/locator-text.ts`: a screen
that names the shapes this system has actually used to address an element
(attribute selector bracketed or bare, XPath step or predicate or function,
pseudo-class, a token beginning with `.` or `#`, `tag#id`), and a redaction that
replaces each with `[locator withheld]`, re-screens the result, and gives up the
string whole if anything still matches. **Every string** in the built recovery
context goes through it, not just the two fields that were caught — applied once
in `buildAutomationStudioRuntimeRecoveryContext`, before anything is measured or
trimmed, so a section added later cannot forget it.

The sentence survives; the locator does not:

```
an element matching selector [locator withheld], visual target 379,116
(refused main scoring -0.29), element fingerprint (refused
button[locator withheld] "Link that goes nowhere" scoring -0.29)
```

**One shape is deliberately not caught, and it matters.** There is no rule for a
tag qualified by a class (`div.row-selected`), because `web.output.dom-click`,
`node.checkout`, `automation-studio.recovery-context.v1` and every failure code
in the system have exactly that shape. The first draft had such a rule and the
request test caught it redacting Core's own identifiers. A class selector that
arrives with its dot is caught; one written against a tag is not. Saying so is
better than a screen that quietly eats every identifier in the request.

**The test the brief asked for** is
`recovery/tests/request-locator-shapes.test.ts`: it builds a real diagnosis
request and a real patch request — run detail with the campaign's own failure
record, a web-shaped failure packet, an explored packet, the diagnosis slot —
walks every string in the body, and fails naming any that the screen would
refuse. It also poisons each slot in turn to prove the walk can see a locator
wherever it is put.

It lives in `recovery/tests/` rather than beside the packet builder because
`structure-audit` forbids `runtime/llm` importing a value out of
`runtime/recovery` (module cycle), and `runtime/tests/` is at its 25-file limit.

---

## Changes, by file

**Core `F:\!FluxIQ`**

| File | What |
| --- | --- |
| `…/runtime/llm/evidence-loop.ts` | `requiresMutationBeforeRepeat` takes the offered list; applies only where a mutation is reachable. *Outside my named ownership — see the disclosure in §1.* |
| `…/runtime/llm/harness-options/registry.ts` | Comment only: why `initialObservation` is kept where `repeatPolicy` is dropped, and that `sideEffectAllows` is unchanged. |
| `…/runtime/llm/harness/task-request.ts` | `diagnosis?: AutomationStudioLlmDiagnosisFields` on the harness input. |
| `…/runtime/llm/harness/context-packet.ts` | `diagnosis` on the packet; `packDiagnosisFields`; refuses on any task but `runtime_patch`. |
| `…/runtime/llm/harness/failure-evidence.ts` | `AUTOMATION_STUDIO_LLM_MAX_FAILURE_EVIDENCE_BYTES` 3,000 → 6,000, with the reasoning. |
| `…/runtime/recovery/locator-text.ts` *(new)* | The locator screen and redaction. |
| `…/runtime/recovery/context.ts` | Screens every section; corrects the `expected`/`actual` contract comment and the budget comment. |
| `…/runtime/recovery/index.ts` | Exports `locator-text.ts`. |
| `…/runtime/llm/tests/repair-exploration-tools.test.ts` *(new)* | The six-tool web domain imitated in Core's own vocabulary; what is offered under each policy; the fail-first case. |
| `…/runtime/llm/harness/tests/patch-request-diagnosis.test.ts` *(new)* | The diagnosis slot: carried, bounded, key-restricted, runtime-patch-only. |
| `…/runtime/recovery/tests/locator-text.test.ts` *(new)* | What the screen catches, what it must leave alone, and that redaction can never emit a refused string. |
| `…/runtime/recovery/tests/request-locator-shapes.test.ts` *(new)* | The whole-request walk. |
| `…/runtime/llm/tests/evidence-loop.test.ts` | One test rewritten for the new repeat rule. |
| `…/runtime/llm/tests/harness.test.ts` | The over-budget fixture is now eight bounded strings, so it is a byte-limit refusal at any value of the limit (two 3,000-char strings would trip the 2,000-char per-string bound instead). |

**Extension `F:\!FluxIQWebExtension`**

| File | What |
| --- | --- |
| `domain/src/runtime/llm-evidence/limits.ts` | Comment only — the value follows Core's import, as designed. |
| `domain/src/runtime/llm-evidence/tests/limits.test.ts` | Asserts the parity relationship instead of restating 3,000. |
| `domain/src/runtime/llm-evidence/tests/failure-row-values.test.ts` *(new)* | A catalogue at the real page's scale and in ranked order: at the budget a repair is now given, whole rows arrive; at 3,000 bytes, none did. |

---

## Needed in files I do not own — exact diffs

All three are in
`F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\runtime\recovery\annotation\annotate.ts`.

**(a) Carry the diagnosis into the patch request** (finding 2 — without this the
slot exists and is never filled). In the `taskKind: "runtime_patch"` harness
call, currently line 312:

```diff
       ...(failureEvidence ? { failureEvidence } : {}), ...(ports.llmEvidenceRuntime?.deniedEvidenceKeys ? { deniedEvidenceKeys: ports.llmEvidenceRuntime.deniedEvidenceKeys } : {}), recoveryContext,
+      // The plan the stage instruction tells it to carry out. The model's own
+      // answer one call earlier, not Core's reading of it.
+      ...(result.response?.kind === "diagnosis" && result.response.diagnosis ? { diagnosis: result.response.diagnosis } : {}),
       ...(explorationEvidence ? { explorationEvidence } : {}),
```

**(b) Let the failure packet actually use the new ceiling** (finding 3). Line
167 caps the per-call share at 20% of the input allowance, which at the default
8,000 input tokens is 4,800 bytes — so without this the ceiling change delivers
3,000 → 4,800 rather than 3,000 → 6,000:

```diff
     const maxEvidenceBytes = Math.max(1, Math.min(
       AUTOMATION_STUDIO_LLM_MAX_FAILURE_EVIDENCE_BYTES,
-      Math.floor(resolvedTokenLimits.maxInputTokens * 3 * 0.2)
+      Math.floor(resolvedTokenLimits.maxInputTokens * 3 * FAILURE_EVIDENCE_INPUT_SHARE)
     ));
```

with, beside `EXPLORATION_EVIDENCE_INPUT_SHARE`:

```ts
/**
 * A quarter of what a call may carry goes to the page the run failed on. At the
 * default 8,000-token input allowance that is Core's whole 6,000-byte ceiling,
 * which is the point: a repair sees what authoring sees. A smaller allowance
 * scales it down rather than overshooting the gate.
 */
const FAILURE_EVIDENCE_INPUT_SHARE = 0.25;
```

**(c) Pay for (b) out of the explored packets** (finding 3). Line 415:

```diff
-const EXPLORATION_EVIDENCE_INPUT_SHARE = 0.5;
+const EXPLORATION_EVIDENCE_INPUT_SHARE = 0.375;
```

Worst-case patch request before: 9,978 B + 12,000 B ≈ 22,000 B. After (b) and
(c), with the diagnosis slot: 13,000 + 9,000 + 400 ≈ 22,400 B. Unchanged, with
the page it failed on twice the size.

---

## Commands run, and what they printed

Run from inside `packages/fluxiq` so the package's own 15,000 ms `testTimeout`
applies, per the coordinator's note.

**The ten suites covering everything I changed** — green:

```
cd F:/!FluxIQ/packages/fluxiq && FLUXIQ_TEST_ENV_FILES=none npx vitest run --no-file-parallelism \
  …/llm/tests/repair-exploration-tools.test.ts …/llm/tests/evidence-loop.test.ts \
  …/llm/tests/harness.test.ts …/llm/tests/recovery-context-packet.test.ts \
  …/llm/harness/tests/patch-request-diagnosis.test.ts …/llm/harness/tests/context-packet.test.ts \
  …/llm/harness-options/tests/registry.test.ts …/recovery/tests/locator-text.test.ts \
  …/recovery/tests/request-locator-shapes.test.ts …/recovery/tests/context.test.ts
→ Test Files 10 passed (10);  Tests 105 passed (105)
```

**The brief's scope** — four failures, all in other workers' in-flight files:

```
cd F:/!FluxIQ/packages/fluxiq && FLUXIQ_TEST_ENV_FILES=none npx vitest run \
  src/programs/automation-studio/runtime/llm src/programs/automation-studio/runtime/recovery --no-file-parallelism
→ Test Files 3 failed | 47 passed (50);  Tests 4 failed | 642 passed (646)
   × deepseek-provider.test.ts  "binds diagnose_and_adapt to one target override…"
   × opaque-target-override.test.ts  "keeps every browser noun out of the prompt and the response schema"
       both assert the runtime_patch output schema, which now has a second `oneOf`
       branch: `kind: "no_repair"` with `AUTOMATION_STUDIO_NO_REPAIR_REASONS`, added
       in the uncommitted diffs to `harness/structured-response.ts` and
       `deepseek-provider.ts` — the other worker's refusal work, not mine.
   × bootstrap-completion.test.ts  ×2, "the feedback on a completed plan that was refused"
       `harness-options/bootstrap-completion.ts` has 15 uncommitted changed lines
       that appeared mid-session; not a file I touched.
```

These three were green in my earlier runs of the same command, except the two
schema ones, which were already red before I made any change.

**Fail-first evidence**, recorded before each fix:

```
repair-exploration-tools.test.ts → 1 failed | 3 passed
  × "keeps the free first look and lets the model look again when nothing offered can mutate"
    expected ["web.recovery.inspect","web.recovery.wait_for_change","web.recovery.detect_repeating_structure"]
    received ["web.recovery.wait_for_change","web.recovery.detect_repeating_structure"]
  — exactly the audit's two-of-six, with the other three tests already green,
    which is what says the fail-closed side was never the problem.

patch-request-diagnosis.test.ts → 3 failed | 1 passed (no slot existed)
failure-row-values.test.ts (domain) → the first draft at 3,000 bytes carried 5 whole rows,
  because my fixture was 36 short elements; rebuilt at the real page's ~90 elements and
  in ranked order (controls first, text last), which is what made the old budget lose values.
```

**Core type check** — clean for my files:

```
cd F:/!FluxIQ && npx tsc --noEmit -p packages/fluxiq
→ no output at all on the final run.
   (An earlier run in this session reported errors in exactly one file,
   …/runtime/flow-bootstrap/plan/authoring/tests/accept.test.ts — untracked,
   another worker's — which they fixed while I worked. Never mine.)
```

**Structure audit, Core** — clean for my files:

```
cd F:/!FluxIQ && node scripts/structure-audit.mjs
→ structure-audit: 16 violation(s) across 3 rule(s)
  every one under …/runtime/flow-bootstrap/plan/ (another worker's untracked
  directories: 13 naming, 2 imports, 1 failure-as-empty). The count moved from 12
  to 16 during the session as they added files; none was ever in a file of mine.
```

It caught three of mine first, and all three are fixed: the request test
importing `runtime/recovery` values from inside `runtime/llm` (module cycle),
the same test reaching past a directory barrel, and
`repair-exploration-tools.test.ts` importing `harness-options/option.ts` instead
of its index. Moving the request test to `runtime/tests/` then tripped that
directory's 25-file limit, so it is in `recovery/tests/`.

**Structure audit, extension** — clean:

```
cd F:/!FluxIQWebExtension && node scripts/structure-audit.mjs
→ structure-audit: passed (63 warning(s), 122 baselined)
```

**Domain type check** — clean:

```
cd F:/!FluxIQWebExtension/domain && npx tsc -p tsconfig.json --noEmit ; npx tsc -p tsconfig.test.json
→ no output from either
```

**Domain tests** — my two new ones and `limits.test.ts` pass; seven failures, all
in another worker's area:

```
cd F:/!FluxIQWebExtension/domain && DOMAIN_TEST_BUILD_LABEL=w2-repair node scripts/test-domain.mjs
→ # tests 663  # pass 656  # fail 7
   not ok 477–480  recovery-selector-hints.test.ts
   not ok 549, 551, 553  tools.test.ts
```

All seven fail with refusals from `domain/src/runtime/llm-evidence/target-equivalence.ts`
(**untracked** — it did not exist at `a67a8f0`) reached through
`target-override.ts` (**modified, uncommitted**). The brief names
`domain target-override.ts` as another worker's. Failure 477 reads
`expected a resolved target, got {"status":"absent","reason":"recorded_target_unknown"}`,
and `recorded_target_unknown` is produced at `target-equivalence.ts:69`. None of
the seven touches a file I changed, and none involves a byte budget, the
evidence loop, the recovery context or the diagnosis slot.

## Not verified

- **No live provider call**, as instructed. Nothing here is evidence about what
  a model actually answers — only about what it is now shown and offered.
- **The end-to-end repair path is not exercised.** The diagnosis slot and the
  6,000-byte failure budget both need diff (a) and diffs (b)/(c) in
  `annotate.ts` before a real recovery uses them. What is tested is the packet
  builder, the registry, the loop and the domain sanitizer in isolation.
- **I rebuilt Core's `dist/`** (`npx tsc -b tsconfig.build.json` inside
  `packages/fluxiq`), because the domain resolves `fluxiq/automation-studio` to
  `dist/`, not to Core's source, and could not otherwise see the new constant.
  `tsc -b` emits despite type errors, so the build reported the other worker's
  `flow-bootstrap/plan/authoring/` errors and wrote output anyway. `dist/` is
  git-ignored, so nothing is staged — but **the current `dist/` was built from a
  tree containing two workers' in-flight code**, and it is the confound I cannot
  fully rule out for the seven domain failures. The evidence above points at the
  untracked domain file instead.
- **`domain/.test-build/` was not refreshed.** I ran with
  `DOMAIN_TEST_BUILD_LABEL=w2-repair`, which writes to the ignored scratch
  directory. That tracked directory is a build output and needs
  `node scripts/test-domain.mjs` with no label before these changes are
  committed.
- **`member-directory` is still unreadable to a repair** (finding 3, stated
  above). Fixing it means changing which elements the capture ranks first, which
  is outside what I own.
- **No browser run.** Nothing here changes a content script, the manifest,
  permissions, storage or the side panel.
- **The locator screen's coverage is a claim about named shapes, not about all
  locators.** It guarantees that no string leaving the recovery context matches a
  shape it names, and the request test holds the whole body to the same screen.
  A form of locator neither has seen would pass.

## Open questions and contradictions found

1. **`registry.ts` was not where the bug could be fully fixed**, though the brief
   named it. The complete rule needed one line in `evidence-loop.ts`. If the
   supervisor would rather that file were left alone, the fallback is to drop
   `initialObservation` in `registry.tools()` when nothing offered can mutate —
   at the cost of the free look and one extra provider call per exploration, as
   set out in §1.
2. **A now-unreachable branch.** `llm_evidence_loop.repeat_without_progress` on
   an empty eligible-tool list can no longer be reached through `validTools`. I
   left it as a guard. Someone may prefer it removed, or `validTools` relaxed so
   a wholly gated list stays expressible.
3. **`sanitize.ts` does not protect the failed element's own row.** `popElement`
   demotes `failedTarget` to `failedTargetMissing` when the trim reaches it, so
   on a large page the one element the repair is about can still be cut. Biasing
   the trim to keep the failed element and its `item.index` siblings is a small,
   well-bounded change in `domain/src/runtime/llm-evidence/sanitize.ts`, which I
   do not own. My second domain test asserts the property holds today only
   because the capture ranks the failed control first.
4. **`heading` is still mis-attributed** to the previous row for the element that
   names a row (audit finding, `elements.ts`). Unchanged here; a model building a
   per-row mapping from `heading` will still mis-associate the naming field.
   `item.index` is the reliable key, and nothing tells the model that.
5. **The `omitted` bookkeeping is still 555 bytes** per runtime call. Left alone
   deliberately (§3); worth ~430 bytes if someone wants it, and it touches
   `context-summary.ts` and `annotate.ts`.
