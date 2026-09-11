# Worker report: hooks

## Outcome

Done. All five hooks in [Mechanical Enforcement](../../agent-token-efficiency-plan.md#mechanical-enforcement)
are implemented as dependency-free ES modules under `F:\!AgentBrain\hooks\`, with
39 passing `node --test` cases fed from 16 recorded stdin fixtures.

One caveat the supervisor must action: the command named in the definition of
done, `node --test hooks/tests/`, does not work on this machine's Node
(v22.11.0) for any code — a directory argument is resolved as a module, not
searched. See *Open questions*.

## What changed and why

Payload field names were confirmed against https://code.claude.com/docs/en/hooks
before writing. Confirmed shapes used: common fields `cwd`, `hook_event_name`,
`agent_id`, `agent_type`; `tool_name` / `tool_input.command` on `PreToolUse`;
`stop_hook_active` / `last_assistant_message` on `Stop` and `SubagentStop`;
`source` on `SessionStart`; `file_path` / `load_reason` / `content` on
`InstructionsLoaded`; and the output objects
`hookSpecificOutput.{hookEventName, permissionDecision, permissionDecisionReason}`
plus top-level `systemMessage`. Exit-code semantics used: 0 = proceed (stdout
parsed as JSON only when it starts with `{` and ends with `}`), 2 = block with
the reason taken from stderr.

Every hook shares one contract: read all of stdin, `JSON.parse` it, and on
malformed input or any thrown error exit 0 with no output. Each also re-checks
`hook_event_name` so a misconfigured matcher cannot make it act on the wrong
event. No shared module is imported, so a hook file can be copied or installed
anywhere on its own.

- `hooks/worker-git-guard.mjs` — `PreToolUse`. Acts only when `agent_id` is
  present (subagent calls only, so the supervisor session is untouched) and the
  tool is `Bash` or `PowerShell`. The command is split on
  `newline ; & | backtick ( ) { }` in one pass, then each segment is normalised
  (leading `VAR=value` assignments and `sudo`/`env`/`command`/`nohup`/`time`
  dropped, quotes stripped, a path or `.exe` suffix reduced to the program name)
  and matched. Braces are in the separator set because PowerShell 5.1 writes
  `if ($?) { git commit ... }`; without them that commit was not caught — the
  test found this. Denies `commit push tag rebase merge cherry-pick am reset
  stash filter-repo`, `branch` with `-d`/`-D`/`--delete`, and
  `gh pr create|merge`; skips git global options that take a value (`-C`, `-c`,
  `--git-dir`) when locating the subcommand. Over-splitting quoted text is
  deliberate: a fragment can only ever add a denial, never remove one. Allowed
  commands produce no output at all rather than `permissionDecision: "allow"`,
  so normal permission rules still apply.
- `hooks/worker-report-guard.mjs` — `SubagentStop`. Acts when `agent_type` is
  `worker` and `stop_hook_active` is not true. Takes the last `Report: <path>`
  line (tolerating list markers and `**Report**:`, stripping backticks and
  quotes), resolves a relative path against the payload `cwd`, and exits 2 with a
  single stderr line when the line is absent or the path is not a file.
- `hooks/session-pointer.mjs` — `SessionStart`. Prints plain text (added to the
  transcript on this event): repository root, branch, uncommitted paths under
  `docs/working/`, the `## Active` rows of `docs/working/README.md` as
  `name (lines)`, and `Run /resume <document>`. Silent when `cwd` is not in a git
  repository or there is no `docs/working/`. Hard-capped at 15 lines, with the
  head and the resume hint always kept. The Active parser accepts a markdown
  link, a table row, or a plain list item, skips a table's header by starting
  after the `|---|` delimiter, and stops at the next heading so `## Archived`
  rows are ignored.
- `hooks/handoff-reminder.mjs` — `Stop`. Warns only, never blocks (a blocking
  `Stop` can loop). Emits single-line `{"systemMessage": ...}` naming up to five
  changed paths and `/handoff` when `git status --porcelain` under `docs/working`
  is non-empty and `stop_hook_active` is not true.
- `hooks/instruction-metrics.mjs` — `InstructionsLoaded`. Appends one JSON line
  `{time, cwd, file_path, load_reason, bytes}` to
  `~/.claude/brain-metrics.ndjson`, creating the directory if needed. `bytes` is
  the byte length of `content`, or the size on disk when `content` is absent; the
  content itself is never written, and a test asserts a marker string in the
  content does not reach the file. `CLAUDE_CONFIG_DIR` overrides the directory,
  which is how the test redirects it.

Tests live in `hooks/tests/*.test.mjs` with `node:test` and `node:assert/strict`.
Every case spawns the hook as a real child process
(`spawnSync(process.execPath, [script], { input })`) so the stdin, stdout, stderr
and exit-code contract is exercised, never an imported function. Fixtures in
`hooks/tests/fixtures/` are recorded payloads; tests override `cwd` to point at a
temporary git repository built per test (`git init -b main`, local user config,
`docs/working/` documents, committed or left dirty on demand) and remove it
afterwards. `hooks/tests/_helpers.mjs` holds the shared fixture, spawn and
temp-repository helpers; the leading underscore keeps it out of the test-file
discovery patterns.

Coverage includes every case the brief names: a compound `&&` command, a
PowerShell tool call, a main-session call with no `agent_id`, and malformed
stdin (plus empty stdin) for all five hooks.

Two bugs were found by the tests and fixed:

1. `git status --porcelain` output was being `trim()`ed, which ate the leading
   space of the first entry's ` M ` status and so truncated the first character
   of that path (`ocs/working/...`). Both hooks now use `trimEnd()`.
2. A README table header row (`| Document | Owner |`) was reported as an Active
   document named `Document (not found)`. The parser now starts after the
   `|---|` delimiter.

One behaviour change came from the manual smoke test rather than a unit test:
`git status --porcelain` collapses a wholly untracked directory to a single
`docs/working/` entry. Both git-reading hooks now pass `--untracked-files=all`
so individual documents are named, with a regression test in each.

## Commands run and observed results

- `node --check` on each of the 5 hooks, the helper and the 5 test files — all
  clean.
- `node --test hooks/tests/` from `F:\!AgentBrain` — **fails for an environment
  reason, not a code reason**: `Error: Cannot find module 'F:\!AgentBrain\hooks\tests'`,
  `# pass 0 # fail 1`. Reproduced on a throwaway directory outside the repository
  with a single trivial test, so it is Node v22.11.0 on this machine treating a
  directory argument as a module specifier. Same result with and without the
  trailing slash.
- `node --test "hooks/tests/**/*.test.mjs"` from `F:\!AgentBrain` —
  `tests 39 / pass 39 / fail 0 / duration_ms 2630`.
- `node --test` (no argument) from `F:\!AgentBrain` — `tests 39 / pass 39 / fail 0`.
  Default discovery finds all five test files and does not collect `_helpers.mjs`
  or the JSON fixtures.
- Manual end-to-end run of each hook as `node hooks/<name>.mjs < payload.json`
  against a throwaway repository on branch `dev` with one modified and one
  untracked working document. Observed, verbatim:
  - git guard, worker running `pnpm check && git push origin dev`: exit 0 and
    `{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"Blocked \"git push\": workers must not change git history or open pull requests. The senior supervisor agent commits and pushes; report your changes instead."}}`
  - git guard, same command with no `agent_id`: exit 0, no output.
  - report guard, worker naming a report file that does not exist: exit 2, stderr
    `Write your report file, then end your final message with "Report: <path>" naming a file that exists (no file at ...\docs\working\reports\hooks.md).`
  - session pointer: exit 0 and 7 lines — `Repository: ...`, `Branch: dev`,
    `Uncommitted under docs/working/ (2):`, the two paths,
    `Active documents (1):`, `  agent-token-efficiency-plan (4 lines)`,
    `Run /resume <document>`.
  - handoff reminder: exit 0 and
    `{"systemMessage":"Uncommitted working documents: docs/working/agent-token-efficiency-plan.md, docs/working/scratch.md. Run /handoff to record state before this session ends."}`
  - instruction metrics: exit 0, no stdout, and one appended line
    `{"time":"2026-09-11T00:20:27.570Z","cwd":"...","file_path":".../AGENTS.md","load_reason":"session_start","bytes":20}`.

## Not verified

- No hook has been run inside a live Claude Code session. Everything here is
  observed from the documented stdin/stdout contract, not from Claude Code
  actually honouring a denial, a blocked `SubagentStop`, or a `systemMessage`.
- No `settings.json` was written. Nothing wires these hooks to events yet; the
  `hooks` entries (matchers `Bash|PowerShell` for the guard,
  `startup|clear|compact|resume` for the pointer) still have to be installed by
  whoever owns `install.mjs`.
- `session-pointer.mjs` was tested against an Active section written as a table
  and as a list. The real `docs/working/README.md` does not exist yet, so the
  parser has not met the format it will actually be given.
- `instruction-metrics.mjs` was never allowed to write to the real
  `~/.claude/brain-metrics.ndjson`; every test redirected `CLAUDE_CONFIG_DIR`.
- The `InstructionsLoaded` payload shape is taken from the published reference
  only; no recording of a real one was available.
- Tested on Windows with git 2.41 and Node v22.11.0 only. The hooks use
  `node:path` and spawn `git` by name, so POSIX should be fine, but it is
  untested there.
- Nothing outside `F:\!AgentBrain\hooks\**` and this report file was touched; in
  particular `package.json`, `install.mjs`, `agents/worker.md` and both FluxIQ
  repositories are untouched.

## Open questions or contradictions found

1. **`node --test <dir>` does not work on this Node, so `pnpm check` and
   `pnpm test` in `F:\!AgentBrain\package.json` are currently broken** — they run
   `node --test hooks/tests/ tools/tests/`, which exits 1 with
   `Cannot find module`. This is not caused by anything in `hooks/`. I do not own
   `package.json`, so it is unchanged. Suggested fix, verified working here:
   `"test": "node --test"` (bare discovery from the repository root finds both
   `hooks/tests/` and `tools/tests/` and skips helpers and fixtures), or
   `node --test "hooks/tests/**/*.test.mjs" "tools/tests/**/*.test.mjs"` if the
   directories must stay explicit. Note that bare discovery will also collect any
   future `*.test.mjs` elsewhere in the repository.
2. **`reset` vs `reset --hard`** — the Mechanical Enforcement table says deny
   `reset --hard`; the brief's hook specification lists bare `reset` among the
   denied subcommands. I implemented the brief, so every `git reset` is denied for
   workers, including `git reset HEAD~1` and `git reset -- <path>`. If unstaging
   should stay available to workers, the guard needs a `--hard`/`--mixed` check.
3. **SessionStart output channel** — the brief says print plain text to stdout,
   which the reference confirms is added to the transcript for this event. The
   event also supports `hookSpecificOutput.additionalContext`. Plain text was used
   as specified; if the pointer should be injected as context rather than shown,
   that is a one-line change.
4. **Report paths are resolved against the payload `cwd`** — a worker that names
   a path relative to a repository other than the session's own will be judged
   missing. With FluxIQ spanning two checkouts, worker briefs should give either
   an absolute report path or one relative to the session root.
5. **The `## Active` format is not settled** — the parser accepts markdown links,
   table rows (header skipped) and list items, resolving a row to `<label>.md` in
   `docs/working/` when there is no link target, and printing `<label> (not found)`
   when nothing resolves. Whoever authors `docs/working/README.md` should check
   the pointer's output once, or the README's shape should be fixed by the
   working-docs audit rule.
6. **The guard keys on `agent_id`, per the brief.** The reference says subagent
   payloads carry both `agent_id` and `agent_type`, so matching on
   `agent_type === "worker"` instead would guard workers only, and leave `Explore`
   and other subagents able to write history. `agent_id` is the stricter reading
   and is what is implemented: every subagent is blocked, not only workers.
