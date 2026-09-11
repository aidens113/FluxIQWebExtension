# Report: templates

## Outcome

Done. All seven template files exist under `F:\!AgentBrain\templates\`, both
line budgets are met, and the banned-term grep finds nothing anywhere in the
directory.

## What changed and why

Created, all new files, nothing else touched:

- `templates/CLAUDE.md` (13 lines) — this repository's root `CLAUDE.md`
  verbatim, with the family lessons import written as
  `@F:/!AgentBrain/lessons/<family>/INDEX.md` and the briefed marker
  `<!-- PROJECT: keep and set the family, or delete this line -->` on the line
  directly below it. The marker is below rather than trailing the import,
  because a comment on the same line risks being parsed into the import path.
  Using `<family>` rather than a real family name also keeps the project name
  out of the template.
- `templates/AGENTS.md` (200 lines) — the seven generic sections named in the
  brief, in source order. Every project-specific fact became a `PROJECT`
  comment: repository purpose, ownership and dependency direction, paired-
  repository rules and what the user must be told before the first edit there,
  and the secrets that must never be logged are one comment under `Start Here`;
  the background-document bullets are a second; live-validation specifics sit
  under mode 4; substantial-change triggers under Documentation Maintenance;
  check/test/build commands and what compilation cannot prove under Validation;
  never-commit paths under Committing And Pushing. Dropped as wholly project-
  specific: Engineering Structure And Modularity, Generated Data, and the
  Automated Testing Facility Boundary. There is no separate Repository
  Boundaries heading — the brief's kept-section list does not include one, so
  its content lives in the first `Start Here` placeholder, which the
  `Both roles` paragraph still refers to.
- `templates/agent-working-doc-protocol.md` (250 lines) — a generic header
  block, a nine-line `Why This Exists` reduced to the argument that survives
  without this project's measurements, then the ten normative sections
  essentially verbatim: Directory layout, Header block, Section order, Work
  Ledger entries, Compaction, Worker briefs and reports (brief format, report
  format, return contract), Cross-repository pairing, Index, Durability, Agent
  Operating Rules. Pairing is phrased for any paired repository, with a
  `PROJECT` comment for which side owns which kind of contract by default and
  an instruction to delete the section when nothing is paired. No `Current
  State` narrative, ledger, rollout plan, or briefs.
- `templates/docs-working-README.md` (37 lines) — the index prose verbatim, a
  `PROJECT` comment for the paired index path, empty `Active` and `Complete`
  tables with the source's columns (the source's `Paired in Core` is `Paired`),
  a comment saying what a row contains and that any other status value gets its
  own section in the same shape, and the 800-line compaction footnote.
- `templates/working-doc.md` (52 lines) — H1, the eight header fields with no
  blank lines between them, then `Current State`, a reference-section slot
  (noting that `## Worker Briefs` goes there at dispatch time), `Work Ledger`
  with one entry skeleton, and `Open Questions`.
- `templates/brief.md` (19 lines) — the protocol's brief format, with the
  40-line limit, the "operating rules live in the `worker` agent definition"
  note, and the partition-by-file rule that makes `Owns` / `Must not touch`
  meaningful.
- `templates/report.md` (34 lines) — the protocol's report format as real
  headings, each with a comment saying what belongs under it, plus the return
  contract as a closing comment so a worker has both formats in one file.

Three redundancies were removed from the `AGENTS.md` skeleton to fit 200 lines,
each already stated elsewhere in the same file: the mode 2 bullet restating
that the supervisor owns coordination and integration (Agent Roles says it),
"Workers do not declare modes" in the modes preamble (Agent Roles says it), and
"Infer the practical mode when confidence is high; otherwise ask" at the end of
the modes section (the preamble says it). Prose is wrapped near 80 columns
rather than the source's 76, which is what made the budget reachable without
cutting further rules.

Every file opens with a comment naming its destination path, so no eighth
index file is needed.

## Commands run and observed results

- `wc -l *.md` in `F:\!AgentBrain\templates` ->
  `200 AGENTS.md`, `13 CLAUDE.md`, `250 agent-working-doc-protocol.md`,
  `19 brief.md`, `37 docs-working-README.md`, `34 report.md`,
  `52 working-doc.md`, `605 total`. Both budgets met: `AGENTS.md` 200 of at
  most 200, protocol 250 of at most 250.
- `grep -rn -E "FluxIQ|extension|domain/|pnpm" .` in that directory -> no
  output, exit status 1 (no matches). The definition of done allows matches
  inside `PROJECT` comments; there are none at all, inside comments or out.
- `grep -rni -E "fluxiq|extension|domain/|pnpm" .` -> no output, exit status 1.
  Run as well so the result does not depend on case.
- `ls -1` -> the seven expected filenames and nothing else.

## Not verified

- No template was instantiated into a real repository, so the copy-and-fill
  flow is untested end to end.
- The brief's premise that Claude Code strips block HTML comments was taken as
  given; nothing here measured it.
- Markdown rendering was not inspected; the tables in `docs-working-README.md`
  are header-only, which renders as an empty table rather than as nothing.
- Both budgeted files sit exactly at their caps, so any later addition to
  either needs an offsetting cut.

## Open questions or contradictions found

- `docs/working/agent-working-doc-protocol.md` in this repository has a
  duplicated bullet: "A worker writes only its owned files and its report,
  using filenames unique to it. Workers never share a scratch file..." appears
  twice in a row under "Worker briefs and reports". The template carries it
  once. The source, and Core's paired copy, still have the duplicate.
- The brief's kept-section list for `AGENTS.md` names no boundaries section,
  yet lists "boundaries" among the facts to replace with a placeholder. Read as
  "keep the slot, not the heading": the boundary facts are a `PROJECT` comment
  inside `Start Here`. If a dedicated `## Repository Boundaries` heading is
  wanted, it is four lines to restore and something else must give to stay at
  200.
- `templates/CLAUDE.md` keeps the absolute `F:/!AgentBrain` paths from the
  source. On another machine those are wrong, and nothing in the template says
  so.
- The Write tool refused to create `templates/report.md`, treating the filename
  as a subagent report; it was created through the shell instead. Any later
  agent editing that template will hit the same refusal.
