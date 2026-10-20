// The page as the trace capture writes it: one synchronous pass over the
// composed tree, so the document is the page at one instant (lane T U3,
// capture method B, productionized).
//
// What is written:
// - every element and text node, attributes raw and live form state written
//   in (`element-markup-state.ts`);
// - every open shadow root as a declarative `<template shadowrootmode>`,
//   holding the root's own tree and its adopted stylesheets, before the host's
//   light children;
// - each `<style>` as the CSSOM now holds it (`read-stylesheet.ts`), and the
//   document's adopted stylesheets as `<style>` at the end of `<head>`, where
//   the cascade puts them;
// - a same-origin `about:` frame's document into its `srcdoc`.
//
// What is referred to and carried beside it (`collector`), keyed by the
// absolute address the document requests it at: each `<link>` stylesheet and
// each stylesheet an `@import` names, each image's current source, and each
// same-origin frame's document, serialized by this same pass. A reference the
// capture cannot carry -- another origin's, a `blob:` -- is counted.
//
// What is dropped: `<script>` (in any namespace), `<noscript>`, a `<link>`
// that preloads a script, every inline `on*` handler, comments, and a frame's
// `srcdoc` this pass did not write itself, which could hold a script.
//
// What may not leave the page does not: text inside a control the shared rule
// marks sensitive (`isSensitiveFormControl`) -- a sensitive textarea's text, a
// sensitive select's option labels, the words in a region marked
// `data-sensitive` -- is left out, as `textOutsideSensitiveControls` leaves it
// out of every read. `within` carries "inside such a control" down the tree.
// A sensitive element's shadow root and a frame inside one are not written:
// what they hold is that control's contents, and neither the attribute rule
// nor the text rule can see across into them.

import { isSensitiveFormControl } from "../element-traits";
import { elementMarkupState } from "./element-markup-state";
import { readStylesheet } from "./read-stylesheet";
import { isSameOriginAddress } from "./same-origin-address";
import type { TraceResourceCollector } from "./types";

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;
const HTML_NAMESPACE = "http://www.w3.org/1999/xhtml";

/** HTML elements written with no end tag. */
const VOID_ELEMENTS = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);

/** HTML elements whose text the parser reads raw: escaping it would show the escapes. */
const RAW_TEXT_ELEMENTS = new Set(["style", "xmp", "noembed", "noframes", "iframe"]);

/** HTML elements whose first newline the parser drops, so a body that starts with one is written with one more. */
const LEADING_NEWLINE_ELEMENTS = new Set(["pre", "listing", "textarea"]);

/** A `<link>`'s `as` values that fetch a script. */
const SCRIPT_DESTINATIONS = new Set(["script", "worker", "sharedworker", "serviceworker", "audioworklet", "paintworklet"]);

/** One pass over one document: the document the pass is in, and where its references go. */
type Pass = { doc: Document; collector: TraceResourceCollector };

export function serializeDocument(doc: Document, collector: TraceResourceCollector): string {
  const pass: Pass = { doc, collector };
  const doctype = doc.doctype ? doctypeMarkup(doc.doctype) : "";
  const root = doc.documentElement;
  return root ? doctype + elementMarkup(root, pass, false) : doctype;
}

function doctypeMarkup(doctype: DocumentType): string {
  if (doctype.publicId) return `<!DOCTYPE ${doctype.name} PUBLIC "${doctype.publicId}"${doctype.systemId ? ` "${doctype.systemId}"` : ""}>`;
  if (doctype.systemId) return `<!DOCTYPE ${doctype.name} SYSTEM "${doctype.systemId}">`;
  return `<!DOCTYPE ${doctype.name}>`;
}

function elementMarkup(element: Element, pass: Pass, parentWithin: boolean): string {
  const html = element.namespaceURI === HTML_NAMESPACE;
  const tag = element.localName;
  if (isDropped(element, html)) return "";
  const within = parentWithin || isSensitiveFormControl(element);
  if (html && tag === "link") referLinkedStylesheet(element as HTMLLinkElement, pass);
  if (html && tag === "img") referImage(element as HTMLImageElement, pass);
  const state = elementMarkupState(element, within);
  if (html && (tag === "iframe" || tag === "frame")) writeFrame(element as HTMLIFrameElement, state.attributes, within, pass);
  const open = `<${tag}${attributesMarkup(state.attributes)}>`;
  if (html && VOID_ELEMENTS.has(tag)) return open;
  if (html && tag === "style") return `${open}${styleText(element as HTMLStyleElement, pass)}</style>`;
  let body = "";
  const root = element.shadowRoot;
  if (root && !within) body += shadowRootMarkup(root, pass);
  if (state.content !== undefined) body += escapeText(state.content);
  else if (html && tag === "template") body += childrenMarkup((element as HTMLTemplateElement).content, pass, within, false);
  else body += childrenMarkup(element, pass, within, html && RAW_TEXT_ELEMENTS.has(tag));
  if (html && LEADING_NEWLINE_ELEMENTS.has(tag) && body.startsWith("\n")) body = `\n${body}`;
  if (element === pass.doc.head) body += adoptedStylesMarkup(pass.doc, pass);
  return `${open}${body}</${tag}>`;
}

function isDropped(element: Element, html: boolean): boolean {
  const tag = element.localName;
  if (tag === "script") return true;
  if (!html) return false;
  if (tag === "noscript") return true;
  if (tag !== "link") return false;
  const relations = (element.getAttribute("rel") ?? "").toLowerCase().split(/\s+/u);
  if (relations.includes("modulepreload")) return true;
  const fetchesAhead = relations.includes("preload") || relations.includes("prefetch");
  return fetchesAhead && SCRIPT_DESTINATIONS.has((element.getAttribute("as") ?? "").toLowerCase());
}

function childrenMarkup(parent: Node, pass: Pass, within: boolean, rawText: boolean): string {
  let out = "";
  for (const child of Array.from(parent.childNodes)) {
    if (child.nodeType === TEXT_NODE) {
      if (!within) out += rawText ? (child.nodeValue ?? "") : escapeText(child.nodeValue ?? "");
    } else if (child.nodeType === ELEMENT_NODE) {
      out += elementMarkup(child as Element, pass, within);
    }
  }
  return out;
}

function shadowRootMarkup(root: ShadowRoot, pass: Pass): string {
  let open = `<template shadowrootmode="${root.mode}"`;
  if (root.delegatesFocus) open += " shadowrootdelegatesfocus";
  if (root.clonable) open += " shadowrootclonable";
  if (root.serializable) open += " shadowrootserializable";
  return `${open}>${childrenMarkup(root, pass, false, false)}${adoptedStylesMarkup(root, pass)}</template>`;
}

/** A `<style>`'s rules as the CSSOM holds them, or its text when it has no stylesheet (a type the browser does not read). */
function styleText(element: HTMLStyleElement, pass: Pass): string {
  const read = element.sheet ? readStylesheet(element.sheet) : null;
  if (read) referImports(read.imports, pass);
  return protectStyleEnd(read ? read.text : element.textContent ?? "");
}

function adoptedStylesMarkup(owner: Document | ShadowRoot, pass: Pass): string {
  let out = "";
  for (const sheet of owner.adoptedStyleSheets ?? []) {
    const read = readStylesheet(sheet);
    if (!read) continue;
    referImports(read.imports, pass);
    out += `<style>${protectStyleEnd(read.text)}</style>`;
  }
  return out;
}

function referLinkedStylesheet(link: HTMLLinkElement, pass: Pass): void {
  const relations = (link.getAttribute("rel") ?? "").toLowerCase().split(/\s+/u);
  if (!relations.includes("stylesheet") || !link.href) return;
  refer(link.href, pass);
  const read = link.sheet ? readStylesheet(link.sheet) : null;
  if (read) referImports(read.imports, pass);
}

function referImports(addresses: readonly string[], pass: Pass): void {
  for (const address of addresses) refer(address, pass);
}

function referImage(image: HTMLImageElement, pass: Pass): void {
  const address = image.currentSrc || image.src;
  if (address) refer(address, pass);
}

/** Notes a resource to carry at its address, or counts it as one the capture cannot carry; a `data:` address is already in the document. */
function refer(address: string, pass: Pass): void {
  const { collector } = pass;
  if (/^data:/iu.test(address) || collector.references.has(address) || collector.unavailable.has(address)) return;
  if (isSameOriginAddress(address, collector.origin)) collector.references.set(address, { kind: "fetch", source: address });
  else collector.unavailable.add(address);
}

/**
 * A frame's document: written into `srcdoc` when it is an `about:` document
 * of its own, carried at the address the frame requests when it is
 * same-origin, and counted otherwise. A `srcdoc` this pass did not write is
 * dropped, because it is markup the capture has not cleaned.
 */
function writeFrame(frame: HTMLIFrameElement, attributes: Map<string, string>, within: boolean, pass: Pass): void {
  const frameDoc = within ? null : frame.contentDocument;
  const hadSrcdoc = attributes.delete("srcdoc");
  if (!frameDoc?.documentElement) {
    if (!within && frame.src && !/^about:/iu.test(frame.src)) refer(frame.src, pass);
    return;
  }
  if (/^about:/iu.test(frameDoc.URL)) {
    if (hadSrcdoc || (frameDoc.body?.childNodes.length ?? 0) > 0) attributes.set("srcdoc", serializeDocument(frameDoc, pass.collector));
    return;
  }
  const address = frame.src && /^https?:/iu.test(frame.src) ? frame.src : frameDoc.URL;
  const { collector } = pass;
  if (collector.references.has(address) || collector.unavailable.has(address)) return;
  if (!isSameOriginAddress(address, collector.origin)) {
    collector.unavailable.add(address);
    return;
  }
  // Reserved before the frame is walked, so a frame that shows its own address again is written once.
  collector.references.set(address, { kind: "inline", source: address, mediaType: "text/html; charset=utf-8", text: "" });
  collector.references.set(address, { kind: "inline", source: address, mediaType: "text/html; charset=utf-8", text: serializeDocument(frameDoc, collector) });
}

function attributesMarkup(attributes: Map<string, string>): string {
  let out = "";
  for (const [name, value] of attributes) out += value === "" ? ` ${name}` : ` ${name}="${escapeAttribute(value)}"`;
  return out;
}

function escapeText(value: string): string {
  return value.replace(/&/gu, "&amp;").replace(/</gu, "&lt;").replace(/>/gu, "&gt;").replace(/ /gu, "&nbsp;");
}

function escapeAttribute(value: string): string {
  return value.replace(/&/gu, "&amp;").replace(/"/gu, "&quot;").replace(/ /gu, "&nbsp;");
}

/** Stylesheet text cannot end its own element early: the HTML parser ends a `<style>` at the first `</style`. */
function protectStyleEnd(css: string): string {
  return css.replace(/<\/style/giu, "<\\/style");
}
