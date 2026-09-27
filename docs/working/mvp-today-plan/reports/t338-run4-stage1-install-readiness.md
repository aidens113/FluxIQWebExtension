# t338 — Run-4 Stage-1 installation readiness

Status: **Mechanical GO; installation authorization remains contingent on a green t337 gate**

This audit inspected only the copy-ready source block and destination-name metadata. It did not create or edit the pending debug, open run artifacts, invoke a provider/browser/Lab, run tests, or commit.

## Exact copy operation

Source: `docs/working/mvp-today-plan/reports/t331-run4-no-hindsight-stage1-draft.md`

- Opening source fence: line 11, ````markdown` — exclude it.
- First copied line: line 12, `# Run debug — \`pending-t331-run-4\``.
- Last copied line: line 63, the complete `Consecutive-pass rule` bullet.
- Closing source fence: line 64, ```` — exclude it.
- Payload: source lines **12–63 inclusive**, exactly **52 logical lines**.
- Destination: `docs/working/language-driven-flow-loop-plan/debugs/pending-t331-run-4.md`.

The destination file must contain only those 52 payload lines, followed by exactly one final LF. The explanatory material before line 11 and the post-run handling/work-performed sections after line 64 are not part of Stage 1.

## Mechanical identity

Normalization and hash procedure:

1. Decode the source as UTF-8.
2. Normalize CRLF and lone CR to LF.
3. Extract logical lines 12 through 63 inclusive.
4. Join them with LF and append exactly one final LF.
5. Encode as UTF-8 without a BOM and calculate SHA-256.

Expected normalized payload:

- Line count: **52**
- UTF-8 byte count: **7,713**
- SHA-256: `d6ddff223f913f11bf59c46a425ccea1d3969275971e823a79d45d7edda09df9`

An independent delegate reproduced the same boundaries, line count, byte count, and hash.

## Destination gate

At inspection time:

- `docs/working/language-driven-flow-loop-plan/debugs/pending-t331-run-4.md` was absent.
- There were zero `pending-*` siblings.
- There were zero sibling names matching `t331` or a run-4 naming variant.
- Existing debug names are historical/finalized names and do not collide with the proposed pending name.

Result: the destination is absent and its name is unique.

## GO/NO-GO

- **GO mechanically:** the source slice is unambiguous, independently reproduced, and the destination is available.
- **NO-GO to install solely from this report:** no t337 report was present at this capture. The supervisor must first obtain an explicit green t337 result and confirm that no later edit changed t331 or created the destination.
- **GO to install after t337 only if:** t337 is green, the destination remains absent, and a fresh source-slice calculation still yields 52 lines, 7,713 UTF-8 bytes, and the SHA-256 above.
- After installation, independently hash the destination using the same normalization. It must match exactly before any run-4 command starts; Stage 1 must then remain unchanged by run output.

This report is t338's only write.
