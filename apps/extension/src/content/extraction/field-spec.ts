// One field of a `web.dom.extract_list` request, normalized into what the page
// reads: the kind of read, where inside the item, and whether a record may lack
// it.
//
// A field arrives in one of two forms (`WebAutomationExtractField`):
// - today's string grammar, always required as it always was: a plain selector
//   reads text, an empty one reads the item itself, `selector@attribute` reads
//   an attribute, and `column:<header text>` reads the cell under that header.
//   An `@` only introduces an attribute when what follows is a valid attribute
//   name, so a selector that contains one -- `[data-owner="a@b"]` -- stays a
//   selector;
// - the structured spec, which names the same reads plus `link` (an `href`
//   resolved against the page) and `value` (a form control's live value), and
//   adds `required` (true unless it says `false`) and `handling`. A `column`
//   spec reads the cell under its header; it has no selector of its own, so one
//   sent with it is not used.
//
// Handling is decided here, before anything on the page is read:
// - `exclude` drops the field, so `normalizeExtractField` answers `undefined`
//   and its values are never read -- not read and then removed (decision D12);
// - `encrypt` is refused with a NOT_IMPLEMENTED record until the Encrypt
//   column is built. The domain's lift already refuses it at dispatch; this is
//   defence in depth for a request sent straight to the page.
//
// A spec the page cannot honour -- a kind or handling it does not know, an
// `attribute` field naming no attribute, a `column` field naming no header --
// throws rather than reading something other than what the field names. Every
// refusal names the author's field key, never a selector and never page text.

import { WEB_AUTOMATION_FAILURE_CODES, webAutomationFailureRecord } from "@fluxiq-web-extension/domain/client";
import type { WebAutomationExtractListRequest } from "../types";

type ExtractField = WebAutomationExtractListRequest["fields"][string];
type ExtractFieldSpec = Exclude<ExtractField, string>;

/** What one included field reads inside each item, and whether a record may lack it. */
export type ExtractFieldReader =
  | { kind: "text" | "link" | "value"; selector?: string; required: boolean }
  | { kind: "attribute"; selector?: string; attribute: string; required: boolean }
  | { kind: "column"; header: string; required: boolean };

const COLUMN_PREFIX = "column:";
const ATTRIBUTE_NAME = /^[A-Za-z_][-A-Za-z0-9_:.]*$/u;

/**
 * The reader for the field `name`, or `undefined` for a field whose column is
 * excluded and so is never read. Throws for a field the page cannot read, and
 * with a NOT_IMPLEMENTED record for an `encrypt` field.
 */
export function normalizeExtractField(name: string, field: ExtractField): ExtractFieldReader | undefined {
  if (typeof field === "string") return parseStringField(field);
  if (typeof field !== "object" || field === null) {
    throw new Error(`The extract_list field ${JSON.stringify(name)} is neither a selector nor a field spec.`);
  }
  return normalizeSpec(name, field);
}

function parseStringField(spec: string): ExtractFieldReader {
  if (spec.startsWith(COLUMN_PREFIX)) {
    const header = normalizeText(spec.slice(COLUMN_PREFIX.length));
    if (!header) throw new Error(`The extract_list field ${JSON.stringify(spec)} names no column header.`);
    return { kind: "column", header, required: true };
  }
  const at = spec.lastIndexOf("@");
  const candidate = at < 0 ? "" : spec.slice(at + 1);
  const attribute = ATTRIBUTE_NAME.test(candidate) ? candidate : undefined;
  const selector = (attribute === undefined ? spec : spec.slice(0, at)).trim();
  const where = selector ? { selector } : {};
  return attribute === undefined
    ? { kind: "text", ...where, required: true }
    : { kind: "attribute", ...where, attribute, required: true };
}

function normalizeSpec(name: string, spec: ExtractFieldSpec): ExtractFieldReader | undefined {
  const handling: unknown = spec.handling ?? "include";
  if (handling === "exclude") return undefined;
  if (handling === "encrypt") throw encryptNotImplemented(name);
  if (handling !== "include") throw new Error(`The extract_list field ${JSON.stringify(name)} asks for a handling the page does not know.`);

  const required = spec.required !== false;
  const selector = typeof spec.selector === "string" ? spec.selector.trim() : "";
  const where = selector ? { selector } : {};
  const kind: unknown = spec.kind;
  switch (kind) {
    case "text":
    case "link":
    case "value":
      return { kind, ...where, required };
    case "attribute": {
      const attribute = typeof spec.attribute === "string" ? spec.attribute.trim() : "";
      if (!attribute) throw new Error(`The extract_list field ${JSON.stringify(name)} reads an attribute but names none.`);
      return { kind, ...where, attribute, required };
    }
    case "column": {
      const header = normalizeText(typeof spec.header === "string" ? spec.header : "");
      if (!header) throw new Error(`The extract_list field ${JSON.stringify(name)} reads a column but names no header.`);
      return { kind, header, required };
    }
    default:
      throw new Error(`The extract_list field ${JSON.stringify(name)} asks for a kind of read the page does not know.`);
  }
}

/**
 * The refusal for an `encrypt` field. The record names the field key and the
 * missing feature, never a selector; `actionFailure` lifts it, so the read
 * fails as NOT_IMPLEMENTED before anything is read.
 */
function encryptNotImplemented(name: string): Error {
  const failure = webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.NOT_IMPLEMENTED, {
    expected: "the Encrypt column to be implemented",
    actual: `field ${name} asks for handling "encrypt", which the page does not read until the Encrypt column is built`
  });
  return Object.assign(new Error(`web.dom.extract_list does not encrypt a column yet: field ${name} asks for it.`), { failure });
}

function normalizeText(text: string): string {
  return text.replace(/\s+/gu, " ").trim();
}
