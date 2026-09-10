# Agent Working Document Protocol

Status: Active
Status detail: Protocol defined and adopted in both repositories; backlog
triage and compaction of oversized documents remain.
Created: 2026-09-10
Last updated: 2026-09-10
Owner: Senior supervisor agent
Scope: How the supervisor and workers use `docs/working/` as durable memory
and as the coordination substrate for multi-agent work.
Paired document: `F:\!FluxIQ\docs\working\agent-working-doc-protocol.md`
Related: [AGENTS.md](../../AGENTS.md), [working document index](./README.md)

---

## Current State

This section is authoritative. It is rewritten in place, never appended to,
and must stay under 150 lines. Everything below it is reference or history.

**Adopted.** Every working document in this repository follows the layout,
header block, ledger format, and lifecycle defined in
[The Protocol](#the-protocol). Every agent follows
[Agent Operating Rules](#agent-operating-rules) at the start of a task.

**Done**

- Protocol authored here and mirrored into FluxIQ Core.
- [Working document index](./README.md) created in both repositories and
  populated from the existing documents.
- `AGENTS.md` in both repositories links to the protocol and the index.

**Not done**

- Three documents here and ten in Core carry `Unclassified` status because
  their headers predate the controlled vocabulary. Each needs a one-time
  triage pass to set a real status, owner, and pairing.
- Oversized documents have not been compacted. The index flags every document
  over 800 lines. The largest is Core's `ui-ux-upgrade-audit-plan.md` at 5,944
  lines, which no agent can read within a normal context budget.
- No existing document has a `Current State` section yet. Retrofit happens
  opportunistically: the next agent to touch a document adds one.

**Next steps**

1. Triage `Unclassified` documents in both indexes, starting with the ones
   that pair across repositories.
2. Retrofit `Current State` into the two documents driving MVP Week 2:
   `llm-production-automation-plan.md` here and
   `adaptive-flow-training-roadmap.md` in Core.
3. Compact documents over 800 lines as they are next touched, per
   [Compaction](#compaction).

**Blockers:** none.

---

## Why This Exists

Agent context does not survive a session. Workers share no context with each
other or with the supervisor. A worker's completion report is a claim,
not a record. Working documents are therefore the only channel through which
one agent's knowledge reaches the next, and they have to be treated as a
durable data structure rather than as prose that accumulates.

The documents as they stand do not meet that bar, for four measured reasons.

**They are too large to read.** Nineteen documents across the two
repositories exceed 800 lines, sixteen of them in Core. Core's
`ui-ux-upgrade-audit-plan.md` is 5,944 lines and
`llm-assisted-deterministic-automation-expansion-plan.md` is 3,459. A document
that cannot be read inside a task budget cannot function as memory, and a
worker that skips it works from assumptions instead.

**Current truth is interleaved with history.** In
`llm-production-automation-plan.md`, one dated checkpoint section runs from
line 185 to line 1152. An agent looking for "what is true now" has to
reconstruct it from a chronological log. Appending is cheap for the writer and
expensive for every later reader.

**Status is unstructured.** Headers range from `Status: working document` to a
sentence describing partial completion of a certification harness. Some
documents have no header at all. Nothing can be triaged or indexed
mechanically.

**Cross-repository state is duplicated.** The same effort is tracked as
`action-visual-entity-target-plan.md` in both repositories, and this
repository's LLM production work overlaps Core's adaptive-flow and
LLM-assisted-expansion documents. Neither side declares which document owns
which contract, so both drift.

There is also a durability lesson already recorded here: a crash overwrote all
239,413 bytes of `llm-production-automation-plan.md` with NUL bytes while it
was untracked. Working documents are memory, so losing one loses the project's
accumulated context.

---

## The Protocol

### Directory layout

```text
docs/working/
  README.md                              index of every working document
  <effort-slug>.md                       the working document
  <effort-slug>/
    reports/<agent-label>.md             worker write-back, one file per agent
    archive/YYYY-MM-DD-<topic>.md        compacted history
```

The per-effort subdirectory is created only when it is needed: when workers
are dispatched, or at the first compaction.

### Header block

Every working document opens with an H1 followed by this block, one field per
line, no blank lines between fields:

```text
Status: <controlled value>
Status detail: <one sentence>
Created: YYYY-MM-DD
Last updated: YYYY-MM-DD
Owner: <role, agent, or area>
Scope: <one or two lines>
Paired document: <path in the other repository, or "none">
Related: <links>
```

`Status` takes exactly one of:

| Value | Meaning |
| --- | --- |
| `Active` | Work is in progress or queued. |
| `Paused` | Deliberately stopped; may resume. Say why in `Status detail`. |
| `Blocked` | Cannot proceed. Name the blocker in `Status detail`. |
| `Complete` | Delivered and validated. Retained for reference. |
| `Superseded` | Another document owns this now. Link it in `Status detail`. |
| `Archived` | Historical only. Do not plan current work from it. |
| `Unclassified` | Predates this protocol. Needs a triage pass. |

Nuance belongs in `Status detail`, never in the `Status` value itself.

### Section order

1. `## Current State` — required, authoritative, under 150 lines.
2. Reference sections — objective, design, ownership, invariants, phases.
3. `## Work Ledger` — append-only history.
4. `## Open Questions` — unresolved decisions, each owned by someone.

`Current State` is rewritten in place. It answers, for an agent with no prior
context: what is true now, what is done, what is not done, what is next, what
is blocked. If `Current State` and a ledger entry disagree, `Current State`
wins and the ledger entry is history.

### Work Ledger entries

Append one entry per completed unit of work. Keep each under 15 lines.

```text
### YYYY-MM-DD — <short title>
- Agent: <supervisor | worker label>
- Changed: <files or modules>
- Why: <one or two lines>
- Validation: `<exact command>` -> <actual observed result>
- Outcome: Accepted | Partial | Reverted | Blocked
- Follow-up: <next action, or "none">
```

The `Validation` line records the command that ran and what it actually
printed. "Worker reported success" is not a validation result and must not
appear. If nothing was run, write `not validated` and say why. This mirrors
the rule in `AGENTS.md` that completion reports are not verification by
themselves.

### Compaction

When a document passes 800 lines, or its ledger passes 20 entries, the next
agent to touch it compacts before doing anything else:

1. Fold settled outcomes into `Current State`.
2. Move superseded detail into
   `docs/working/<effort-slug>/archive/YYYY-MM-DD-<topic>.md`.
3. Leave a one-line pointer at the point of removal.
4. Record the compaction as a ledger entry.

Compaction removes redundancy, not evidence. Anything that could still explain
a decision moves to the archive rather than being deleted.

### Worker briefs and reports

Parallel workers must never edit the same file. Two agents editing one
markdown document will silently lose each other's writes. So:

- The supervisor writes a brief into the working document **before**
  dispatch, under a `## Worker Briefs` section.
- Each worker writes its findings to its own file at
  `docs/working/<effort-slug>/reports/<agent-label>.md`.
- Workers never edit `Current State` or the `Work Ledger`.
- The supervisor reads the report files, independently verifies the claims,
  merges the outcome into `Current State`, and appends the ledger entry.

Brief format:

```text
### Brief: <agent-label>
- Repository: <this repository | FluxIQ Core>
- Task: <what to accomplish>
- Required reads: <this document's Current State, plus specific files>
- Owns (may edit): <explicit paths>
- Must not touch: <explicit paths>
- Definition of done: <observable outcome, including checks to run>
- Report to: docs/working/<effort-slug>/reports/<agent-label>.md
```

`Owns` and `Must not touch` are what make parallel work safe. Partition by
file, never by topic. If two briefs need the same file, the work is serial.

### Cross-repository pairing

An effort spanning this repository and FluxIQ Core gets one document in each,
named identically, each naming the other in `Paired document`.

Each shared contract has exactly one owning document. The owning side records
the contract's state; the paired side links to it and does not restate it. By
default Core owns domain-neutral contracts and this repository owns
browser-specific ones, matching the boundary rules in `AGENTS.md`.

A change crossing the boundary gets one full ledger entry in the owning
document and a one-line entry in the paired document referencing it by date
and title. Per `AGENTS.md`, the user is alerted before the first Core edit of
a task, and Core work follows Core's own `AGENTS.md`.

### Index

`docs/working/README.md` lists every working document with its status, owner,
size, one-line scope, and paired document. It is the cheapest possible entry
point: an agent reads it to find the right document instead of listing the
directory and guessing. Any agent that creates, retires, or re-statuses a
document updates the index in the same work unit.

### Durability

Working documents are tracked in git and committed as part of the work that
changes them, not batched at the end. An uncommitted working document is one
crash away from taking the project's memory with it, which has happened here
once already.

---

## Agent Operating Rules

**Starting a task, as the senior supervisor agent**

1. Read `AGENTS.md`.
2. Read [docs/working/README.md](./README.md) and pick the relevant document.
3. Read that document's `Current State` and nothing else yet.
4. Read deeper sections, the ledger, or the archive only when the task demands
   it.

**Starting a task, as a worker**

Read your brief, the files it names, and the `Current State` of the working
document it points to. Nothing else: not the index, not the rest of that
document, not the repository's planning documents. Reading more is how a
worker spends the context its actual task needs. If the brief is not enough
to do the work correctly, say so rather than reading broadly — an
insufficient brief is the supervisor's defect to fix.

**During a task**

Record decisions, findings, and validation results as they happen. A working
document updated only at the end of a session is a summary, not memory: the
reasoning that would help the next agent is exactly what gets dropped.

**Ending a task**

Update `Current State`, append the ledger entry, update the index if status
changed, and commit. Per `AGENTS.md`, leave enough for the next agent: what
changed, why, files affected, tests performed, known failures, remaining work,
and the recommended next task.

---

## Rollout Plan

**Phase 1 — Define and link.** Complete. Protocol authored in both
repositories, indexes created and populated, `AGENTS.md` updated in both.

**Phase 2 — Triage.** Resolve every `Unclassified` entry in both indexes. Set
a real status, owner, and pairing. Start with documents that exist in both
repositories, since those are the ones that drift. No content rewriting in
this phase.

**Phase 3 — Retrofit active documents.** Add a `Current State` section to each
document the index marks `Active`, sourced from its existing status prose and
most recent checkpoint. Do not rewrite history.

**Phase 4 — Compact on touch.** Compact any document over 800 lines the next
time work touches it. Do not schedule a bulk rewrite; compaction with no
active task tends to discard context whose value is not yet visible.

**Phase 5 — Retire the superseded.** Core's six Automation Studio documents
carrying a 2026-08-29 historical tracking notice are marked `Superseded` in
the index with their successor named, so no agent reads them as current.

---

## Work Ledger

### 2026-09-10 — Protocol authored and adopted in both repositories

- Agent: supervisor
- Changed: `docs/working/agent-working-doc-protocol.md`,
  `docs/working/README.md`, `AGENTS.md`, and the mirrored trio in
  `F:\!FluxIQ`.
- Why: Working documents were already serving as agent memory without a format
  that made them readable, indexable, or safe for parallel worker writes.
- Validation: `wc -l` and `git ls-files docs/working` across both repositories
  -> 5 tracked documents here, 23 in Core, 11 of them over 800 lines.
  Documentation-only change, so no build or test check applies.
- Outcome: Accepted
- Follow-up: Phase 2 triage of `Unclassified` documents.

### 2026-09-10 — Role model, push policy, and AGENTS.md condensation

- Agent: supervisor
- Changed: `AGENTS.md`, new `docs/architecture/repository-layout.md`, this
  protocol, and the Core equivalents.
- Why: The user defined the senior supervisor / worker split, asked the
  supervisor to push `dev` on its own after validated work, and flagged that
  `AGENTS.md` was too large to be mandatory reading for every agent.
- Validation: every internal link target and the Core `#repository-boundary`
  anchor resolved by file check; `wc -l AGENTS.md` -> 277 here and 266 in
  Core. Documentation only, so no build or test check applies.
- Outcome: Accepted
- Follow-up: Phase 2 triage of `Unclassified` documents.

---

## Open Questions

- **Where does this protocol live long term?** It is a standing convention,
  not a plan, so `docs/architecture/` may be its eventual home. Kept in
  `docs/working/` for now because that is where agents are already told to
  look. Owner: user.
- **Should the 800-line cap be enforced mechanically?** This repository
  already has a `pnpm boundary:audit` script for boundary rules; a similar
  check could flag oversized or badly headed working documents. Deferred until
  the protocol has survived real use. Owner: senior supervisor agent.
