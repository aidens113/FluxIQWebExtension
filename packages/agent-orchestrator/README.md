# Bounded improvement workflow primitives

This private package defines vendor-neutral task packets and review gates for
human-triggered improvement work. It does not invoke an agent, create or mutate
a worktree, run a command, merge, publish, or deploy.

The intended caller gathers authoritative changed-file data and run results,
then uses this package to:

1. create and validate a task packet with a named human authorization;
2. render an agent-readable task whose commands remain argv arrays;
3. validate independently observed edits against one repository and exact
   allowed roots, and reconcile them against the agent response;
4. reject removed, changed, or optionalized protected expectations;
5. require the existing test-contract evaluation/comparison safety signals;
6. return `approve-for-human-review` (never an automatic merge decision); and
7. append workflow decisions to a SHA-256 hash-chained NDJSON audit log.

Path validation is lexical and does not resolve filesystem links. The caller
must construct candidate edits from a trusted worktree diff and reject symlink
or reparse-point escapes before using the result as an authorization decision.
The append-only audit writer serializes calls made through one instance. A CI
coordinator must ensure one writer owns a task log; the hash chain detects
later mutation but is not a multi-process locking service.

## CLI

Build the package, then call its dependency-free JSON CLI through the workspace
binary or compiled entrypoint:

```text
fluxiq-agent-orchestrator task create request.json
fluxiq-agent-orchestrator result validate packet.json response.json observed-edits.json
fluxiq-agent-orchestrator review evaluate submission.json
fluxiq-agent-orchestrator audit verify audit.ndjson
fluxiq-agent-orchestrator worktree plan worktree-request.json
```

Every command prints one JSON object to stdout. Exit `0` means the validation
or gate accepted its input, exit `2` means a well-formed input was rejected by
policy, and exit `1` means the invocation or input could not be parsed safely.
No command invokes an agent, runs a supplied check, executes Git, changes a
worktree, or merges a candidate.

`task create` adds the mandatory prohibitions, validates the packet, and
returns both JSON and rendered Markdown. `result validate` combines response
contract checks with a separately collected trusted edit list. `review
evaluate` returns at most `approve-for-human-review`. `audit verify` rejects an
empty, malformed, or hash-inconsistent chain.

The worktree planner requires absolute repository, main-workspace, disposable
base, and worktree paths. The worktree must be inside its disposable base, and
that base may not overlap either the repository or main workspace. The caller
must attest that symlinks were resolved and reparse points are absent. An
accepted result contains create, inspect, and remove commands as
`{ executable, args, cwd }`; those argv objects are a plan for a separately
authorized coordinator, not execution.
