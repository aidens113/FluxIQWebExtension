# Wave 3 outcomes and its gate results

Moved out of the plan's `Current State` on 2026-09-12 to keep it under the
compaction threshold, and because live validation later that day changed how
several of these figures should be read.

Read the D13/D14 paragraph below with the caveats the same day produced: the
drift figure of 0.389 was measured through a harness carrying identity signals
the wire was dropping, so it did not hold live until the wire was fixed; and
D14's claim of exhaustiveness held over the candidate axis only. The plan's
`Current State` and the open questions carry the corrections.

**Wave 3 is complete, integrated, verified and pushed.** Seventeen workers ran
across Phases 1.3, 1.4 and 1.5; every report is under
[reports/](../reports/). Seven of the
seventeen were dispatched mid-wave to close gaps earlier workers found outside
their own briefs, which is the wave's main lesson: the briefs were partitioned by
file and the defects lived across them.

**Gates, run one at a time on a still tree (2026-09-12).** This repository: root
`pnpm check` exit 0 with the structure audit clean, root `pnpm test` exit 0,
extension 215/215, domain 245/245, content harness **186 passed** at
`--workers=4`. Core: `pnpm check`, `pnpm docs:check`, `pnpm package:lint` and
`pnpm build` each exit 0, `packages/fluxiq` **129 of 129** test files green under
`--no-file-parallelism`.

**Target matching, in short.** Core's matcher is published for a browser through
a `fluxiq/automation-studio/fingerprinting` subpath, at a cost of 18,974 bytes
of content bundle (8.5%), attributed by esbuild metafile. Level 2 scoring could
not succeed until **D13** changed how Core charges a *missing* identifier
against a *contradicted* one; the drift case now resolves at 0.389 where it
scored 0.218 against a 0.35 floor. **D14** then closed the larger exposure the
investigation uncovered: Level 1 was resolving and clicking by class alone, with
no score and no floor, so a page whose Save button had become
`<button class="btn btn-primary">Delete workspace</button>` was clicked. Level 1
now selects and the scorer vetoes. Both decisions carry their measurements, the
alternatives rejected, and the interaction between them — D13 shrank D14's
safety margin sixfold, and one test now guards both.
