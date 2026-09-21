# Unified Decision Completion Repair

Status: Completion boundary diagnosed and minimally clarified; live rerun failed at the provider boundary before an evidence decision
Updated: 2026-09-20
Owner: `w2-unified-decision-completion-repair`

## Result

The prior unified-decision run's two completion refusals were traced to the
closed Flow-script parameter invariant. Each completion contained at least one
step key that matched neither a parameter id/label, a closed synonym, nor a
uniquely declared child of a structured parameter on the selected catalog
node. Core correctly returned `bootstrap.unknown_parameter` and created
nothing. The sanitized artifact does not publish the model-authored key or
value, so no more specific key is claimed here.

I made the smallest fail-closed schema/feedback correction: the Flow-script
format now states explicitly that form-field names, labels, and purposes are
values under a declared parameter such as `text` or `value`, never new keys;
completion feedback now tells the model to remove the undeclared path-tail key
and move its value under one of the closed `accepted.parameters` ids. No
normalizer, accepted parameter set, validator, batch coordinator, execution,
permission, or stop behavior changed.

The one permitted identical real-provider rerun failed on the first provider
request with sanitized `lab.generation_http_400`, before an evidence loop or
provider decision existed. It therefore did not exercise the correction and
cannot satisfy the required batch plus creation/playback/oracle gate. Per the
brief, I stopped without tests or another retry.

## Diagnosis from the first unified run

Source run: `run-muaibves-62a48bc2`.

Its sanitized trace recorded two `core.decision_unusable` steps, both with
`bootstrap.unknown_parameter`, followed by:

- failure code: `flow_bootstrap.evidence_unusable_decision`;
- stage: `provider_output_validation`;
- HTTP status: 400;
- issue code set: `bootstrap.unknown_parameter`.

The completion path is closed in these stages:

1. `acceptAutomationStudioFlowBootstrapResult` reads the provider's one-string
   Flow script.
2. The script assembler selects the catalog node and compares each step line's
   head against that node's declared parameters.
3. Matching accepts only exact parameter ids, labels, a closed synonym map, or
   a child key declared by exactly one structured parameter example.
4. Any remaining head produces `bootstrap.unknown_parameter`; the completion
   check feeds back the bounded plan path plus the selected node's declared
   parameter ids, and the plan is not built.

This distinguishes the failure from a malformed provider envelope, invalid
parameter value, handle-resolution failure, batch failure, or registry
validation after resolution. The exact authored path tail is intentionally not
present in the sanitized Lab snapshot. No raw response, page data, tool input,
selector, or value was opened to fill that gap.

## Minimal correction

Core files added to the existing unified-decision experiment:

- `runtime/flow-bootstrap/plan/flow-script-format.ts`
  - Added one format sentence requiring only exact parameter ids from the
    selected `nodeCatalog` entry after `node:`.
  - Explicitly distinguishes a form field's label/purpose (a value) from the
    step's parameter key.
- `runtime/llm/harness-options/bootstrap-completion.ts`
  - Added one closed correction sentence for `bootstrap.unknown_parameter`:
    remove the undeclared path-tail key and use an id in
    `accepted.parameters`.

The earlier unified provider-schema candidate remains unchanged in:

- `runtime/llm/evidence-batch/schema.ts`;
- `runtime/llm/evidence-loop.ts`.

Unsupported keys still fail closed because neither matching nor normalization
nor validation was changed. This is source inspection, not a new test result;
the live gate failed before post-live focused tests were authorized.

## One-shot live rerun

- Run: `run-muain918-d2c35ea4`
- Scenario/task: `social-scheduler` / `social-scheduler-schedule-post`
- Browser/target: isolated Chromium
- Provider/model: DeepSeek / `deepseek-chat`
- `maxActionsPerDecision`: 16
- Started: `2026-09-21T00:38:25.188Z`
- Build settled: `2026-09-21T00:39:40.177Z`
- Evaluated duration: 121,159 ms
- Build duration: 70,786 ms
- Evaluator provider-call observation: 1
- Build accounting/provider calls: absent
- Provider invocation classification: `unknown`
- Failure: `lab.generation_http_400`, HTTP 400
- Evidence loop: absent (`null`)
- Flow created: false
- Browser actions: 0
- Reported verdict / oracle: absent / absent
- Harness interventions: 0

This is not zero-adoption evidence after valid decisions. The request failed
before Core established an evidence loop, so no decision existed and no
`batchDecisions` array was published. It also does not refute the earlier run's
positive two-action batch; it simply supplies no new batch observation.

The sanitized evidence does not publish a provider explanation for the 400, so
this report does not infer whether it was schema validation, request handling,
or another provider-side cause.

## Validation and stop rule

- `pnpm --filter fluxiq build`: passed before the live rerun.
- `git diff --check`: passed for the four isolated Core files and this report,
  with only Git's existing Windows LF-to-CRLF warnings.
- No focused tests ran because the live lane did not pass.
- No broad suite, second retry, downstream edit, commit, merge, or push was
  performed.

## Handoff

Keep the four-file unified experiment isolated. The first run proves actual
two-action adoption but fails completion; the repair rerun failed before it
could test completion. A future run must still meet all four acceptance facts
in one attempt: a completed 2+ action batch, Flow creation/application,
successful playback, and a passing oracle. The current evidence is insufficient
to integrate either the unified schema or the wording correction.

No secrets or page content are included in this report.
