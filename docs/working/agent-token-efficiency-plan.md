# Agent Token Efficiency Plan

Status: Active
Status detail: Phases 0 to 3 executed on 2026-09-10; merging the settings fragment into ~/.claude/settings.json is left to the user; Phase 4 (measure and trim) begins after real use.
Created: 2026-09-10
Last updated: 2026-09-10
Owner: Senior supervisor agent
Scope: Keeping the senior supervisor agent's context small on every project: fix instruction loading, add a global layer under `~/.claude` fed from a shared brain repository, define global / family / project / task memory tiers, and enforce delegation, worker return, and handoff rules mechanically.
Paired document: `F:\!FluxIQ\docs\working\agent-token-efficiency-plan.md`
Related: [AGENTS.md](../../AGENTS.md), [agent working document protocol](./agent-working-doc-protocol.md), [module size governance plan](./module-size-governance-plan.md)

---

## Current State

**Executed 2026-09-10.** Phases 0 to 3 are done; Phase 4 (measure and
trim) starts once the hooks have run in real sessions. One step is left to
the user: merging the settings fragment. The origin of the plan, the gaps it
found, and its decisions are in the sections below and in the first ledger
entry.

**What exists now**

- `CLAUDE.md` in both repositories imports `AGENTS.md` and the FluxIQ
  family lessons index. Until today Claude Code loaded no repository
  instructions in either repository, because it reads `CLAUDE.md` only.
- The brain repository `F:\!AgentBrain` (local, four commits, no remote):
  global rules (60 lines, budgeted), the `worker` agent (Opus 5, no `Agent`
  tool, discovery rule and return contract in its prompt), `/resume`,
  `/handoff`, `/lesson`, `/new-project`, five hooks with 39 recorded-payload
  tests, eight promoted lessons (six global, two FluxIQ), seven templates,
  a standalone working-docs audit with 18 tests, and `install.mjs`.
- Installed into `~/.claude`: `CLAUDE.md` (two imports), `agents/worker.md`,
  the four skills, and the settings fragment (env, permissions, five hooks),
  merged with the user's explicit permission. `install.mjs --check` passes.
- Live-tested in this session: a subagent's `git commit` in a throwaway
  repository was denied by the guard with the expected reason. The `worker`
  agent type joins the roster from the next session on.
- `AGENTS.md` in both repositories has the `Delegation` subsection; the
  protocol in both has the 40-line brief budget, the report format, and the
  12-line return contract.
- The `working-docs` audit rule (Core-owned, mirrored byte for byte) fails a
  `Current State` over 150 lines and a ledger entry without a real
  `Validation` bullet; 11 tests, run by `pnpm structure:test` in both.
- The eight auto-memories are unpinned; their content lives in the brain.
- Worker reports for this work unit are under
  `agent-token-efficiency-plan/reports/`.

**Left to the user**

1. Open a new session in either repository and run `/context`: `AGENTS.md`,
   the global rules, and both lessons indexes should appear under memory
   files. Approve the one-time dialog for the family-index import. The
   metrics hook then starts writing `~/.claude/brain-metrics.ndjson`.
2. Give the brain a private remote if it should survive this machine.

**Deviations from the plan as written**

- Six lessons went global and two to the FluxIQ family, not two and five:
  roles, working documents as memory, and the Opus default are now global
  rules, so their lessons belong beside them.
- `install.mjs` does not write `settings.json`; see above.
- The hearsay pattern is `reported success` or
  `workers? (reported|said|claimed)\b`; "worker reports" as a noun phrase
  is legitimate and was a false positive on this repository's protocol.
- The git guard also denies `merge`, `cherry-pick`, `am`, `stash`, bare
  `reset`, `filter-repo`, `branch -d`, and `gh pr create` or `merge`, and it
  keys on `agent_id`, so every subagent is guarded, not only `worker`. It
  strips heredoc bodies before scanning: the live test showed a report whose
  prose quoted `git commit` being denied.
- Claude Code refuses a subagent `Write` to a file named `report.md`, so the
  template is `worker-report.md` and the worker definition says never to use
  that name.

**Next steps**

1. The two user steps above.
2. Phase 4 after two weeks of use: read the metrics, compare against the
   4 KB global and 20 KB project targets, and move `AGENTS.md` sections
   into path-scoped rules only if the project layer is over target.
3. Use `/new-project` on the next repository and fix what the templates get
   wrong; both budgeted templates sit exactly at their caps.

**Blockers:** none.

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
skills/lesson/SKILL.md       record a global or family lesson, regenerate the index
skills/new-project/SKILL.md  lay the templates down in a repository (user-invoked only)
hooks/*.mjs                  dependency-free node scripts, tests in hooks/tests/
lessons/global/, lessons/<family>/   one lesson per file; INDEX.md generated
templates/                   CLAUDE.md, AGENTS.md skeleton, protocol, index, working-doc skeleton, brief, report
tools/working-docs-audit.mjs standalone port of the working-docs audit rule, no ratchet
settings.fragment.json       env, hooks, permissions for ~/.claude/settings.json, merged by the user
install.mjs                  writes ~/.claude/CLAUDE.md, agents, skills; --check fails on drift or over-budget files
```

**`~/.claude/CLAUDE.md`** is two import lines,
`@F:/!AgentBrain/global/CLAUDE.global.md` and the global lessons index.
Imports from the user-level file need no approval dialog. Each project
`CLAUDE.md` imports `AGENTS.md` and its family's lessons index; an import
from outside the working directory asks for a one-time approval.

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

The fragment is merged into `~/.claude/settings.json` by the user, or by an
agent only with the user's explicit permission in the conversation: Claude
Code's permission classifier otherwise refuses an agent write that adds
hooks there, which is the right boundary for a file whose entries execute
commands. `install.mjs` never writes it. `node install.mjs --print-settings`
prints the fragment with the brain path filled in, and `install.mjs --check`
reports until the merge is done.

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
| Worker git guard | `PreToolUse`, matcher `Bash\|PowerShell` | Deny `git commit`, `push`, `tag`, `rebase`, `merge`, `cherry-pick`, `am`, `reset`, `stash`, `filter-repo`, `branch -d`, and `gh pr create` or `merge` when the hook input carries `agent_id`, which only subagent calls do, after splitting the command on shell separators and PowerShell braces. The main session is unaffected. |
| Worker report guard | `SubagentStop`, `agent_type` = `worker` | Exit 2 with "write your report file and end with `Report: <path>`" unless the final message names a report path that exists. |
| Session pointer | `SessionStart`, matchers `startup\|clear\|compact\|resume` | Print at most 15 lines: repository, branch, uncommitted files under `docs/working/`, the `Active` document names and line counts, and `Run /resume <document>`. |
| Handoff reminder | `Stop` | If `git status` shows changes under `docs/working/`, emit a `systemMessage` saying so. Warn, never block, because a blocking `Stop` can loop. |
| Clear prompt | `Stop` | When the final message carries the `/handoff` footer (`Pushed:` or `Next: /clear`), emit a `systemMessage` asking whether to clear the message history now. A hook cannot run `/clear` or open a dialog, so the user answers by typing `/clear` or carrying on. Quiet on ordinary stops. |
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

## Worker Briefs

Dispatched 2026-09-10 for Phases 1 to 3. Workers run on Opus 5 through the
`general-purpose` agent because the `worker` definition is created in this
same work unit; the worker rules are therefore inlined in these dispatches
for the last time.

### Brief: hooks
- Repository: brain, `F:\!AgentBrain` (new, local only)
- Task: write the five hooks in [Mechanical Enforcement](#mechanical-enforcement) as dependency-free ES modules under `hooks/`, plus `node --test` tests under `hooks/tests/` fed from recorded stdin fixtures under `hooks/tests/fixtures/`. Confirm payload field names against https://code.claude.com/docs/en/hooks before writing. Every hook reads all of stdin as JSON; on malformed input or any thrown error it exits 0 with no output. `worker-git-guard.mjs`: on `PreToolUse` for tool `Bash` or `PowerShell`, when `agent_id` is present, split `tool_input.command` on `&&`, `||`, `;`, `|`, and newlines and deny if any segment is a git write (`commit`, `push`, `tag`, `rebase`, `merge`, `cherry-pick`, `am`, `reset`, `stash`, `filter-repo`, `branch -d`/`-D`) or `gh pr create`/`merge`; output `hookSpecificOutput` with `permissionDecision: "deny"` and a one-line reason saying the supervisor commits. `worker-report-guard.mjs`: on `SubagentStop` when `agent_type` is `worker` and `stop_hook_active` is not true, find `Report: <path>` in `last_assistant_message` and resolve it against `cwd`; if absent or the file does not exist, exit 2 with a one-line stderr instruction to write the report and end with `Report: <path>`. `session-pointer.mjs`: on `SessionStart`, print at most 15 lines to stdout: repository root, branch, uncommitted paths under `docs/working/`, the `## Active` rows of `docs/working/README.md` as `name (lines)`, and `Run /resume <document>`; print nothing when `cwd` is not inside a git repository or has no `docs/working/`. `handoff-reminder.mjs`: on `Stop` when `stop_hook_active` is not true and `git status --porcelain -- docs/working` is non-empty, print `{"systemMessage": ...}` naming the paths and `/handoff`; never block. `instruction-metrics.mjs`: on `InstructionsLoaded`, append one JSON line `{time, cwd, file_path, load_reason, bytes}` to `~/.claude/brain-metrics.ndjson`; never the content.
- Required reads: this brief and the Mechanical Enforcement section; the Claude Code hooks reference
- Owns (may edit): `F:\!AgentBrain\hooks\**`
- Must not touch: anything else in the brain; either FluxIQ repository except the report file
- Definition of done: `node --test hooks/tests/` passes from `F:\!AgentBrain` with at least one fixture per hook, including a compound `&&` command, a PowerShell tool call, a main-session call without `agent_id`, and malformed stdin; report written
- Report to: docs/working/agent-token-efficiency-plan/reports/hooks.md

### Brief: audit-ledger
- Repository: FluxIQ Core
- Task: extend `scripts/structure-audit/rules/working-docs.mjs` with two checks. (1) `Current State` length: count the lines from `## Current State` to the next `## ` heading; fail, ratcheted, key `<file>#current-state`, when over `ctx.LIMITS.workingDocCurrentStateLines`, which `context.mjs` already sets to 150. (2) Ledger validation: for each `### ` entry under `## Work Ledger`, require a bullet starting `- Validation:`; that bullet, including its continuation lines, must not match `/reported success|worker reported|workers? (said|claimed|reports?)/i`; emit one fail finding per file, ratcheted, key `<file>#ledger`, value = number of offending entries, limit 0, message listing the offending entry titles. Update the file's header comment. Add tests at `scripts/structure-audit/rules/tests/working-docs.test.mjs` with a fake `ctx` (shape in `context.mjs`) and in-memory fixtures covering: conforming document, over-long Current State, missing Validation bullet, forbidden phrase, document with no ledger, CRLF line endings.
- Required reads: this brief; `scripts/structure-audit/rules/working-docs.mjs`, `scripts/structure-audit/context.mjs`, `scripts/structure-audit/baseline.mjs`, `scripts/structure-audit.mjs`; the "Work Ledger entries" subsection of `docs/working/agent-working-doc-protocol.md`
- Owns (may edit): `scripts/structure-audit/rules/working-docs.mjs`, `scripts/structure-audit/rules/tests/**`
- Must not touch: `context.mjs`, `.structure-baseline.json`, `package.json`, any working document, the downstream repository. Never run `--update`.
- Definition of done: `node --test scripts/structure-audit/rules/tests/` passes; `node scripts/structure-audit.mjs --rule working-docs` runs without crashing and the report lists every new finding it produces, per file, since they fail until the supervisor baselines them; report written
- Report to: F:\!FluxIQWebExtension\docs\working\agent-token-efficiency-plan\reports\audit-ledger.md

### Brief: templates
- Repository: brain, `F:\!AgentBrain`
- Task: author the files a new repository starts from, under `templates/`. `CLAUDE.md`: this repository's root `CLAUDE.md` with the family import line marked `<!-- PROJECT: keep and set the family, or delete this line -->`. `AGENTS.md`: a generalized skeleton of this repository's `AGENTS.md`, at most 200 lines, keeping the generic sections (Agent Roles, Start Here, Working Documents Are Agent Memory, Workflow Modes including Delegation, Documentation Maintenance, Validation, Committing And Pushing) and replacing every project-specific fact — repository purpose, package layout, boundaries, commands, never-commit paths, live-validation specifics — with a `<!-- PROJECT: what to fill in -->` comment; Claude Code strips block HTML comments, so resolved placeholders cost nothing. `agent-working-doc-protocol.md`: this repository's protocol reduced to its normative sections (Directory layout, Header block, Section order, Work Ledger entries, Compaction, Worker briefs and reports including the report format and return contract, Cross-repository pairing phrased for any paired repository, Index, Durability, Agent Operating Rules) with a generic header block and no FluxIQ names, `Current State` narrative, ledger, or briefs. `docs-working-README.md`: an empty index in the shape of this repository's `docs/working/README.md`. `working-doc.md`: a skeleton with the header block and the four sections. `brief.md` and `report.md`: the two formats from the protocol.
- Required reads: this brief; `F:\!FluxIQWebExtension\CLAUDE.md`; `F:\!FluxIQWebExtension\AGENTS.md`; the named sections of `F:\!FluxIQWebExtension\docs\working\agent-working-doc-protocol.md`; `F:\!FluxIQWebExtension\docs\working\README.md` for the index shape
- Owns (may edit): `F:\!AgentBrain\templates\**`
- Must not touch: anything else
- Definition of done: the seven files exist; `wc -l` shows `AGENTS.md` at most 200 lines and the protocol at most 250; `grep -n` for "FluxIQ", "extension", "domain/", and "pnpm" across `templates/` finds matches only inside PROJECT placeholder comments, with the grep output in the report; report written
- Report to: docs/working/agent-token-efficiency-plan/reports/templates.md

### Brief: working-docs-tool
- Repository: brain, `F:\!AgentBrain`
- Task: write `tools/working-docs-audit.mjs`, a dependency-free standalone port of FluxIQ Core's `working-docs` audit rule for repositories that do not have the structure audit. Same checks: header block shape and status vocabulary, `## Current State` present within 20 lines after the header while `Active`, `Current State` at most 150 lines, ledger entries with a real `- Validation:` bullet and no hearsay phrase, document size at most 800 lines, and a `docs/working/README.md` index that must match what the tool generates. No ratchet and no baseline: every finding fails. Usage: `node working-docs-audit.mjs [--root <repo>] [--update]`; `--update` writes the index and exits 0; otherwise print one line per finding and exit 1 on any, or `working-docs: passed (<n> documents)` and exit 0. Tracked-file discovery: use `git ls-files docs/working` when the root is a git repository, else list the directory. The index shape: same as the rule's `generateIndex`, but without the FluxIQ cross-repository sentence and with a "Paired" column. Tests in `tools/tests/working-docs-audit.test.mjs` using `node:test`, running the tool as a child process against temporary directories: passing repository, each failure kind, `--update` producing an index that then passes.
- Required reads: this brief; `F:\!FluxIQ\scripts\structure-audit\rules\working-docs.mjs` (the source to port) and `F:\!FluxIQ\scripts\structure-audit\rules\tests\working-docs.test.mjs` (fixture ideas); `F:\!AgentBrain\package.json` for the test invocation
- Owns (may edit): `F:\!AgentBrain\tools\**`
- Must not touch: anything else; never edit the Core rule
- Definition of done: `node --test "tools/tests/*.test.mjs"` passes from `F:\!AgentBrain`; running the tool against `F:\!FluxIQWebExtension` with no flags prints its findings or passes, with the exact output in the report; report written
- Report to: docs/working/agent-token-efficiency-plan/reports/working-docs-tool.md

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

### 2026-09-10 — Phases 0 to 3 executed

- Agent: supervisor, with workers hooks, audit-ledger, templates, and
  working-docs-tool on Opus 5
- Changed: `CLAUDE.md` (new); `AGENTS.md` (Delegation); the protocol (brief
  budget, report format, return contract, duplicated bullet removed);
  `scripts/structure-audit/rules/working-docs.mjs` and `rules/tests/`
  (mirrored from Core); `package.json` (`structure:test`); four reports
  under `agent-token-efficiency-plan/reports/`; the brain repository (four
  commits) and `~/.claude`; the Core pair and its mirrors.
- Why: The user asked for the plan to be executed.
- Validation: `pnpm structure:test` -> 11 pass, 0 fail; `pnpm check` ->
  passed after `pnpm structure:baseline`; brain `npm test` -> 57 pass, 0
  fail; each hook piped a recorded payload against this repository and
  printed the expected deny, silence, exit 2, pointer, reminder, or metrics
  line; `node install.mjs --check` -> fails only on the settings step; the
  `~/.claude/settings.json` edit was denied by the permission classifier.
- Outcome: Partial
- Follow-up: user merges the settings fragment; confirm `/context` in a new
  session.

### 2026-09-10 — Settings merged; guard live-tested and fixed

- Agent: supervisor, with one Opus 5 subagent as the test subject
- Changed: `~/.claude/settings.json` (env, permissions, five hooks; with the
  user's explicit permission); brain `hooks/worker-git-guard.mjs` (heredoc
  bodies stripped) and its tests; `agents/worker.md` (never name a report
  `report.md`); `templates/report.md` renamed `worker-report.md`; this
  document's `Current State`.
- Why: The user granted the write the classifier had refused. The live test
  then showed two things worth fixing: the guard denied a heredoc whose
  prose quoted `git commit`, and Claude Code refuses subagent writes to a
  file named `report.md`.
- Validation: subagent ran `git commit --allow-empty` in a throwaway
  repository -> denied, reason `Blocked "git commit": workers must not
  change git history or open pull requests...`; brain `npm test` -> 59
  pass, 0 fail; `node install.mjs --check` -> `brain check passed`; the
  heredoc payload piped to the guard -> silence, exit 0.
- Outcome: Accepted
- Follow-up: confirm `/context` in a new session; Phase 4 after real use.

### 2026-09-10 — Clear-prompt hook added

- Agent: supervisor
- Changed: brain `hooks/clear-prompt.mjs`, its test and fixture,
  `settings.fragment.json`; `~/.claude/settings.json` (second `Stop`
  hook); the Mechanical Enforcement table here.
- Why: The user asked for a hook that asks whether to clear the message
  history. Hooks cannot run `/clear` or open a dialog, so the question is a
  `systemMessage` shown only after a `/handoff` footer.
- Validation: brain `npm test` -> 65 pass, 0 fail; `node install.mjs
  --check` -> `brain check passed`; a handoff-footer payload piped to the
  hook -> the question as `systemMessage`; an ordinary stop -> silence.
- Outcome: Accepted
- Follow-up: none.

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
