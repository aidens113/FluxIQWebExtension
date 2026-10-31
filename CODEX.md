# FluxIQ Web Extension: Codex specifics

Read [AGENTS.md](AGENTS.md) for project rules, repository boundaries, validation
and the `pnpm task` git workflow. Project rules take precedence over global policy.

Read the [MeritPrompts Codex guide](C:/Users/osrs_/MeritClaude/CODEX.md) and
the [FluxIQ family lesson index](C:/Users/osrs_/MeritClaude/lessons/fluxiq/INDEX.md).
Open the relevant lesson files explicitly; Claude Code `@file` imports do not
load them in Codex. Preserve the existing working documents and runtime-local
memory rather than replacing them with a new brain.

The global policy snapshot is installed with
`node C:/Users/osrs_/MeritClaude/install.mjs --codex --apply`. Reinstall after
MeritPrompts source changes and start a new session to load the new snapshot.
Use the configured Codex models and tools; Claude agent aliases are not Codex
model names. This integration installs guidance into Codex, with no Claude
enforcement hooks or usage telemetry.
