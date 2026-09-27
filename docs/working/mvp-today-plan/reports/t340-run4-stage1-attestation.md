# t340 — Run 4 Stage-1 attestation

Status: **GO — installed pending Stage 1 exactly matches the frozen t331 payload**

## Decision

`docs/working/language-driven-flow-loop-plan/debugs/pending-t331-run-4.md` is an exact normalized copy of t331 lines 12–63 and satisfies t338's installation contract. It is ready to remain frozen through the remaining run-4 gates.

This attestation does not authorize a provider call by itself. The immediate machine/lock, provider-free dry-run, effective-authorization, second machine/lock, and capture/privacy gates remain serial requirements.

## Mechanical identity

Both source slice and destination were strictly decoded as UTF-8; CRLF/lone CR were normalized to LF for comparison; the payload was joined with exactly one terminal LF and UTF-8 encoded without a BOM.

| Property | t331 lines 12–63 | Installed destination | Result |
| --- | ---: | ---: | --- |
| Logical lines | 52 | 52 | **exact** |
| UTF-8 bytes | 7,713 | 7,713 | **exact** |
| SHA-256 | `d6ddff223f913f11bf59c46a425ccea1d3969275971e823a79d45d7edda09df9` | `d6ddff223f913f11bf59c46a425ccea1d3969275971e823a79d45d7edda09df9` | **exact** |
| Normalized text | source payload | destination | **ordinal exact match** |
| BOM | none required | absent | **GO** |
| Line endings | normalized LF | LF only; no CR | **GO** |
| Terminal newline | exactly one | exactly one | **GO** |

The opening/closing source fences and t331's explanatory/post-run sections are absent, as required. The destination contains only the 52-line Stage-1 payload.

## No-hindsight and pending-field audit

| Gate | Result | Finding |
| --- | --- | --- |
| Run id | **GO** | `pending`; replacement is deferred until the command returns a safe real run id. |
| Date/model | **GO** | Date and observed model remain pending; DeepSeek is the frozen configured provider, not a run outcome. |
| Calls/tokens/cost | **GO** | Pending from sanitized accounting; overlapping representations must remain separate. |
| Verdict | **GO** | Pending. |
| Stage reached | **GO** | Pending. |
| Post-run evidence | **GO** | No actual run-4 id, timestamps, call counts, costs, decisions, tool outcomes, authored nodes, dataset, verdict, failure, repair, replay, or lifecycle result appears. |
| Run-3 leakage | **GO** | The only run-3 statement is the pre-authorized disposition: terminal truthfulness was proved, no deterministic source defect was established, and no budget/answerability/retry change is authorized. No run-3 trace count, rerun sequence, node rejection, or provider output is presented as a run-4 prediction. |

## Frozen contract audit

- **Command:** exact isolated `everything-store` created-Flow command with `mvp-hard-scenario`, DeepSeek, `create-flow`, task `everything-store-plus-earbuds-under-50`, and `--replays 1`.
- **No overrides:** the command carries no max-call, token, cost, timeout, retry, concurrency, Lab-instance, alternate target, or run-root override. The default production allowance remains 26 calls.
- **Instruction/chain:** verbatim instruction and all nine expected-chain steps are present.
- **Oracle:** exactly 13 ordered records from `extract-plus-under-fifty`, exact four-field comparison, `kind === "earbuds"`, `plus === true`, `rating >= 4`, and `priceCents < 5000`; count alone cannot pass.
- **Authority/accounting:** exact existing run-owned grant only, no mint/replacement/widening/reset/drift bypass, truthful attempt/response provenance, and non-overlapping accounting.
- **Pass threshold:** integrity-valid finalized passed bundle, Flow creation, exact oracle/reported pass, confirmed verification, exact ordered fields, and one zero-provider deterministic replay; repair additionally requires applied/persisted adaptation, selected-Subflow replay, recursive judgement, and terminal revocation.
- **Streak:** starts at 0; a complete pass advances only to 1; any failure remains/resets to 0.
- **Stop rule:** exactly one run-4 invocation. Repeated accepted Stage-2 `flow_bootstrap.evidence_unusable_decision` / `bootstrap.cannot_answer_instruction` forbids run 5 unchanged and requires fix-before-retry investigation.

## Privacy audit

The file contains the pre-frozen scenario instruction, expected chain, oracle contract, closed policy codes, and command only. It contains no credential, token, authorization material, raw provider prompt/response, page text/rows, selector, cookie, browser state, raw error/log, artifact hash, run artifact, or post-run observation. It instructs later fields to use only integrity-valid sanitized evidence and `NO EVIDENCE:` for missing facts.

Stage 1 must now remain byte-stable. Do not edit it from provider-free dry-run output or live output; after a safe real run id exists, rename the file before semantic artifact inspection according to t266.

## Scope

Read t331 lines 12–63, t338, and the installed pending file. Performed only strict UTF-8 read-only normalization, byte count, hash, and ordinal comparison. I did not edit the pending file, open artifacts/`test-runs`, or run tests, builds, process scans, dry runs, browser/Lab/provider/live commands. This report is the only write.
