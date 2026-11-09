# MVP Seal

Status: Active
Status detail: Revised 2026-11-09 with the user's second direction; Wave 1 started the same day (Core's plan lists it).
Created: 2026-11-09
Last updated: 2026-11-09
Owner: Senior supervisor agent
Scope: Sealing the MVP from this repository's side: landing the live lanes, the extension's finish and store submission, the managed browser host that FluxNodes run on, and the Lab's FluxNode lane and examples. The FluxNode design, the Core lanes and the cloud are owned by the paired document.
Paired document: `C:/Users/osrs_/FluxStuff/!FluxIQ/docs/working/fluxnode-plan.md`
Related: [Answer First](./answer-first-plan.md), [hosted production](./hosted-production-plan.md), [testing facility](../architecture/testing-facility.md), [30-day MVP plan](../../FluxIQ%20Web%20Extension%20%E2%80%94%2030-Day%20MVP%20Implementation%20Plan.md)

---

## Current State

**State (2026-11-09).** Planning only, for the user's review. The user's words and the FluxNode design are in the paired Core document. In short: seal the MVP on two tracks, the extension ("nearly done") and the framework, where FluxNode becomes Core's main offering and the web panel gets no new feature work.

**Where the extension stands** (discovery, 2026-11-09; evidence is commit subjects on `dev` and code under `apps/extension/src/panel/`):

| Answer First extension phase | Status |
| --- | --- |
| Truth pass, work header, setup, second attempt shown, tasks, library, recording and settings | Built on `dev`, not yet accepted live |
| Answer turn, real rows | Built; rows read the saved dataset; live acceptance open |
| Budget out | The engine side is built; the add-budget card has no separate proof |
| Asks | The model key stays unlocked; the Firefox popup re-open is unverified |
| Firefox pass | Built at the code level. Firefox is not installed here, so real-browser parity is unproven |

**Against the 30-day plan's Final MVP Acceptance Test (26 criteria):**
- **Mostly met:** install, describe and run (1-3, 8-11). Zero-call replay passed on lane A.
- **Partial:** scraping (5), generate and test (6-7), learned situations (21-23), and showing the learning in the UI (24-26).
- **Still the main risk:** the adaptation loop (12-20). Its gate is launch-ready but held, and the current-source rerun is open.

**Hosted and store.**
- Core's hosted control plane (IAM, provisioning, tenancy) is on `dev`, but not deployed.
- The extension has no hosted connection code yet: no server list, sign-in screen or transport.
- Store submission still needs the manifest edits, the privacy declaration and notice, a reviewer account, and the user's items: the developer account, the VM and DNS, and the legal copy.

**Lanes.** The four live lanes (`task/t875`-`t878`) are 2 to 7 commits ahead of `dev` here and 2 to 8 in Core, all pushed.

**Credit.** About $145 of Claude credit expires about 2026-11-10 and then refreshes to $200 at no cost to the user (user, 2026-11-09), so money sets no date. Live runs are still watched by an agent and stop at the first balance error.

**Revised direction (user, 2026-11-09; words in Core's plan, "Direction").**
- Work on FluxNodes starts at once.
- Data pipelines become central.
- Simulated Android, Linux and Windows test environments are built.
- One key-based access system covers every client.
- The panel is redesigned for setup, monitoring, security and an easy editor, with a panel-wide assistant.
- "Subflow" retires: everything is a Flow in a project's folders.

**Next.** E0 now, with E1 once E0 lands. E2 to E6 run alongside Core's Wave 2.

## The MVP Is Sealed When

1. **The extension.** Answer First is the product default. The lanes' fixes are on `dev`. The live breadth round has covered every realistic site, and the result per site is recorded. The store submission package is ready; sending it waits only on the user's items.
2. **FluxNode.** A developer starts `fluxiq dev`, declares a web FluxNode with typed inputs, outputs and a check, and runs it on a managed browser:
   - run 1 explores and returns typed outputs;
   - run 2 with new inputs replays with zero model calls;
   - a perturbed site is repaired and the result still comes back.
   This holds on realistic scenarios, provider-free, plus one live proof per example.
   The same holds for a FluxNode on each simulated environment: Android, Linux and Windows (Core's P8).
3. **Release.** All three repositories pass the full sweep and are promoted to `main` together.
4. **Docs.** The developer docs (quickstart, concepts, API reference) and the examples are published in the repositories.
5. **The panel.** The redesigned panel takes a new person from `fluxiq dev` to a running Flow through its wizard (Core's P9).

## Extension Finish

| Step | Builds | Done when |
| --- | --- | --- |
| E0 Land | Integration round 2 with Core's P0: lanes A-D into `dev`, narrow checks, then `dev` merged back into each lane at its ready point | Both `dev`s hold every lane fix, and the narrow checks pass |
| E1 Use the credit (by 11-10) | The agreed live checks, in order: the napkins Sonnet pair (the repeat fix), the apprentices Haiku pair (the native judge's required fields), the kiln Sonnet pair (saved steps, looks). Then sites not yet run, on Haiku and Sonnet, four lanes busy. Every standing live rule binds | Each run has a debug note; results are in Answer First's table; the native judge schema goes to `dev` only if the Haiku pair shows full replies |
| E2 Defaults and defects | Flip `authoring-mode.ts:48` to `answer-first` after the breadth proof. Fix Answer First's open items 3-8: carried-act item words; `answerRecords {asked:false}`; the carried set-up press; splitting `node-run/run.ts`; the table wrap; "$0.00" for $0.0012; the `keep`-only edit; the child-Flow deadline; the before-reading after a restart; the paging paragraph in judge calls | The default is flipped with the breadth evidence cited, and each item is fixed with a test beside it |
| E3 Standalone extension | Nothing a normal user does needs the web panel, except signing in. The hosted connection: the server list, the sign-in screen, the transport work in the hosted plan (D2-D4), and the manifest edits (description, fixed e2e key, Firefox `gecko.id`) | A new person on a stand-in hosted Core signs in, runs a task and sees the result without opening the panel |
| E4 Store package | The single-purpose statement, the `<all_urls>` justification, the privacy declaration, `docs/user/privacy-policy.md` corrected (it still says "operate no server"), a reviewer test account script, and the store text | Everything in the store form is ready; the upload waits on the user's developer account and the hosted deployment |
| E6 Flows and keys in the extension | Core's P6 here: the Library screen becomes the project's Flow tree with folders, and "subflow" leaves the extension's UI, domain and Lab. Core's P3 here: pairing becomes approving the extension's own key, made in the browser and never extractable, keeping today's code entry as the approval step | No "subflow" in the extension; an already-paired extension keeps working through the migration, and a fresh one pairs by key |
| E5 Acceptance record | Re-score the 26 criteria of the Final MVP Acceptance Test against current evidence; run what is missing on the realistic scenarios | Every criterion has evidence or a named gap |

## Managed Browser Host (Core's P5)

FluxNodes need a browser that Core can drive without a person opening one. The Lab already launches Chromium with the extension and pairs it (`packages/test-runner/src/run-scenario/browser-session/launch-browser.ts`, `attempt-lane/live/attempt/session.ts`). That is test code, and product code must not depend on the test runner.

**Builds (`worker-heavy` for enrolment, `worker` for the rest):**
- **A product package `packages/browser-host`.** It launches Chromium with the built extension, headed or headless, and enrols it with Core as a `worker` host:
  - enrolment uses a one-time token the local engine issues for that host (Core's P1 contract), never a person's pairing approval;
  - the token is never logged.
- **Profiles.** A fresh profile per run by default, or a named persistent profile for sites the developer signs in to.
- **Parallel hosts.** Several hosts at once, each holding its own host lease.
- **Lifecycle.** `fluxiq dev --browsers N` starts N hosts. Hosts close when the engine stops.
- **The Lab moves onto it,** so there is one launcher. Lab browsers stay visible (headed), as the standing rule requires.

**Done when:**
- the SDK runs a node on a managed browser on a realistic scenario;
- two hosts replay two runs in parallel;
- the Lab's attempt lane runs through the new package with unchanged results;
- an adversarial review of enrolment finds nothing open.

## FluxNode Lab Lane And Examples (Core's P6)

- **The lane.** `pnpm lab node <example>` runs an example program against a realistic scenario, with the scripted model by default and live under the usual guards. It reports one row per run: path, calls, tokens, dollars, time, and what confirmed it (schema, check or judge). Every Lab rule binds: the ten realistic scenarios, visible browsers, unchanged oracles, and no guidance shaped to the tasks.
- **Three examples** in `examples/fluxnode/`, each built on an audited realistic task the live lanes have already passed:
  1. **Read.** A list of matching records with typed outputs and a check.
  2. **Act.** A lasting act inside a declared scope, which exercises the act record and the out-of-scope refusal.
  3. **Compose.** A small pipeline calling two nodes, with two replays in parallel on two managed browsers.
- **What each example shows:** run 1 exploring, run 2 with new inputs replaying at $0, and a Lab perturbation repaired. It prints a table of cost per run falling.

## Work Ledger

### 2026-11-09 - Plan

- Agent: lead; three read-only discovery agents.
- Changed: this document, and the paired Core `fluxnode-plan.md`. No source.
- Why: the user asked for a full plan to seal the MVP around the extension and FluxNode.
- Validation: not validated; this is a plan. Lane distances from `git rev-list --count dev..<lane>` in both repositories; `main` from `git rev-list --count origin/main..dev` -> 133 here, 221 in Core.
- Outcome: shown to the user for review.
- Follow-up: E0 and E1 on approval.

### 2026-11-09 - Revised with the user's second direction

- Agent: lead.
- Changed: this document: the credit note, the revised direction, the seal criteria (simulated environments, panel) and E6. No source.
- Why: the user widened the scope and asked for work to start at once; Core's plan holds the design and Wave 1.
- Validation: not validated; this is a plan.
- Outcome: Wave 1 running.
- Follow-up: E0.

## Open Questions

The user's open questions are in the paired Core document.
