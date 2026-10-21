# lane-t-p5s-trace-survey: the breadth round's photo, job and social traces, copied and inventoried for the P5 gate

## Outcome

Done. Breadth round 4 (2026-10-20, rr4-slot-2/3/4) is the latest traced round for all three sites, so those are the runs I used. I checked that no process was using the three workspaces, copied each whole into this tree's ignored `test-runs/p5/<run-id>/`, and confirmed by hashes that each copy matches its original. I re-hashed the originals afterwards, and they are unchanged.

I inventoried the copies only through Core's trace store API (`AutomationStudioProjectGatewayTraceStore`, the way `store-trace-manifests.ts` does it). I printed only counts, closed protocol names, URL paths, digest prefixes and field paths. I made no model call, ran no build and no Lab run, and edited no repository file except this report.

**Main findings:**

- Every operation in all 12 traces names a primary `text/html` page snapshot, and the trace holds it. No trace and no read lacks one.
- The client uploads a snapshot only once per digest. So most reads point back to an earlier artifact event (shown as `earlier@seq`) and have no artifact event in their own segment.
- **Job** has the cleanest pair in the round: exploration reads 130 and 144 hit the same snapshot and differ only in `extractList.where`, giving 7 rows and then 3.
- **Social** has many strict pairs. The useful ones isolate `fields.text`, `recordOutput`, and `where`/`dedupe`. It also has cross-trace pairs on the same snapshot among the trial traces.
- **Photo** has one trace (a failed exploration). It has **no** strict changed-read pair. Its same-snapshot pairs differ only in `timeoutMs`, and all of them read 0 rows.

## Progress log

- **2026-10-20 17:51 PDT.** Read the brief, lane rules (plan lines 58-75), and the P4s and P3-R4 reports. The run index at `lab-runs/index.md` lists round 4 as the newest round: no rr5 run exists, and no instance directory outside `a8-`, `bf-`, `rr2-`, `rr3-` and `rr4-` exists in the four lane trees. `run.json`/`entry.json` map the runs:
  - job `run-mvgw1854-5d10955b` → rr4-slot-2, t719, `claude-job-save-t719-20261020-r5`;
  - social `run-mvgw3ve5-294881b5` → rr4-slot-3, t566, `claude-social-groups-t566-20261020-r7`;
  - photo `run-mvgw7320-de416190` → rr4-slot-4, t567, `claude-photo-likes-t567-20261020-r5`.
- **17:51.** Idle checks, all clear:
  - `Get-CimInstance Win32_Process` filtered on `fxwork[\/](t719|t566|t567)`, `rr4-slot-[234]` and the three workspace names → `procs: 0`.
  - Files modified in the last 30 minutes under each slot → `0`, `0`, `0`. Newest file times are 09:31, 09:51 and 09:36 local.
  - Exclusive-open probe (`FileShare.None`, read access, `\\?\` long paths) over all 15 `*.sqlite*` files → `probed: 15 ok: 15 locked: 0`. My first probe without `\\?\` reported one file as "locked". That was a MAX_PATH error, not a lock.
- **17:53-17:53:38.** Copied and verified (below).
- **17:55-18:10.** Inventory helpers in my scratchpad: `p5s-core.mjs` opens the store through Core's dist, `p5s-shapes.mjs` lists key paths only, `p5s-vocab.mjs` tallies closed names, `p5s-inventory.mjs` builds the inventory, and `p5s-tables.mjs`/`p5s-group.mjs`/`p5s-same.mjs` render the tables. Opening applied Core's migrations to the **copies'** `project.sqlite` (see hashes). After the inventory I re-hashed the originals: identical.

## Copies (ignored; never commit)

Destination root: `C:/Users/osrs_/FluxStuff/fxwork/t749/!FluxIQWebExtension/test-runs/p5/` (`git check-ignore -v test-runs/p5/x` → `.gitignore:15:test-runs/`).

Each copy holds the whole workspace: `fluxiq-root/`, `.identity/`, `.sessions/` and the browser profile. I did not read the identity, session or profile contents. The Core automation data dir is `<copy>/fluxiq-root/.fluxiq/artifacts/automation-studio`, and `global.sqlite` is at `<copy>/fluxiq-root/.fluxiq/global.sqlite`.

| site | run | source workspace | project id | build / Flow |
| --- | --- | --- | --- | --- |
| job-board (save-quillmark-remote) | run-mvgw1854-5d10955b | fxwork/t719/.../rr4-slot-2/persistent-isolated/claude-job-save-t719-20261020-r5 | 1fa185e9-b435-4616-9d51-72a92e54b135 | build.963d06f9-c107-442b-a0ee-cf11ca60a024 / flow.aab43b29-b8c7-4a2d-8282-728f5083a7b2 |
| photo-social (newest-likes) | run-mvgw7320-de416190 | fxwork/t567/.../rr4-slot-4/persistent-isolated/claude-photo-likes-t567-20261020-r5 | 46260e60-39ac-433d-a319-1b814a0c45ac | build.c435118d-fdee-421a-bb3a-de01f52a3e13 / flow.839c7c10-4475-488e-afe3-97e7fd557d0e |
| social-network-feed (recent-group-posts) | run-mvgw3ve5-294881b5 | fxwork/t566/.../rr4-slot-3/persistent-isolated/claude-social-groups-t566-20261020-r7 | a846814f-becd-4569-934f-f3a10df1ce79 | build.6a028d03-e39f-492a-95cd-a976bc7712f7 / flow.de7e910c-4fa5-4106-8a2f-620cdb9a4a26 (from P4s) |

**Copy command** (scratch `copy1` function, bash), per workspace:

1. `p5s-hashtree.sh <src> p5s-src-<run>.txt`
2. `cp -a <src> test-runs/p5/<run>`
3. `p5s-hashtree.sh <copy> p5s-dst-<run>.txt`
4. `cmp` of the two lists

`p5s-hashtree.sh` runs `find . -type f -print0 | sort -z | xargs -0 sha256sum`, so it records every file's sha256 by relative path. From that list it prints the file count, total bytes, the sha256 of the whole list, and the sha256 of the `.sqlite*` lines only. The SQLite figure uses the same method as P4s.

| run | files | bytes | list sha256 (all files) | sqlite sha256 | src = copy | original re-hashed after inventory |
| --- | --- | --- | --- | --- | --- | --- |
| run-mvgw1854-5d10955b | 270 | 59,549,019 | 9e4fc9a04dfdefac8215572b76f2dc7a6b4b10124011f6195e8dcc26cbd1b610 | 97cfe02cbce571ee9132204963eca06e1dd057d9b08e08cbe94c7c11d401496e | `lists identical` | unchanged |
| run-mvgw7320-de416190 | 343 | 109,124,241 | b3381de813f99495ee39154afcf4bdc187f1af32af513c4a6f75a126f015dca7 | e4b49e6e22ef2c931b0db01a4d0e72b288b91bade51558617e3807825c80d8c5 | `lists identical` | unchanged |
| run-mvgw3ve5-294881b5 | 794 | 849,290,136 | d93bc4b870f7e9f96b268c481eefe5339b9453674f227ddc08d4b65d531c56d2 | 62a40a83dd0d99b2fe3437862213e7d685e346bff42c8836fffaf04e3b7451e9 | `lists identical` | unchanged |

The social SQLite hash `62a40a83dd0d` equals the P3 and P4s copies of the same store.

**After the inventory opened them:** Core checkpointed and migrated each copy's `project.sqlite` and removed its `-wal`/`-shm`. Each copy now has 2 fewer files and different SQLite hashes; nothing else changed:

- job: 268 files, 84,428,067 B, sqlite `2c19a936ea6d...`;
- photo: 341 files, 160,983,641 B, sqlite `88c4ef26c51a...`;
- social: 792 files, 853,336,928 B, sqlite `af475339c119...`.

## How I decided what is read-only

The domain gives every web action one safety class in `domain/src/actions/safety.ts`: `safe` means "only observes or waits on the page", and `review` means it acts on the page. It also gives an effect in `output-nodes/definitions.ts` (`WEB_AUTOMATION_ACTION_EFFECT`: `observe` or `mutate`).

- **Read-only:** I took the `safe` set, every member of which is also `observe`: `extract_list`, `extract`, `capture_snapshot`, `assert`, `wait_for_selector`, `wait_for_text`.
- **State-changing:** everything else. That includes `web.dom.scroll`, which is `observe` in effect but `review` in safety. A scroll can load more items, so I counted it as state-changing; this is conservative.
- **What the tables list.** The per-read tables list every read-only operation except `capture_snapshot`, which is the builder's page view (226-282 per store). Each trace row aggregates its snapshots.
- **What the pairs cover.** Pairs are formed only between data reads (`extract_list`, `extract`) of the same action. `capture_snapshot` and `wait_for_text` never break a window.

**Definitions used in the tables:**

- **Operation:** an outbound `server.execute_action`.
- **Segment:** the events from that operation to the next outbound `server.execute_action`.
- **primary snapshot:** the result's `metadata.trace.artifacts[]` entry with `role: primary`, which is always `text/html`. Its value in the table is one of:
  - `in_segment`: an artifact event in the segment delivered those bytes;
  - `earlier@N`: the same digest was delivered at sequence N, before the operation;
  - `not_held`: no artifact event delivered that digest (none occurred).
- **unavailable:** the result's `metadata.trace.unavailable`.
- **rows / items seen:** `payload.extracted` length and `payload.extraction.itemsSeen`. A `web.dom.extract` result is a single string value: its rows show `-`, meaning 1 value.
- **Strict changed-read pair:**
  - two data reads of the same action in the same trace;
  - the same URL path, with no state-changing operation between them;
  - `parameters` or `target` differ (deep diff, field paths only).
- **Same-snapshot pairs (supplementary):** any two data reads in the store, in any trace or window, whose results name the same primary snapshot digest and whose parameter or target fingerprints differ. A fingerprint is the sha256 prefix of canonical JSON. I grouped these by fingerprint pair. They are the strongest offline-versus-live candidates: the offline reader re-reads the exact document the live second read saw.

## Store-wide tallies (closed names)

| store | traces (activity / termination) | events by kind | operations by action | result status | failure codes | trace `unavailable` |
| --- | --- | --- | --- | --- | --- | --- |
| job | exploration 1 / test 1, both `completed` | outbound 297, artifact 42, inbound 585, disposition 585, control 2 | capture_snapshot 245, navigate 25, click 13, type 4, extract_list 10 | succeeded 291, failed 6 | web.action.failed 4, web.target.ambiguous 1, web.action.rate_limited 1 | 0 on all 297 |
| photo | exploration 1, `failed` (`AutomationStudioFlowBootstrapGenerationError`) | outbound 333, artifact 30, inbound 665, disposition 665 | capture_snapshot 273, navigate 37, click 14, extract_list 7, extract 2 | succeeded 333 | none | 0 on all 333 |
| social | exploration 1 / test 8, all `completed` | outbound 421, artifact 89, inbound 738, disposition 738, control 16 | capture_snapshot 282, click 50, extract_list 58, navigate 18, scroll 9, wait_for_text 4 | succeeded 333, failed 88 | web.validation.output_not_observed 47, web.target.not_found 41 | 0 on 154, **1 on 267** (every social read) |

All 12 manifests list only `text/html` artifacts (job 42, photo 30, social 89). The store holds every one of them: manifest count = held count in every trace.

## Inventory per site

Trace columns: artifacts = manifest entries / artifacts the store holds. capture_snapshot = count (primary snapshot in segment / delivered earlier / missing; results with unavailable > 0). Read rows: seq = the outbound command's delivery sequence; op# = its ordinal among the trace's operations.

### job-board (run-mvgw1854-5d10955b)

Project 1fa185e9-b435-4616-9d51-72a92e54b135

| trace | activity / termination | episode | candidate rev / digest | events | artifacts (manifest / held) | operations | by action | reads | capture_snapshot (in segment / earlier / missing; unavailable>0) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| trace.5ef4fa86-6447-4add-9294-32a9562daada | exploration / completed | 963d06f9 | - | 1330 | 31 / 31 | 267 | capture_snapshot 226, navigate 21, click 9, type 3, extract_list 8 | 8 | 226 (9 / 217 / 0; 0) |
| trace.53d44264-941e-4d59-8bcf-afd7e0abb0da | test / completed | 7819ef68 | 1 / 83f06d8a05ae | 181 | 11 / 11 | 30 | capture_snapshot 19, navigate 4, type 1, extract_list 2, click 4 | 2 | 19 (3 / 16 / 0; 0) |

| trace | seq (op#) | action | lease | URL path | primary snapshot | digest | unavailable | status (failure) | rows / items seen |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 5ef4fa86 | 130 (30) | extract_list | builder | /scenarios/job-board/jobs | earlier@65 | cbdb3c64d00c | 0 | succeeded | 7 / 7 |
| 5ef4fa86 | 144 (34) | extract_list | builder | /scenarios/job-board/jobs | earlier@65 | cbdb3c64d00c | 0 | succeeded | 3 / 7 |
| 5ef4fa86 | 1234 (237) | extract_list | builder | /scenarios/job-board/myjobs | earlier@1066 | 0a1c9b587911 | 0 | failed (web.action.failed) | - / - |
| 5ef4fa86 | 1237 (238) | extract_list | builder | /scenarios/job-board/myjobs | earlier@1066 | 0a1c9b587911 | 0 | failed (web.action.failed) | - / - |
| 5ef4fa86 | 1240 (239) | extract_list | builder | /scenarios/job-board/myjobs | earlier@1066 | 0a1c9b587911 | 0 | failed (web.action.failed) | - / - |
| 5ef4fa86 | 1243 (240) | extract_list | builder | /scenarios/job-board/myjobs | earlier@1066 | 0a1c9b587911 | 0 | failed (web.action.failed) | - / - |
| 5ef4fa86 | 1255 (244) | extract_list | builder | /scenarios/job-board/myjobs | earlier@1066 | 0a1c9b587911 | 0 | succeeded | 4 / 4 |
| 5ef4fa86 | 1284 (253) | extract_list | builder | /scenarios/job-board/myjobs | earlier@1066 | 0a1c9b587911 | 0 | succeeded | 4 / 4 |
| 53d44264 | 91 (11) | extract_list | builder | /scenarios/job-board/jobs | earlier@63 | cbdb3c64d00c | 0 | succeeded | 4 / 7 |
| 53d44264 | 171 (28) | extract_list | builder | /scenarios/job-board/myjobs | earlier@163 | 6cb32ea2f275 | 0 | succeeded | 5 / 5 |


**Strict changed-read pairs** (grouped by differing paths and outcomes; "pairs" is the number of seq pairs in the group):
/^\*\*Same-snapshot pairs\*\*/a
/^Project [0-9a-f-]*$/a
| trace | pairs | example first / second seq (all pairs) | same snapshot | first | second | differing paths |
| --- | --- | --- | --- | --- | --- | --- |
| 5ef4fa86 | 1 | 130/144 | yes | ok 7/7 | ok 3/7 | parameters.extractList.where (added) |
| 5ef4fa86 | 4 | 1234/1255, 1237/1255, 1240/1255, 1243/1255 | yes | failed -/- | ok 4/4 | parameters.handle (removed); parameters.fields (removed); parameters.extractList (added); parameters.recordOutput (added) |
| 5ef4fa86 | 4 | 1234/1284, 1237/1284, 1240/1284, 1243/1284 | yes | failed -/- | ok 4/4 | parameters.handle (removed); parameters.fields (removed); parameters.extractList (added) |
| 5ef4fa86 | 1 | 1255/1284 | yes | ok 4/4 | ok 4/4 | parameters.recordOutput (removed) |

**Same-snapshot pairs** (any trace or window; grouped by parameter-fingerprint pair):
| snapshot | fingerprints | instances | cross-trace | example (first / second) | differing paths |
| --- | --- | --- | --- | --- | --- |
| cbdb3c64d00c | f6ef0ceb73 / a76760a00e | 1 | 0 | 5ef4fa86@130 ok 7/7 / 5ef4fa86@144 ok 3/7 | parameters.extractList.where (added) |
| cbdb3c64d00c | f6ef0ceb73 / 6b0f86f63f | 1 | 1 | 5ef4fa86@130 ok 7/7 / 53d44264@91 ok 4/7 | parameters.extractList.fields.url (removed); parameters.extractList.where (added); parameters.extractList.answer (added); parameters.rejectedSamples; parameters.timeoutMs (added) |
| cbdb3c64d00c | a76760a00e / 6b0f86f63f | 1 | 1 | 5ef4fa86@144 ok 3/7 / 53d44264@91 ok 4/7 | parameters.extractList.fields.url (removed); parameters.extractList.where[0].equals (removed); parameters.extractList.where[0].contains (added); parameters.extractList.where[1].equals (removed); parameters.extractList.where[1].contains (added); parameters.extractList.answer (added); parameters.rejectedSamples; parameters.timeoutMs (added) |
| 0a1c9b587911 | da85afef3a / 96b67589ce | 4 | 0 | 5ef4fa86@1234 failed -/- / 5ef4fa86@1255 ok 4/4 | parameters.handle (removed); parameters.fields (removed); parameters.extractList (added); parameters.recordOutput (added) |
| 0a1c9b587911 | da85afef3a / d96f68d9fd | 4 | 0 | 5ef4fa86@1234 failed -/- / 5ef4fa86@1284 ok 4/4 | parameters.handle (removed); parameters.fields (removed); parameters.extractList (added) |
| 0a1c9b587911 | 96b67589ce / d96f68d9fd | 1 | 0 | 5ef4fa86@1255 ok 4/4 / 5ef4fa86@1284 ok 4/4 | parameters.recordOutput (removed) |

### photo-social (run-mvgw7320-de416190)

Project 46260e60-39ac-433d-a319-1b814a0c45ac

| trace | activity / termination | episode | candidate rev / digest | events | artifacts (manifest / held) | operations | by action | reads | capture_snapshot (in segment / earlier / missing; unavailable>0) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| trace.9d22eb9b-0e9a-4b7a-9881-5a79bbf0cc00 | exploration / failed | c435118d | - | 1693 | 30 / 30 | 333 | capture_snapshot 273, navigate 37, click 14, extract_list 7, extract 2 | 9 | 273 (12 / 261 / 0; 0) |

| trace | seq (op#) | action | lease | URL path | primary snapshot | digest | unavailable | status (failure) | rows / items seen |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 9d22eb9b | 211 (37) | extract_list | builder | /scenarios/photo-social/harbourlight.studio/ | in_segment | 4db48d956da5 | 0 | succeeded | 24 / 24 |
| 9d22eb9b | 675 (132) | extract_list | builder | /scenarios/photo-social/p/D1OKDvAEHfa/ | earlier@658 | d8ceba0efe14 | 0 | succeeded | 0 / 0 |
| 9d22eb9b | 891 (169) | extract_list | builder | /scenarios/photo-social/ | earlier@33 | 45707b85cac5 | 0 | succeeded | 0 / 0 |
| 9d22eb9b | 943 (181) | extract_list | builder | /scenarios/photo-social/p/D1OKDvAEHfa/ | earlier@728 | b35edf6fb8c7 | 0 | succeeded | 0 / 0 |
| 9d22eb9b | 1023 (199) | extract_list | builder | /scenarios/photo-social/ | earlier@33 | 45707b85cac5 | 0 | succeeded | 0 / 0 |
| 9d22eb9b | 1043 (205) | extract | builder | /scenarios/photo-social/ | earlier@33 | 45707b85cac5 | 0 | succeeded | - / - |
| 9d22eb9b | 1095 (217) | extract | builder | /scenarios/photo-social/p/D1OKDvAEHfa/ | earlier@728 | b35edf6fb8c7 | 0 | succeeded | - / - |
| 9d22eb9b | 1208 (240) | extract_list | builder | /scenarios/photo-social/ | earlier@33 | 45707b85cac5 | 0 | succeeded | 0 / 0 |
| 9d22eb9b | 1414 (280) | extract_list | builder | /scenarios/photo-social/ | earlier@33 | 45707b85cac5 | 0 | succeeded | 0 / 0 |


**Strict changed-read pairs** (grouped by differing paths and outcomes; "pairs" is the number of seq pairs in the group):
/^\*\*Same-snapshot pairs\*\*/a
/^Project [0-9a-f-]*$/a
| trace | pairs | example first / second seq (all pairs) | same snapshot | first | second | differing paths |
| --- | --- | --- | --- | --- | --- | --- |

**Same-snapshot pairs** (any trace or window; grouped by parameter-fingerprint pair):
| snapshot | fingerprints | instances | cross-trace | example (first / second) | differing paths |
| --- | --- | --- | --- | --- | --- |
| 45707b85cac5 | fa53368b49 / dccd96cfab | 1 | 0 | 9d22eb9b@891 ok 0/0 / 9d22eb9b@1023 ok 0/0 | parameters.timeoutMs (added) |
| 45707b85cac5 | fa53368b49 / 0d6581b3e9 | 1 | 0 | 9d22eb9b@891 ok 0/0 / 9d22eb9b@1208 ok 0/0 | parameters.timeoutMs (added) |
| 45707b85cac5 | fa53368b49 / 147708e5d5 | 1 | 0 | 9d22eb9b@891 ok 0/0 / 9d22eb9b@1414 ok 0/0 | parameters.timeoutMs (added) |
| 45707b85cac5 | dccd96cfab / 0d6581b3e9 | 1 | 0 | 9d22eb9b@1023 ok 0/0 / 9d22eb9b@1208 ok 0/0 | parameters.timeoutMs |
| 45707b85cac5 | dccd96cfab / 147708e5d5 | 1 | 0 | 9d22eb9b@1023 ok 0/0 / 9d22eb9b@1414 ok 0/0 | parameters.timeoutMs |
| 45707b85cac5 | 0d6581b3e9 / 147708e5d5 | 1 | 0 | 9d22eb9b@1208 ok 0/0 / 9d22eb9b@1414 ok 0/0 | parameters.timeoutMs |

### social-network-feed (run-mvgw3ve5-294881b5)

Project a846814f-becd-4569-934f-f3a10df1ce79

| trace | activity / termination | episode | candidate rev / digest | events | artifacts (manifest / held) | operations | by action | reads | capture_snapshot (in segment / earlier / missing; unavailable>0) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| trace.5c07f127-aad7-4151-bae6-818d6693eb41 | exploration / completed | 6a028d03 | - | 892 | 51 / 51 | 153 | capture_snapshot 112, navigate 2, click 5, extract_list 33, scroll 1 | 33 | 112 (15 / 97 / 0; 73) |
| trace.7480feb6-8525-45d0-b097-655124513838 | test / completed | 7c8e2301 | 1 / 480db038a577 | 126 | 4 / 4 | 30 | capture_snapshot 19, navigate 2, click 7, scroll 1, extract_list 1 | 1 | 19 (1 / 18 / 0; 11) |
| trace.a4d59680-a35f-4100-b8f9-dccc890b35c6 | test / completed | c9eb5664 | 2 / 5eb4bae4eb28 | 115 | 4 / 4 | 27 | capture_snapshot 17, navigate 2, click 3, scroll 1, extract_list 4 | 4 | 17 (1 / 16 / 0; 9) |
| trace.b414b6a4-00a5-4799-b663-6b8ca5bd03c3 | test / completed | 154425ca | 3 / b7e2fec46c5e | 332 | 9 / 9 | 89 | capture_snapshot 57, navigate 2, click 20, scroll 1, extract_list 5, wait_for_text 4 | 9 | 57 (1 / 56 / 0; 49) |
| trace.e855db8e-a1ec-4afa-bb15-4bc15d57f3f4 | test / completed | 08cc7673 | 4 / 5eb4bae4eb28 | 118 | 5 / 5 | 27 | capture_snapshot 17, navigate 2, click 3, scroll 1, extract_list 4 | 4 | 17 (1 / 16 / 0; 9) |
| trace.f53b350b-3146-40b2-a44d-15ddbf0913a7 | test / completed | 9ddb30fe | 5 / 86d511cb0b83 | 89 | 4 / 4 | 19 | capture_snapshot 12, navigate 2, click 3, scroll 1, extract_list 1 | 1 | 12 (1 / 11 / 0; 4) |
| trace.b2b5984c-d314-4b60-81a8-64832069c4b9 | test / completed | 746db4d6 | 6 / 738539e34c6d | 117 | 4 / 4 | 27 | capture_snapshot 17, navigate 2, click 3, scroll 1, extract_list 4 | 4 | 17 (1 / 16 / 0; 9) |
| trace.92d5ddeb-dbe6-49ff-83a1-680b84d31890 | test / completed | 24935b2b | 7 / 613ee2f26a89 | 124 | 4 / 4 | 30 | capture_snapshot 19, navigate 2, click 3, scroll 1, extract_list 5 | 5 | 19 (1 / 18 / 0; 11) |
| trace.3e353455-9e9e-48da-baba-a06b73f0ccc9 | test / completed | f0b2dfbd | 8 / cfa2549ce1e8 | 89 | 4 / 4 | 19 | capture_snapshot 12, navigate 2, click 3, scroll 1, extract_list 1 | 1 | 12 (1 / 11 / 0; 4) |

| trace | seq (op#) | action | lease | URL path | primary snapshot | digest | unavailable | status (failure) | rows / items seen |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 5c07f127 | 136 (36) | extract_list | builder | /scenarios/social-network-feed/ | in_segment | c554300708d3 | 1 | failed (web.validation.output_not_observed) | - / - |
| 5c07f127 | 140 (37) | extract_list | builder | /scenarios/social-network-feed/ | in_segment | e974895db016 | 1 | failed (web.validation.output_not_observed) | - / - |
| 5c07f127 | 146 (38) | extract_list | builder | /scenarios/social-network-feed/ | in_segment | 8bb19fe7df78 | 1 | failed (web.validation.output_not_observed) | - / - |
| 5c07f127 | 150 (39) | extract_list | builder | /scenarios/social-network-feed/ | earlier@147 | 8bb19fe7df78 | 1 | failed (web.validation.output_not_observed) | - / - |
| 5c07f127 | 164 (43) | extract_list | builder | /scenarios/social-network-feed/ | earlier@147 | 8bb19fe7df78 | 1 | failed (web.validation.output_not_observed) | - / - |
| 5c07f127 | 167 (44) | extract_list | builder | /scenarios/social-network-feed/ | earlier@147 | 8bb19fe7df78 | 1 | failed (web.validation.output_not_observed) | - / - |
| 5c07f127 | 172 (45) | extract_list | builder | /scenarios/social-network-feed/ | earlier@147 | 8bb19fe7df78 | 1 | failed (web.validation.output_not_observed) | - / - |
| 5c07f127 | 175 (46) | extract_list | builder | /scenarios/social-network-feed/ | earlier@147 | 8bb19fe7df78 | 1 | failed (web.validation.output_not_observed) | - / - |
| 5c07f127 | 189 (50) | extract_list | builder | /scenarios/social-network-feed/ | earlier@147 | 8bb19fe7df78 | 1 | succeeded | 34 / 34 |
| 5c07f127 | 201 (54) | extract_list | builder | /scenarios/social-network-feed/ | earlier@147 | 8bb19fe7df78 | 1 | failed (web.validation.output_not_observed) | - / - |
| 5c07f127 | 206 (55) | extract_list | builder | /scenarios/social-network-feed/ | earlier@147 | 8bb19fe7df78 | 1 | failed (web.validation.output_not_observed) | - / - |
| 5c07f127 | 209 (56) | extract_list | builder | /scenarios/social-network-feed/ | earlier@147 | 8bb19fe7df78 | 1 | failed (web.validation.output_not_observed) | - / - |
| 5c07f127 | 214 (57) | extract_list | builder | /scenarios/social-network-feed/ | earlier@147 | 8bb19fe7df78 | 1 | failed (web.validation.output_not_observed) | - / - |
| 5c07f127 | 226 (61) | extract_list | builder | /scenarios/social-network-feed/ | earlier@147 | 8bb19fe7df78 | 1 | failed (web.validation.output_not_observed) | - / - |
| 5c07f127 | 231 (62) | extract_list | builder | /scenarios/social-network-feed/ | earlier@147 | 8bb19fe7df78 | 1 | failed (web.validation.output_not_observed) | - / - |
| 5c07f127 | 234 (63) | extract_list | builder | /scenarios/social-network-feed/ | earlier@147 | 8bb19fe7df78 | 1 | failed (web.validation.output_not_observed) | - / - |
| 5c07f127 | 239 (64) | extract_list | builder | /scenarios/social-network-feed/ | earlier@147 | 8bb19fe7df78 | 1 | failed (web.validation.output_not_observed) | - / - |
| 5c07f127 | 251 (68) | extract_list | builder | /scenarios/social-network-feed/ | earlier@147 | 8bb19fe7df78 | 1 | succeeded | 34 / 34 |
| 5c07f127 | 265 (72) | extract_list | builder | /scenarios/social-network-feed/ | earlier@147 | 8bb19fe7df78 | 1 | succeeded | 34 / 34 |
| 5c07f127 | 291 (80) | extract_list | builder | /scenarios/social-network-feed/ | earlier@147 | 8bb19fe7df78 | 1 | succeeded | 34 / 34 |
| 5c07f127 | 803 (128) | extract_list | repair | /scenarios/social-network-feed/ | earlier@399 | a57645902a11 | 1 | failed (web.validation.output_not_observed) | - / - |
| 5c07f127 | 806 (129) | extract_list | repair | /scenarios/social-network-feed/ | earlier@399 | a57645902a11 | 1 | failed (web.validation.output_not_observed) | - / - |
| 5c07f127 | 809 (130) | extract_list | repair | /scenarios/social-network-feed/ | earlier@399 | a57645902a11 | 1 | failed (web.validation.output_not_observed) | - / - |
| 5c07f127 | 814 (131) | extract_list | repair | /scenarios/social-network-feed/ | earlier@399 | a57645902a11 | 1 | failed (web.validation.output_not_observed) | - / - |
| 5c07f127 | 828 (135) | extract_list | repair | /scenarios/social-network-feed/ | earlier@399 | a57645902a11 | 1 | failed (web.validation.output_not_observed) | - / - |
| 5c07f127 | 831 (136) | extract_list | repair | /scenarios/social-network-feed/ | earlier@399 | a57645902a11 | 1 | failed (web.validation.output_not_observed) | - / - |
| 5c07f127 | 834 (137) | extract_list | repair | /scenarios/social-network-feed/ | earlier@399 | a57645902a11 | 1 | failed (web.validation.output_not_observed) | - / - |
| 5c07f127 | 839 (138) | extract_list | repair | /scenarios/social-network-feed/ | earlier@399 | a57645902a11 | 1 | failed (web.validation.output_not_observed) | - / - |
| 5c07f127 | 851 (142) | extract_list | repair | /scenarios/social-network-feed/ | earlier@399 | a57645902a11 | 1 | succeeded | 16 / 34 |
| 5c07f127 | 865 (146) | extract_list | repair | /scenarios/social-network-feed/ | earlier@399 | a57645902a11 | 1 | succeeded | 16 / 34 |
| 5c07f127 | 882 (151) | extract_list | repair | /scenarios/social-network-feed/ | earlier@399 | a57645902a11 | 1 | failed (web.validation.output_not_observed) | - / - |
| 5c07f127 | 885 (152) | extract_list | repair | /scenarios/social-network-feed/ | earlier@399 | a57645902a11 | 1 | failed (web.validation.output_not_observed) | - / - |
| 5c07f127 | 890 (153) | extract_list | repair | /scenarios/social-network-feed/ | earlier@399 | a57645902a11 | 1 | failed (web.validation.output_not_observed) | - / - |
| 7480feb6 | 80 (17) | extract_list | builder | /scenarios/social-network-feed/ | in_segment | a89251e6c353 | 1 | succeeded | 17 / 32 |
| a4d59680 | 78 (17) | extract_list | builder | /scenarios/social-network-feed/ | earlier@2 | a89251e6c353 | 1 | failed (web.validation.output_not_observed) | - / - |
| a4d59680 | 87 (20) | extract_list | builder | /scenarios/social-network-feed/ | in_segment | a57645902a11 | 1 | failed (web.validation.output_not_observed) | - / - |
| a4d59680 | 99 (23) | extract_list | builder | /scenarios/social-network-feed/ | earlier@88 | a57645902a11 | 1 | failed (web.validation.output_not_observed) | - / - |
| a4d59680 | 108 (26) | extract_list | builder | /scenarios/social-network-feed/ | earlier@88 | a57645902a11 | 1 | failed (web.validation.output_not_observed) | - / - |
| b414b6a4 | 80 (17) | extract_list | builder | /scenarios/social-network-feed/ | in_segment | a89251e6c353 | 1 | succeeded | 17 / 32 |
| b414b6a4 | 110 (25) | wait_for_text | builder | /scenarios/social-network-feed/ | earlier@102 | a8b156195c25 | 1 | succeeded | - / - |
| b414b6a4 | 148 (36) | wait_for_text | builder | /scenarios/social-network-feed/ | earlier@140 | a3e897dbc0f7 | 1 | succeeded | - / - |
| b414b6a4 | 217 (56) | wait_for_text | builder | /scenarios/social-network-feed/ | earlier@209 | 7a5b4a6d4451 | 1 | succeeded | - / - |
| b414b6a4 | 246 (64) | wait_for_text | builder | /scenarios/social-network-feed/ | earlier@238 | 71da59d1f0ed | 1 | succeeded | - / - |
| b414b6a4 | 295 (79) | extract_list | builder | /scenarios/social-network-feed/ | in_segment | fff583393e15 | 1 | failed (web.validation.output_not_observed) | - / - |
| b414b6a4 | 307 (82) | extract_list | builder | /scenarios/social-network-feed/ | earlier@296 | fff583393e15 | 1 | failed (web.validation.output_not_observed) | - / - |
| b414b6a4 | 316 (85) | extract_list | builder | /scenarios/social-network-feed/ | earlier@296 | fff583393e15 | 1 | failed (web.validation.output_not_observed) | - / - |
| b414b6a4 | 327 (88) | extract_list | builder | /scenarios/social-network-feed/ | earlier@296 | fff583393e15 | 1 | failed (web.validation.output_not_observed) | - / - |
| e855db8e | 78 (17) | extract_list | builder | /scenarios/social-network-feed/ | in_segment | a89251e6c353 | 1 | failed (web.validation.output_not_observed) | - / - |
| e855db8e | 90 (20) | extract_list | builder | /scenarios/social-network-feed/ | in_segment | a57645902a11 | 1 | failed (web.validation.output_not_observed) | - / - |
| e855db8e | 102 (23) | extract_list | builder | /scenarios/social-network-feed/ | earlier@91 | a57645902a11 | 1 | failed (web.validation.output_not_observed) | - / - |
| e855db8e | 111 (26) | extract_list | builder | /scenarios/social-network-feed/ | earlier@91 | a57645902a11 | 1 | failed (web.validation.output_not_observed) | - / - |
| f53b350b | 78 (17) | extract_list | builder | /scenarios/social-network-feed/ | in_segment | a89251e6c353 | 1 | succeeded | 17 / 32 |
| b2b5984c | 78 (17) | extract_list | builder | /scenarios/social-network-feed/ | in_segment | a57645902a11 | 1 | failed (web.validation.output_not_observed) | - / - |
| b2b5984c | 90 (20) | extract_list | builder | /scenarios/social-network-feed/ | earlier@81 | a57645902a11 | 1 | failed (web.validation.output_not_observed) | - / - |
| b2b5984c | 101 (23) | extract_list | builder | /scenarios/social-network-feed/ | earlier@81 | a57645902a11 | 1 | failed (web.validation.output_not_observed) | - / - |
| b2b5984c | 110 (26) | extract_list | builder | /scenarios/social-network-feed/ | earlier@81 | a57645902a11 | 1 | failed (web.validation.output_not_observed) | - / - |
| 92d5ddeb | 78 (17) | extract_list | builder | /scenarios/social-network-feed/ | in_segment | 639e1b0f9e2d | 1 | succeeded | 0 / 30 |
| 92d5ddeb | 88 (20) | extract_list | builder | /scenarios/social-network-feed/ | earlier@2 | a57645902a11 | 1 | failed (web.validation.output_not_observed) | - / - |
| 92d5ddeb | 99 (23) | extract_list | builder | /scenarios/social-network-feed/ | earlier@2 | a57645902a11 | 1 | failed (web.validation.output_not_observed) | - / - |
| 92d5ddeb | 108 (26) | extract_list | builder | /scenarios/social-network-feed/ | earlier@2 | a57645902a11 | 1 | failed (web.validation.output_not_observed) | - / - |
| 92d5ddeb | 119 (29) | extract_list | builder | /scenarios/social-network-feed/ | earlier@2 | a57645902a11 | 1 | failed (web.validation.output_not_observed) | - / - |
| 3e353455 | 78 (17) | extract_list | builder | /scenarios/social-network-feed/ | in_segment | 639e1b0f9e2d | 1 | succeeded | 0 / 30 |


**Strict changed-read pairs** (grouped by differing paths and outcomes; "pairs" is the number of seq pairs in the group):
/^\*\*Same-snapshot pairs\*\*/a
/^Project [0-9a-f-]*$/a
| trace | pairs | example first / second seq (all pairs) | same snapshot | first | second | differing paths |
| --- | --- | --- | --- | --- | --- | --- |
| 5c07f127 | 8 | 136/164, 136/167, 136/172, 136/175, ... | no c554300708d3/8bb19fe7df78 | failed -/- | failed -/- | parameters.extractList.fields: 56 auto-named fields (removed); parameters.extractList.fields.group (added); parameters.extractList.fields.author (added); parameters.extractList.fields.posted (added); parameters.extractList.fields.text (added); parameters.extractList.fields.comments (added) |
| 5c07f127 | 1 | 136/189 | no c554300708d3/8bb19fe7df78 | failed -/- | ok 34/34 | parameters.extractList.fields: 56 auto-named fields (removed); parameters.extractList.fields.group (added); parameters.extractList.fields.author (added); parameters.extractList.fields.posted (added); parameters.extractList.fields.comments (added); parameters.timeoutMs (added) |
| 5c07f127 | 4 | 136/201, 136/206, 136/209, 136/214 | no c554300708d3/8bb19fe7df78 | failed -/- | failed -/- | parameters.extractList.fields: 56 auto-named fields (removed); parameters.extractList.fields.group (added); parameters.extractList.fields.group2 (added); parameters.extractList.fields.author (added); parameters.extractList.fields.posted (added); parameters.extractList.fields.text (added); parameters.extractList.fields.comments (added); parameters.timeoutMs (added) |
| 5c07f127 | 1 | 136/251 | no c554300708d3/8bb19fe7df78 | failed -/- | ok 34/34 | parameters.extractList.fields: 56 auto-named fields (removed); parameters.extractList.fields.group (added); parameters.extractList.fields.group2 (added); parameters.extractList.fields.author (added); parameters.extractList.fields.posted (added); parameters.extractList.fields.comments (added); parameters.timeoutMs (added) |
| 5c07f127 | 1 | 136/265 | no c554300708d3/8bb19fe7df78 | failed -/- | ok 34/34 | parameters.extractList.fields: 56 auto-named fields (removed); parameters.extractList.fields.group (added); parameters.extractList.fields.author (added); parameters.extractList.fields.posted (added); parameters.extractList.fields.comments (added) |
| 5c07f127 | 1 | 136/291 | no c554300708d3/8bb19fe7df78 | failed -/- | ok 34/34 | parameters.extractList.fields: 56 auto-named fields (removed); parameters.extractList.fields.group (added); parameters.extractList.fields.author (added); parameters.extractList.fields.posted (added); parameters.extractList.fields.comments (added); parameters.recordOutput (added) |
| 5c07f127 | 8 | 140/164, 140/167, 140/172, 140/175, ... | no e974895db016/8bb19fe7df78 | failed -/- | failed -/- | parameters.extractList.fields: 56 auto-named fields (removed); parameters.extractList.fields.group (added); parameters.extractList.fields.author (added); parameters.extractList.fields.posted (added); parameters.extractList.fields.text (added); parameters.extractList.fields.comments (added) |
| 5c07f127 | 1 | 140/189 | no e974895db016/8bb19fe7df78 | failed -/- | ok 34/34 | parameters.extractList.fields: 56 auto-named fields (removed); parameters.extractList.fields.group (added); parameters.extractList.fields.author (added); parameters.extractList.fields.posted (added); parameters.extractList.fields.comments (added); parameters.timeoutMs (added) |
| 5c07f127 | 4 | 140/201, 140/206, 140/209, 140/214 | no e974895db016/8bb19fe7df78 | failed -/- | failed -/- | parameters.extractList.fields: 56 auto-named fields (removed); parameters.extractList.fields.group (added); parameters.extractList.fields.group2 (added); parameters.extractList.fields.author (added); parameters.extractList.fields.posted (added); parameters.extractList.fields.text (added); parameters.extractList.fields.comments (added); parameters.timeoutMs (added) |
| 5c07f127 | 1 | 140/251 | no e974895db016/8bb19fe7df78 | failed -/- | ok 34/34 | parameters.extractList.fields: 56 auto-named fields (removed); parameters.extractList.fields.group (added); parameters.extractList.fields.group2 (added); parameters.extractList.fields.author (added); parameters.extractList.fields.posted (added); parameters.extractList.fields.comments (added); parameters.timeoutMs (added) |
| 5c07f127 | 1 | 140/265 | no e974895db016/8bb19fe7df78 | failed -/- | ok 34/34 | parameters.extractList.fields: 56 auto-named fields (removed); parameters.extractList.fields.group (added); parameters.extractList.fields.author (added); parameters.extractList.fields.posted (added); parameters.extractList.fields.comments (added) |
| 5c07f127 | 1 | 140/291 | no e974895db016/8bb19fe7df78 | failed -/- | ok 34/34 | parameters.extractList.fields: 56 auto-named fields (removed); parameters.extractList.fields.group (added); parameters.extractList.fields.author (added); parameters.extractList.fields.posted (added); parameters.extractList.fields.comments (added); parameters.recordOutput (added) |
| 5c07f127 | 16 | 146/164, 146/167, 146/172, 146/175, ... | yes | failed -/- | failed -/- | parameters.extractList.fields: 56 auto-named fields (removed); parameters.extractList.fields.group (added); parameters.extractList.fields.author (added); parameters.extractList.fields.posted (added); parameters.extractList.fields.text (added); parameters.extractList.fields.comments (added) |
| 5c07f127 | 2 | 146/189, 150/189 | yes | failed -/- | ok 34/34 | parameters.extractList.fields: 56 auto-named fields (removed); parameters.extractList.fields.group (added); parameters.extractList.fields.author (added); parameters.extractList.fields.posted (added); parameters.extractList.fields.comments (added); parameters.timeoutMs (added) |
| 5c07f127 | 8 | 146/201, 146/206, 146/209, 146/214, ... | yes | failed -/- | failed -/- | parameters.extractList.fields: 56 auto-named fields (removed); parameters.extractList.fields.group (added); parameters.extractList.fields.group2 (added); parameters.extractList.fields.author (added); parameters.extractList.fields.posted (added); parameters.extractList.fields.text (added); parameters.extractList.fields.comments (added); parameters.timeoutMs (added) |
| 5c07f127 | 2 | 146/251, 150/251 | yes | failed -/- | ok 34/34 | parameters.extractList.fields: 56 auto-named fields (removed); parameters.extractList.fields.group (added); parameters.extractList.fields.group2 (added); parameters.extractList.fields.author (added); parameters.extractList.fields.posted (added); parameters.extractList.fields.comments (added); parameters.timeoutMs (added) |
| 5c07f127 | 2 | 146/265, 150/265 | yes | failed -/- | ok 34/34 | parameters.extractList.fields: 56 auto-named fields (removed); parameters.extractList.fields.group (added); parameters.extractList.fields.author (added); parameters.extractList.fields.posted (added); parameters.extractList.fields.comments (added) |
| 5c07f127 | 2 | 146/291, 150/291 | yes | failed -/- | ok 34/34 | parameters.extractList.fields: 56 auto-named fields (removed); parameters.extractList.fields.group (added); parameters.extractList.fields.author (added); parameters.extractList.fields.posted (added); parameters.extractList.fields.comments (added); parameters.recordOutput (added) |
| 5c07f127 | 4 | 164/189, 167/189, 172/189, 175/189 | yes | failed -/- | ok 34/34 | parameters.extractList.fields.text (removed); parameters.timeoutMs (added) |
| 5c07f127 | 16 | 164/201, 164/206, 164/209, 164/214, ... | yes | failed -/- | failed -/- | parameters.extractList.fields.group.selector; parameters.extractList.fields.group2 (added); parameters.timeoutMs (added) |
| 5c07f127 | 16 | 164/226, 164/231, 164/234, 164/239, ... | yes | failed -/- | failed -/- | parameters.extractList.fields.group.selector; parameters.extractList.fields.author.selector |
| 5c07f127 | 4 | 164/251, 167/251, 172/251, 175/251 | yes | failed -/- | ok 34/34 | parameters.extractList.fields.group.selector; parameters.extractList.fields.text (removed); parameters.extractList.fields.group2 (added); parameters.timeoutMs (added) |
| 5c07f127 | 4 | 164/265, 167/265, 172/265, 175/265 | yes | failed -/- | ok 34/34 | parameters.extractList.fields.text (removed) |
| 5c07f127 | 4 | 164/291, 167/291, 172/291, 175/291 | yes | failed -/- | ok 34/34 | parameters.extractList.fields.text (removed); parameters.recordOutput (added) |
| 5c07f127 | 4 | 189/201, 189/206, 189/209, 189/214 | yes | ok 34/34 | failed -/- | parameters.extractList.fields.group.selector; parameters.extractList.fields.group2 (added); parameters.extractList.fields.text (added) |
| 5c07f127 | 4 | 189/226, 189/231, 189/234, 189/239 | yes | ok 34/34 | failed -/- | parameters.extractList.fields.group.selector; parameters.extractList.fields.author.selector; parameters.extractList.fields.text (added); parameters.timeoutMs (removed) |
| 5c07f127 | 1 | 189/251 | yes | ok 34/34 | ok 34/34 | parameters.extractList.fields.group.selector; parameters.extractList.fields.group2 (added); parameters.timeoutMs |
| 5c07f127 | 1 | 189/265 | yes | ok 34/34 | ok 34/34 | parameters.timeoutMs (removed) |
| 5c07f127 | 1 | 189/291 | yes | ok 34/34 | ok 34/34 | parameters.timeoutMs (removed); parameters.recordOutput (added) |
| 5c07f127 | 16 | 201/226, 201/231, 201/234, 201/239, ... | yes | failed -/- | failed -/- | parameters.extractList.fields.group2 (removed); parameters.extractList.fields.author.selector; parameters.timeoutMs (removed) |
| 5c07f127 | 4 | 201/251, 206/251, 209/251, 214/251 | yes | failed -/- | ok 34/34 | parameters.extractList.fields.text (removed); parameters.timeoutMs |
| 5c07f127 | 4 | 201/265, 206/265, 209/265, 214/265 | yes | failed -/- | ok 34/34 | parameters.extractList.fields.group.selector; parameters.extractList.fields.group2 (removed); parameters.extractList.fields.text (removed); parameters.timeoutMs (removed) |
| 5c07f127 | 4 | 201/291, 206/291, 209/291, 214/291 | yes | failed -/- | ok 34/34 | parameters.extractList.fields.group.selector; parameters.extractList.fields.group2 (removed); parameters.extractList.fields.text (removed); parameters.timeoutMs (removed); parameters.recordOutput (added) |
| 5c07f127 | 4 | 226/251, 231/251, 234/251, 239/251 | yes | failed -/- | ok 34/34 | parameters.extractList.fields.author.selector; parameters.extractList.fields.text (removed); parameters.extractList.fields.group2 (added); parameters.timeoutMs (added) |
| 5c07f127 | 4 | 226/265, 231/265, 234/265, 239/265 | yes | failed -/- | ok 34/34 | parameters.extractList.fields.group.selector; parameters.extractList.fields.author.selector; parameters.extractList.fields.text (removed) |
| 5c07f127 | 4 | 226/291, 231/291, 234/291, 239/291 | yes | failed -/- | ok 34/34 | parameters.extractList.fields.group.selector; parameters.extractList.fields.author.selector; parameters.extractList.fields.text (removed); parameters.recordOutput (added) |
| 5c07f127 | 1 | 251/265 | yes | ok 34/34 | ok 34/34 | parameters.extractList.fields.group.selector; parameters.extractList.fields.group2 (removed); parameters.timeoutMs (removed) |
| 5c07f127 | 1 | 251/291 | yes | ok 34/34 | ok 34/34 | parameters.extractList.fields.group.selector; parameters.extractList.fields.group2 (removed); parameters.timeoutMs (removed); parameters.recordOutput (added) |
| 5c07f127 | 1 | 265/291 | yes | ok 34/34 | ok 34/34 | parameters.recordOutput (added) |
| 5c07f127 | 16 | 803/828, 803/831, 803/834, 803/839, ... | yes | failed -/- | failed -/- | parameters.extractList.where.length; parameters.extractList.where[1].field; parameters.extractList.where[1].matches (removed); parameters.extractList.where[1].equals (added); parameters.extractList.dedupe (added); parameters.recordOutput (added) |
| 5c07f127 | 4 | 803/851, 806/851, 809/851, 814/851 | yes | failed -/- | ok 16/34 | parameters.extractList.fields.text (removed); parameters.extractList.where.length; parameters.timeoutMs (removed); parameters.recordOutput (added) |
| 5c07f127 | 4 | 803/865, 806/865, 809/865, 814/865 | yes | failed -/- | ok 16/34 | parameters.extractList.fields.text (removed); parameters.extractList.where.length |
| 5c07f127 | 12 | 803/882, 803/885, 803/890, 806/882, ... | yes | failed -/- | failed -/- | parameters.extractList.where[0].is (removed); parameters.extractList.where[0].equals (added); parameters.extractList.dedupe (added); parameters.recordOutput (added) |
| 5c07f127 | 4 | 828/851, 831/851, 834/851, 839/851 | yes | failed -/- | ok 16/34 | parameters.extractList.fields.text (removed); parameters.extractList.where.length; parameters.extractList.dedupe (removed); parameters.recordOutput.datasetId; parameters.recordOutput.schema.fields.length; parameters.recordOutput.schema.fields[3].id; parameters.recordOutput.schema.fields[3].label; parameters.recordOutput.process (removed); parameters.recordOutput.purpose (added); parameters.timeoutMs (removed) |
| 5c07f127 | 4 | 828/865, 831/865, 834/865, 839/865 | yes | failed -/- | ok 16/34 | parameters.extractList.fields.text (removed); parameters.extractList.where.length; parameters.extractList.dedupe (removed); parameters.recordOutput (removed) |
| 5c07f127 | 12 | 828/882, 828/885, 828/890, 831/882, ... | yes | failed -/- | failed -/- | parameters.extractList.where.length; parameters.extractList.where[0].is (removed); parameters.extractList.where[0].equals (added); parameters.extractList.where[1].field; parameters.extractList.where[1].equals (removed); parameters.extractList.where[1].matches (added); parameters.extractList.dedupe.by.length; parameters.extractList.dedupe.by[3] |
| 5c07f127 | 1 | 851/865 | yes | ok 16/34 | ok 16/34 | parameters.recordOutput (removed); parameters.timeoutMs (added) |
| 5c07f127 | 3 | 851/882, 851/885, 851/890 | yes | ok 16/34 | failed -/- | parameters.extractList.fields.text (added); parameters.extractList.where.length; parameters.extractList.where[0].is (removed); parameters.extractList.where[0].equals (added); parameters.extractList.dedupe (added); parameters.recordOutput.datasetId; parameters.recordOutput.schema.fields.length; parameters.recordOutput.schema.fields[3].id; parameters.recordOutput.schema.fields[3].label; parameters.recordOutput.purpose (removed); parameters.recordOutput.process (added); parameters.timeoutMs (added) |
| 5c07f127 | 3 | 865/882, 865/885, 865/890 | yes | ok 16/34 | failed -/- | parameters.extractList.fields.text (added); parameters.extractList.where.length; parameters.extractList.where[0].is (removed); parameters.extractList.where[0].equals (added); parameters.extractList.dedupe (added); parameters.recordOutput (added) |
| 92d5ddeb | 4 | 78/88, 78/99, 78/108, 78/119 | no 639e1b0f9e2d/a57645902a11 | ok 0/30 | failed -/- | parameters.extractList.fields.text (added) |

**Same-snapshot pairs** (any trace or window; grouped by parameter-fingerprint pair):
| snapshot | fingerprints | instances | cross-trace | example (first / second) | differing paths |
| --- | --- | --- | --- | --- | --- |
| 8bb19fe7df78 | c250cb9782 / b7614ff312 | 8 | 0 | 5c07f127@146 failed -/- / 5c07f127@164 failed -/- | parameters.extractList.fields: 40 auto-named fields (removed); parameters.extractList.fields.group (added); parameters.extractList.fields.author (added); parameters.extractList.fields.posted (added); parameters.extractList.fields.text (added); parameters.extractList.fields.comments (added) |
| 8bb19fe7df78 | c250cb9782 / b42312e113 | 2 | 0 | 5c07f127@146 failed -/- / 5c07f127@189 ok 34/34 | parameters.extractList.fields: 40 auto-named fields (removed); parameters.extractList.fields.group (added); parameters.extractList.fields.author (added); parameters.extractList.fields.posted (added); parameters.extractList.fields.comments (added); parameters.timeoutMs (added) |
| 8bb19fe7df78 | c250cb9782 / 8f013c0def | 8 | 0 | 5c07f127@146 failed -/- / 5c07f127@201 failed -/- | parameters.extractList.fields: 40 auto-named fields (removed); parameters.extractList.fields.group (added); parameters.extractList.fields.group2 (added); parameters.extractList.fields.author (added); parameters.extractList.fields.posted (added); parameters.extractList.fields.text (added); parameters.extractList.fields.comments (added); parameters.timeoutMs (added) |
| 8bb19fe7df78 | c250cb9782 / 8e69edcbc7 | 8 | 0 | 5c07f127@146 failed -/- / 5c07f127@226 failed -/- | parameters.extractList.fields: 40 auto-named fields (removed); parameters.extractList.fields.group (added); parameters.extractList.fields.author (added); parameters.extractList.fields.posted (added); parameters.extractList.fields.text (added); parameters.extractList.fields.comments (added) |
| 8bb19fe7df78 | c250cb9782 / 175133fe55 | 2 | 0 | 5c07f127@146 failed -/- / 5c07f127@251 ok 34/34 | parameters.extractList.fields: 40 auto-named fields (removed); parameters.extractList.fields.group (added); parameters.extractList.fields.group2 (added); parameters.extractList.fields.author (added); parameters.extractList.fields.posted (added); parameters.extractList.fields.comments (added); parameters.timeoutMs (added) |
| 8bb19fe7df78 | c250cb9782 / 5b932b57d1 | 2 | 0 | 5c07f127@146 failed -/- / 5c07f127@265 ok 34/34 | parameters.extractList.fields: 40 auto-named fields (removed); parameters.extractList.fields.group (added); parameters.extractList.fields.author (added); parameters.extractList.fields.posted (added); parameters.extractList.fields.comments (added) |
| 8bb19fe7df78 | c250cb9782 / 9b44945fed | 2 | 0 | 5c07f127@146 failed -/- / 5c07f127@291 ok 34/34 | parameters.extractList.fields: 40 auto-named fields (removed); parameters.extractList.fields.group (added); parameters.extractList.fields.author (added); parameters.extractList.fields.posted (added); parameters.extractList.fields.comments (added); parameters.recordOutput (added) |
| 8bb19fe7df78 | b7614ff312 / b42312e113 | 4 | 0 | 5c07f127@164 failed -/- / 5c07f127@189 ok 34/34 | parameters.extractList.fields.text (removed); parameters.timeoutMs (added) |
| 8bb19fe7df78 | b7614ff312 / 8f013c0def | 16 | 0 | 5c07f127@164 failed -/- / 5c07f127@201 failed -/- | parameters.extractList.fields.group.selector; parameters.extractList.fields.group2 (added); parameters.timeoutMs (added) |
| 8bb19fe7df78 | b7614ff312 / 8e69edcbc7 | 16 | 0 | 5c07f127@164 failed -/- / 5c07f127@226 failed -/- | parameters.extractList.fields.group.selector; parameters.extractList.fields.author.selector |
| 8bb19fe7df78 | b7614ff312 / 175133fe55 | 4 | 0 | 5c07f127@164 failed -/- / 5c07f127@251 ok 34/34 | parameters.extractList.fields.group.selector; parameters.extractList.fields.text (removed); parameters.extractList.fields.group2 (added); parameters.timeoutMs (added) |
| 8bb19fe7df78 | b7614ff312 / 5b932b57d1 | 4 | 0 | 5c07f127@164 failed -/- / 5c07f127@265 ok 34/34 | parameters.extractList.fields.text (removed) |
| 8bb19fe7df78 | b7614ff312 / 9b44945fed | 4 | 0 | 5c07f127@164 failed -/- / 5c07f127@291 ok 34/34 | parameters.extractList.fields.text (removed); parameters.recordOutput (added) |
| 8bb19fe7df78 | b42312e113 / 8f013c0def | 4 | 0 | 5c07f127@189 ok 34/34 / 5c07f127@201 failed -/- | parameters.extractList.fields.group.selector; parameters.extractList.fields.group2 (added); parameters.extractList.fields.text (added) |
| 8bb19fe7df78 | b42312e113 / 8e69edcbc7 | 4 | 0 | 5c07f127@189 ok 34/34 / 5c07f127@226 failed -/- | parameters.extractList.fields.group.selector; parameters.extractList.fields.author.selector; parameters.extractList.fields.text (added); parameters.timeoutMs (removed) |
| 8bb19fe7df78 | b42312e113 / 175133fe55 | 1 | 0 | 5c07f127@189 ok 34/34 / 5c07f127@251 ok 34/34 | parameters.extractList.fields.group.selector; parameters.extractList.fields.group2 (added); parameters.timeoutMs |
| 8bb19fe7df78 | b42312e113 / 5b932b57d1 | 1 | 0 | 5c07f127@189 ok 34/34 / 5c07f127@265 ok 34/34 | parameters.timeoutMs (removed) |
| 8bb19fe7df78 | b42312e113 / 9b44945fed | 1 | 0 | 5c07f127@189 ok 34/34 / 5c07f127@291 ok 34/34 | parameters.timeoutMs (removed); parameters.recordOutput (added) |
| 8bb19fe7df78 | 8f013c0def / 8e69edcbc7 | 16 | 0 | 5c07f127@201 failed -/- / 5c07f127@226 failed -/- | parameters.extractList.fields.group2 (removed); parameters.extractList.fields.author.selector; parameters.timeoutMs (removed) |
| 8bb19fe7df78 | 8f013c0def / 175133fe55 | 4 | 0 | 5c07f127@201 failed -/- / 5c07f127@251 ok 34/34 | parameters.extractList.fields.text (removed); parameters.timeoutMs |
| 8bb19fe7df78 | 8f013c0def / 5b932b57d1 | 4 | 0 | 5c07f127@201 failed -/- / 5c07f127@265 ok 34/34 | parameters.extractList.fields.group.selector; parameters.extractList.fields.group2 (removed); parameters.extractList.fields.text (removed); parameters.timeoutMs (removed) |
| 8bb19fe7df78 | 8f013c0def / 9b44945fed | 4 | 0 | 5c07f127@201 failed -/- / 5c07f127@291 ok 34/34 | parameters.extractList.fields.group.selector; parameters.extractList.fields.group2 (removed); parameters.extractList.fields.text (removed); parameters.timeoutMs (removed); parameters.recordOutput (added) |
| 8bb19fe7df78 | 8e69edcbc7 / 175133fe55 | 4 | 0 | 5c07f127@226 failed -/- / 5c07f127@251 ok 34/34 | parameters.extractList.fields.author.selector; parameters.extractList.fields.text (removed); parameters.extractList.fields.group2 (added); parameters.timeoutMs (added) |
| 8bb19fe7df78 | 8e69edcbc7 / 5b932b57d1 | 4 | 0 | 5c07f127@226 failed -/- / 5c07f127@265 ok 34/34 | parameters.extractList.fields.group.selector; parameters.extractList.fields.author.selector; parameters.extractList.fields.text (removed) |
| 8bb19fe7df78 | 8e69edcbc7 / 9b44945fed | 4 | 0 | 5c07f127@226 failed -/- / 5c07f127@291 ok 34/34 | parameters.extractList.fields.group.selector; parameters.extractList.fields.author.selector; parameters.extractList.fields.text (removed); parameters.recordOutput (added) |
| 8bb19fe7df78 | 175133fe55 / 5b932b57d1 | 1 | 0 | 5c07f127@251 ok 34/34 / 5c07f127@265 ok 34/34 | parameters.extractList.fields.group.selector; parameters.extractList.fields.group2 (removed); parameters.timeoutMs (removed) |
| 8bb19fe7df78 | 175133fe55 / 9b44945fed | 1 | 0 | 5c07f127@251 ok 34/34 / 5c07f127@291 ok 34/34 | parameters.extractList.fields.group.selector; parameters.extractList.fields.group2 (removed); parameters.timeoutMs (removed); parameters.recordOutput (added) |
| 8bb19fe7df78 | 5b932b57d1 / 9b44945fed | 1 | 0 | 5c07f127@265 ok 34/34 / 5c07f127@291 ok 34/34 | parameters.recordOutput (added) |
| a57645902a11 | 29a70d6c7c / b3fb77375f | 16 | 0 | 5c07f127@803 failed -/- / 5c07f127@828 failed -/- | parameters.extractList.where.length; parameters.extractList.where[1].field; parameters.extractList.where[1].matches (removed); parameters.extractList.where[1].equals (added); parameters.extractList.dedupe (added); parameters.recordOutput (added) |
| a57645902a11 | 29a70d6c7c / fc058d44e4 | 4 | 0 | 5c07f127@803 failed -/- / 5c07f127@851 ok 16/34 | parameters.extractList.fields.text (removed); parameters.extractList.where.length; parameters.timeoutMs (removed); parameters.recordOutput (added) |
| a57645902a11 | 29a70d6c7c / e8a9e7857f | 4 | 0 | 5c07f127@803 failed -/- / 5c07f127@865 ok 16/34 | parameters.extractList.fields.text (removed); parameters.extractList.where.length |
| a57645902a11 | 29a70d6c7c / 64965f88b8 | 12 | 0 | 5c07f127@803 failed -/- / 5c07f127@882 failed -/- | parameters.extractList.where[0].is (removed); parameters.extractList.where[0].equals (added); parameters.extractList.dedupe (added); parameters.recordOutput (added) |
| a57645902a11 | 29a70d6c7c / 1221881997 | 24 | 24 | 5c07f127@803 failed -/- / a4d59680@87 failed -/- | parameters.extractList.fields.group.selector; parameters.extractList.fields.author.selector; parameters.extractList.where.length; parameters.extractList.where[1].field; parameters.extractList.where[1].matches (removed); parameters.extractList.where[1].equals (added); parameters.extractList.where[1].not (added); parameters.extractList.answer (added); parameters.rejectedSamples |
| a57645902a11 | 29a70d6c7c / 3735e59d02 | 32 | 32 | 5c07f127@803 failed -/- / b2b5984c@78 failed -/- | parameters.extractList.fields.group.selector; parameters.extractList.fields.author.selector; parameters.extractList.where[0].is (removed); parameters.extractList.where[0].equals (added); parameters.extractList.answer (added); parameters.rejectedSamples |
| a57645902a11 | b3fb77375f / fc058d44e4 | 4 | 0 | 5c07f127@828 failed -/- / 5c07f127@851 ok 16/34 | parameters.extractList.fields.text (removed); parameters.extractList.where.length; parameters.extractList.dedupe (removed); parameters.recordOutput.datasetId; parameters.recordOutput.schema.fields.length; parameters.recordOutput.schema.fields[3].id; parameters.recordOutput.schema.fields[3].label; parameters.recordOutput.process (removed); parameters.recordOutput.purpose (added); parameters.timeoutMs (removed) |
| a57645902a11 | b3fb77375f / e8a9e7857f | 4 | 0 | 5c07f127@828 failed -/- / 5c07f127@865 ok 16/34 | parameters.extractList.fields.text (removed); parameters.extractList.where.length; parameters.extractList.dedupe (removed); parameters.recordOutput (removed) |
| a57645902a11 | b3fb77375f / 64965f88b8 | 12 | 0 | 5c07f127@828 failed -/- / 5c07f127@882 failed -/- | parameters.extractList.where.length; parameters.extractList.where[0].is (removed); parameters.extractList.where[0].equals (added); parameters.extractList.where[1].field; parameters.extractList.where[1].equals (removed); parameters.extractList.where[1].matches (added); parameters.extractList.dedupe.by.length; parameters.extractList.dedupe.by[3] |
| a57645902a11 | b3fb77375f / 1221881997 | 24 | 24 | 5c07f127@828 failed -/- / a4d59680@87 failed -/- | parameters.extractList.fields.group.selector; parameters.extractList.fields.author.selector; parameters.extractList.where[1].equals.length; parameters.extractList.where[1].equals[0]; parameters.extractList.where[1].equals[1]; parameters.extractList.where[1].equals[2]; parameters.extractList.where[1].not (added); parameters.extractList.dedupe (removed); parameters.extractList.answer (added); parameters.recordOutput (removed); parameters.rejectedSamples |
| a57645902a11 | b3fb77375f / 3735e59d02 | 32 | 32 | 5c07f127@828 failed -/- / b2b5984c@78 failed -/- | parameters.extractList.fields.group.selector; parameters.extractList.fields.author.selector; parameters.extractList.where.length; parameters.extractList.where[0].is (removed); parameters.extractList.where[0].equals (added); parameters.extractList.where[1].field; parameters.extractList.where[1].equals (removed); parameters.extractList.where[1].matches (added); parameters.extractList.dedupe (removed); parameters.extractList.answer (added); parameters.recordOutput (removed); parameters.rejectedSamples |
| a57645902a11 | fc058d44e4 / e8a9e7857f | 1 | 0 | 5c07f127@851 ok 16/34 / 5c07f127@865 ok 16/34 | parameters.recordOutput (removed); parameters.timeoutMs (added) |
| a57645902a11 | fc058d44e4 / 64965f88b8 | 3 | 0 | 5c07f127@851 ok 16/34 / 5c07f127@882 failed -/- | parameters.extractList.fields.text (added); parameters.extractList.where.length; parameters.extractList.where[0].is (removed); parameters.extractList.where[0].equals (added); parameters.extractList.dedupe (added); parameters.recordOutput.datasetId; parameters.recordOutput.schema.fields.length; parameters.recordOutput.schema.fields[3].id; parameters.recordOutput.schema.fields[3].label; parameters.recordOutput.purpose (removed); parameters.recordOutput.process (added); parameters.timeoutMs (added) |
| a57645902a11 | fc058d44e4 / 1221881997 | 6 | 6 | 5c07f127@851 ok 16/34 / a4d59680@87 failed -/- | parameters.extractList.fields.group.selector; parameters.extractList.fields.author.selector; parameters.extractList.fields.text (added); parameters.extractList.where.length; parameters.extractList.answer (added); parameters.recordOutput (removed); parameters.rejectedSamples; parameters.timeoutMs (added) |
| a57645902a11 | fc058d44e4 / 3735e59d02 | 8 | 8 | 5c07f127@851 ok 16/34 / b2b5984c@78 failed -/- | parameters.extractList.fields.group.selector; parameters.extractList.fields.author.selector; parameters.extractList.fields.text (added); parameters.extractList.where.length; parameters.extractList.where[0].is (removed); parameters.extractList.where[0].equals (added); parameters.extractList.answer (added); parameters.recordOutput (removed); parameters.rejectedSamples; parameters.timeoutMs (added) |
| a57645902a11 | e8a9e7857f / 64965f88b8 | 3 | 0 | 5c07f127@865 ok 16/34 / 5c07f127@882 failed -/- | parameters.extractList.fields.text (added); parameters.extractList.where.length; parameters.extractList.where[0].is (removed); parameters.extractList.where[0].equals (added); parameters.extractList.dedupe (added); parameters.recordOutput (added) |
| a57645902a11 | e8a9e7857f / 1221881997 | 6 | 6 | 5c07f127@865 ok 16/34 / a4d59680@87 failed -/- | parameters.extractList.fields.group.selector; parameters.extractList.fields.author.selector; parameters.extractList.fields.text (added); parameters.extractList.where.length; parameters.extractList.answer (added); parameters.rejectedSamples |
| a57645902a11 | e8a9e7857f / 3735e59d02 | 8 | 8 | 5c07f127@865 ok 16/34 / b2b5984c@78 failed -/- | parameters.extractList.fields.group.selector; parameters.extractList.fields.author.selector; parameters.extractList.fields.text (added); parameters.extractList.where.length; parameters.extractList.where[0].is (removed); parameters.extractList.where[0].equals (added); parameters.extractList.answer (added); parameters.rejectedSamples |
| a57645902a11 | 64965f88b8 / 1221881997 | 18 | 18 | 5c07f127@882 failed -/- / a4d59680@87 failed -/- | parameters.extractList.fields.group.selector; parameters.extractList.fields.author.selector; parameters.extractList.where.length; parameters.extractList.where[0].equals (removed); parameters.extractList.where[0].is (added); parameters.extractList.where[1].field; parameters.extractList.where[1].matches (removed); parameters.extractList.where[1].equals (added); parameters.extractList.where[1].not (added); parameters.extractList.dedupe (removed); parameters.extractList.answer (added); parameters.recordOutput (removed); parameters.rejectedSamples |
| a57645902a11 | 64965f88b8 / 3735e59d02 | 24 | 24 | 5c07f127@882 failed -/- / b2b5984c@78 failed -/- | parameters.extractList.fields.group.selector; parameters.extractList.fields.author.selector; parameters.extractList.dedupe (removed); parameters.extractList.answer (added); parameters.recordOutput (removed); parameters.rejectedSamples |
| a89251e6c353 | 883c6c6fac / 1221881997 | 6 | 6 | 7480feb6@80 ok 17/32 / a4d59680@78 failed -/- | parameters.extractList.fields.text (added) |
| a57645902a11 | 1221881997 / 3735e59d02 | 48 | 48 | a4d59680@87 failed -/- / b2b5984c@78 failed -/- | parameters.extractList.where.length; parameters.extractList.where[0].is (removed); parameters.extractList.where[0].equals (added); parameters.extractList.where[1].field; parameters.extractList.where[1].equals (removed); parameters.extractList.where[1].not (removed); parameters.extractList.where[1].matches (added) |


## Traces or reads with no snapshot

**None.** In all 12 traces, every operation's result names a primary `text/html` snapshot, and the trace delivered that digest at or before the operation. The inventory's `opsWithoutHeldSnapshot` is 0 in every trace, and `primaryMissing` is 0 for every `capture_snapshot`.

Only a minority of reads have the artifact event inside their own segment; the rest point to an earlier delivery of the same digest:

- job: 0 of 10 reads in segment;
- photo: 1 of 9;
- social: 15 of 62.

A loader that looks for the snapshot only inside the segment would therefore find nothing for most reads. It must resolve the result's primary digest against the whole trace.

## The three best pairs per site, for an offline-versus-live comparison

**How I ranked them:**

1. The same snapshot digest for both reads, so an offline re-read of the first document under the second read's parameters should reproduce the second live result exactly.
2. A narrow difference, ideally one field path.
3. Both live results known, preferably with nonzero rows.
4. `unavailable` 0.

### job-board (run-mvgw1854, project 1fa185e9-...)

1. **Exploration trace.5ef4fa86, seq 130 → 144** (ops 30 → 34), `extract_list` on `/scenarios/job-board/jobs`.
   - Same snapshot `cbdb3c64d00c`, delivered at 65; `unavailable` 0.
   - Differs only in `parameters.extractList.where (added)`.
   - Live: succeeded 7/7 → succeeded 3/7.
   - This is the purest read-condition change in the round: the offline reader must apply the added `where` to the captured list and keep 3 of 7.
2. **Exploration trace.5ef4fa86, seq 1255 → 1284** (ops 244 → 253), `extract_list` on `/scenarios/job-board/myjobs`.
   - Same snapshot `0a1c9b587911`.
   - Differs only in `parameters.recordOutput (removed)`.
   - Live: 4/4 → 4/4.
   - This is a control: a Core-side parameter change. The read itself should be unchanged offline.
3. **Cross-trace, same snapshot `cbdb3c64d00c`: exploration 5ef4fa86 seq 144 → trial trace.53d44264 seq 91.**
   - The trial is candidate.2e696aaf rev 1 / 83f06d8a05ae, episode trial.7819ef68.
   - Differing paths:
     - `where[0].equals` → `contains` and `where[1].equals` → `contains`;
     - `fields.url (removed)`, `answer (added)`;
     - `rejectedSamples`, `timeoutMs (added)`.
   - Live: 3/7 → 4/7.
   - It tests a different match operator on the same document, against a trial's live result.
   - *Alternative:* strict pair 5ef4fa86 1243 → 1255 on snapshot `0a1c9b587911`. The first read uses the legacy `handle`/`fields` parameter form and failed with `web.action.failed`; the second uses `extractList` and got 4/4. It tests reproducing a failure offline.

### photo-social (run-mvgw7320, project 46260e60-...)

There is no strict changed-read pair. Every pair of reads on one page has a navigation or click between them. Most reads return 0 rows. The best available:

1. **trace.9d22eb9b seq 891 → 1023**, `extract_list` on `/scenarios/photo-social/`.
   - Same snapshot `45707b85cac5`, delivered at 33.
   - Differs only in `parameters.timeoutMs (added)`.
   - Live: 0/0 → 0/0. A parity control only.
2. **trace.9d22eb9b seq 1208 → 1414**: the same snapshot again; differs only in `parameters.timeoutMs`; 0/0 → 0/0. Another parity control.
3. **trace.9d22eb9b seq 211**, a single read with no pair: `extract_list` on `/scenarios/photo-social/harbourlight.studio/`.
   - Snapshot `4db48d956da5`, delivered in its own segment.
   - Live 24/24. It is the only photo read with rows, so it is the only photo read that can test row-for-row fidelity offline (same parameters).

The two `web.dom.extract` reads (1043 on `45707b85cac5`, 1095 on `b35edf6fb8c7`) each return one string value. Each shares its snapshot with `extract_list` reads, but a different action type is not a changed-read pair. Photo is a weak site for P5. A photo trial trace would need a later round.

### social-network-feed (run-mvgw3ve5, project a846814f-...)

1. **Exploration trace.5c07f127, seq 164 → 265** (ops 43 → 72), `extract_list` on `/scenarios/social-network-feed/`.
   - Same snapshot `8bb19fe7df78`.
   - Differs only in `parameters.extractList.fields.text (removed)`.
   - Live: failed `web.validation.output_not_observed` → succeeded 34/34.
   - Offline must reproduce both the refusal (the disclosure / incomplete-text check that P4s traced to `list-reader.ts`) and the 34 rows. The four retries 164/167/172/175 have identical parameters.
2. **Exploration trace.5c07f127, seq 265 → 291** (ops 72 → 80): same snapshot `8bb19fe7df78`; differs only in `parameters.recordOutput (added)`; live 34/34 → 34/34. This is the clean control for a Core-side parameter.
3. **Cross-trace, same snapshot `a89251e6c353`:** trial trace.f53b350b seq 78 vs trial trace.a4d59680 seq 78.
   - f53b350b is whole rev 5, the judged trial 9ddb30fe. a4d59680 is whole rev 2.
   - The reads at trace.7480feb6 seq 80 and trace.b414b6a4 seq 80 are fingerprint-identical to f53b350b's: fingerprint `883c6c6fac`, 17/32 each.
   - The pair differs only in `parameters.extractList.fields.text (added)`.
   - Live: succeeded 17/32 (with `where`: 32 items seen, 17 kept) → failed `output_not_observed`.
   - These are trial reads, so this is the closest match to the P4/P5 gate's trial path. trace.e855db8e seq 78 (whole rev 4, same digest as rev 2) repeats the failing side.
   - *`where`-change alternative:* exploration 5c07f127, seq 851 → 882 (repair lease), same snapshot `a57645902a11`. The second read changes `where[0]` (`is` → `equals`) and `where.length`, adds `fields.text`, `dedupe` and `recordOutput.process`, and swaps `purpose` for `process`. Live: 16/34 → failed.
   - The P4s candidate pair f53b350b → 3e353455 (rev 10 → rev 16, `where` only) is **not** same-snapshot: `a89251e6c353` (32 items) vs `639e1b0f9e2d` (30 items). Confirmed here.

**`unavailable` caveat:** every social read result reports `metadata.trace.unavailable: 1`, while job and photo report 0. Each still names and holds its primary snapshot. I did not determine what the one unavailable item is.

## Commands run and observed results

- `grep -n "2026-10-20" lab-runs/index.md`: 12 runs that day, rounds rr2/rr3/rr4; rr4 is the latest. Runs:
  - job rr4-slot-2 `run-mvgw1854-5d10955b` (failed, 229 steps);
  - social rr4-slot-3 `run-mvgw3ve5-294881b5`;
  - photo rr4-slot-4 `run-mvgw7320-de416190` (failed, 158 steps).
- `grep` of `run.json`/`entry.json` for the workspace names; result in the copies table.
- Idle checks (PowerShell `Get-CimInstance Win32_Process`, a 30-minute mtime scan, and the `FileShare.None` probe): `procs: 0`; `recent30m: 0` ×3; `probed: 15 ok: 15 locked: 0`.
- `copy1` ×3 (hashtree, `cp -a`, hashtree, `cmp`): `lists identical` ×3; figures in the table. Wall time 17:53:11 → 17:53:38.
- `node p5s-shapes.mjs run-mvgw1854-5d10955b`: key paths only, 10 kind/messageType groups. Found `payload.metadata.trace.{artifacts[].role, sha256, mediaType, byteLength, source; unavailable}` on results and `metadata.trace.{artifacts, scope}` on commands.
- `node p5s-vocab.mjs <run>` ×3: the store-wide tallies table. On first run it threw `TypeError: boolean true is not iterable` because the command's `metadata.trace.artifacts` is `true`; I fixed the script and reran.
- `node p5s-inventory.mjs <run> p5s-inv-<run>.json` ×3:
  - job: `traces 2 reads 10 pairs 10`, same-snapshot groups 6;
  - photo: `traces 1 reads 9 pairs 0`, groups 6;
  - social: `traces 9 reads 62 pairs 233`, groups 50 (37 s).
- `node p5s-extract-shape.mjs run-mvgw7320-de416190`: both `web.dom.extract` results have a `string` `extracted` and `validation.{status,reason}`. Their parameter keys are `extract`, `selector`, `element`.
- The `p5s-hashtree.sh` re-hash of the 3 originals after the inventory: identical to the pre-copy lists.
- `git status --short` in this tree: only other workers' files (`action-runner.ts`, `domain/src/runtime/index.ts`, `offline-reads/`, `offline-snapshot-page/`, other reports). Nothing of mine except this report.

## Not verified

- What `metadata.trace.unavailable: 1` counts on social results, and why it is 0 on job and photo.
- That an offline re-read of each named pair actually reproduces the live second result. I ran no reader.
- The live verdicts of the job trial (53d44264) and its candidate's later revisions. I did not read the Lab step files for job or photo.
- Whether the job and photo stores hold a `candidate-draft` in `global.sqlite`. I did not open `global.sqlite`.
- Field names in `extractList.fields` were taken as given. Some are auto-generated from page class names or labels; I report paths only and collapsed long runs of them.
- The URL path came from the result's `payload.url`, falling back to `snapshot.evidence.navigation.path`; I did not check it against the snapshot.

## Open questions or contradictions found

1. **Snapshots are deduplicated per trace.** A segment rarely holds its own artifact event. The P5 reader must look up the result's primary digest across the whole trace, not within the segment.
2. **Photo offers no changed-read pair**, and its only trace is a failed exploration with no trial. If P5 needs a photo comparison with a parameter change, it needs a later traced photo round, or a hand-made correction applied to read 211's snapshot.
3. **Opening a copy migrates it.** The three copies' `project.sqlite` hashes changed after my read-only inventory. Anyone comparing against the hashes above should use the pre-open figures for "copy = original" and the post-open figures for the current copy.
