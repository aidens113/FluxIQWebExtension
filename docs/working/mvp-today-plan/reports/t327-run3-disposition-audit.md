# t327 — Run 3 disposition audit

## Scope and evidence boundary

This is a read-only disposition review. I did not open `test-runs/`, run artifacts,
provider prompts or responses, page/browser state, or credentials, and I ran no
tests, builds, dry runs, or live/provider commands. I changed no source, shared
plan, generated output, or live state. The run-3 facts come only from the
sanitized accepted evidence in t325/t326 and the supervisor's brief. Comparisons
use the sanitized run-1/run-2 debug documents, t213/t215/t217, the current active
plans, and the owning Core/downstream policy source.

## Decision

**Authorize one unchanged default-profile retry, after the gates below; do not
make a speculative product fix first.** This is a bounded repeat of a variable
live build, not permission to retry until it happens to pass.

Run 3 is a valid product failure and a real creation-reliability deficiency: it
spent all 26 build decisions without producing an answerable Flow. It is not,
however, evidence for a specific safe source change. Core correctly rejected a
completion that could not answer the instruction and correctly preserved
`bootstrap.cannot_answer_instruction` as
`flow_bootstrap.evidence_unusable_decision`. Weakening that answerability gate,
raising a budget, or adding an unbounded retry would conceal the observed defect
rather than fix it.

The unchanged retry is justified by three facts together:

1. t213 classified run 1's underlying result as model/authoring non-convergence;
   the one demonstrated Core defect was the terminal diagnostic being flattened.
2. t217 fixed only that terminal classification. It did not change budgets,
   answerability, evidence gathering, rerun semantics, or convergence. Run 3 is
   live proof that the corrected terminal classification now survives.
3. Run 2 produced a reviewed five-node Flow in 19 main calls under the same
   default 26-call profile. The scenario is therefore not shown to be
   deterministically impossible, and the present policy is capable of success.

The safe records show repeated draft work and late unusable output, but do not
show enough content or stable identity to prove an implementation-owned cycle,
a lost correction, a false answerability rejection, or two semantically
identical reruns. There is consequently no evidence-backed implementation to
validate before the next measurement.

## Why fix-before-retry is not yet justified

Core already exposes the remaining decision count, makes the last affordable
decision completion-only, allows completion before that last turn, and gives a
specific answerability instruction when the draft cannot produce/save the
requested records. The completion schema also tells the model to correct and
rerun missing work rather than finish with an empty answer. A successful rerun
clears general no-progress state because execution success is real progress;
run 2's six reruns followed by completion demonstrates why repeated reruns
cannot simply be collapsed.

It is true that answerability feedback produced by a refused literal-final-turn
completion cannot be consumed in another turn. That fact alone does not specify
a safe fix. Reserving a turn earlier would reduce exploration capacity, and an
additional decision would be a budget/policy change; neither is supported by a
deterministic reproduction or a trace showing that one particular earlier
checkpoint would have converged. T215's test-gap finding and t326's proposed
scripted diagnostic fixture are valuable follow-up, but a fixture that pins the
existing terminal behavior is not itself a product repair.

## Evidence threshold for changing the disposition

**Fix-before-retry becomes mandatory immediately** if the accepted sanitized
debug establishes any one of the following source-owned contradictions:

- answerability rejected a retained draft that actually contained an eligible
  record-producing/saving path;
- an eligible node/tool or required completion guidance was omitted from what
  Core made available;
- actionable refusal feedback was available before the final decision but was
  lost, replaced, or made unusable by Core's state/window handling;
- remaining-call, token, cost, deadline, or tool-call accounting was wrong;
- stable sanitized identities prove a semantic rerun/amend cycle that the
  existing progress policy failed to stop;
- context or retained-draft truncation removed required authored work; or
- a deterministic sanitized provider stub reproduces an implementation branch
  that prevents an otherwise acceptable completion.

The terminal code recurring by itself does not meet that threshold: it proves a
refused completion and exhaustion, not which source change would make the Flow
correct. It does rule out accepting the draft, weakening answerability, or
raising the call ceiling as a response.

If the **one** authorized unchanged retry ends in the same Stage-2 exhaustion
family, stop unchanged retries. Two consecutive post-t217 accepted measurements
with truthful `cannot_answer` exhaustion are enough operational evidence that
another uncontrolled repeat is not a responsible next action, even though they
still may not identify a code branch. At that point the next provider call must
wait for a fix-before-retry investigation with privacy-safe stable draft/step
identity or a deterministic scripted reproduction and a measured source change.

## Cost and streak implications

- The pass streak remains **0**. Run 3 earns no partial pass credit because no
  Flow, runtime, oracle, repair, or replay existed.
- A passing next run starts the streak at **1**, not 2; a second independent
  unchanged-profile pass is still required. Any failure leaves/resets it to 0
  and must be fully debugged before another provider call.
- The retry may consume the full default **26 calls** again. Do not increase
  calls, tokens, timeout, per-call cost, total cost, retries, or concurrency.
- The unchanged plan authorizes 560,000 run tokens, USD 0.25 per call, and a USD
  2 total estimated-cost ceiling. These are ceilings, not an expected invoice.
  Run 1's comparable failed build observed USD 0.0573657 and Run 3 observed USD
  0.057534336; run 2's accounting representations must remain separate and are
  not a basis for inventing a combined expected cost.
- One bounded retry is therefore a known additional provider exposure under the
  existing authorization. A call-ceiling increase would expand exposure without
  evidence that call 27 resolves the defect and is not authorized by this
  disposition.

## Exact gates before the single retry

All gates are serial; any **NO-GO** stops before provider contact.

1. **Accepted-debug gate:** retain t325/t326's accepted classification and close
   any outstanding integrity, redaction, accounting, or contradiction review.
   Record Stage 2 as the highest stage, 26/26 build calls, no proposal, and
   streak 0 in the active plans before launch. The current shared Current State
   still describes run 2 and must not be treated as the latest measurement.
2. **Disposition gate:** the supervisor records that no evidence-threshold item
   above is present. If one is present, disposition is fix-before-retry.
3. **Settled-tree gate:** identify the exact settled source revision. If source,
   configuration, dependencies, or generated runtime output changed after the
   last accepted validation, rerun the already-defined focused/root checks,
   builds, output-freshness checks, and diff review before proceeding. An
   unchanged retry must not silently include a new product change.
4. **No-hindsight gate:** create and independently attest a fresh run-4 Stage-1
   record before launch. It may carry the scenario contract and expected gates,
   but no prediction copied from run 3's observed trace.
5. **Single-Lab gate:** prove no Lab/live run is active and hold the one-run
   lock. No parallel provider or browser campaign may overlap it.
6. **Provider-free preflight gate:** run the exact frozen default-profile command
   in dry-run mode with process-only environment isolation. Require exit 0,
   parseable `ready`, provider call count 0, created-flow lane, isolated target,
   the same scenario/workflow/task/oracle identity, and one replay. A failed or
   ambiguous preflight is NO-GO.
7. **Authorization gate:** verify process-only credential/config isolation and
   the unchanged effective plan: DeepSeek configured model, `create-flow` /
   `build_and_adapt`, 26 calls, 560,000 run tokens, 25,000 ms effective timeout,
   zero provider retries, USD 0.25 per-call ceiling, USD 2 total ceiling, one
   concurrent run, and only the already frozen consequence permissions. No
   command-line budget or policy override is allowed.
8. **Launch gate:** state scenario, exact command, and authorized exposure, then
   execute exactly one live invocation. Do not automatically relaunch on any
   failure, timeout, malformed output, or facility ambiguity.
9. **Capture gate:** preserve the established capture/privacy order; finalize
   marker/index/integrity/redaction before substantive artifact inspection.
   Read only the bounded evidence authorized by the active evidence plan.
10. **Post-run gate:** fully debug that single measurement before another
    provider call. If it passes every MVP stage, record streak 1. If it fails,
    record streak 0; if it repeats Stage-2 `evidence_unusable_decision` /
    `cannot_answer_instruction`, enforce the stop rule above and move to
    fix-before-retry investigation.

## Explicit non-actions

Do not raise `--llm-max-calls`; do not weaken or bypass answerability; do not
adjust the scenario/oracle; do not add provider retries; do not batch attempts;
do not infer semantic duplicate reruns from counts alone; and do not award live
MVP credit for t217's correct diagnostic. The next run is justified only as one
controlled measurement under the unchanged contract.

## Sources inspected

- `docs/working/mvp-today-plan.md`
- `docs/working/language-driven-flow-loop-plan.md`
- sanitized run-1 and run-2 debug documents
- reports t213, t215, t217, t325, and t326
- Core Flow Bootstrap evidence-loop limits, evidence-loop orchestration,
  completion answerability, and plan-evidence schema source
- downstream default LLM budget and live-plan authorization source

No tests were executed. This report is the only file changed.
