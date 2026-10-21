import assert from "node:assert/strict";
import test from "node:test";
import type { WebPageSnapshot, WebPageSnapshotPart } from "@fluxiq-web-extension/domain/node";
import { snapshotRoutes } from "../routes.js";

const encoder = new TextEncoder();
const part = (role: "primary" | "resource", source: string | null, mediaType: string, text: string): WebPageSnapshotPart => ({
  sha256: `sha-${text.length}`, mediaType, role, source, bytes: encoder.encode(text)
});
const SNAPSHOT: WebPageSnapshot = {
  url: "http://127.0.0.1:4100/scenarios/site/list#top",
  primary: part("primary", "http://127.0.0.1:4100/scenarios/site/list", "text/html", "<html><body><p>doc</p></body></html>"),
  resources: [
    part("resource", "http://127.0.0.1:4100/static/site.css", "text/css", "p{}"),
    part("resource", "http://127.0.0.1:4100/frames/inner", "text/html; charset=utf-8", "<p>frame</p>"),
    part("resource", null, "image/png", "nameless")
  ],
  unavailable: 1
};

test("the primary is served once, at the snapshot's address with its fragment dropped, with page scripts off", () => {
  const routes = snapshotRoutes(SNAPSHOT, (html) => `${html}<!--armed-->`);
  assert.equal(routes.status, "ready");
  if (routes.status !== "ready") return;
  const first = routes.answer({ url: "http://127.0.0.1:4100/scenarios/site/list", navigation: true });
  assert.equal(first.kind, "served");
  if (first.kind !== "served") return;
  assert.equal(first.headers["content-security-policy"], "script-src 'none'");
  assert.match(first.headers["content-type"] ?? "", /^text\/html/u);
  assert.equal(Buffer.from(first.body).toString("utf8"), "<html><body><p>doc</p></body></html><!--armed-->");
  // A second navigation to the page would replace the document read so far: it is held, as any other is.
  assert.deepEqual(routes.answer({ url: "http://127.0.0.1:4100/scenarios/site/list", navigation: true }), { kind: "held" });
});

test("a resource is served at its source with its own media type; an HTML one with page scripts off", () => {
  const routes = snapshotRoutes(SNAPSHOT, (html) => html);
  assert.equal(routes.status, "ready");
  if (routes.status !== "ready") return;
  const css = routes.answer({ url: "http://127.0.0.1:4100/static/site.css", navigation: false });
  assert.equal(css.kind, "served");
  if (css.kind === "served") {
    assert.deepEqual(css.headers, { "content-type": "text/css" });
    assert.equal(Buffer.from(css.body).toString("utf8"), "p{}");
  }
  const frame = routes.answer({ url: "http://127.0.0.1:4100/frames/inner", navigation: true });
  assert.equal(frame.kind, "served");
  if (frame.kind === "served") assert.equal(frame.headers["content-security-policy"], "script-src 'none'");
});

test("a navigation the snapshot cannot answer is held; any other request is refused", () => {
  const routes = snapshotRoutes(SNAPSHOT, (html) => html);
  assert.equal(routes.status, "ready");
  if (routes.status !== "ready") return;
  assert.deepEqual(routes.answer({ url: "http://127.0.0.1:4100/scenarios/site/list?page=2", navigation: true }), { kind: "held" });
  assert.deepEqual(routes.answer({ url: "http://127.0.0.1:4100/api/feed?after=5", navigation: false }), { kind: "refused" });
  // A part that named no source cannot be asked for, so nothing is served for it.
  assert.deepEqual(routes.answer({ url: "null", navigation: false }), { kind: "refused" });
});

test("a primary that is not a document cannot be loaded", () => {
  const routes = snapshotRoutes({ ...SNAPSHOT, primary: { ...SNAPSHOT.primary, mediaType: "image/png" } }, (html) => html);
  assert.equal(routes.status, "unavailable");
  if (routes.status === "unavailable") assert.match(routes.detail, /image\/png/u);
});
