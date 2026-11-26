# Scripted round 2: diagnosis of apprentices and saturday-certificate

Lane `C:/Users/osrs_/FluxStuff/fxwork/t1015-paid-bigbox` (dev at fluxiq 0.54.27), shared Core
`C:/Users/osrs_/FluxStuff/fxwork/!FluxIQ` at 266b99197. Diagnosed only from the recordings: no Lab task re-run, no edits.

## Outcome

Done. Both failures are **scripted-model defects**, not product or Lab defects. Neither script made a wrong call
on the page. Each misread or miswrote one Core/domain contract, then could not recover and used up its decision
allowance.

| Task | Cause | Kind | Introduced by |
| --- | --- | --- | --- |
| company-website-apprentices | The script requires the held-rows group to be exactly `"holder:read"`. Since t1048, Core names it `holder:read:<hash>`. | Scripted-model defect | Exposed by Core t1048 (b0b058b2a, merged in 38e47ebfb) |
| company-website-saturday-certificate | The script names a read column `"group heading"`, with a space. That is an illegal field key, so the domain refuses every weekly read. | Scripted-model defect | Caused by downstream t1052 (dcc480da2). It was never run past the widget before this round. No Core merge is involved. |

## 1. company-website-apprentices (`run-mwx9k3mi-2567c7d4`)

### The read succeeded every time

The product read the team correctly twice:

- Step 0024 (`read-team`) and step 0028 (`read-team-retry-13`) both returned
  `"ok": true, "status": "succeeded"`.
- Each return said `"actual": "4 records from 1 page, 24 items left out by where; ..."`.
- `extracted` held Rhian Taverner, James Whitlock, Ollie Pratchett and one more apprentice.

### Why the script did not complete

`company-website-apprentices.ts:45`:

```ts
if (reference?.callId !== entry?.callId || reference?.group !== "holder:read") return false;
```

The decision request after the read (step 0030 `request.txt`, line 119) shows the reference Core wrote:

```
"extracted":{"core.view_reference":{"callId":"read-team","group":"holder:read:750f72d20954"}}
```

The same request's current view (line 136) holds the rows under that same name:

```
{"group":"holder:read:750f72d20954","callId":"read-team-retry-13","holder":"read"
```

The group is not the literal `"holder:read"`, so `readSucceeded` returns false. `decide` then falls through to
line 74 and asks again: detect (`detect-team-retry-12`), then read (`read-team-retry-13`). That made the
detect/read cycle in step 0029 (`"pattern": "cycle", "toolIds": ["web.detect_repeating_structure", "core.run_node"]`).

After that it asks for `detect-team-retry-N` every time. Core correctly answers from memory
(step 0031: `"resultCode": "llm_evidence_loop.already_answered", "answeredByCallId": "detect-team-retry-12"`).

The answered entry never becomes a newer `web.detect_repeating_structure` result than the read. So the script asks
again eleven times, until request 25 exceeds `MOST_DECISIONS = 24` (line 109).

### Proof that t1048 is what changed

- **Core code:** `packages/fluxiq/src/runtime/llm/decision-context/current-view.ts:90-96` (`nameOf`). When the read
  names its `listKey`, the group becomes
  `${group.group}:${sha256([listKey, place, address]).slice(0,12)}`. That is t1048's "one group per list key,
  place and address". The web read's answer carries `"listKey":"list.071487963cb742047efd01bd5042"` (step 0030
  request, line 119), so the read gets the hashed name.
- **Round 1 passed with the old name:** in `run-mwwwf7pb-c646fefb`, before t1048, the requests carry only
  `"group":"holder:read"` (for example `steps/0025-decide/request.txt`, 4 occurrences, no hashed group). That is why
  attempt 1 passed there.
- **The unit test did not catch it:** `scripts/tests/company-website-apprentices.test.ts:113-125` runs Core's real
  `automationStudioLlmEvidenceCurrentView`, but its read fixture has no `listKey`. Core therefore still produces
  `"holder:read"`, and the test asserts that literal.

### Is it a product defect?

No. The product read, held and showed the rows correctly. The repeated `already_answered` refusals and the
`core.no_progress` steering (step 0050: `"stepsWithoutProgress":10`) are the designed behaviour since t1049. No
count ended the attempt; the script's own decision cap did.

### Smallest general fix (downstream test-runner only)

1. **Stop parsing Core's group naming.** In `readSucceeded`, drop the literal at line 45. Accept the reference when
   the current view holds a group with `group === reference.group`, `callId === reference.callId` and
   `holder === "read"`. Line 48 already checks exactly that.
   - A more general form is one shared helper in `scripts/evidence.ts`, for example `heldReadRows(entry, evidence)`.
     It would resolve any `core.view_reference` through `core.current_view` by `{callId, group}`, so no script ever
     spells a group name.
2. **Make the test match the product.** Give the read fixture in the test a `listKey` and a `url`, so it gets a
   hashed group like the real product. Assert completion, not the group string.

### Will it hit other scripted tasks?

No:

- Only `company-website-apprentices.ts` (and its test) mentions `holder:read` or resolves a `core.view_reference`.
  Checked with grep over `scripted-model/`.
- bigbox's `columnsOf` searches the value generically, and bigbox passed this round.
- The judge (`judgement.ts`) reads `resultSummary.recordSets`, which t1048 did not change.

## 2. company-website-saturday-certificate (`run-mwx9mpt9-0b0b87d4`)

### What happened

The path ran correctly up to the calendar:

- covers cleared, booking open, Wrenfield chosen, CP12 chosen, Next pressed;
- each week detected (steps 0020, 0026, 0032: `web.structure.detected`, with `cells.handle: "extraction.2"`);
- Later pressed (steps 0024, 0030 succeeded).

Every weekly read was refused, in steps 0022, 0028 and 0034. Step 0022 `result.json`:

```
"ok": false, "code": "target_unobserved",
"detail": { "reason": "malformed_handle",
  "instead": [ "web.handle.malformed", "web.handle.expected.extract_list.handle_fields",
               "web.handle.malformed:extractList.fields.2", ... ] }
```

The call it refused (step 0022 `call.json`):

```
"fields": { "date": "data-date", "time": "item", "group heading": "group_heading", "disabled": "item_disabled" }
```

### The exact cause

`fields.2` is the third key of that map, `"group heading"`. The domain's `issue-position.ts:68` writes a key that
is not a grammar word as its index.

The script writes that key at `company-website-saturday-certificate.ts:66`:

```ts
fields: { date: columns.date, time: columns.time, "group heading": columns.heading, disabled: columns.disabled },
```

The domain refuses it here:

- `domain/src/runtime/llm-evidence/plan-resolution/extraction/columns.ts:201`:
  `if (!isWebAutomationExtractFieldKey(under)) return { ok: false, issue: "web.handle.malformed", path: written.at };`
- The rule it applies is `domain/src/actions/extraction/field-key.ts:14`: `/^[A-Za-z0-9_-]{1,100}$/`. A space is not
  allowed.
- This rule is old (since 36daa6800). `columns.ts` last changed in t1038, before t1052.

The refused reads stored no rows. Every `complete` was then refused:

```
step 0036: "resultCode": "answer_first.processing_schema_missing",
  "resultHolds": { "result": "Result: no rows: the draft has no read step yet.", "totalRows": 0 }
```

The script repeated `complete` through Core's steering (`steer near_repeat`, `change_approach near_repeat x7`) until
request 61 exceeded `MOST_DECISIONS = 60` (line 143).

The about 2.5 minutes it took is these 40-odd refused completions.

### Why the script never noticed

`company-website-saturday-certificate.ts:32` (`callsMade`) counts a call id as made if it appears anywhere in the
payload, refused results included. So it treated `read-week-1` as done, pressed Later, and moved on. After
`read-week-3` was refused, it completed with nothing read.

### Which change caused it

- **Downstream t1052 (dcc480da2)** replaced `fields: { date, time }` plus a `where` with the four-column map above.
  It named the heading column `"group heading"` to match the processing declaration's words.
- **The change was never run.** `reports/t1052.md` lines 48-52: the rerun was "REFUSED before starting ... behind-dev".
  Its "Not verified" says the saturday run "has not confirmed it".
- **Round 1 could not show it.** `run-mwwwr1ty-d36c4ce1` stopped at request 3, "nothing matching ... Wrenfield",
  before the frame fix. The first run that reached the read is this one.
- **No Core merge (t1048 to t1054) is involved.**

### Is it a product defect?

Not as the cause. The refusal is correct: a column key must be a legal record field id, or Core's store refuses
it later.

A smaller product point, optional: the refusal tells a real model only `web.handle.malformed:extractList.fields.2`
plus the `handle_fields` hint. It does not say that the name is an illegal key or what the key rule is.
An issue such as `{code: "web.handle.field_key_invalid", field: "group heading"}` would let a model fix it in one
step. That is a message improvement, not this failure's cause.

### Smallest general fix (downstream test-runner only)

1. **Fix the key.** At `company-website-saturday-certificate.ts:66`, write the heading column under a legal key:
   `group_heading: columns.heading`. The declaration's `{ field: "group heading", contains: "Sat" }` still binds,
   because Core's process binding folds `_`, `-` and spaces to one space and ignores case
   (`domain/.../extraction/stored-columns.ts:105-106`, citing Core's `record-sets/process/binding/name-key.ts`). The declaration and the oracle need no change.
2. **Update the test.** `scripts/tests/company-website-saturday-certificate.test.ts` lines 49 and 58 expect
   `"group heading"`; they should expect `group_heading`.
3. **Make a refusal stop the script at once (recommended).** Have `callsMade` count only calls whose result was not
   refused (`ok !== false`, no `refused` verdict). Better, use one shared helper in `evidence.ts` for all scripts. A
   refused step then fails the script at the step that was refused, not 40 decisions later.

### Will it hit other scripted tasks?

The illegal key will not:

- Every other script's `extractList.fields` keys are legal identifiers: bigbox (`name, price, rating, ad,
  fulfillment`), crossborder, everything-store.
- `"group heading"` appears only in the saturday script, its test, and the processing declaration. The declaration
  is fine because it binds by fold.

The refused-call-counted-as-made weakness is wider. `professional-network-accept-messaged-invitations.ts` also uses
a `made` set. It is not failing now, but it would hide a refusal the same way.

## Commands run and observed results

All were reads: `ls`, `cat`, `sed`, `grep`, `git log`, `git show`, plus the Grep tool. Key outputs are quoted above.

- `git log` in the shared Core shows t1048 (`38e47ebfb`), t1049 (`909800723`), t1050 and t1053 merged; Core HEAD is
  `266b99197`.
- `git log -S` showed the field-key refusal at `columns.ts:201` dates from 36daa6800.
- `git show dcc480da2` showed t1052's change to the saturday read.

No Lab task, test, build or `node -e` was run.

## Not verified

- That the two fixes make attempt 1 of each task pass. Each attempt's later steps (judge, the saved Flow's runs in
  attempts 2 to 4) were never reached, so other defects could still sit behind these.
- For saturday: that Core's processing binding accepts `group_heading` against the declaration's `"group heading"`
  on a real run. This rests on the fold rule's comment, not on a run.
- That apprentices' attempts 2 to 4 still run the saved Flow with no model call after the fix (they did in t1053's
  lane: 13, 1, 0, 0 calls).

## Open questions or contradictions found

- crossborder-marketplace-free-hubs-under-ten's log in the same round ends at `[attempt] starting an isolated Core`,
  then `ELIFECYCLE Command failed with exit code 1`, with no reason printed. That is outside this brief and was not
  diagnosed, but it is a separate failure the round summary does not explain.
- t1052's report (line 15) counts the saturday script's unit tests passing as validation. Those tests assert the
  illegal key itself (test lines 49 and 58), so they could not catch this. Script unit tests should run their read
  through the domain's real field-key rule (`isWebAutomationExtractFieldKey`) or its slot resolver.
