# What The 2026-09-26 Batch Established

Moved from `language-driven-flow-loop-plan.md` on 2026-09-30 under the compaction threshold. Read the
second section before adding a field to anything the domain sends Core.

**Two bracket minters are still unscreened, and are fine only while they stay that way.**
t160 fixed the notation where Core mints a path that then passes the locator screen, and
found two more minters — `llm/deepseek/request-shape.ts` and `model/recording-domain.ts` —
which produce bracketed paths that nothing screens today. They are harmless now and
become the same defect the moment either output is screened. Dotting them is cheap;
nobody has been asked to.

**A new member on the evidence execution result refuses the whole call. Read this before
adding a field to anything the domain sends Core.** t155 was asked to carry a recorded
name assumption out to a run's artifact and stopped one line short of the wire, which was
the right call. Both of Core's readers are closed key checks that refuse the whole value
rather than ignoring an unknown member:

- `llm/harness-options/plan-parameter-resolution.ts` — `exactKeys(answer, ["status","parameters"])`.
  One unknown key and every resolved node of every plan fails validation.
- `llm/evidence-loop-decision.ts` — `exactKeys` over the execution result's eight members.
  One unknown key and **the whole execution result is refused
  `llm_evidence_loop.tool_result_invalid`, and the call is recorded as a failure that
  never happened.** Core's own comment says so.

So emitting the field today would have made every node run of the next live exploration
report as a failure — after passing `pnpm check` and all 837 domain tests. Nothing in this
repository encoded that constraint before t155 restated Core's allow-list on the producing
side as `WEB_LLM_EVIDENCE_RESULT_KEYS_CORE_READS`, with a private `readable()` withholding
any member Core has not learned. **Core widens first, then one entry here.** The ordered
hops are in t155's report section 5.1, and they cross files two other workers hold, so
that task waits for t161 and t162 rather than racing them.

Note the shape of the near-miss: a field *inside* `evidence` is safe, because the check is
over top-level members. t153's three read fields ride inside it and are unaffected. The
difference is invisible unless someone has read the check.

**Run 8's seven silent amendments are t140's defect and not the draft's — established,
not assumed.** t157 was dispatched on the hypothesis that the model had been shown no
draft, and refuted it from the run's own rows: the five consecutive `draft_unchanged`
decisions at iterations 27–31 all report an identical `inputTokens: 15463`, so the request
was byte-stable and the draft was present, and iterations 13, 17 and 26 recorded
`draft_amended` and `draft_rerun`, so the model was reading it. What run 8 lacked was an
answer to a no-op amendment, which is exactly what t140 built.

The defect t157 found is real and was worse than the failing test suggested: any
`maxEvidenceContextBytes` below 4,824 switched the draft off entirely, and
`evidence-loop.ts` then filtered the `undefined` away — no draft, no refusal, no trace
row, no log. The live profile uses 24,000, so this loop was clear of it by luck. t162
makes that class of misconfiguration loud.

**Two downstream assertions in this repository will fail the moment Core is rebuilt,
and that is correct.** t156 predicted them by replaying its algorithm over the real key
sets rather than by running them, because Core's `dist` was stale:
`domain/src/runtime/llm-evidence/plan-resolution/extraction/tests/column-match.test.ts`
— "a column with no plausible candidate is still an honest failure" — now sees `title`
(0.497) and `prce` (0.597) resolve, and its comment is wrong; and that directory's
`slot.test.ts` `unknownField` third entry, keyed `"title"`, now resolves. Both must be
updated to assert the new behaviour, with `banana` and a selector still refused, during
the integration pass and not before, since neither can be validated until Core is built.

**One of t144's two handovers needed changing rather than applying.** It asked for
`service.ts`'s private `unclassifiedThrowCode` to be replaced by the exported
`flowBootstrapUnclassifiedThrowCode`, which would have lost information: the build's
catch tracks a *phase-specific* code in `failureCode`, and the exported function falls
back to the stage's generic default. A straight swap would have answered
`flow_bootstrap.provider_transport_unknown` where the caller already knew
`flow_bootstrap.instruction_resolution_failed`. The shared function now takes an
optional `fallback` for a caller that knows better, so there is one classification and
no loss. Verified: `npx tsc --noEmit` clean, 608 tests across 37 files, Core's audit
passing.

**Two loose ends recorded rather than fixed.** `parameter-screen.ts` passed its
400-line advisory under three consecutive tasks (t151 is splitting it), and
`expectedState.conditions[].expected` stayed withheld while an extraction's
comparand became carried — the same structure under a different key, which t151 is
settling.
