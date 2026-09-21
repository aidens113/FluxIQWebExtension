# t027 Batch Adoption

Status: Live attempt complete; batching not adopted; supervisor review pending
Updated: 2026-09-20
Owner: `w2-t027-batch-adoption`

## Result

The successful telemetry run showed that the provider used three single tool
calls and no batch. Sanitized evidence named two observation tools and one
press. Core's batch schema description, however, used filling form fields as
its only positive example while the higher-level exploration instruction
correctly forbids executing eventual workflow values merely to build a Flow.
That example no longer described a permitted adoption opportunity.

I changed only
`runtime/llm/evidence-batch/schema.ts`: the description now prefers grouping
two or more independent observations of the same current state, permits
multiple exploratory mutations only when independently needed and expected to
keep target handles stable, and explicitly forbids eventual workflow steps
merely to form a batch. No batch execution, stopping, telemetry, domain, or
downstream behavior changed.

## Live-first attempt

After a required Core compile, I reran the identical real DeepSeek lane once.
The credential was injected only into the child process from the authorized
local source. Environment-file target loading remained disabled, and no
credential, page data, selector, input, or value was inspected or reported.

- Run: `run-muagk23y-e3c51232`
- Isolated instance: `t027-batch-adoption`
- Run root: `F:\fxlab-runs\t027-batch-adoption`
- Scenario/task: `social-scheduler` / `social-scheduler-schedule-post`
- Provider/model: DeepSeek / `deepseek-chat`
- `maxActionsPerDecision`: `16`
- Whole evaluated run: 760,509 ms

### Build and adoption evidence

- Build outcome: proposed
- Build duration: 40,262 ms
- Provider decisions/calls: 4
- Tool calls: 3
- Input/output/total tokens: 41,605 / 1,008 / 42,613
- Estimated cost: USD 0.01963676
- Budget breaches / pending calls: 0 / 0
- Sanitized tool IDs: `web.detect_repeating_structure`,
  `web.inspect_current_page`, `web.press_control`
- Sanitized `batchDecisions`: `[]`

The description change therefore did **not** cause the provider to choose a
multi-action decision. No completed batch may be claimed.

### Post-build failure

The build settled at `2026-09-20T23:40:45.421Z`. The next sanitized settlement
was not recorded until `23:51:20.640Z`; the lane then failed at
`23:51:50.646Z` with:

- failure category: `environment.missing`;
- facility reason: `http.timeout`;
- operation stage: `control.request`;
- endpoint: `/api/programs/automation-studio/run-runtime-session`;
- request timeout: 30,000 ms.

The finalized evaluation recorded no playback actions, no reported verdict,
and no oracle. Although the build proposed a Flow, the failed lane did not
certify the complete create/apply/playback path. The long post-build wait is
separate from adoption: `batchDecisions` had already been published as empty
when the build settled.

## Validation and stop rule

- `pnpm --filter fluxiq build` passed before the live attempt.
- The real provider attempt was not retried.
- Per the brief, no adoption unit test, full suite, corpus, commit, or push was
  run after live acceptance failed.
- The earlier telemetry diff and its already-passing focused tests remain
  present in the isolated worktrees unchanged.
- `git diff --check` passed in both repositories, with only Git's existing
  Windows LF-to-CRLF checkout warnings.

## Next smallest lever

Wording alone is insufficient for this provider on this scenario. The next
smallest Core-only experiment is to place the existing `tool_calls` schema
variant before the per-tool singular variants in the evidence decision's
`oneOf`, while retaining the safety coordinator and all stop rules. The
current order presents completion first, every singular tool next, and the
batch variant last. Reordering changes no accepted shape and may remove a
provider choice bias without forcing a batch.

That experiment needs a new isolated live run and must still require:

1. at least one sanitized batch with two or more executed ordinals;
2. successful Flow creation, playback, and oracle;
3. no later action after any recorded stop boundary.

The current wording change is unproven as an adoption improvement and should
remain isolated until the supervisor decides whether to combine it with that
schema-order experiment. No commits or pushes were made.
