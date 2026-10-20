# Lane S-H (t728): Core architecture docs describe lane S's seams

## Outcome

Done. All seven areas are now in Core's authored docs. Each one extends an existing page; no
parallel page was added. I changed docs only and committed nothing.

## What changed and why

Core tree `C:/Users/osrs_/FluxStuff/fxwork/t728/!FluxIQ`:

- `docs/architecture/automation-studio/llm-flow-bootstrap.md`
  - (1) "Provider transport": a paragraph on `llm.provider_balance_exhausted` and
    `flow_bootstrap.provider_balance_exhausted`.
  - (4) "Domain system instructions": "Rules Core says itself, per task kind". It covers the
    recordings, person-limits, loop-authoring, list and efficiency sentences, which kinds get each
    one, and the fact that a domain's instructions carry only domain wording.
  - (1) "One purse per Flow creation": a new bullet on the itemised spend. It covers the phases and
    their precedence, that a phase needs the step-log scope, `interpretationCalls` and the `chat`
    phase, `calls`/`byPhase`, and the `get-flow-spend` request and response.
  - (5) The repeated-answer paragraph now names `AUTOMATION_STUDIO_REPEATED_ANSWER_REASON` in
    `@fluxiq/contracts`.
  - (6) New subsection "A domain tool call's build scope and durable state". It covers:
    - `automationStudioEvidenceBuildScope()` and the meaning of `opening`, `callScope` and
      `buildId`, with the buildId used in each build path;
    - that an explicit request field is a follow-up once binding.ts and evidence-loop.ts are free;
    - `automationStudioDomainBuildState(fluxiq, domainId)` with its scope semantics, storage,
      bounds and refusal codes.
- `docs/architecture/automation-studio/flow-authoring.md` (1): next to `totalProviderCallCount`, I
  added `instructedConsequences` (classes only, never quotes) and the re-author attempt's `calls`
  (where the count comes from, and 0 for a cost-bound build) and balance code.
- `docs/architecture/automation-studio.md` (5): next to the credential-shaped screening, I added
  the card-number rule (13 to 19 digits, issuer digit 2 to 6, Luhn), its effect on every
  `secretShaped` caller, and `automationStudioWithoutCardNumbers`, which should run in place
  before the screen.
- `docs/architecture/automation-studio/client-gateway.md`
  - (2) Under "Per-step activity", the `fluxiq/ui` activity status: headline, pacer (1,600 ms,
    160-character cut), wording, units, the fan-out gate, history limits (10 units, 500 events
    each, 5,000 for a build in progress) and the clock. It also says what the extension keeps and
    which behaviour apps/web adopted through `ConversationPacedStatus`.
  - (7) The paired-client allowlist gains `get-recording-capture-policy`. A new paragraph covers
    the policy shape, the default, the clamp rules, the endpoint, and the per-project dependency
    seam, which is not wired yet.
- `docs/architecture/package-boundaries.md`
  - (3) "Exports And Builds": `fluxiq/automation-studio/nodes` as a browser-safe seam for the
    record-process re-exports (blank string is absent, plus the unsortable count rule) and the
    capture policy. It also covers the browser-safety tests and `fluxiq/ui` activity status.
  - A new migration note, "Next minor (unreleased)", lists every addition and behaviour change.
    The behaviour changes are: blank is absent, the date reading changes, cards are
    credential-shaped, the prompt sentences were re-pinned, and the apps/web pacer.
- `packages/fluxiq/docs/reference/framework-reference.md`: regenerated with `pnpm docs:reference`.
  It was stale before I edited anything. The diff covers lane S's new exports and also earlier
  surface changes that were never regenerated, such as moved result-verification contracts.

I checked several facts in Core source against the reports rather than taking them on trust: the
endpoint names, the prompt constants and their placement, the activity-status files, the history
limits, the pacer interval and cut, the headline situation fields, and the spend phases. The
reports' headline signature was imprecise, and I wrote the source's one
(`{ stopped, repairing, testing, waitingOn }`).

## Commands run and observed results

All were run in the Core tree.

- `pnpm docs:check` before the edits printed `structure-audit: passed (0 warning(s), 0 baselined).`
  and then failed with `framework-reference.md is stale: the public surface changed`.
- `pnpm docs:reference` printed `Wrote docs/reference/framework-reference.md and packages/fluxiq/docs/reference/framework-reference.md (3840 public declarations).`
- `pnpm docs:check` after the edits printed `structure-audit: passed (0 warning(s), 0 baselined).`
  and `Deterministic framework reference is current.` The docs-links rule therefore accepts the
  new anchors.
- `node scripts/structure-audit.mjs` printed `structure-audit: passed (412 warning(s), 1152 baselined).`
  This is the count the lane S workers reported, so the docs changed nothing.

## Not verified

- I did not read the downstream switch reports (d1 to d6). The docs therefore describe Core's
  seams and do not claim which downstream modules have already switched. For example, they say
  "a domain deletes its copy", not that `web-12` shipped.
- The reference regeneration ran against a tree that holds every lane S worker's uncommitted
  source. If any of that source changes before commit, run `pnpm docs:reference` again.

## Open questions or contradictions found

- `pnpm docs:reference` also wrote the repository-root copy, `docs/reference/framework-reference.md`.
  That file is outside my owned paths, and the generator writes it identically. `docs:check`
  needs both copies current, so I left it changed. To drop it, run
  `git checkout -- docs/reference/framework-reference.md`, but `docs:check` will then fail.
- The reports and source disagree slightly on the headline's situation fields. I documented the
  source.
