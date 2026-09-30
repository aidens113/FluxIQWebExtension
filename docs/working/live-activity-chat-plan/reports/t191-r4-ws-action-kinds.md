# t191-r4-ws: shared chat action kinds in Core's `fluxiq/ui`

## Outcome

Done. Core tree `C:/Users/osrs_/FluxStuff/fxwork/t191/!FluxIQ`, branch `task/t191-extension-chat-ui`. Nothing committed.

## Final API, as exported from `fluxiq/ui` (and from the `fluxiq` root, which re-exports `./ui`)

```ts
type ActivityActionKind = "click" | "type" | "navigate" | "read" | "look" | "wait" | "person_check" | "permission" | "draft" | "test" | "repair" | "other";
type ActivityActionOutcome = "working" | "done" | "failed" | "waiting";
type ActivityAction = { kind: ActivityActionKind; target: string | null; outcome: ActivityActionOutcome; why: string | null };
type ActivityActionEvent = {
  phase: string;
  detail?: { kind: string; title: string; text?: string | undefined; status?: string | undefined; ref?: string | undefined } | undefined;
  step?: { nodeId?: string | undefined; label?: string | undefined } | undefined;
};
type ActivityActionVerb = "navigate" | "back" | "click" | "type" | "search" | "clear" | "select" | "check" | "upload" | "read" | "list" | "detect" | "look" | "scroll" | "wait" | "assert" | "download" | "key" | "dialog" | "tab";

const ACTIVITY_ACTION_ICONS: Readonly<Record<ActivityActionKind, string>>;  // frozen; the pinned lucide names
const ACTIVITY_ACTION_NAMES: Readonly<Record<ActivityActionKind, string>>;  // frozen; the pinned card labels
function activityActionOf(event: ActivityActionEvent): ActivityAction | null;
function activityActionVerb(word: string, form?: "word" | "gerund"): { verb: ActivityActionVerb; kind: ActivityActionKind } | undefined;
```

The pinned names are unchanged. There are two additions. `ActivityActionEvent` names the input type; a `ClientGatewayActivity` payload can be passed to it as is. `activityActionVerb` and `ActivityActionVerb` are what the wording module uses to recognize verbs.

I confirmed that all 12 icon names exist in `apps/web/node_modules/lucide-react/dist/esm/icons/` (lucide-react 0.468.0): mouse-pointer-click, keyboard, globe, table, scan-search, hourglass, shield-check, hand, pencil, flask-conical, wrench, circle-dot.

## What changed and why

New directory `packages/fluxiq/src/ui/activity-action/`, one exported thing per file, with a barrel:
- `types.ts`: the five types.
- `icons.ts`, `names.ts`: the two maps. They are built with `Object.fromEntries` from pairs and then frozen. An object literal was not used because `web-vocabulary` counts property names such as `click` and `scroll` in `packages/`.
- `verb.ts`: `activityActionVerb`, which holds the single verb table. For each verb it gives the word regexes, the kind, and the "-ing" word that the wording puts first in its sentence.
- `record.ts`: `activityActionRecordOf` (not in the barrel). It parses the observer's `detail.text` record, `Result: <code> · Node: <node>`.
- `failure-reason.ts`: `activityActionFailureReason` (not in the barrel). It turns the last words of a result code into a short reason. Examples: not_found becomes "it wasn't on the page", timeout becomes "the page took too long", `core.replay.*` other than `replayed` becomes "it didn't work the same way again". An unknown code gives null.
- `action-of.ts`: `activityActionOf`.
- `index.ts`: the barrel. It also adds `export * from "./activity-action/index.ts";` to `packages/fluxiq/src/ui/index.ts`.

How `activityActionOf` decides:
- **When it returns null:**
  - there is no `detail`
  - `detail.kind` is "thought", which covers decide-start and decision thoughts
  - a note or step row whose verb cannot be found and that has no `step` or `ref`: "Run started", "Build started/finished/failed", "Run finished/failed/cancelled".
- **Kind, first match wins:**
  1. `ref` is `core.flow_draft`: draft
  2. phase `repairing`: repair
  3. phase `waiting_permission` or kind `ask`: person_check if the title has the word "check" or the code names intervention; otherwise permission
  4. result code with intervention, check_required or human_check: person_check
  5. result code with permission: permission
  6. kind `check`, phase `verifying` (a dry run's calls and the reset note), or `core.dry_run`, `core.dry_run.page` or `core.completion_check`: test
  7. `core.observe`, `core.state_snapshot` or `core.state_diff`: look
  8. otherwise the verb from the first of these that names one: the node id's last segment (the `Node:` record), the non-core `ref`, the step label, the result code's action word, the title
  9. a tool row, or a step row that has `step` or `ref`: other.
- **Target:** the text inside “…” in the title, otherwise `step.label`, otherwise null. Anything shaped like a dotted id is dropped.
- **Outcome:**
  - phase `waiting_permission`: waiting
  - status `failed`, or a result code that means failure: failed. Failure is judged by the same regex as the observer's `outcomeOf`, or a `core.replay.*` code other than `replayed`.
  - a code for intervention or permission: waiting
  - `succeeded`: done
  - anything else: working
- **why:** only when the outcome is failed and there is a result code.

Wording reuse (`programs/automation-studio/runtime/activity/wording/action.ts`): done without a layering violation. The dependency runs from programs to ui; ui imports nothing from programs. `programs/_shared/types.ts` already imports `../../ui` in the same way. The wording's own `VERBS` regex table is replaced by `PHRASES`, keyed by `ActivityActionVerb`, and word recognition now goes through `activityActionVerb`. The sentences and the `also` sub-word rules stay in the wording. Behaviour changes:
- `nav` now reads as "Opening a page".
- `search` and `list` are verbs only for classification. The wording has no sentence for them, so it skips them as before.

New test `wording/tests/action.test.ts` checks that the verbs stay in one place. For every verb, it passes the wording's sentence through `activityActionOf` as a step title and checks that it comes back as the same kind.

Tests in `packages/fluxiq/src/ui/activity-action/tests/`:
- `action-of.test.ts`: every kind, the null cases, target rules, outcome and why, and a check that no output contains a dotted id
- `verb.test.ts`
- `failure-reason.test.ts`
- `record.test.ts`
- `icons.test.ts`
- `names.test.ts`

## Files

- M `packages/fluxiq/src/ui/index.ts`: one re-export line added, plus a final newline.
- M `packages/fluxiq/src/programs/automation-studio/runtime/activity/wording/action.ts`
- A `packages/fluxiq/src/ui/activity-action/{index,types,icons,names,verb,record,failure-reason,action-of}.ts`
- A `packages/fluxiq/src/ui/activity-action/tests/{action-of,verb,failure-reason,record,icons,names}.test.ts`
- A `packages/fluxiq/src/programs/automation-studio/runtime/activity/wording/tests/action.test.ts`
- Regenerated, untracked: `packages/fluxiq/dist/**` (includes `dist/ui/activity-action/*`).

## Commands run and observed results

- In `packages/fluxiq`: `npx vitest run src/ui src/programs/automation-studio/runtime/activity --minWorkers=1 --maxWorkers=2`
  - First run: 1 failure. My own assertion wrongly expected a bare `not_found` to give null; I corrected the test.
  - Re-run: `Test Files 16 passed (16)`, `Tests 176 passed (176)`.
- `bash .../heavy.sh "t191 ws core check" pnpm --filter fluxiq check`: `fluxiq:check` built (tsc --noEmit). The step reports ms 47718 and the command exits 0 with no errors.
- `bash .../heavy.sh "t191 ws core build" node scripts/build-cache/cli.mjs contracts:build fluxiq:build client-gateway-websocket:build`: contracts reused, fluxiq built (4509 files), websocket reused; exit 0. The top of `dist/ui/index.js` and of `dist/ui/index.d.ts` is `export * from "./activity-action/index.js";`.
- Smoke test of the built subpath with `node` importing `dist/ui/index.js`. Input: a tool row with `Result: web.target.not_found · Node: web.output.dom-click`. Output: `{"kind":"click","target":"Buy","outcome":"failed","why":"it wasn't on the page"}`. `ACTIVITY_ACTION_ICONS.click` is `mouse-pointer-click`.
- `node scripts/structure-audit.mjs`: `structure-audit: passed (202 warning(s), 354 baselined)`, exit 0. None of the findings are on the touched paths. It also printed "1 baseline entries can be lowered". That entry is not from this change, and I did not run `pnpm structure:baseline`.

## Not verified

- I did not run either client, the web panel or the extension, against the new exports. There was no browser and no Lab run.
- I did not run the full `pnpm check`, `pnpm test` or `pnpm build` for Core.
- I did not classify real event streams from a live run. The rules are tested only against events shaped like the emitters' code: `observer.ts`, `step.ts`, `ask.ts`, `run.ts`, `build.ts`, `bind.ts`.

## Open questions or contradictions found

1. **Extension bundle entry.** The extension's `pnpm check` fails when its bundle enters Core through a module missing from `browserBundles.entries` in Core's `scripts/structure-audit/config.mjs`. Once the extension imports `fluxiq/ui`, `packages/fluxiq/src/ui/index.ts` probably has to be added to that list. The module is pure, with no Node built-ins and no dependencies. I did not edit the config because it was outside this brief.
2. **Additions beyond the pinned rules.** None of these change a pinned name.
   - An ask whose title contains "check" becomes person_check rather than permission. Today that is only the person-needed ask, "Asked the person to complete a check".
   - A `permission_required` code becomes permission.
   - An intervention or permission code with a succeeded status gives outcome waiting.
   - Core bookkeeping tools other than those listed above become "other".
3. **Coupling to the observer's text format.** `record.ts` reads `Result:` and `Node:` from `detail.text`, which is how `observer.ts` formats it. If that format changes, the classifier falls back to reading the title.
