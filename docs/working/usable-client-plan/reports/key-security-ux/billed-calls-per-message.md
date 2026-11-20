# Billed model calls per chat message (t925 follow-up, read-only)

## Outcome

Done. Answer: **one billed provider call per simple message**, on both clients. "Save and check" is **not a
billed call**. The "used a key" lines are **4 per call** (8 in all for the run's 2 messages, not 8 per message):
they are 4 IAM permission decisions made while one key value is released, not 4 provider calls.

| What | Billed provider calls | "used a key" Activity lines |
|---|---|---|
| Save and check (Anthropic) | 0 (one `GET /v1/models`) | 0 (it writes "save model key" / "added a key") |
| One extension chat message | 1 (`POST /v1/messages`) | 4 |
| One panel assistant message, no project | 1 (`POST /v1/messages`) | 4 |

Paths: "Core dev" = `C:/Users/osrs_/FluxStuff/!FluxIQ` (dev, 48a96eb24), `packages/fluxiq/src/` unless stated.
"Run Core" = `C:/Users/osrs_/FluxStuff/fxwork/t925/!FluxIQ` (task/t925-key-security-ux, c447a817d), which the
live run built. Between the two, every runtime file traced below is identical (`git diff dev c447a817d` over
`runtime/models`, `runtime/llm`, `runtime/conversations`, `programs/secret-keys`, `programs/_shared` showed changes only in
`platform/iam/catalog`). The key card wording and the Activity sentences are only on the t925 branch.

## Evidence from the run's own records

Data root: `C:/Users/osrs_/FluxStuff/fxwork/t925/!FluxIQWebExtension/.fluxiq` (the report's `EXT/.fluxiq`).
I copied its SQLite files to my scratchpad and read them there. `global.sqlite` holds `secret.keys` (encrypted key
material); I did not print any rows from it. The run wrote no provider step logs (no `steps/` folder), so the
POST count below comes from the key releases plus the code, not from a wire capture.

`platform/iam-audit.sqlite`, table `allow_20261119` (27 rows). Request ids encode milliseconds plus a counter:

| ms (…since epoch, last digits) | Action | Origin |
|---|---|---|
| 452833 | studio:OpenConversation | extension-chat |
| 452885 | (person turn written, project.sqlite) | |
| 452920, 452928, 452930, 452930 | secrets:UseKey x4 (same key) | extension-chat |
| 455152 | (reply turn written, 2.2 s later) | |
| 467043 | studio:SendPanelMessage | panel |
| 467077 | (person turn written, panel-assistant project.sqlite) | |
| 467121, 467123, 467123, 467123 | secrets:UseKey x4 (same key) | panel |
| 468676 | (reply turn written, 1.6 s later) | |

The save at 01:22:46 UTC wrote only `secrets:SaveModelKey` (a decision row and an `ok` outcome row). No
`secrets:UseKey` row came near it. Screenshot `after-live/shots/129-e05c-activity-after-fake-1440-light.png` shows
four "owner used a key." lines above "owner send panel message." and more below for the extension message: 4 + 4,
which matches the table.

Each conversation holds exactly 2 turns (person, reply). The extension thread's title came from a
`conversation.rename` mutation 6 ms after the person's turn, with no key use (see 3).

## 1. Is the save check billed? No.

- `runtime/models/secrets/model-access/check-key.ts:25-26,55-58`: for Anthropic it sends one
  `GET {messages URL minus /messages}/models` (line 20) with the key in `x-api-key`. For DeepSeek it sends
  `GET /models` and then `GET /user/balance` (lines 60-74). No Messages or Completions endpoint is called, so no
  tokens are sent or billed. (That a models list costs nothing is the providers' published behaviour. I did not
  check it against an invoice.)
- Caller chain: `programs/secret-keys/api/model-key-endpoints.ts:71,82-89` (SaveModelKey stores the key, then calls
  `checkSavedModelKey` with the pasted value, so the key is never released) → `api/saved-key-check.ts:18-26` →
  host callback `programs/_shared/runtime.ts:439-443` → `checkAutomationStudioModelKey` → `ledger.noteCheck`
  (`model-access/ledger.ts:72-75`, which records the result as `note(..., "answered")`). The same check runs after
  ReplaceModelKey (`model-key-endpoints.ts:107-110`) and CreateKey/RotateKey (`api/handlers.ts:99,153`).
  `checkAutomationStudioModelKey` has no other caller in Core (grep).
- What writes "It last answered just now": `model-access/state.ts:38,43` puts `ledger.lastCall` in the state.
  Then run Core `packages/ui-components/src/model-access/contract/from-core.ts:20-21` takes `lastCall.atMs` when
  `outcome === "answered"`, and `.../model-access/words.ts:27,43-46` renders " It last answered just now."
  So right after a save, the sentence reports the free models-list check.
- Misleading wording, not a cost: the ledger has a single outcome word, `answered`, for both the free check and a
  real chat answer. `runtime/llm/caller-key-chat/model.ts:83` notes `"answered"` after a billed extension chat call,
  and `ledger.ts:73-74` notes a check the same way. The card cannot tell "checked" from "answered a message".
  The panel assistant's calls never note the ledger at all (`runtime/conversations/assistant/model/key-model-source.ts`
  has no ledger), so a panel message does not refresh "last answered".

## 2. Calls per message, in order

### Extension chat message (studio:AppendTurn, project chat)
1. No call: the thread title is the first message, trimmed (`runtime/conversations/title-from-message.ts:9`).
   This is the run's `conversation.rename` row.
2. **Billed: one Anthropic `POST /v1/messages`**, purpose `panel_command`, which interprets the message and replies
   in one decision. Model: the chosen key's model, or else `claude-sonnet-5-5` (`runtime/models/catalog/anthropic.ts:6`;
   `models/secrets/caller-key-choice.ts:81-86`). The run's environment could have overridden this with
   `FLUXIQ_LLM_DEFAULT_MODEL`; I did not check it.
   Path: `runtime/conversations/instructions/interpret.ts:81-97` (one `model.decide`, returned on the first
   readable decision) → `runtime/llm/caller-key-chat/model.ts:57-84` (bound at `programs/_shared/runtime.ts:356`)
   → `runtime/llm/anthropic/panel-command.ts:24-41` → `runtime/models/providers/anthropic/messages.ts:49`
   (release the key) and `:58-61` (POST). Writes 4 "used a key" rows. Notes the ledger "answered" (`model.ts:83`).

### Panel assistant message, no project (studio:SendPanelMessage)
1. **Billed: one Anthropic `POST /v1/messages`**, purpose `panel_command`. Model: the assistant's chosen model,
   or else the Anthropic default above (`anthropic/panel-command.ts:18`).
   Path: `runtime/conversations/assistant/loop/run-turn.ts:37-70` (one iteration; a `reply` decision ends the turn at
   line 68-70) → `assistant/model/conversation-model.ts:14-24` → `assistant/model/key-model-source.ts:76-83,96-98`
   (bound at `programs/_shared/runtime.ts:424-428`) → the same `panel-command.ts` and `messages.ts:49,58`.
   Writes 4 "used a key" rows. Its `checkCurrentChoice` before and after the release (`key-model-source.ts:69-75,78,81`)
   only reads the choice and writes no audit row.

### Why exactly 4 Activity lines per call (all Core dev)
One release is `releaseAutomationStudioSessionProviderKey` (`runtime/models/secrets/session-key.ts:39-64`;
`authorizeUseKey` at line 46 is not wired: `programs/_shared/key-access/model-ports.ts:7-22`). During it the
full use authority runs four times:
1. `programs/secret-keys/runtime/access/access.ts:21`, in `createUseAuthorization`.
2. `access.ts:33`, the same call again after the key is protected (8 ms later in the run: 452920 → 452928).
3. `programs/secret-keys/runtime/service.ts:511`, in `revealKeyWithAuthorization` via `assertAuthorization`
   (`access.ts:51-55`).
4. `service.ts:520`, the same check again just before the value is returned.

Each of these goes through `access.ts:110` → `programs/_shared/key-access/authority.ts:105`
`api.authorize({ action: "secrets:UseKey" ... })`. `programs/_shared/api.ts:313-321` "Records one audit row", and
`platform/iam/audit/decision-filter.ts:22` keeps every `allow` of a non-read action. Run Core
`apps/web/src/app/api/security/server/shape-activity-entry.ts:41-51` turns each row into one Activity entry, and
`apps/web/src/features/security/activity/model/activity-sentence.ts:12` words it "used a key".

So an Activity line does **not** match a billed call one to one. On a successful call it is **4 lines to 1 call**.

## 3. Is any call avoidable for a simple message? No.

Each message made one call. That one call both classifies the message and writes the reply (`interpret.ts:90-97`;
`run-turn.ts:48,68-70`). There is no separate classification call. The title is built without a model
(`title-from-message.ts:9`), and no call ran twice. Extra billed calls happen only on paths this run did not reach:
- An unreadable answer: the extension chat asks again with a correction (`interpret.ts:59,98`), and the panel
  assistant re-asks (`run-turn.ts:60-64`).
- A retryable provider failure is tried again (`interpret.ts:113-114`; `run-turn.ts:54`).
- The panel assistant calls one tool per iteration (`run-turn.ts:72-75`).
All of these are legitimate. None fired here, since each message released the key exactly once.

## 4. Are "used a key" lines written for things that are not provider calls? Yes.

- The main cause is the 4x count. Each release re-runs the recorded authority 4 times
  (`access.ts:21,33`; `service.ts:511,520`). The re-checks are right as security (they catch a key or permission
  changing during the async release), but each one is recorded as a fresh decision.
  Root-cause fix: decide the re-checks with the existing unrecorded path (`api.ts:323-335` `decideUnrecorded`), or
  record a single row when the value is handed to the call (`service.ts:529`). A release would then read as one line.
  To make a line mean a billed call, record the call's outcome (answered / refused / unreachable) against that row,
  the way key writes do with `auditOutcome` (`model-key-endpoints.ts:64-65`).
- No provider call at all: saving a Flow's settings with result checking turned on writes a `secrets:UseKey` row
  (`programs/automation-studio/api/handlers/flows.ts:159-163`), so Activity shows "used a key" for a settings save.
- Released but not billed: the 4 lines are written before the POST. A call that then fails also writes them: 401,
  429, 5xx, unreachable, abort, or the credential-in-body guard (`messages.ts:49-56,74-82`). Each retry writes 4 more.
- The reverse error: a lent workspace key (another person's key paying for the assistant) is authorized as
  `studio:SendPanelMessage` (or `studio:UpdateFlowSettings` for a standing result check) instead of `secrets:UseKey`
  (`authority.ts:96-104`). Those calls write 4 extra "send panel message" lines and no "used a key" line.
- The other key paths write none of these lines: model-access state reads, key snapshots (`keys.snapshot()` is a
  direct service call), the assistant's choice lookups, and the save check.

## Commands run and observed results

- Python `sqlite3` over scratchpad copies of `.fluxiq/platform/iam-audit.sqlite*`, `global.sqlite` (table names and
  counts only), and the two `project.sqlite` files. Output: 27 allow rows and 2 `long` rows; 8 `secrets:UseKey` rows in
  two bursts of 4; 2 turns per conversation; 1 `conversation.rename` mutation.
- `git diff --stat dev c447a817d -- <traced runtime paths>` in Core dev: only `platform/iam/catalog/*` differ.
- Greps for `checkAutomationStudioModelKey`, `secrets:UseKey`, `createUseAuthorization`, `assertAuthorization` and
  "last answered" across both Core trees and the extension source.
- Viewed screenshot `129-e05c-activity-after-fake-1440-light.png`.
- No model calls, no panel, no source edits.

## Not verified

- The number of POSTs on the wire. The run kept no provider step logs, so 1 call per message is inferred from one key
  release per message plus `messages.ts:49→58`, which releases exactly once per POST.
- The exact model id used. `FLUXIQ_LLM_DEFAULT_MODEL` and the key's stored model metadata were not read.
- Whether Anthropic or DeepSeek ever bill the models-list or balance endpoints. This rests on their documentation;
  I checked no invoice.
- Whether the Activity page groups or caps rows beyond what the screenshot shows.

## Open questions or contradictions

- The after-live report's "about 8 used a key lines per message" is 8 lines for the 2 messages (4 each).
- "It last answered just now" uses the same wording for a free check and a billed reply. It could say "checked" for a
  check. Also, panel assistant calls never update it.
