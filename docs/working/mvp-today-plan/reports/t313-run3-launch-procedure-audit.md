# t313 — Run-3 launch procedure audit

Status: **GO with one pre-read index correction; no provider command was run**

The requested t266 filename does not exist. The repository's t266 report is
`t266-run3-artifact-capture-audit.md`; this audit used that report and t262. The live command,
default 26-call profile, isolated target, one replay, no-hindsight Stage 1, and bounded evidence
policy remain aligned.

## Ordered launch checklist

1. Require every final local gate green: settled root tests/check, downstream freshness, exact
   tree identity, provider-free dry-run, and zero active Lab/build/test-runner/Scenario-Lab
   processes with no build lock. The process/lock check is a snapshot, so repeat it immediately
   before the live command.
2. Require the pending path
   `docs/working/language-driven-flow-loop-plan/debugs/pending-t249-run-3.md` not to exist. Create it
   once from t262's exact copy-ready header and Stage 1. Do not overwrite or reuse an older debug.
3. Before launch, attest the pending file still says run/outcome pending and contains the verbatim
   instruction, nine-step expected chain, plausible wrong answer, exact ordered 13-row oracle,
   hypotheses, authority/accounting invariants, pass threshold, and streak rule. Do not revise
   Stage 1 after the command starts.
4. Keep the credential process-only. Never interpolate, print, transcript, serialize, or write it.
   Start no transcript. Run the t266 command exactly once: isolated target, live DeepSeek,
   `mvp-hard-scenario`, `create-flow`, the named instruction task, and one replay; add no budget,
   timeout, Lab-instance, target, or run-root override.
5. Capture all stdout in memory and send stderr to the null sink. Never display or persist either
   the raw stdout collection or parsed result object. Parse only the last nonblank stdout line as
   JSON. Retain only numeric exit code, safe run id, reported path, and closed CLI verdict.
6. Require the run id to match `^[A-Za-z0-9._-]{1,128}$`. With no safe id, retain the pending
   debug, report only generic startup state plus numeric exit code, inspect nothing, and make no
   second provider call.
7. Before inspecting bundle content, require the destination `<run-id>.md` not to exist and rename
   the pending debug to it. A pre-existing destination is NO-GO and must never be overwritten.
8. Require the reported bundle path to equal the default
   `F:\!FluxIQWebExtension\test-runs\<run-id>` after full-path normalization, and the CLI verdict
   to be exactly `passed` or `failed`. A nonzero exit with a safe id/closed bundle is still a
   product measurement and must be inspected; a path or verdict mismatch invalidates it.
9. Run `inspect <run-id>` with stdout held in memory and stderr discarded. Never print its JSON.
   Require exit 0, one parseable final JSON line, `valid:true`, matching run id, and exact default
   path. This verifies completion-marker/index linkage and every indexed byte count/digest.
10. Open only `artifact-index.json`. Require schema `0.1`, an artifact array, unique safe relative
    paths, and every entry's redaction field in the conservative t266 set `applied|verified`.
    **Before opening `run.json`, additionally require exactly one `run.json` index entry.** Its
    bytes/digest were already verified by `inspect`; do not reimplement hashing.
11. Open only that indexed `run.json`. Require matching run id, manifest redaction state
    `verified|not_applicable`, and verdict equal to the retained CLI verdict. On any integrity,
    identity, redaction, path, or verdict failure, keep the renamed debug, record only the bounded
    blocker, stop evidence reading, and make no further provider call.
12. After every gate passes, read the minimum artifacts in order: `run.json`, `summary.json`,
    `evaluation.json`; `snapshots/live-llm.json`; indexed `snapshots/flow-lane.json`; mismatch and
    repair snapshots only when their conditions hold. Before each read, require exactly one index
    entry whose bytes/digest `inspect` verified and whose redaction classification passed step 10.
13. Corroborate run id across manifest/summary/evaluation. Populate only sanitized bounded fields;
    keep accounting representations separate; write `NO EVIDENCE:` for missing facts. Fully debug
    and classify this run before any later provider call. A pass moves the streak only to 1; a
    failure leaves it at 0.

## Exact privacy stops

Never open, quote, print, or copy provider sidecars, prompts/responses, raw logs,
`events.ndjson`, screenshots, video, HTML/contact sheets, browser profiles, databases, raw page
snapshots/datasets, selectors, opaque page handles, recorded page text/rows, cookies, network
payloads, credentials, authorization material, or unsanitized errors. Never print artifact hashes
or whole CLI/inspection objects. Suppress stderr for both `run` and `inspect`; their error surfaces
can contain arbitrary message text.

The credential and any in-memory raw/parsed objects must be cleared after the values required for
binding are retained, including on error paths. Do not save them to a variable dump, transcript,
temporary file, clipboard, or debug document.

## Discrepancies

1. **Requested report path:** the task names
   `t266-run3-safe-artifact-and-stdout-capture-procedure.md`, but the actual report is
   `t266-run3-artifact-capture-audit.md`. This is naming-only.
2. **Pre-read index gate:** t266 opens `run.json` after checking global index redaction but before
   explicitly requiring one matching `run.json` entry. Its later rule requires one verified index
   entry before every semantic artifact read. Move that uniqueness/existence check ahead of the
   first `run.json` read, as step 10 above. This is the only procedure correction found.
3. **Meaning of "verified index entry":** `inspect` verifies bytes/digest; the artifact contract's
   redaction field separately permits `not-required|applied|verified`. t266 intentionally applies
   the stricter disclosure gate `applied|verified`. Preserve that stricter gate and do not confuse
   integrity verification with a literal `redaction:"verified"` requirement.

No provider, browser, Lab, build, dry-run, or inspection command was executed. No shared document,
source, artifact, pending debug, commit, or live state was changed. This report is t313's only
write.
