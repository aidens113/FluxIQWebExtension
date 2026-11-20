# F25: answers sent as JSON inside a JSON string garble on long replies

For the user's review (recorded as fundamental on 2026-11-20). Lead's write-up; no code changed by this note.

## What happens

Core asks Claude for a JSON object in one of two ways (`packages/fluxiq/src/runtime/models/providers/anthropic/schema.ts`):

- **Native.** The task's own schema goes to Anthropic's structured outputs. The grammar guarantees the shape. This is used when the schema is closed (`additionalProperties: false` on every object), has at most 24 optional properties and at most 16 unions.
- **JSON text.** Otherwise the model answers `{"result_json": "<the object, serialised as a string>"}`. The grammar guarantees only the outer string, so every quote inside the answer has to be escaped by the model.

On long answers the escaping breaks partway through. The outer JSON is valid; the string inside is not. Seen live:

- run-mwoznmcq 0047 and 0053 (Haiku judge, 1,343 output tokens);
- run-mwouuc9b 0060 (Sonnet judge);
- run-mwovplov 0307 (Haiku judge);
- decisions with `content_off_shape` across the campaign.

## Why the JSON-text path exists

- The decider's schemas contain open maps (tool arguments, free-form values). Structured outputs reject an open object, so those schemas cannot go native.
- Forced tool use (`tool_choice` `any` or `tool`) returns a 400 on Sonnet 5.5 and Opus 5.5, so "always call this tool" cannot be enforced.
- The output format is part of the prompt-cache prefix (t965 measured it: a judge sending its own format read 0 cached tokens). A judge that continues its decider's cached conversation therefore must use the decider's format, which is JSON text.

## What is being fixed now (not fundamental)

t979: an unreadable judge reply is re-asked with a note saying what could not be read. The first re-ask goes standalone with the judge's own native format where that format is representable. Later re-asks climb the model ladder. The check keeps asking until it gets a readable answer or the purse is out. Decisions already re-ask with a note (`unusable-decision.ts`).

## Options for the root cause (the decision is yours)

1. **One `answer` tool for every call.** Every request declares one tool with an open, non-strict input schema, plus an instruction to answer only by calling it (`tool_choice: auto`). The model writes the object as native JSON (no escaping), and every role shares the tool definition, so the cache prefix stays shared.
   - Costs: a reply that answers in text instead of calling the tool must be re-asked; the shape is not grammar-checked (Core already validates every answer against the original schema); every provider path changes.
2. **Close the decider's schemas.** Replace each open map with a closed shape (for example a list of `{key, value}` pairs) so every role goes native.
   - Costs: a schema change in every decision family; values stay strings inside the pairs; it may not fit the 24-optional and 16-union limits.
3. **Keep JSON text, but shorten what is escaped.** Move long free text (diagnoses, reasons) out of the escaped object into a separate plain field of the outer schema.
   - Costs: a smaller change; the outer schema gains fields, which every role must share to keep the cache; still fragile for long structured parts.

Lead's recommendation: option 1. It removes the escaping for every role, keeps one cache prefix, and Core's validation against the original schema already exists. Measure it on a provider-free replay of the recorded failing requests before any live run.
