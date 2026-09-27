# t394 — Core framework-reference regeneration

## Outcome

Core's owning `pnpm docs:reference` generator completed successfully from `F:\!FluxIQ` and
refreshed both of its declared outputs:

- `docs/reference/framework-reference.md`
- `packages/fluxiq/docs/reference/framework-reference.md`

The root reference was clean before the command. Core already contained many unrelated in-progress
source and authored-document changes; this task did not edit them. The generator necessarily wrote
the package mirror as well as the requested root reference, and the two regenerated files are
byte-identical.

## Exact generated delta

For `docs/reference/framework-reference.md`, `git diff --numstat` reports **321 added lines and 196
removed lines**. The package mirror has the same 321/196 delta. The API summary changed as follows:

| Declaration kind | Before | After | Delta |
| --- | ---: | ---: | ---: |
| Total public declarations | 2,405 | 2,530 | +125 |
| Class | 86 | 88 | +2 |
| Interface | 2 | 2 | 0 |
| Object | 293 | 319 | +26 |
| Type | 1,459 | 1,507 | +48 |
| Type Alias | 1 | 1 | 0 |
| Value | 564 | 613 | +49 |

Name-set comparison found 123 newly represented unique names and five removed unique names, for a
net increase of 118 unique names; the declaration total is larger because TypeDoc can emit more than
one public declaration with the same name. The removed names are
`AutomationStudioLlmExecutionBinding`, `AutomationStudioRuntimeSessionGrantFlags`,
`automationStudioRuntimeSessionGrantMayAct`, `automationStudioRuntimeSessionGrantRefusal`, and
`automationStudioRuntimeSessionGrantTaskKinds`. In addition, 176 retained unique declarations have
changed source location, line, or kind metadata, consistent with the current source moves and edits.

## Source and sensitive-data review

The generator implementation uses TypeDoc with the sole entry point
`packages/fluxiq/src/index.ts`, its package TypeScript configuration, and public exports only; it
explicitly excludes private, protected, and internal declarations. It reads no `.fluxiq` state,
runtime artifact, Git state, environment value, or machine-local data. All parsed unique declaration
source paths in the regenerated reference exist, and every referenced line is within its current
source file. `pnpm docs:check` independently reproduced the generated content and reported it
current. These checks support that the output reflects the current source tree only.

The regenerated file has zero matches for concrete private-key blocks, common credential prefixes,
assigned authorization/API-key/pairing-token values, absolute Windows paths, `.fluxiq` paths, or
loopback URLs. No sensitive value or recorded page content was found.

There is one precision caveat: the current public source JSDoc already contains historical run-ID
references. The generated reference therefore contains 57 run-ID-shaped occurrences across 14
declaration summaries, with 13 occurrences on added diff lines. These are authored source comments,
not values read from runtime state, and no associated runtime artifact or page data is included. The
result passes a "no runtime-state ingestion or sensitive values" requirement, but it would not pass
a literal requirement that the reference contain zero run identifiers. I did not alter source
comments because this brief authorized generated-reference regeneration only.

## Validation

- `pnpm docs:reference` — **PASS**, exit 0; wrote both reference outputs with 2,530 public
  declarations.
- `pnpm docs:check` — **PASS**, exit 0; docs-link audit reported 0 warnings / 0 baselined findings,
  then the reference checker reported `Deterministic framework reference is current.`
- `git diff --check -- docs/reference/framework-reference.md` — **PASS**, exit 0.
- `git diff --check -- docs/reference/framework-reference.md packages/fluxiq/docs/reference/framework-reference.md`
  — **PASS**, exit 0. Git emitted only the repository's LF-to-CRLF working-copy warning.

No test, build, provider, live, panel, browser, Lab, staging, commit, or push command ran.
