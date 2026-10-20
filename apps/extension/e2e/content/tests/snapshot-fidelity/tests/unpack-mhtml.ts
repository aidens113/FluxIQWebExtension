// Unpacks an MHTML archive from `Page.captureSnapshot` into the document the
// offline sandbox serves (offline-capture.ts).
//
// Why not load the archive itself: Chromium loads an MHTML document with
// script disabled for the whole document, and there it refuses every callback
// of an injected script too -- a TreeWalker filter, a timer, a listener --
// whether the script runs in the main world or in a CDP isolated world. The
// content script starts, answers a synchronous capture, and then never answers
// a read that waits on anything (observed: "Blocked script execution", and
// `Runtime.evaluate` reporting the reply's promise collected).
//
// So the archive is served as what it holds: its HTML part at the snapshot's
// own URL, and every other part from the archive. Two rewrites, both loader
// work rather than page changes: a part Blink addressed as `cid:` (inlined
// stylesheets, and frames by their Content-ID) gets a same-origin path the
// route can answer, and
// Blink's `<template shadowmode>` becomes `shadowrootmode`, the attribute the
// HTML parser builds a declarative shadow root from.

import type { CapturedDocument } from "./offline-capture.js";

const CID_PATH = "/__fluxiq-capture/cid/";

type Part = { headers: Map<string, string>; body: Buffer };

export function unpackMhtml(archive: string): CapturedDocument & { parts: number; shadowTemplates: number } {
  const boundary = /boundary="([^"]+)"/u.exec(archive)?.[1];
  const location = /^Snapshot-Content-Location:\s*(\S+)/mu.exec(archive)?.[1];
  if (!boundary || !location) throw new Error("The MHTML archive names no boundary or no snapshot location.");
  const origin = new URL(location).origin;
  const parts = archive.split(`--${boundary}`).slice(1).filter((chunk) => !chunk.startsWith("--")).map(parsePart);
  const cidUrl = (cid: string): string => `${origin}${CID_PATH}${encodeURIComponent(cid)}`;
  const rewrite = (text: string): string => text.replace(/cid:([^"'()\s>]+)/gu, (_whole, cid: string) => cidUrl(cid));

  const main = parts.find((part) => /^text\/html/iu.test(part.headers.get("content-type") ?? ""));
  if (!main) throw new Error("The MHTML archive has no text/html part.");
  const decoded = main.body.toString("utf8");
  const shadowTemplates = (decoded.match(/<template\s+shadowmode=/giu) ?? []).length;
  const html = rewrite(decoded).replace(/<template(\s+)shadowmode=/giu, "<template$1shadowrootmode=");

  const resources = new Map<string, { contentType: string; body: Buffer }>();
  for (const part of parts) {
    if (part === main) continue;
    const contentType = part.headers.get("content-type") ?? "application/octet-stream";
    const textual = /^text\//iu.test(contentType);
    const decodedPart = textual ? part.body.toString("utf8") : "";
    const body = textual ? Buffer.from(/^text\/html/iu.test(contentType) ? rewrite(decodedPart).replace(/<template(\s+)shadowmode=/giu, "<template$1shadowrootmode=") : rewrite(decodedPart), "utf8") : part.body;
    // A part is addressed by its Content-Location, and a frame also by its
    // Content-ID, which is how the HTML refers to it (`src="cid:frame-..."`).
    const contentLocation = part.headers.get("content-location");
    const contentId = /^<([^>]+)>$/u.exec(part.headers.get("content-id") ?? "")?.[1];
    if (contentLocation) resources.set(contentLocation.startsWith("cid:") ? cidUrl(contentLocation.slice(4)) : contentLocation, { contentType, body });
    if (contentId) resources.set(cidUrl(contentId), { contentType, body });
  }
  return { url: location, html, resources, parts: parts.length, shadowTemplates };
}

function parsePart(chunk: string): Part {
  const text = chunk.replace(/^\r?\n/u, "");
  const split = text.search(/\r?\n\r?\n/u);
  const head = split < 0 ? text : text.slice(0, split);
  const rest = split < 0 ? "" : text.slice(split).replace(/^\r?\n\r?\n/u, "");
  const headers = new Map<string, string>();
  for (const line of head.replace(/\r?\n[ \t]+/gu, " ").split(/\r?\n/u)) {
    const colon = line.indexOf(":");
    if (colon > 0) headers.set(line.slice(0, colon).trim().toLowerCase(), line.slice(colon + 1).trim());
  }
  const encoding = (headers.get("content-transfer-encoding") ?? "binary").toLowerCase();
  const raw = rest.replace(/\r?\n$/u, "");
  let body: Buffer;
  if (encoding === "base64") body = Buffer.from(raw.replace(/\s+/gu, ""), "base64");
  else if (encoding === "quoted-printable") body = decodeQuotedPrintable(raw);
  else body = Buffer.from(raw, "latin1");
  return { headers, body };
}

function decodeQuotedPrintable(text: string): Buffer {
  const joined = text.replace(/=\r?\n/gu, "");
  const bytes: number[] = [];
  for (let index = 0; index < joined.length; index += 1) {
    const char = joined[index]!;
    const hex = joined.slice(index + 1, index + 3);
    if (char === "=" && /^[0-9A-F]{2}$/iu.test(hex)) {
      bytes.push(Number.parseInt(hex, 16));
      index += 2;
    } else {
      bytes.push(joined.charCodeAt(index) & 0xff);
    }
  }
  return Buffer.from(bytes);
}
