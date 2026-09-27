# t346 — Run-4 launch-procedure attestation

## Decision

**GO for the launch and capture setup completed so far; post-result gates remain pending.** On the supplied documented sanitized facts, the launch followed the corrected t266 order and introduced no identified procedural deviation:

1. the final inline process/lock gate passed immediately before launch;
2. the independently attested pending Stage-1 path remained immutable;
3. the exact unchanged t331 command was invoked once;
4. live stdout was retained only in memory and stderr was sent to the null sink;
5. when a result arrives, only a safe parsed run id may be used and the pending debug must be renamed before `inspect`;
6. the reported run path and closed CLI verdict must then be checked against the default path contract;
7. `inspect` must run silently with stdout memory-only and stderr suppressed; and
8. the unique-index, redaction, identity, and `run.json` gates must pass before any bounded semantic read.

Items 5–8 are the required ordered continuation, not observations that the still-pending result has already satisfied them. This attestation does not classify run 4 as passed or failed and does not attest any artifact value. No run-4 artifact or `test-runs` path was opened for this review.

## Procedure audit

| Required control | Sanitized execution fact | Result |
| --- | --- | --- |
| Last machine gate | Inline process/lock check performed immediately before invocation | **GO**; a matching process, lock, uncertain owner, or intervening Lab action would have been a hard stop |
| No-hindsight record | Dedicated pending run-4 debug already attested exact and kept immutable | **GO** |
| Invocation identity | Exact unchanged isolated created-Flow command, one invocation | **GO**; no retry or budget/policy/root override is implied |
| Raw capture privacy | stdout memory-only; stderr discarded | **GO**; neither raw result nor arbitrary error prose may be displayed or persisted |
| Safe identity binding | final nonblank JSON parse; safe id required; pending debug renamed before inspection | **PENDING RESULT**; prescribed order matches t266 |
| Bundle location/verdict | default `test-runs/<run-id>` path and closed `passed|failed` CLI verdict required after rename | **PENDING RESULT**; mismatch invalidates measurement but does not undo the binding rename |
| Integrity inspection | silent `inspect`, memory-only output, matching run id/default path, valid result | **PENDING RESULT**; inspection success is necessary but not the redaction gate |
| Disclosure gate | unique safe artifact-index entries, allowed redaction states, matching `run.json` identity/verdict | **PENDING RESULT**; semantic reads remain forbidden until every condition closes |

No sequence inversion is reported in the launch steps completed so far. The continuation must bind the pending debug to the safe run id before `inspect`, preserving the correction to the weaker historical helper order identified by t266.

## GO/NO-GO criteria when the result arrives

The result may enter bounded semantic review only when all of these are true:

- the final nonblank live stdout line parsed without printing the raw object;
- `runId` matches `^[A-Za-z0-9._-]{1,128}$` and the destination debug path did not pre-exist;
- the renamed debug still preserves Stage 1 exactly;
- the reported path resolves exactly to the repository's default `test-runs/<run-id>` directory;
- CLI verdict is closed as `passed` or `failed`; a non-zero exit is not alone disqualifying when a safe id and finalized failure bundle exist;
- silent `inspect` exits successfully and reports `valid: true` with the same run id and default path;
- `artifact-index.json` has schema `0.1`, its artifact list is well formed, and each artifact requested for reading has exactly one safe indexed entry;
- every indexed artifact's redaction is `applied` or `verified`;
- `run.json` matches the run id and CLI verdict, with manifest redaction `verified` or `not_applicable`; and
- no raw provider/page content, hashes, stdout/inspection objects, credentials, browser state, or unindexed artifact is printed or opened.

Any missing/unsafe id, pre-existing debug destination, wrong run root, open verdict, inspection failure, identity mismatch, duplicate/missing required index entry, unsafe redaction, or manifest disagreement is **NO-GO for semantic artifact reading and for any further provider call**. Keep the bound debug where applicable, record only the sanitized blocker, and do not infer product behavior.

Once every gate is GO, read only the minimal indexed structured set in the established order and use `NO EVIDENCE:` for missing fields. The eventual branch remains evidence-dependent: complete pass advances the streak only to 1; any failure leaves it at 0; repeated accepted Stage-2 cannot-answer exhaustion triggers the fixed no-run-5-unchanged stop.

## Scope

This audit used only the documented sanitized launch facts, t266's corrected capture sequence, t332's run-4 serial gate, and t340's Stage-1 attestation. I did not inspect run 4, open `test-runs`, run live/provider/browser/test/build commands, edit the pending debug or either shared plan, or commit. This report is the only file written.
