# t330 — Archive fidelity audit

## Verdict

**Overall: NO-GO for claiming a verbatim/lossless archive.**

The archive is a **semantic/structural GO**: it has the intended boundaries,
all brief blocks, valid UTF-8, no detectable mojibake, and no whitespace or
newline damage. The byte-fidelity claim is nevertheless a **NO-GO** because
t319's recorded byte count/hash was not a canonical UTF-8 measurement and the
ten manually repaired lines were not checked against a surviving exact
pre-cut source.

Do not edit or discard the present archive: it is the best complete copy and
is suitable as the semantic comparison side of recovery. Do not record its
current hash as proof that the payload was moved verbatim until the recovery
procedure below compares it with an exact pre-compaction snapshot.

## Exact measurements

Strict UTF-8 reading of the text between the archive markers, CR/CRLF
normalized to LF and with one terminal LF, gives:

- first line: `### Brief: t219-run2-preflight-delta`;
- last line:
  ``- Report to: `docs/working/mvp-today-plan/reports/t311-immediate-pre-dry-run-machine-gate.md` ``;
- lines: **688**;
- UTF-8 bytes: **54,297**;
- SHA-256:
  `bde4b6c65df45e7a762df17edb24533adac2b668c5a77937584627771af672d1`.

Whole-archive hygiene:

- strict UTF-8 decode: passed;
- terminal LF: present;
- CRLF: 0; lone CR: 0;
- U+FFFD replacement characters: 0;
- common mojibake indicators `â`, `Â`, `Ã`: 0;
- tabs: 0;
- trailing-whitespace lines in the payload: 0;
- markers: one ordered begin/end pair;
- archive links and introduction: present outside the payload.

The current payload contains 33 non-ASCII code points: 25 en dashes and 8
right arrows. They are valid Unicode, not mojibake.

## Why t319's number/hash is not the canonical source hash

T319's verification example reads the file with unqualified PowerShell
`Get-Content` and then UTF-8-encodes the resulting .NET strings. This machine
is running **Windows PowerShell 5.1.19041.6456**, where a BOM-less UTF-8 file
is not read as UTF-8 by that command path.

The defect is directly reproducible on the current clean archive:

| Reader/hash input | Lines | Bytes | SHA-256 |
| --- | ---: | ---: | --- |
| strict `UTF8Encoding(false, true)` | 688 | 54,297 | `bde4b6c65df45e7a762df17edb24533adac2b668c5a77937584627771af672d1` |
| t319-style unqualified `Get-Content` | 688 | 54,462 | `d715b8799cf908b79bad907ec71ecc2bd3e183d1c5b670e1294327f99c69a7d0` |

The 165-byte inflation is exactly five bytes for each of the 33 current
three-byte Unicode punctuation characters. The reader decodes each UTF-8
character as a three-character Windows-1252 mojibake sequence, which is then
encoded as UTF-8 a second time.

Therefore t319's claimed “54,607 UTF-8 bytes” and
`3ea61fef57ed99ca171a5e59a4645605dc36b7472e2cd4a2a00f5091fa6ca79b`
describe the output of an encoding-dependent string transformation, not the
raw normalized UTF-8 source bytes. The same defect applies to t306's recorded
t219–t296 hash because it used the same reader. The current archive's first
553 lines do not match t306 under either strict or legacy measurement, so that
older hash cannot independently attest the manually repaired payload.

This establishes that **t319's measurement is wrong as a UTF-8 measurement**.
It does not establish that every manual repair reproduced the original source
exactly: a cryptographic hash of a misdecoded string cannot be converted back
into a hash of the original bytes, and count/endpoints alone do not prove the
interior text.

## Semantic completeness

The payload contains 76 ordered brief/group headings and exactly 76 each of
the expected structural fields:

- task/tasks;
- required reads;
- owns;
- must-not-touch;
- definition of done;
- report-to.

The headings run continuously from t219 through t311 in the same grouping
shape described by t306/t319. T220–t223 and t225–t227 are intentionally group
headings, so a simple heading-id parser does not list every interior id. T224
has neither a brief nor a report and is the known numeric gap, not a dropped
archive block. The archive also retains briefs t238 and t240 even though no
matching report file currently exists. There is no duplicated heading,
truncated final block, missing structural field, reflowed line, or blank-line
loss detectable from the archive itself.

On the available documentation, the archive is semantically complete. Reports
can corroborate task meaning and ownership, but cannot prove exact punctuation
or wording because they are results, not copies of their dispatch briefs.

## Recovery-source audit

The current Git index does not contain t219 or t311 in
`mvp-today-plan.md`. The worktree diff compares the compacted plan with an
older indexed plan; it does not retain the overwritten pre-compaction working
copy. A read-only scan of unreachable Git blobs found no blob containing the
t311 endpoint. Consequently neither Git diff/index nor dangling Git objects
are an exact recovery source.

The t306/t319 reports retain boundaries, counts, and encoding-dependent hashes,
not payload text. Individual worker reports retain outcomes rather than exact
brief wording. They are sufficient for semantic review, not byte recovery.

The recoverable exact source, if still available, is the **supervisor/orchestrator
turn record immediately before the compaction edit**: specifically the raw
pre-cut `mvp-today-plan.md` read or payload value used to construct the initial
dynamic apply. A filesystem/editor/local-history snapshot from before the cut
is equally valid. The initial post-apply/pre-manual-repair archive is useful
only if its mojibake has no replacement characters; in that case the known
single Windows-1252/UTF-8 transform can be reversed losslessly and compared to
the recovered source.

If none of those snapshots exists, exact verbatim recovery is not possible
from the two hashes or reports. Keep the current semantic archive, but correct
the documentation claim from “verbatim/lossless” to “normalized semantic copy”
rather than inventing byte equality.

## Exact correction procedure

1. Freeze edits to the active plan and this archive. Copy the pre-compaction
   source from the supervisor turn record, editor history, backup, or other
   byte-preserving snapshot to an isolated temporary file. Do not copy it
   through terminal output.
2. Strictly decode both source and archive with
   `[Text.UTF8Encoding]::new($false, $true)`. A decode exception is a hard stop.
3. Normalize only line endings. In the recovered source, select from the exact
   t219 heading through the exact t311 report-to line. Require nonnegative
   unique endpoints and 688 lines.
4. Compute the canonical source bytes with
   `[Text.Encoding]::UTF8.GetBytes(($payload -join "`n") + "`n")` and record
   their SHA-256. Do not use unqualified `Get-Content` on Windows PowerShell
   5.1; use `ReadAllText` with the strict decoder above.
5. Compare every recovered line by ordinal with the current marker payload.
   If equal, the current archive is the recovered verbatim payload; replace
   t319/ledger validation facts with the canonical strict byte count/hash.
6. If unequal, produce an ordinal-only diff, review each changed line against
   the recovered source, and use `apply_patch` to restore exactly those archive
   lines. Do not regenerate briefs from reports and do not normalize prose,
   punctuation, spacing, or wrapping.
7. Re-extract the marker payload with the strict reader and require exact
   equality with the recovered source, 688 lines, exact endpoints, valid UTF-8,
   zero replacement/mojibake indicators, zero trailing whitespace, LF-only
   line endings, and one terminal LF.
8. Run `git diff --check` on the plan/archive/report set and inspect the active
   plan's archive link and retained headings. Record the newly observed
   canonical bytes/hash; explicitly supersede t319's encoding-dependent hash.

Until step 5 or 7 passes against a recovered source, the archive is
semantically usable but not byte-attested.

## Scope

This audit read only the active/archive documentation, reports, Git metadata,
and unreachable-object metadata/content needed to look for an exact source. It
did not edit shared documents, run tests/builds/dry/live/provider/browser/Lab
commands, or commit. This report is the only file added.
