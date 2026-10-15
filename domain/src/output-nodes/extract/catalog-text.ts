// What a model reads about the single-value read, `web.dom.extract`, when it
// builds a Flow (t646).
//
// Core's Flow Bootstrap shows the model each chosen definition's description
// (kept to 240 characters, its first sentence standing alone within 80), its
// output ports, and the description and example of each object parameter,
// which `core.describe_nodes` and a refusal's `accepted` repeat
// (`flow-bootstrap/plan/catalog.ts`, `plan/issue-feedback.ts`). The request's
// schema stays in metadata, which none of them sends.
//
// **Until t646 none of that said how to read one value.** The node declared
// only `success` and `failed`, its `extract` parameter carried no description
// and no example, and the description said "Extract text, value, or attributes
// from an element". A builder told to hand on one value it read off the page
// (A8 frozen pair 3, `run-mv9zn5ob-d929084d`) bound its output to `.text`, to
// `.success`, and to a list extraction's `extraction.1` handle copied from
// Core's own example, then guessed six shapes for `extract`, and every one was
// refused. So the description names the `value` output the read hands on
// (`./value-port.ts`), and `extract` carries its grammar and one example.
//
// The modes are the request's own (`actions/extraction/request.ts`,
// `WEB_AUTOMATION_EXTRACT_READ_MODES`), each said once in a total record, so a
// mode added there does not compile until it is described here.

import type { JsonObject } from "fluxiq/core";
import type { WebAutomationExtractReadMode } from "../../actions/extraction";

/** Words of a request to read one value. A tag of two words is ranked as both. */
export const WEB_AUTOMATION_EXTRACT_TAGS: readonly string[] = ["read", "value", "text", "read value"];

/** The node's description: what it reads, and how a later step reads what it read. */
export const WEB_AUTOMATION_EXTRACT_DESCRIPTION = [
  "Read one value off one element of the page.",
  "A later step reads it as $step.<label>.value.",
  "Name the element by its handle in target; extract says which value. For rows of a list, use Extract List."
].join(" ");

/** What each mode reads, said once per mode (header). */
const READ_MODE_TEXT: Readonly<Record<WebAutomationExtractReadMode, string>> = {
  text: "its visible text",
  value: "a field's current value",
  attribute: "one attribute, named: {\"mode\": \"attribute\", \"attribute\": \"href\"}",
  html: "its inner HTML"
};

/** The shape of `extract`, for a model to write one: every mode, and what each reads. */
export const WEB_AUTOMATION_EXTRACT_READ_GRAMMAR = [
  "Which value of the element to read, handed on as the step's value output ($step.<label>.value).",
  `{"mode": "text"} reads ${READ_MODE_TEXT.text};`,
  `"value" ${READ_MODE_TEXT.value};`,
  `"attribute" ${READ_MODE_TEXT.attribute};`,
  `"html" ${READ_MODE_TEXT.html}.`,
  "In a Flow script: `extract.mode: text`."
].join(" ");

/**
 * The one request a model is shown: the element's text, the read nearly every
 * single value is. Core reads an example's keys as the keys a model may write
 * beside the parameter (`flow-bootstrap/authoring/matching.ts`), so a bare
 * `mode: text` on the step is folded into `extract.mode`.
 */
export const WEB_AUTOMATION_EXTRACT_READ_EXAMPLE: JsonObject = { mode: "text" };
