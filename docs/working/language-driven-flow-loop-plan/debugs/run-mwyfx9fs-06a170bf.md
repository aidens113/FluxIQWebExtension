# run-mwyfx9fs-06a170bf: crossborder free hubs under ten, 4 of 4 passed, but attempt 1 spent 35 calls

Lane: `live-lane-4` (tree `fxwork/t1061-live-lane-4`). Task:
`crossborder-marketplace/crossborder-marketplace-free-hubs-under-ten`, answer-first, `--attempts 4`, visible Chrome,
run watcher on. fluxiq 0.54.32.
Provider: Anthropic `claude-sonnet-5-5` for build and judge. Cost: $1.73 over 36 calls, 35 of them ($1.66) in attempt 1.
Step files: `C:/Users/osrs_/FluxStuff/lab-runs/2026-11-26/run-mwyfx9fs-06a170bf/steps/`. Debugged offline from the
step files, the watcher's alerts and the code at 0.54.32 (Core worktree `fxwork/t1070/!FluxIQ`). No live or paid run
was used.

The request (0001) names its columns: "... cheapest first, with columns title, store, price and rating, written
exactly as the results show them."

## What happened

| Attempt | Steps | Calls | What it did |
| --- | --- | --- | --- |
| 1 | 0001-0098 | 35 ($1.66) | Read page 1 with the list's own keys, declared the processing over them, built the paging loop, was refused as not the asked table (0057), re-read with the asked names, rebuilt the loop and the processing (0058-0097). Judged yes (0098). |
| 2 | 0099-0121 | 1 ($0.07) | Ran the saved Flow. It deviated from the accepted run (`flow_not_proven`, 0120), so it was judged, yes (0121). |
| 3, 4 | 0122-0165 | 0 | Ran the saved Flow as recorded. No judge was needed (0143, 0165). |

Attempt 1 in detail:

| Steps | Calls | Cost | What it did |
| --- | --- | --- | --- |
| 0001-0012 | 6 | $0.19 | Searched, detected the list (`extraction.1`), read page 1 naming **no** fields (0009: `extractList: {handle: "extraction.1"}`), so the rows carried the list's keys `link_text`, `text_6`, `price`, `number`, `text_3`, `text_7`, `url_2`. Declared the processing over those keys (0012, accepted, 2 rows). |
| 0013-0027 | 7 | $0.21 | Added Next page and the repeat (0015, 0017). The next three amendments were refused `already_so` (0020, 0022, 0024), so the loop steered `same_fix` (0025) and the model chose `change_approach` (0027). |
| 0028-0057 | 8 | $0.41 | Ran the loop (0028, 0036, 0046), declared the same processing again (0034 was sent with no `process`; 0041 was unchanged). `near_repeat` x3 (0054), then `finish_with_best` (0056). The completion was refused before any check, `answer_first.not_asked_table` (0057): "the request names ... (title, store, price, rating), and the rows ... hold columns link_text, text_6, price, number". |
| 0058-0097 | 13 | $0.67 | Re-read naming the asked columns (0058: `title: "link_text"`, `store: "text_6"`, `rating: "number"`, ...), made that read the result and repeated it through a new Next page (0060-0072), declared the processing again over the new names (0081: "the earlier declaration named old column names that no longer exist"), fixed the draft's order (0083), ran it (0085, 0094 refused as a repeat), and finished (0097). |

The watcher raised `finish_not_ending` three times (0064, 0073, 0094): decisions kept coming after `finish_with_best`.

## Why

1. **The first read named no columns, so the rows were not the asked table** (the root of 0057-0097, 13 calls,
   $0.67, plus the finish at 0056).
   - The request names its columns exactly. The read at 0009 still named no fields, so the list's own keys became the
     column ids. Nothing between 0009 and 0056 told the model that the result's columns had to carry the request's
     names. The check that knows this (`answer_first.not_asked_table`) runs only at completion.
   - Processing cannot rename. `columns` picks stored ids. A later read that maps `title: "link_text"` makes new
     ids, so every earlier reference stops binding.
2. **The held processing kept naming the old keys after the result moved to the new read** (0064-0081, shown in
   every request from 0067 on).
   - The data stage refused to bind the held declaration:
     `answer_first.processing_binding_missing`: "process_binding_missing_field, record_output.process_unknown_field.
     Required fields: url_2 (missing), text_3 (missing), text_7 (missing), link_text (missing), text_6 (missing),
     number (missing)."
   - That sentence named the old ids but not the fields the new read holds. The model reasoned (0073) that "the
     processing mentions fields that aren't bound properly", ran the Flow first, and re-declared only at 0081.
   - The framework had the mapping all along: 0058's read says `title` is `link_text`, `store` is `text_6`,
     `rating` is `number`, `shipping` is `text_3`, `ad` is `text_7`, `link` is `url_2`. Binding resolves only an
     exact id or a unique label (`packages/contracts/src/record-sets/process/binding/bind.ts`), and the new
     fields' labels are the new names.
3. **Smaller waste.**
   - 0020-0024: three amendments the draft already held (`already_so`).
   - 0034: a call with no `process`, answered "Give process ...".
   - 0094: a repeat of 0085's run, refused `repeat_refused`.

## Fixed in t1070 (Core)

- Cause 2's message now names what is wrong and what is there. The binding readiness message (`stage.ts`,
  `evaluate`) and the tool's refusal list, for each reference no field binds to, why, then "The rows hold
  "title", "store", ...". Each part the parser refuses names its part, field and operator.
  `automationStudioRecordProcessingRefusalText` in
  `packages/contracts/src/record-sets/process/binding/refusal-text.ts` writes that text. This would have told the model at 0067 which names the result now holds.

## Next (not in t1070's paths)

- Cause 1 at the root: when the request names its columns, the result read should carry those names from its first
  run. Either the read's guidance says so before the read, or the framework maps the request's names onto the
  read's keys when it binds the result. Today only the completion check says so, after a whole loop is built.
- Cause 2 at the root: when the result moves to a read whose `fields` map new names onto the old keys, rebind
  the held declaration through that map automatically. The model would then not have to declare it again.
- Prove both offline on this recording: with 0058's read as the first read, 0057's refusal does not happen, and the
  declaration of 0012 binds to step 8's schema unchanged.
