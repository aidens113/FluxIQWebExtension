# status-survey-product — what a person can actually use, per surface

Read-only survey; no build, test or server run. Every claim is a file, commit or
document line I read; where a document disagrees with the repositories, I say so.

## 1. Structured data extraction (`first-class-data-extraction-plan.md`)

**Usable today: yes in the extension, half in the panel.** A person records,
presses the extraction button, picks a repeating element, sees inferred fields
and a preview table, and confirms — `apps/extension/src/popup/extraction/`
mounted at `popup/index.ts:89`, with `sidepanel/index.ts` being the single line
`import "../popup/index"`, so Chrome side panel and Firefox popup share the
surface. Picker: `content/picker/`; session machine: `background/extraction/`.
The 2026-09-20 ledger entry records a live production run: eight rows, Flow
saved, replayed after full restart, non-empty CSV/JSON, no provider calls, 70s.

**In the panel a dataset is visible only inside a run.** Core owns the substance
(`…/automation-studio/runtime/service/datasets/` — schema digest, export
encoder, run-datasets — plus the `run-datasets` API routes). The UI is
`apps/web/src/features/automation-studio/datasets/RunDatasetsPanel.tsx` and its
**only** mount is `runtime/RunActionLogView.tsx:272`, inside one run's action
log. `views/view-types.ts` lists fourteen canonical views and **none is data or
datasets**. A person sees the rows a run produced if they navigate to that run;
they cannot browse what they have extracted, or re-export it, otherwise.

**Left:** X5.3 (intent seam, waits on X4-C), X5.5–X5.7 (Flow-lane judging and
the extraction bench), X6 (folded into the Week 2 loop). X5.5 must first settle
`x5f`'s finding that a count-only entry scores a false 1.0 in a pooled rate.
**Blocked on:** nothing; E53 was decided as D12 (an excluded column is never
recorded at all). **Document vs repository:** Current State still says "In
progress: the picker". It shipped (`5c14ac9`, `ed7db33`, `ff3d9d8`) — the prose
is one phase stale, the ledger is right.

## 2. Conversations (`fluxiq-conversations-plan.md`)

**Usable today: yes, in Core's web panel only.** The wiring the document lists
as "Next" has landed: `service.ts:368` declares `readonly conversations`, `:435`
constructs it, `:2735` binds the parking port to a run,
`api/handlers/register.ts:44` registers the endpoints. The window is an overlay,
not a view — `AutomationStudioSession.tsx:667` mounts `ConversationDock`
**outside** the workspace composition with a comment saying why, and
`conversation-thread` is gone from `AutomationViewType`. Core `dev` carries
`142e0de` t086 parking, `f1f4d06` t084 store, `7443ad6` t085 window, `ea0179f`
t083 integration, `f7728bf` t084 chat-window-live.

**The document is wrong about the state of the work.** Its status detail says
"No implementation dispatched yet", its Current State says "Next: … wire the
four `service.ts` lines once t083 lands", and its Work Ledger has **one** entry
(2026-09-22, document created, `Outcome: Partial`). Six tasks merged in Core
since. **Trust the repository: conversations are built, wired and running.**

**Measured live in `conv-chat-window-live.md`** (isolated instance, port 3184,
never the user's panel): a permission ask raised by a server-side run lit the
badge in **4.2 s with the tab hidden and the dock collapsed**; a first thread in
an empty project appeared in 2.3 s. Before that task none of it worked —
endpoints unregistered, every call missing `projectId`, strict parsers dropping
every record Core sends, `answer-ask` in a shape the handler refuses, and a real
`disabled` attribute on the composer.

**Left, and this is the one that matters:** there is **no endpoint that opens a
thread**. `api/contracts/endpoints.ts:154-158` has exactly `list-conversations`,
`get-conversation`, `get-conversation-attachment`, `append-turn`, `answer-ask`.
`append-turn` needs an existing `conversationId` and `openConversation` is
Core-internal, so **in a project where FluxIQ has never spoken, the person
cannot speak first**. Also left: an attachment resolver (so a `flow-graph-diff`
draws in place); a sweeper for asks whose waiting process died; and a parked run
holding its HTTP request and admission slot open. **Blocked on:** nothing.

**Reachable from the extension: no.** `grep -rn "conversation" apps/extension/src
domain/src` returns four files and every hit is a comment or test string. There
is no conversation code downstream at all.

## 3. Automated testing facility (`automated-testing-facility-plan.md`)

**Usable today: yes, and far beyond what the document describes.** The most
stale of the five: `Last updated: 2026-09-10`, newest dated content 2026-09-05.
It describes a "ten-scenario corpus"; `apps/scenario-lab/src/registry.ts`
imports **41 scenario sites**, and `packages/test-runner/src` has **25 subsystem
directories** it never mentions — `bench/`, `live-llm/`, `flow-lane/`,
`saved-flow-replay/`, `run-evaluation/`, `ui-e2e/`, `panel-golden-path/`,
`redaction-attestation/`, `core-action-probe/`, `lane-rules/`. Its Core gate
figures (542 tests / 88 files) are three weeks old; Core now runs 2,913.

**Left:** the gaps it names do appear still open, since nothing closes them —
live certification of the `existing` and `clone` lanes (both need external
credentials, a project and a persisted Flow no run was given); Linux Chromium
and the three-repeat baseline in CI; Phase 8 real-site execution; Phase 7 Core
promotion (`defer`, needs a second consumer); no persistent-workspace reset.

**Blocked on, and this one is newly concrete:**
`.github/workflows/testing-facility.yml` runs on `pull_request`, `push` to
**`main`**, a nightly cron and manual dispatch. `origin/main` is `7f07a35` dated
**2026-08-09** and `dev` is **635 commits ahead**. The cron fires — against a
six-week-old tree. The ubuntu/Xvfb matrix and `--repeat 3 --all` baseline the
document waits on have never seen this work: a CI configuration gap, not a
runner gap. **Recommendation:** retire or rewrite this document; the living
record of facility work is in the Week 2 and week2-exit documents.

## 4. Extension UI rebuild — genuinely finished

`Status: Complete`, all six boxes checked, and the repository agrees: one shell
under `apps/extension/src/popup/`, shared by the side panel through a one-line
re-export, and the only later commits there are the three extraction-picker
ones, which extend it. Caveat: never browser-verified independently.

## 5. Module size governance — finished in substance, stale in text

Enforcement is live: `scripts/structure-audit.mjs` runs first in `pnpm check`.
Its `Next steps` are all done or moot and it does not say so:

- "**`apps/extension` has no unit test runner at all** … zero `*.test.ts`" —
  false now. `apps/extension/scripts/test-extension.mjs` bundles every
  `src/**/tests/*.test.ts` under `node:test`, and there are **92** of them.
- "`demo-workspace.ts` (3,855) and `demo-llm-create-ui.ts` (837) remain" — both
  gone; `packages/test-runner/src/demo-workspace.ts` is now **5 lines**.
- The largest source file, `existing-fluxiq-control.ts` in `test-runner`, is
  **788** lines, under the 800 limit. Nothing shipped exceeds it.

**Still open:** the `connection.ts` and `content/index.ts` splits were never
runtime-verified in a browser. **Blocked:** nothing.

## The two cross-cutting questions

**How far is extraction from "first-class with real UI"?** Core owns the
substance and the extension gives a person a real, proven picker. Missing is the
last step: the dataset has no place of its own. It is a panel nested in one
run's action log, absent from the view registry, so "what have I extracted?"
cannot be answered without first remembering which run did it. One view away,
not one subsystem away — and the single change that would make the capability
read as first-class.

**Is the conversation reachable?** In Core's Automation Studio, yes, and
deliberately: an overlay outside the region layout, a launcher always on screen
that changes to "Needs you", collapsed-but-mounted so a question arriving while
it is shut still lights the badge (4.2 s, measured). Elsewhere in the product a
person gets the older modal prompt; from the browser extension, nothing. And the
channel is one-way at the start — FluxIQ can open a thread, a person cannot.
Until a `start-conversation` endpoint exists, "the primary way to interact with
the user" is a channel the user cannot initiate.

## Not verified

- No builds, tests, servers or browsers were run. Every live number quoted is
  read from a worker's report, not reproduced by me.
- The facility's `existing`/`clone` certification gaps are inferred from the
  absence of a contradicting commit — weaker evidence than the rest.
- I did not open `flow-authoring-and-defensive-runtime-plan.md` (brief excluded
  it), so its record of the permission gate or ladder is not reflected here.
- CI history was not inspected — only workflow triggers and branch divergence.
