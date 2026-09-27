# t316 Installed Stage-1 Attestation

Status: **GO for live-launch sequencing.**

## Result

The installed pending debug is byte-for-byte identical to the copy-ready payload at lines 14–52
of t262. It is also identical after newline normalization. There is no missing, extra, reordered,
or reflowed content.

Compared:

- source payload: lines 14–52 of
  `docs/working/mvp-today-plan/reports/t262-run3-no-hindsight-stage1-draft.md`;
- installed file:
  `docs/working/language-driven-flow-loop-plan/debugs/pending-t249-run-3.md`.

## Byte and normalized evidence

| Evidence | Value |
| --- | --- |
| Expected payload size | 6,843 bytes |
| Installed file size | 6,843 bytes |
| Expected payload SHA-256 | `306dccb4af0d56695f03a5a2ae52a6ebcfddace9d6e73ff2d691331501f4bb36` |
| Installed file SHA-256 | `306dccb4af0d56695f03a5a2ae52a6ebcfddace9d6e73ff2d691331501f4bb36` |
| Normalized expected SHA-256 | `306dccb4af0d56695f03a5a2ae52a6ebcfddace9d6e73ff2d691331501f4bb36` |
| Normalized installed SHA-256 | `306dccb4af0d56695f03a5a2ae52a6ebcfddace9d6e73ff2d691331501f4bb36` |
| Raw-byte equality | PASS |
| Newline-normalized equality | PASS |
| Logical lines | 39 expected / 39 installed |
| Newline form | LF only; terminal newline present |

For provenance, the complete t262 report (not merely the extracted payload) has SHA-256
`d4463273def19053f7159ddf86eaafd20166b36547b182d680fa31fcb875660d` and size 9,678 bytes.

## No-hindsight review

Exact equality proves the installed file contains only t262's prewritten header and Stage 1. In
particular, it still records:

- run id as pending;
- date/model as pending except for the predeclared provider;
- provider calls, tokens, and cost as pending;
- verdict and stage reached as pending;
- the pre-run instruction, expected chain, oracle, hypotheses, authority/accounting invariants,
  pass threshold, and streak rule exactly as drafted.

There is no run id, observed outcome, artifact-derived fact, accounting result, provider response,
post-run diagnosis, or other hindsight content. Nothing appears before or after the 39-line payload.

## Decision boundary

**GO:** the installed Stage-1 file satisfies the no-hindsight content attestation. This attestation
does not itself authorize or perform the provider invocation. The supervisor must still repeat the
one-Lab/process-lock gate immediately before the unchanged live command and then follow t266's
capture/privacy order. The pending file must not be edited between this attestation and launch.

## Scope

This task performed read-only byte/text comparison and wrote only this report. It did not edit the
pending debug, inspect run artifacts, run a dry/live/provider/browser/Lab command, change generated
output, or commit/push anything.
