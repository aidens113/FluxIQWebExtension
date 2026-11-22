# Offline replay, scoreboard and preflight intake

Outcome: read-only discovery complete, 2026-11-22. No source edits, tests, builds, browsers, paid calls, panel changes or git mutations. This report is implementation guidance, not acceptance evidence.

## Finding

The pieces exist, but S1/S2/S6 are not an end-to-end facility yet. `lab attempt --scripted-model` drives real Core/chat/browser code with hand-authored replies; it does not replay recorded campaign replies. Existing offline trials replay a saved candidate through Core against domain traces, not the full chat/Answer First exploration. Existing saved-Flow replay proves a different thing again: a saved Flow runs with provider wiring disabled. Keep these three results separate.

## Available evidence (metadata only)

Inspected file names, counts and selected attempt/report metadata only. Never read or copied recorded requests/replies, page captures, credentials or browser-state contents.

- t959 has 55 attempt.json files and t960 has 30 (including internal workspace metadata). Their final public attempt bundles identify exact task IDs, per-attempt calls/verdicts, continuation proofs and workspace lineage. Synthetic workspace/profile databases remain locally, but no database was opened.
- Main live model step logs are stored by `LabRunRecord` at `C:/Users/osrs_/FluxStuff/lab-runs/<date>/<runId>/steps`, not generally in the task's test-runs tree. Lead explicitly approved named-run file-presence inventory there.
- Of 45 run IDs named by the t959/t960 campaign reports and attempt directories (campaign plus probes), 43 have canonical machine-wide folders. The remaining two are the early probes `run-mwojshmc-57adba2a` and `run-mwoo9ota-6cff4f80`; their raw request/response files exist under t959's campaign-a-probe/campaign-a-f16 attempt directories.
- Canonical runs generally retain request.json, response.json, call.json, result.json and meta.json. Example F25 `run-mwoznmcq-cd1d4618`: 30 request files, 29 response files, 20 call files and 30 result files. A request without a response is an explicit admission gap unless metadata proves no reply arrived; never fabricate one. Some setup failures have no steps.
- Core step-log/model-step.ts confirms request.json is the exact sent body and response.json is the raw response body, including refused/malformed replies; these are suitable inputs to a replay adapter. Current scripted-model codec instead JSON-stringifies a decoded reply and invents stream/usage, so it cannot reproduce malformed transport faithfully.
- No snapshot-named or HTML files were found in canonical run folders. That does NOT prove captured-page snapshots are absent: trace/snapshot content can be in the workspace's stores/blobs. Availability and trace admission require a copied-store survey, which was not run. Presence of browser profile databases is not proof of usable domain snapshots.

## Fixed ten-task scoreboard recommendation

Preserve task wording and oracle. One task per allowed realistic site; order the existing near-passes first. These are recommendations for a fixed manifest, not a claim the tasks now pass.

| Site | Exact task ID | Existing metadata baseline |
| --- | --- | --- |
| auction-marketplace | auction-marketplace-lens-hood-seller-shop | t959 run-mwohvt8n-a57cad8a: 4 right, all 3 continuations held, calls 12/1/0/18 |
| company-website | company-website-apprentices | t960 run-mwp12i2r-e575e27d: 4 right, all continuations held, calls 37/33/1/0 |
| job-board | job-board-halvard-careers-roles | t960 run-mwoyjcgq-bb4a27f1: 4 right, all continuations held, calls 34/38/35/3 |
| bigbox-retail | bigbox-retail-new-store-cheapest-towels | t960 run-mwoxglkg-e37fd49b: 4 right, all continuations held, calls 49/53/20/1 |
| local-classifieds | local-classifieds-bikes-within-alex-price | t960 run-mwowwwd0-ea0caab9: 4 right, all continuations held, calls 102/15/26/11 |
| everything-store | everything-store-plus-earbuds-under-50 | t959 run-mwodpw10-3d5748ab: 4 right, all continuations held, calls 34/7/0/0 |
| crossborder-marketplace | crossborder-marketplace-free-hubs-under-ten | t959 run-mwp0hukg-2f5e19ad: 4 budget_out, calls 106/48/17/8; continuation 2->3 failed |
| professional-network | professional-network-netherlands-data-engineers | t960 run-mwojyaub-a76ac16e: 4 budget_out, calls 147/1/0/0 |
| photo-social | photo-social-august-over-1300 | t960 run-mwovqznu-0cbc3b10: 4 budget_out, calls 84/78/49/4; continuation 2->3 failed |
| social-network-feed | social-network-feed-delete-stranger-requests | t960 run-mwp1jqze-388b466c: 4 right, calls 35/46/46/27; last 2 continuations failed |

The plan's six named near-passes include two auction tasks. Keep `auction-marketplace-save-mark-ii-sellers` as a supplemental recorded regression (t960 run-mwoy01bi-cb36b624: 4 right, continuations held, calls 56/1/1/3). Choose lens hood for the one auction scoreboard row because its initial exploration was smaller and one successor already used zero calls; both keep their unchanged oracle and remain useful. This choice changes neither task criteria nor recorded verdicts.

No recommended row currently meets strict SUCCESS (all four right, all three predecessor-Flow proofs held, and zero calls on attempts 2-4). Existing run-attempt-command.ts exits passed for allRight plus continuation; its allRight gate does not require zero later calls. The new scoreboard must calculate strict SUCCESS independently, not map exit 0 to SUCCESS.

## Existing coverage and missing pieces

`scripted-model/scripts/index.ts` currently registers eight task IDs across six sites: apprentices, Saturday certificate, rated-delivery towels, free hubs plus its timed-check variant, batteries/descaler, accept-messaged invitations, save dining tables. Only apprentices and base free-hubs directly cover the recommended scoreboard. No auction/job/photo/social scripted task exists. Scripts validate evidence dynamically and fail exhausted/unexpected request kinds; network routing refuses nonloopback traffic apart from Messages redirected to the local scripted server. Those are good seams to reuse, not proof that recorded replies match.

`attempt-lane/continuation.ts`, run-attempt-series.ts and report.ts already prove predecessor saved digest/Flow, as-left ordering and per-attempt call/cost/time. `saved-flow-replay/` disables provider wiring, preserves keys and requires explicit zero accounting. Do not label its isolated replay as an as-left successor-series proof unless the same predecessor/digest/state evidence is supplied.

`offline-trial-experiment/` has provider-free survey, candidate rebuild/digest verification, tier-1 trial and tier-2 changed-read reevaluation. Tier 2 opens a browser over recorded snapshots with network off; it is provider-free but not browser-free. These are candidate/read proofs, not full recorded-response attempt replay.

S6 has useful pieces: extension-chat-check's provider-free pairing/relay/ask/build probes; scenario manifest/task selection; isolated startup; scripted model; attempt-person permission and person-check handling. `lab attempt --dry-run` validates config/task/script and returns providerCallCount 0 before startup, so it proves no pairing, chat, permission or read. Only four scenarios currently declare site person-check modules (everything-store, crossborder-marketplace, bigbox-retail, company-website). Universal site challenge coverage therefore does not already exist. Distinguish a generic chat ask/answer protocol proof from a declared site's actual challenge. Do not alter scoreboard task wording or silently invent a site challenge just to tick a preflight box.

## Bounded implementation sequence by file ownership

1. Evidence admission and S1 replay, owning new `packages/test-runner/src/recorded-attempt-replay/**` plus focused tests. Inventory named runs without opening originals for migration; copy synthetic stores into ignored run-scoped directories. Admit recorded request/response/tool-result chains, version/fingerprint, starting state, clock and missing-response classification. Feed recorded model responses and recorded domain evidence through real product entry points until first substantive divergence. Reuse public Core interfaces; do not private-import Core source or duplicate product logic. Candidate-only offline runner is insufficient for chat/exploration, so establish that composition before claiming full S1. If a needed public seam is absent, give the lead its exact interface and owning Core path before extending scope.
2. Reuse `attempt-lane/scripted-model/{route-model-call,child-environment,model-server,wire-request,anthropic-stream}.ts` for transport isolation, with a distinct recorded-response mode. Preserve raw malformed/status/usage semantics; never normalize a recorded broken reply into a valid object. Match substantive request hashes (task/model/grammar/evidence), with only explicit transient IDs normalized, and correlate concurrent agent streams. First divergence stops playback with expected/actual digest and closed reason codes. No paid/network fallback, no jumping to an arbitrary later matching reply. A shorter replay that reaches the fix's changed branch is a prefix reproduction, not a proven final result or successor success.
3. S6, owning new `packages/test-runner/src/attempt-lane/preflight/**` plus specific scripted task fixtures and owning tests. Compose existing pairing/relay, actual chat-start, generic person answer, declared permission grant and one real read. Emit a capability matrix that separately names protocol handoff versus site challenge. Select existing realistic task declarations where actual site/permission coverage exists; for the six sites without a challenge, report the missing capability rather than claiming success. Keep preflight artifacts separate from oracle/scoreboard proof. Interface/registration edits shared with step 2 are serial.
4. S2, owning new `packages/test-runner/src/attempt-lane/scoreboard/**`, a fixed task manifest and `scripts/lab/offline-scoreboard.mjs` with tests. Consume existing attempt-series schema plus S1/S6 artifacts; output ten fixed rows with current-source fingerprint and historical baseline. Strict SUCCESS needs 4/4 right, 3/3 continuations, same predecessor Flow/digest, zero logical calls on attempts 2-4, and explicit accounting. Distinguish actual external spend (zero in provider-free runs), modeled usage from replay/script, and historical billed cost. Unknown fields cannot become zero. Proposed task scripts for missing rows belong only in Lab fixtures, never product guidance.
5. Lead integrates public interfaces/CLI registrations, verifies all ten oracle-positive fixture paths, and runs first plus at least three as-left successors. P1/P2/P4/P5 must land before interpreting new data/replay/model behavior. No task/oracle weakening, no retry cap, no paid round until all required proofs are present.

## Exact provider-free commands (not executed)

All commands assume current dependencies/build artifacts already prepared; no build was run in this intake. Browser commands require authorized isolated Lab/browser execution and the usual heavy-slot gate.

- Existing config-only check: `pnpm lab attempt company-website --task company-website-apprentices --authoring-mode answer-first --scripted-model --attempts 4 --dry-run` -> ready/providerCallCount 0; no runtime proof.
- Existing real scripted path: `pnpm lab attempt company-website --task company-website-apprentices --authoring-mode answer-first --scripted-model --attempts 4` -> attempt.json, attempt-report.txt, model/calls.jsonl, continuation rows and answer/oracle verdicts. Use same shape for base free-hubs; missing-script rows fail registration today. A model-free provider bill is not zero logical calls.
- Existing pairing/chat ask probe: `node packages/test-runner/dist/extension-chat-check/cli.js --browser chrome --scenario company-website --page / --evidence test-runs/offline-preflight/company-website` -> relay/ask checks, browser and evidence paths. This does not by itself prove permission plus fixture read. Supply each scenario's real starting path for the ten-site matrix.
- Existing candidate intake: `node packages/test-runner/dist/offline-trial-experiment/cli.js survey --store test-runs/offline-intake/source/.fluxiq --project <recorded-project-id> --steps <canonical-run>/steps --scenario <site> --task <exact-task-id> --out test-runs/offline-intake/survey.json` -> ids/digests/counts/codes, admissible traces and candidate rebuild parity. The store must be an isolated copy, never the original.
- Existing candidate replay: `node packages/test-runner/dist/offline-trial-experiment/cli.js trial --store test-runs/offline-intake/source/.fluxiq --project <recorded-project-id> --steps <canonical-run>/steps --trace <trace-id> --revision <recorded-revision> --scenario <site> --task <exact-task-id> --work test-runs/offline-intake/trial-01 --out test-runs/offline-intake/trial-01.json` -> candidate replay result/oracle comparison, without model or browser. Add `--tier2 --channel chrome` only for authorized recorded-snapshot browser reevaluation. Missing view/snapshot is a gap.
- Existing saved Flow proof: `pnpm lab replay <site> --workspace <isolated-saved-workspace> --flow <saved-flow-id> --project <recorded-project-id> --instruction-task <exact-task-id>` -> explicit provider absence/zero accounting and unchanged task oracle. Separate from four as-left attempts.
- Proposed (not yet implemented): `pnpm lab recorded-replay --run <canonical-run-id> --task <exact-task-id> --out test-runs/offline-prefix/<label>` -> source manifest, request-match hashes, raw-response consumption metadata, tool-trace admission, first-divergence.json and replay-verdict.json. Add only after command parser/public-runtime interface is implemented and unit-tested.
- Proposed (not yet implemented): `node scripts/lab/offline-scoreboard.mjs --manifest <fixed-ten-manifest> --evidence test-runs/offline-scoreboard/<label>` -> scoreboard.json/md plus per-site preflight and four-attempt proof references. No paid options; fail closed on missing rows/proofs.

## Acceptance artifacts

Each S1 run: source/version/digest manifest; admitted recording counts; trace/snapshot availability; compared request hashes; exact divergence step/cause; real product branch reached; no external calls; historical versus modeled usage separately. Each S6 site: explicit pairing/chat/person/permission/read stage observations and capability gaps. Each S2 row: unchanged task/oracle ID, source commit pair, four attempt paths, saved Flow IDs/digests, 3 continuation proofs, logical/provider call counts, observed runtime, cost classification and SUCCESS/PARTIAL/FAILURE with a cause. No captured data in authored reports; raw artifacts stay ignored and local.

Outcome: Done
Changed: docs/working/data-first-simplification-plan/reports/offline-intake.md only
Validation: Read-only source tracing and metadata/file-presence inventory; no commands that build, test, launch a browser or call a provider.
Not verified: copied-store trace/snapshot admission, playable response payloads, browser preflights, final oracle results, zero-call successors on current code.
Report: C:/Users/osrs_/FluxStuff/fxwork/t983/!FluxIQWebExtension/docs/working/data-first-simplification-plan/reports/offline-intake.md
Notes: Raw live logs are locally available in the machine-wide store; every replay still needs admission. S1 full-attempt replay and strict S2/S6 orchestration are missing. P4 code remains held pending lead sync.
