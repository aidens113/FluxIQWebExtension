# t314 — Stage-1 installation readiness

Status: **Filesystem GO; installation NO-GO until zero-provider readiness is green**

No pending Stage-1 debug currently exists at
`docs/working/language-driven-flow-loop-plan/debugs/pending-t249-run-3.md`. The target directory
exists and contains five completed debug files: three legacy date/scenario names and two real
`run-*.md` names. There is no naming collision with the pending path.

## Exact source boundary

The only content to install is the fenced `markdown` payload under t262's
`## Copy-ready header and Stage 1`:

- source: `docs/working/mvp-today-plan/reports/t262-run3-no-hindsight-stage1-draft.md`;
- opening fence: line 13;
- copy lines: **14–52 inclusive**, 39 lines;
- closing fence: line 53, excluded;
- first copied line: ``# Run debug — `pending-t249-run-3` ``;
- last copied line: the complete `Consecutive-pass rule` bullet;
- normalized content SHA-256: `306dccb4af0d56695f03a5a2ae52a6ebcfddace9d6e73ff2d691331501f4bb36`.

The hash input is the 39 UTF-8-decoded lines in order, joined with LF and one terminal LF. Copy
neither the surrounding t262 report prose nor the fence markers. The later `Failure evidence
checklist` is guidance for post-run completion, not part of the pre-run installed Stage 1.

## Preservation requirements

Install the 39 lines verbatim into the unused pending path. Do not rewrap, normalize wording,
correct punctuation, update task references, add results, or copy facts from runs 1 or 2. Preserve:

- the pending H1 and the no-hindsight attestation;
- `Run id`, date/model, accounting, verdict, and stage as pending;
- the exact scenario/variant/task and unchanged default-profile command description;
- the complete post-run-2 change-under-measurement paragraph without claiming a live outcome;
- the verbatim instruction and all nine ordered expected-chain steps;
- the plausible-wrong-answer boundary and exact ordered 13-record oracle;
- the hypotheses, including no expected permission question and the expected-but-not-assumed
  provider sequence;
- exact authority/accounting invariants, pass threshold, and streak rule.

After installation, recompute the same normalized hash from the entire pending file. It must still
be 39 lines and equal the digest above. The file must contain no real run id, provider result,
artifact-derived fact, date/model inference, token/cost number, or verdict. Its existence then
attests only that expectations were fixed before launch.

## Naming and lifecycle

The installation name is exactly `pending-t249-run-3.md`. It is temporary but must never be
overwritten. After one provider invocation returns a safe real run id, rename this same file to
`<run-id>.md` before any bundle inspection; do not copy it to a second file or revise Stage 1.
Existing completed examples use `run-muj2kzx1-8f9f8271.md` and
`run-muj39xl6-f6a5d4e5.md`, consistent with that lifecycle.

## Decision

- **Mechanical installation readiness: GO.** Directory exists, pending path is unused, source
  boundary is exact and hashable, and no destination collision exists.
- **Authorization to install now: NO-GO.** t262 says the pending debug is created only after every
  serial preflight gate, including zero-provider readiness, passes. The supervisor is still
  resolving dry-run startup, so that prerequisite is not green.
- **Transition to GO:** after the unchanged provider-free dry-run returns its required ready/zero-
  provider facts and the immediately preceding process/lock gate is clear, create the pending file
  once from the exact 39-line payload, verify its digest, attest its pending fields, repeat the
  immediate one-Lab gate as required, and only then consider live launch.

No pending debug was created, renamed, opened, or edited. No shared document, source, artifact,
provider/browser/Lab state, commit, or live state changed. This report is t314's only write.
