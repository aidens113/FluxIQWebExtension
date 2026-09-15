# `bh-sharded-closeout-comparison` — sealed topology comparability

## Outcome

Closeout report loading now returns optional validated campaign topology.
Legacy reports without campaign authority remain readable and normalize to
serial only when closeout compares them. Current serial campaigns report an
explicit serial topology. A shard child cannot be read as a logical report.

A sharded logical report is readable only after the loader proves all of the
following:

- its campaign identity is a shard parent matching the report ID;
- its parent checkpoint chain is exact and terminal;
- its deterministic child group and authenticated merge seal load and match;
- every child checkpoint chain is exact and terminal, and its terminal digest
  equals the corresponding sealed digest; and
- child plus merged `runs.json`, `report.json`, and `report.md` bytes match the
  projection digests authenticated by the seal.

The exposed sharded topology contains only the fixed algorithm, shard count,
and saved jobs count. Shared-load closeout rejects serial/sharded or sharded
shape mismatches. Sequential closeout keeps the metric and verdict result,
returns both topologies plus `identical: false`, and adds an explicit topology
gap instead of hiding the difference.

## Tests

Direct compare/load coverage now proves:

- reports with no campaign manifest retain legacy serial behavior;
- missing seals, changed seal digests, unfinished parent chains, and changed
  algorithms make a sharded report unreadable;
- differing saved jobs or shard counts reject shared-load closeout; and
- the same jobs mismatch is disclosed during sequential comparison while its
  otherwise-equivalent metric/verdict result remains available.

## Validation

- `pnpm --filter @fluxiq-web-extension/test-runner check` — passed.
- `pnpm --filter @fluxiq-web-extension/test-runner build` — passed.
- Focused `compare-reports.test.js` — passed, 15/15.
- Owned-file `git diff --check` — passed; line-ending advisories only.

No store, merge, executor, CLI, command, barrel, Core, or extension file was
edited. No Lab/corpus run, commit, or push was performed.
