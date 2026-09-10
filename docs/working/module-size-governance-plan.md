# Module Size Governance Plan

Status: Active
Status detail: Plan authored; the ratchet check is unimplemented here.
Created: 2026-09-10
Last updated: 2026-09-10
Owner: Senior supervisor agent
Scope: Applying the shared file and class size policy to this repository, and
decomposing the files here that already exceed it.
Paired document: `F:\!FluxIQ\docs\working\module-size-governance-plan.md`
Related: [AGENTS.md](../../AGENTS.md),
[agent working document protocol](./agent-working-doc-protocol.md)

The shared policy — thresholds, ratchet semantics, rationale, and the
CodeGraph assessment — is owned by the paired Core document. This document
covers only this repository's offenders and wiring, and does not restate the
policy.

---

## Current State

**Nothing is implemented yet.** This is a plan.

**This repository is in far better shape than Core.** Of 287 tracked source
files, four exceed 800 lines:

| File | Lines | Note |
| --- | --- | --- |
| `packages/test-runner/src/demo-workspace.ts` | 3,855 | Test infrastructure, not shipped product code. |
| `apps/extension/src/background/connection.ts` | 1,913 | Shipped. WebSocket session, tab routing, recording state, storage — plausibly several responsibilities in one module. |
| `apps/extension/src/content/index.ts` | 1,188 | Shipped. Content script entry point. |
| `packages/test-runner/src/demo-llm-create-ui.ts` | 837 | Test infrastructure. |

Nothing here approaches Core's 12,482-line, 419-method
`AutomationStudioService`. The two shipped files are the ones worth attention;
the two test-runner files matter less, since test infrastructure failing to
be elegant costs less than product code failing to be navigable.

**Next steps**

1. Adopt Core's `scripts/structure-audit.mjs`, now implemented and wired into
   its `pnpm check`. Copy it here rather than writing a second implementation,
   and keep the two in sync — or decide it belongs in `packages/boundary-audit`
   per the open question below.
2. Generate `.structure-baseline.json` capturing the four files above plus any
   directories over 25 files.
3. Relocate tests to `tests/` mirroring `src/` in each package, per Core's
   Phase 1. The extension's `apps/extension/tsconfig.json` and
   `domain/tsconfig.json` need the same `include` treatment Core's plan
   describes; check each build config's `rootDir` before moving anything.
4. Split the four oversized files by their pathology — `connection.ts` and
   `content/index.ts` first, since they ship. Sequence per Core's plan.

The methodology — ownership / layer / feature / kind placement, the
prefix-becomes-directory rule, one exported thing per file, barrels, `tests/`
mirroring, and the six division pathologies — is authored in Core at
`docs/architecture/code-structure.md` and applies here without modification.
Core's audit also enforces directory density (25 files) and warns on classes
over 40 methods.

**Blockers:** none. The shared script now exists in Core.

---

## Local Notes

**`connection.ts` is the one to watch.** At 1,913 lines it owns, per the
architecture description in `AGENTS.md`, the WebSocket session, tab routing,
recording state, and storage. That is four responsibilities, and the
repository's own modularity rule asks that they be separable. It is also
directly in the path of MVP Week 4's reliability hardening work — extension
reconnect, runtime reconnect, tab closure, network failure. If that hardening
requires substantial edits inside it, splitting the reconnection and session
lifecycle out at that point is justified on its own terms rather than as a
refactor for its own sake.

**`demo-workspace.ts` should not be exempt merely for being test code**, but
its 3,855 lines are the least urgent problem in either repository. Baseline
it and let the ratchet stop it growing.

**Existing tooling to reuse.** This repository already has
`packages/boundary-audit` with a `pnpm boundary:audit` entry point. If a
size audit becomes a second standalone script, that is two audit tools with
separate invocations. Worth considering whether the size check belongs inside
the existing audit package instead of alongside it.

---

## Work Ledger

### 2026-09-10 — Plan authored

- Agent: supervisor
- Changed: this document and its Core pair.
- Why: Core reached a 12,482-line class while an instruction forbidding it
  was in force; this repository needs the same mechanical guard before it
  drifts the same way.
- Validation: `wc -l` over all tracked `.ts`, `.tsx`, `.mjs`, and `.js`
  files excluding `node_modules` and build outputs -> 287 source files, four
  over 800 lines, one over 2,000. Plan only, so no code check applies.
- Outcome: Accepted
- Follow-up: Implement the shared ratchet in Core, then wire it here.

---

## Open Questions

- **Should the size check live in `packages/boundary-audit` or as a separate
  script?** Reusing the existing audit package avoids a second tool, but
  couples a generic size rule to a repository-specific boundary tool that
  has no counterpart in Core. Owner: senior supervisor agent.
