# Agent Token Efficiency Plan

Status: Active
Status detail: Plan authored from the user's advisor draft; Phase 0 is partly done (baseline repaired, CLAUDE.md files pending), Phases 1 to 4 not started.
Created: 2026-09-10
Last updated: 2026-09-10
Owner: Senior supervisor agent
Scope: Keeping the senior supervisor agent's context small on every project: fix instruction loading, add a global layer under `~/.claude` fed from a shared brain repository, define global / family / project / task memory tiers, and enforce delegation, worker return, and handoff rules mechanically.
Paired document: `F:\!FluxIQ\docs\working\agent-token-efficiency-plan.md`
Related: [AGENTS.md](../../AGENTS.md), [agent working document protocol](./agent-working-doc-protocol.md), [module size governance plan](./module-size-governance-plan.md)

---

## Current State

**Origin.** The user brought a draft, written with an advisor, for cutting
token cost by keeping the directly prompted agent light and pushing heavy
work into isolated sub-agents that report back briefly, with a `.brain/`
directory as the shared memory. The draft is refined here, not adopted as
written: most of what it describes already exists in this repository and in
Core under other names, and the parts that do not exist are better placed in
a global layer so they carry to every future project. The user's two standing
requirements are that the system works globally for all projects and that it
separates global shared memory from project-specific memory.

**What already exists.** The supervisor / worker role split, role-scoped
required reading, `docs/working/` as memory with a generated index and an
authoritative `Current State` per document, written worker briefs with
per-worker report files, the 800-line compaction threshold, and the ledger
rule that a `Validation` line must quote a command and its observed output.
All of it is in `AGENTS.md` and the protocol, and the header, `Current
State`, size, and index rules are enforced by `pnpm structure:check`.

**Gaps found.**

1. **`AGENTS.md` is not loaded by Claude Code.** Claude Code reads
   `CLAUDE.md` only, and neither repository has one. A supervisor session
   sees the role rules only if the model chooses to open the file. This
   session's own context confirms it: the auto-memory loaded, `AGENTS.md`
   did not. The fix is a one-line `CLAUDE.md` containing `@AGENTS.md`.
2. **Standing preferences are trapped in one repository's auto-memory.**
   Claude Code keys auto-memory by git repository, so the seven memories
   under `~/.claude/projects/f---FluxIQWebExtension/memory/` (roles, Opus 5
   workers, mechanical enforcement, tests placement, push policy, working
   docs as memory, role-scoped reading) load here and nowhere else, Core
   included. The `pinned` flag that loads them in full is undocumented.
3. **There is no global layer.** `~/.claude/` holds a two-key
   `settings.json` and nothing else: no `CLAUDE.md`, agents, skills, rules,
   or hooks. The worker model preference is held by memory, not by config.
4. **Rules that matter most are prose only.** Nothing stops a worker
   committing, nothing checks that a worker wrote its report file, the
   150-line `Current State` cap is not audited, and a ledger entry with no
   real `Validation` line passes.
5. **Every brief pays the same overhead.** Worker operating rules are
   restated per brief because there is no worker agent definition to hold
   them once.
6. **`pnpm check` was failing on `dev`.** The `scripts/` directory count is
   32 against a baseline of 31, because the baseline was generated before
   `scripts/structure-audit.mjs` was tracked. Repaired in this work unit; see
   the ledger.

**Decisions.**

- No `.brain/` directory. `docs/working/README.md` plus each document's
  `Current State` is the draft's `projects.md`; `AGENTS.md` plus
  `docs/architecture/` is its `areas.md`; `## Worker Briefs` plus
  `docs/working/<effort>/reports/` is its `subagents/`. A second board would
  split the truth.
- The global layer is a git repository, proposed at `F:\!AgentBrain`, whose
  `install.mjs` writes `~/.claude/CLAUDE.md`, `agents/`, `skills/`,
  `hooks/`, and the `settings.json` fragment. Git makes it durable and
  portable; the install script makes drift detectable.
- Four memory tiers with a placement rule, in [Memory Tiers](#memory-tiers).
- Delegation is a rule with criteria, not "always spawn a sub-agent";
  dispatch has fixed overhead and a worker's claim still needs verifying.
- Workers run through one global `worker` agent definition: Opus 5, no
  `Agent` tool, discovery rule and return contract in its system prompt.
- Enforcement is by hooks and the structure audit, not by more prose.

**Phases.**

| Phase | Content | Status |
| --- | --- | --- |
| 0 | `CLAUDE.md` in both repositories; baseline repair | Baseline done; `CLAUDE.md` pending |
| 1 | Brain repository, global `CLAUDE.md`, worker agent, hooks, skills | Not started |
| 2 | Delegation rule and return contract in `AGENTS.md` and the protocol; audit extension; memory promotion | Not started |
| 3 | Templates and bootstrap for future projects | Not started |
| 4 | Measure and trim | Not started |

**Next steps**

1. Phase 0: add `CLAUDE.md` to both repositories; confirm with `/context`
   that `AGENTS.md` appears under memory files.
2. Phase 1: create the brain repository and run its install; confirm
   `/agents` lists `worker` and a worker's `git commit` is denied.
3. Phase 2, Core first then mirror: delegation rule, return contract, audit
   extension, and the memory promotion.

**Blockers:** none. Two choices are the user's: the brain repository's
location and name, and whether Opus 5 is the worker default on non-FluxIQ
projects as well.

---

## The Draft, Mapped Onto What Exists

| Draft element | Existing equivalent | Decision |
| --- | --- | --- |
| `CLAUDE.md` orchestrator blueprint | `AGENTS.md` roles, modes, reading rules | Keep `AGENTS.md` as the tool-neutral source; add a thin `CLAUDE.md` that imports it. The universal part moves to the global `CLAUDE.md`. |
| `.brain/projects.md` master board | `docs/working/README.md` index and each `Current State` | Already better: generated, statused, size-checked. Not added. |
| `.brain/areas.md` architecture rules | `AGENTS.md`, `docs/architecture/` | Already static and human-owned. Not added. |
| `.brain/subagents/<task>.md` briefs | `## Worker Briefs` in the working document | Keep briefs in the document so they are versioned with the work and compacted later; no orphan files to clean up. |
| "Must spawn a sub-agent for any multi-file task" | Mode 2 and partition-by-file | Replaced by the [Delegation Rule](#delegation-rule) with criteria on both sides. |
| "Return a 3-sentence summary" | Report file per worker | Replaced by a structured return of at most 12 lines with `Not verified`; three sentences invite the state-sync hallucination the draft warns about. |
| "Close the tab; zero token footprint" | Protocol "Ending a task" | Becomes `/handoff` then `/clear`, with a `SessionStart` hook that re-injects the pointer. |
| "Dependency discovery step" | Not present | Goes into the worker agent's system prompt once, so briefs stay short. |
| "Proof of execution before marking complete" | Ledger `Validation` line | Kept and enforced: audit checks the line, a `SubagentStop` hook checks the report file. |
| "Human reviews the brain" | Index and `Current State` | Kept; the `Stop` hook surfaces uncommitted working documents so there is something to review. |

The draft's PARA framing maps cleanly: Projects are `Active` working
documents; Areas are `AGENTS.md` and `docs/architecture/`; Resources are the
brain repository's lessons and templates; Archive is
`docs/working/<effort>/archive/` and the `Superseded` and `Archived`
statuses.

---

## Memory Tiers

| Tier | Lives at | Loaded when | Written by |
| --- | --- | --- | --- |
| Global rules | `F:\!AgentBrain\global\CLAUDE.global.md`, imported by `~/.claude/CLAUDE.md` | Every session of every project | User, or supervisor with user approval |
| Global lessons | `F:\!AgentBrain\lessons\global\*.md`; one-line index imported alongside the rules | Index always; a lesson body only when relevant | Supervisor, on promotion |
| Family lessons | `F:\!AgentBrain\lessons\<family>\*.md`, index imported from the project `CLAUDE.md` | Every session of that family's projects | Supervisor, on promotion |
| Project rules | `AGENTS.md` via `CLAUDE.md`; `.claude/rules/*.md` with `paths:` for path-scoped extras | `AGENTS.md` always; a scoped rule when a matching file is read | Supervisor |
| Project state | `docs/working/` | Index rows via the `SessionStart` hook; `Current State` on `/resume` | Supervisor; workers via report files |
| Project local | `~/.claude/projects/<slug>/memory/`, `CLAUDE.local.md` | Auto-memory index always; bodies on demand | The harness; the user for machine paths |
| Task | Brief in the working document, `reports/<label>.md`, the session scratchpad | Worker reads its brief only | Supervisor writes the brief, worker the report |

**Placement rule.** Ask, in order: would this be true in a different
repository? Then it is global, or family if it is true only of a group of
repositories such as FluxIQ Core and this one. Is it true for everyone who
clones this repository? Then it is project rules or project state, tracked in
git. Is it true only on this machine? Project local. Only for this task?
Task. A lesson that could apply beyond the current project is written to the
global or family tier as well as wherever the harness put it.

**Why a family tier.** FluxIQ is two repositories with two auto-memory slugs.
Five of the seven current memories apply to both; two are not FluxIQ-specific
at all (role-scoped reading, mechanical enforcement). Without a family tier
they either stay trapped here or get copied by hand into Core.

**Auto-memory stays as the harness's inbox.** It is machine-local and its
`pinned` behaviour is undocumented, so nothing durable depends on it. After
promotion to the brain a memory is unpinned so it costs one index line, not
its full body, per session.

---

## Delegation Rule

Dispatching a worker costs a brief, the worker's own load of `CLAUDE.md` and
its agent definition, its re-reading of files the supervisor may already have
seen, and the supervisor's verification of its claims. It pays off when the
reads the worker will do would otherwise land in the supervisor's context.

**Delegate when any of these holds.**

- The task needs more than about five files read whose content the
  supervisor will not need afterwards.
- An iterative loop is expected: run, fix, rerun.
- Bulk mechanical edits across many files, partitionable by file.
- Bounded investigation or implementation in FluxIQ Core.
- Two or more independent pieces can run in parallel without touching the
  same file.

**Keep with the supervisor.**

- A focused edit to one or two files the supervisor already understands.
- Verifying a worker's claims, integrating results, resolving conflicts.
- Anything that needs the user's conversation context to judge.
- Anything expected to finish in a handful of tool calls.

**Reads are the cost.** Route discovery through `Explore` or a worker and
read only the conclusion. When the supervisor must read, read `Current
State` sections and line ranges, not whole documents.

**Brief budget.** At most 40 lines, in the protocol's brief format. The
worker's operating rules are not repeated in the brief; they are in the agent
definition.

**Worker return contract.** The worker's final message is at most 12 lines:

```text
Outcome: Done | Partial | Blocked
Changed: <files>
Validation: `<command>` -> <observed result, or "not run" and why>
Not verified: <what the worker could not or did not check>
Report: docs/working/<effort>/reports/<label>.md
Notes: <at most three lines>
```

Everything else goes in the report file. The supervisor verifies before
merging into `Current State`, per the protocol.

---

## Global Layer Design

Repository `F:\!AgentBrain` (name and location are the user's call):

```text
global/CLAUDE.global.md      universal rules, at most 60 lines
agents/worker.md             the worker definition
skills/resume/SKILL.md       read index rows and one Current State, state Mode
skills/handoff/SKILL.md      the ending-a-task checklist, then commit and push
hooks/*.mjs                  dependency-free node scripts, tests in hooks/tests/
lessons/global/, lessons/<family>/   one lesson per file; INDEX.md generated
templates/                   CLAUDE.md, AGENTS.md skeleton, protocol, working-doc skeleton, brief, report
settings.fragment.json       env, hooks, permissions to merge into ~/.claude/settings.json
install.mjs                  writes ~/.claude; --check fails on drift or over-budget files
```

**`~/.claude/CLAUDE.md`** is one line: `@F:/!AgentBrain/global/CLAUDE.global.md`.
Imports from the user-level file need no approval dialog.

**`global/CLAUDE.global.md`** carries only what changes behaviour on every
project: the two roles and their obligations; the required-reading rule by
role; the four memory tiers and the placement rule; the delegation rule in
short form; the worker return contract; "workers never commit or push";
"`/resume` to start, `/handoff` to end, then `/clear`"; "a completion report
is a claim; validate before recording". Budget 60 lines, checked by
`install.mjs --check`.

**`agents/worker.md`** frontmatter: `name: worker`, `model: opus`,
`disallowedTools: Agent`, and a description that says it executes one bounded
brief from the senior supervisor agent. Body, at most 60 lines: read the
brief, the files it names, and the `Current State` it points to, nothing
else; before editing a module, read its directory barrel and the type
definitions it imports; edit only files the brief says you own; write the
report file; if the brief is insufficient, stop and say so; end with the
return contract. Because `~/.claude/agents/` is available in every project,
briefs everywhere shrink to the task itself.

**Settings fragment.**

```json
{
  "env": { "CLAUDE_CODE_SUBAGENT_MODEL": "opus" },
  "permissions": { "allow": ["Bash(pnpm check *)", "Bash(pnpm test *)", "Bash(pnpm build *)", "Bash(pnpm structure:check *)", "Bash(git status *)", "Bash(git diff *)", "Bash(git log *)"] },
  "hooks": { "...": "see Mechanical Enforcement" }
}
```

`CLAUDE_CODE_SUBAGENT_MODEL` makes Opus 5 the default for every subagent,
built-in ones included, without relying on memory. Per-invocation `model`
still overrides it.

**Skills.** `/resume [document]` prints the `Active` rows of
`docs/working/README.md`, reads the named document's `Current State`, and
states `Mode:`. `/handoff` runs the checklist: rewrite `Current State`;
append a ledger entry whose `Validation` line quotes what was actually run;
regenerate the index (`pnpm structure:baseline` where the audit exists);
promote any generalizable lesson to the brain and unpin it locally; commit
with the working documents; push `dev` if the `AGENTS.md` criteria hold;
print `Next: /clear, then /resume <document>`. Both skills are global, so
every project gets the same lifecycle.

---

## Mechanical Enforcement

| Check | Event | Behaviour |
| --- | --- | --- |
| Worker git guard | `PreToolUse`, matcher `Bash\|PowerShell` | Deny `git commit`, `push`, `tag`, `reset --hard`, `rebase` when the hook input carries `agent_id`, which only subagent calls do. The main session is unaffected. |
| Worker report guard | `SubagentStop`, `agent_type` = `worker` | Exit 2 with "write your report file and end with `Report: <path>`" unless the final message names a report path that exists. |
| Session pointer | `SessionStart`, matchers `startup\|clear\|compact\|resume` | Print at most 15 lines: repository, branch, uncommitted files under `docs/working/`, the `Active` document names and line counts, and `Run /resume <document>`. |
| Handoff reminder | `Stop` | If `git status` shows changes under `docs/working/`, emit a `systemMessage` saying so. Warn, never block, because a blocking `Stop` can loop. |
| Instruction metrics | `InstructionsLoaded` | Append `{time, cwd, file, load_reason, bytes}` to `~/.claude/brain-metrics.ndjson`. This is how Phase 4 measures what the hierarchy costs. |
| Budgets | `install.mjs --check` | Fail if `CLAUDE.global.md` > 60 lines, any agent body > 60 lines, any skill > 80 lines, the global lessons index > 40 lines, or installed copies differ from the repository. |
| Ledger and Current State shape | `working-docs` audit rule, Core first then mirrored | Fail a ledger entry without a `- Validation:` line, or one containing "reported success" or "worker reported"; fail a `Current State` over 150 lines. Ratcheted like the other rules. |

Hook scripts read stdin JSON and write the documented `hookSpecificOutput`
shape. Each has a test under `hooks/tests/` fed with recorded inputs,
including compound commands joined by `&&` and a PowerShell tool call, since
PowerShell is a separate tool from Bash on this machine.

---

## Session Lifecycle

1. Open a session. The `SessionStart` hook prints the pointer.
2. `/resume <document>`: index rows, one `Current State`, `Mode:` declared.
3. Work. The supervisor delegates by the rule above, briefs in writing,
   verifies returns, and records to the working document as it goes.
4. `/handoff`: the checklist, commit, push if the criteria hold.
5. `/clear`. The next task starts from disk, which is exactly what the
   working document was written for. The user's draft calls this the
   trash-and-refresh cycle; here it costs one command and loses nothing
   because nothing durable was in the conversation.

---

## Phases

### Phase 0 — Make the existing rules load

- Add `CLAUDE.md` to this repository and to Core. Content: `@AGENTS.md`, then
  at most eight Claude-specific lines: the two lifecycle skills, and the note
  that workers are dispatched through the `worker` agent. Nothing that
  belongs in `AGENTS.md` goes here.
- Repair the `scripts/` baseline. Done; ledger below.
- Validation: `/context` shows `AGENTS.md` under memory files in both
  repositories; `pnpm structure:check` passes in both.

### Phase 1 — Global layer

- Create the brain repository with the layout above. Author
  `CLAUDE.global.md`, `worker.md`, the two skills, the five hooks with tests,
  the settings fragment, and `install.mjs` with `--check`.
- Run `install.mjs`. Check `/agents` lists `worker`; `/context` shows the
  global file; a throwaway worker asked to run `git commit` is denied; a
  worker that ends without a report line is sent back once.
- Update the user-level `settings.json` only through the install script so
  the repository stays the source of truth.

### Phase 2 — Protocol, audit, and memory promotion

- `AGENTS.md`, both repositories in one work unit: a "Delegation" subsection
  of at most 12 lines under Workflow Modes, and a pointer to the return
  contract. Keep `AGENTS.md` under 300 lines; it is 277 here.
- Protocol, both repositories: add the return contract and a report-file
  template under "Worker briefs and reports"; add the 40-line brief budget.
- Audit: extend `working-docs.mjs` in Core, mirror here byte for byte, run
  `pnpm structure:baseline` in both so existing entries are frozen.
- Promote the seven auto-memories: two to `lessons/global/`, five to
  `lessons/fluxiq/`; import the family index from both project `CLAUDE.md`
  files; unpin the local copies.

### Phase 3 — Templates for future projects

- `templates/` in the brain: `CLAUDE.md`, an `AGENTS.md` skeleton holding
  the generic sections (roles, start here, working documents, modes,
  validation, commit policy) with project-specific sections marked, the
  protocol, a working-document skeleton, brief and report templates.
- A dependency-free `tools/working-docs-audit.mjs` in the brain, extracted
  from the `working-docs` rule, so a repository without the FluxIQ structure
  audit still gets header, `Current State`, size, and index enforcement.
- Optional skills once the lifecycle has been used for real: `/brief` to
  scaffold a brief into a document, `/lesson` to write a lesson and
  regenerate the index, `/new-project` to lay the templates down.

### Phase 4 — Measure and trim

- After two weeks of use, read `brain-metrics.ndjson`: bytes always loaded
  per session, per file. Targets: global always-loaded at most 4 KB; project
  always-loaded (`CLAUDE.md`, `AGENTS.md`, unscoped rules) at most 20 KB.
- If `AGENTS.md` is over target, move path-specific sections (testing
  facility boundary, generated data detail) into `.claude/rules/*.md` with
  `paths:` so they load only when a matching file is read. `AGENTS.md` keeps
  a one-line pointer for tools that do not read rules.
- Revisit the delegation thresholds against what the supervisor actually
  read in sessions where it did not delegate.

---

## Risks And Controls

| Risk | Control |
| --- | --- |
| Telephone game: a poor summary drops a nuance and the project drifts | `Current State` is rewritten in place and capped; report files keep the detail; the supervisor verifies before merging. |
| Blind context: a worker does not know a distant type or helper | Discovery rule in the worker definition; briefs name files; a worker with an insufficient brief stops instead of reading broadly. |
| State-sync hallucination: "task complete" with nothing run | Audited `Validation` line; report guard on `SubagentStop`; `/handoff` runs the checks before it writes the entry. |
| Phase 0 raises always-loaded bytes by about 15 KB per session | Deliberate: correctness of the role rules comes first; Phase 4 measures and trims. |
| Hooks misfire on compound commands or the PowerShell tool | Recorded-input tests; matcher covers both tools; deny on any git write inside a compound command. |
| Brain and repository copies of the protocol drift | Canonical text in the brain; "change the brain first, then mirror"; `install.mjs --check` for the installed files. |
| Windows: symlinks need Developer Mode | The install script copies; it does not link. |
| `pinned` auto-memory is undocumented behaviour | Nothing durable depends on it after Phase 2. |

---

## Work Ledger

### 2026-09-10 — Plan authored; scripts baseline repaired

- Agent: supervisor
- Changed: this document and its Core pair; `.structure-baseline.json`
  (`directory-files` entry for `scripts/` reset and regenerated at 32);
  `docs/working/README.md` regenerated in both repositories.
- Why: The user asked for the advisor draft to be refined against the
  existing system. `pnpm check` was failing on `dev` because the baseline
  was written before `scripts/structure-audit.mjs` was tracked, so the
  index could not be regenerated on a passing check.
- Validation: `pnpm structure:check` -> passed in both repositories after
  `pnpm structure:baseline`; a `claude-code-guide` worker on Opus 5 confirmed
  the Claude Code facts this plan relies on (`CLAUDE.md` only, `@` imports,
  agent frontmatter, hook payloads, `CLAUDE_CODE_SUBAGENT_MODEL`).
- Outcome: Accepted
- Follow-up: Phase 0 `CLAUDE.md` files.

---

## Open Questions

- **Brain repository name and location.** `F:\!AgentBrain` follows the
  user's naming; a private GitHub remote like the other two would make it
  portable. Owner: user.
- **Is Opus 5 the worker default outside FluxIQ?** The global env var says
  yes for every project. Owner: user.
- **Should `AGENTS.md` sections move to path-scoped rules?** Only if Phase
  4 measurements show the project layer over budget; other tools that read
  `AGENTS.md` do not read `.claude/rules/`. Owner: senior supervisor agent.
- **`packages/agent-orchestrator`** defines task packets and review gates
  for human-authorized CI improvement agents. It is a different mechanism
  from interactive worker dispatch; whether the brief and return contract
  should later feed its packet schema is undecided. Owner: senior supervisor
  agent.
