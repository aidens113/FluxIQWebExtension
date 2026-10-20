// The serialized page: raw attributes, live form state, shadow roots and
// styles written in, scripts and handlers out, sensitive contents withheld by
// the action results' rule, and every resource it refers to noted for
// carrying or counted. Built on the hand-made page in capture-stub-page.ts;
// what a real page proves -- that the capture reloads to the same page view --
// is the content harness's.

import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { asDocument, comment, h, installCaptureStubs, page, sheet, svg, unreadableSheet } from "./capture-stub-page";
import type { StubDocument, StubFrame, StubImage, StubInput, StubLink, StubOption, StubStyle, StubTemplate, StubTextArea } from "./capture-stub-page";
import type { TraceResourceCollector } from "../types";

const ORIGIN = "https://shop.test";
const URL_HERE = `${ORIGIN}/s?k=earbuds`;

async function serializer(t: TestContext) {
  installCaptureStubs(t);
  const { serializeDocument } = await import("../serialize-document");
  const { captureSettings } = await import("../../capture-settings");
  const run = (doc: StubDocument): { html: string; collector: TraceResourceCollector } => {
    const collector: TraceResourceCollector = { origin: ORIGIN, references: new Map(), unavailable: new Set() };
    return { html: serializeDocument(asDocument(doc), collector), collector };
  };
  return { run, captureSettings };
}

function input(attributes: Record<string, string>, live?: { value?: string; checked?: boolean }): StubInput {
  const control = h("input", attributes) as StubInput;
  if (live?.value !== undefined) control.value = live.value;
  if (live?.checked !== undefined) control.checked = live.checked;
  return control;
}

test("attributes are written raw and in order, handlers and scripts are dropped", async (t) => {
  const { run } = await serializer(t);
  const doc = page(URL_HERE, [
    h("script", { src: "/app.js" }, "window.boot()"),
    h("link", { rel: "modulepreload", href: "/chunk.js" }),
    h("link", { rel: "preload", as: "script", href: "/next.js" }),
    h("link", { rel: "preload", as: "font", href: "/font.woff2" })
  ], [
    h("a", { href: "/p/123", "data-state": "open", onclick: "go()", class: "card" }, "Earbuds"),
    comment("a comment"),
    h("noscript", {}, "enable script"),
    svg("svg", { viewBox: "0 0 10 10", onload: "x()" }, svg("script", {}, "evil()"), svg("path", { d: "M0 0" }))
  ]);
  doc.doctype = { name: "html", publicId: "-//W3C//DTD HTML 4.01//EN", systemId: "http://www.w3.org/TR/html4/strict.dtd" };
  const { html } = run(doc);
  assert.ok(html.startsWith('<!DOCTYPE html PUBLIC "-//W3C//DTD HTML 4.01//EN" "http://www.w3.org/TR/html4/strict.dtd"><html lang="en">'));
  assert.ok(html.includes('<a href="/p/123" data-state="open" class="card">Earbuds</a>'), html);
  assert.ok(html.includes('<link rel="preload" as="font" href="/font.woff2">'), "a preload that is not a script was dropped");
  assert.ok(html.includes('<svg viewBox="0 0 10 10"><path d="M0 0"></path></svg>'), html);
  for (const gone of ["<script", "window.boot", "modulepreload", "/next.js", "onclick", "onload", "a comment", "noscript", "evil()"]) {
    assert.ok(!html.includes(gone), `${gone} reached the capture`);
  }
});

test("text and attribute values are escaped, raw-text elements are not, and a leading newline survives", async (t) => {
  const { run } = await serializer(t);
  const area = h("textarea", {}) as StubTextArea;
  area.value = "\nfirst line";
  const { html } = run(page(URL_HERE, [], [
    h("p", { title: 'say "hi" & <go>' }, "1 < 2 & 3 > 2\u00a0!"),
    h("xmp", {}, "<b>raw</b>"),
    h("pre", {}, "\nindented"),
    area
  ]));
  assert.ok(html.includes('<p title="say &quot;hi&quot; &amp; <go>">1 &lt; 2 &amp; 3 &gt; 2&nbsp;!</p>'), html);
  assert.ok(html.includes("<xmp><b>raw</b></xmp>"), html);
  assert.ok(html.includes("<pre>\n\nindented</pre>"), html);
  assert.ok(html.includes("<textarea>\n\nfirst line</textarea>"), html);
});

test("live form state is written in place of the markup's defaults", async (t) => {
  const { run } = await serializer(t);
  const area = h("textarea", { name: "note" }, "default text") as StubTextArea;
  area.value = "typed note";
  const kept = h("option", { value: "a", selected: "" }, "A") as StubOption;
  const chosen = h("option", { value: "b" }, "B") as StubOption;
  chosen.selected = true;
  const { html } = run(page(URL_HERE, [], [
    input({ type: "search", value: "old", name: "k", placeholder: "Search" }, { value: "wireless earbuds" }),
    input({ type: "email", name: "e" }, { value: "" }),
    input({ type: "checkbox", name: "prime", checked: "" }, { checked: false }),
    input({ type: "radio", name: "sort", value: "price" }, { checked: true }),
    input({ type: "file", name: "upload", value: "C:\\fakepath\\me.png" }),
    input({ type: "hidden", name: "token", value: "page-data" }),
    input({ type: "submit", value: "Go" }),
    h("select", { name: "size" }, kept, chosen),
    area
  ]));
  assert.ok(html.includes('<input type="search" value="wireless earbuds" name="k" placeholder="Search">'), "the live value did not replace the written one in place");
  assert.ok(html.includes('<input type="email" name="e">'), "an emptied field kept a value");
  assert.ok(html.includes('<input type="checkbox" name="prime">'), "an unchecked box stayed checked");
  assert.ok(html.includes('<input type="radio" name="sort" value="price" checked>'), "a checked radio was not written checked");
  assert.ok(html.includes('<input type="file" name="upload">'), "a file input carried a file name");
  assert.ok(html.includes('<input type="hidden" name="token" value="page-data">'));
  assert.ok(html.includes('<input type="submit" value="Go">'));
  assert.ok(html.includes('<option value="a">A</option><option value="b" selected>B</option>'), html);
  assert.ok(html.includes('<textarea name="note">typed note</textarea>'), html);
});

test("what a sensitive control holds never reaches the capture", async (t) => {
  const { run } = await serializer(t);
  const secretArea = h("textarea", { "data-sensitive": "true" }, "SECRET_AREA_MARKUP") as StubTextArea;
  secretArea.value = "SECRET_AREA_LIVE";
  const expiry = h("option", { value: "SECRET_OPTION_VALUE", label: "SECRET_OPTION_LABEL" }, "SECRET_OPTION_TEXT") as StubOption;
  expiry.selected = true;
  const region = h("div", { "data-sensitive": "true", class: "region" }, "SECRET_REGION_TEXT", h("span", { "aria-valuenow": "SECRET_VALUENOW" }, "SECRET_NESTED"), input({ type: "checkbox", name: "remember" }, { checked: true }));
  const host = h("div", { "data-sensitive": "true", id: "host" });
  host.attachShadow({ mode: "open" }).append(h("span", {}, "SECRET_SHADOW"));
  const frame = h("iframe", { src: `${ORIGIN}/pay` }) as StubFrame;
  frame.contentDocument = page(`${ORIGIN}/pay`, [], ["SECRET_FRAME"]);
  const framed = h("div", { "data-sensitive": "true" }, frame);
  const { html, collector } = run(page(URL_HERE, [], [
    h("label", {}, "Password ", input({ type: "password", name: "pw", value: "SECRET_PW_ATTR" }, { value: "SECRET_PW_LIVE" })),
    input({ type: "text", name: "card", autocomplete: "cc-number" }, { value: "SECRET_CARD" }),
    input({ type: "text", name: "cvc", "aria-label": "Security code" }, { value: "SECRET_CVC" }),
    h("select", { autocomplete: "cc-exp-month" }, expiry),
    secretArea,
    region,
    host,
    framed
  ]));
  const leaked = html.match(/SECRET_[A-Z_]+/gu);
  assert.equal(leaked, null, `sensitive contents reached the capture: ${leaked?.join(", ")}`);
  assert.ok(html.includes('<label>Password <input type="password" name="pw"></label>'), "a label around a sensitive field lost its own words or its field");
  assert.ok(html.includes('<input type="checkbox" name="remember">'), "a box inside a sensitive region kept its checked state");
  assert.ok(html.includes('<div data-sensitive="true" id="host"></div>'), "a sensitive host's shadow root was written");
  assert.ok(html.includes(`<iframe src="${ORIGIN}/pay"></iframe>`));
  assert.equal(collector.references.size, 0, "a frame inside a sensitive region was carried");
});

test("with input-value capture off, typed values are withheld and the page's own values stay", async (t) => {
  const { run, captureSettings } = await serializer(t);
  const area = h("textarea", {}, "markup") as StubTextArea;
  area.value = "TYPED_AREA";
  captureSettings.inputValues = false;
  t.after(() => {
    captureSettings.inputValues = true;
  });
  const { html } = run(page(URL_HERE, [], [
    input({ type: "text", value: "TYPED_ATTR" }, { value: "TYPED_LIVE" }),
    input({ type: "submit", value: "Search" }),
    input({ type: "checkbox" }, { checked: true }),
    area
  ]));
  assert.equal(html.match(/TYPED_[A-Z]+/gu), null, html);
  assert.ok(html.includes('<input type="submit" value="Search">'));
  assert.ok(html.includes('<input type="checkbox" checked>'), "a checked state is not a typed value");
  assert.ok(html.includes("<textarea></textarea>"));
});

test("open shadow roots become declarative templates, and a template's content is cleaned", async (t) => {
  const { run } = await serializer(t);
  const host = h("consent-wall", { mode: "strict" }, h("span", { slot: "title" }, "Light"));
  const root = host.attachShadow({ mode: "open", delegatesFocus: true });
  root.serializable = true;
  root.adoptedStyleSheets = [sheet([":host { display: block; }"])];
  root.append(h("button", { onclick: "accept()" }, "Accept"), h("slot", { name: "title" }));
  const closed = h("closed-thing", {});
  closed.attachShadow({ mode: "closed" }).append("hidden from the page");
  const template = h("template", { id: "row" }) as StubTemplate;
  template.content.append(h("li", { onmouseover: "x()" }, "Row"), h("script", {}, "evil()"));
  const { html } = run(page(URL_HERE, [], [host, closed, template]));
  assert.ok(html.includes('<consent-wall mode="strict"><template shadowrootmode="open" shadowrootdelegatesfocus shadowrootserializable><button>Accept</button><slot name="title"></slot><style>:host { display: block; }</style></template><span slot="title">Light</span></consent-wall>'), html);
  assert.ok(html.includes("<closed-thing></closed-thing>"));
  assert.ok(html.includes('<template id="row"><li>Row</li></template>'), html);
});

test("styles are written as the CSSOM holds them, and stylesheets are referred to or counted", async (t) => {
  const { run } = await serializer(t);
  const style = h("style", { media: "screen", nonce: "abc" }, "body{color:red}") as StubStyle;
  style.sheet = sheet(["body { color: blue; }", '.x::after { content: "</style>"; }'], null, [sheet([], `${ORIGIN}/base.css`)]);
  const link = h("link", { rel: "stylesheet", href: "/app.css" }) as StubLink;
  link.href = `${ORIGIN}/app.css`;
  link.sheet = sheet(["a { color: green; }"], link.href, [sheet([], `${ORIGIN}/theme.css`, [sheet([], `${ORIGIN}/deep.css`)])]);
  const foreign = h("link", { rel: "stylesheet", href: "https://cdn.test/lib.css" }) as StubLink;
  foreign.href = "https://cdn.test/lib.css";
  foreign.sheet = unreadableSheet(foreign.href);
  const icon = h("link", { rel: "icon", href: "/favicon.ico" }) as StubLink;
  icon.href = `${ORIGIN}/favicon.ico`;
  const doc = page(URL_HERE, [h("title", {}, "Shop"), style, link, foreign, icon], []);
  doc.adoptedStyleSheets = [sheet([".adopted { margin: 0; }"])];
  const { html, collector } = run(doc);
  assert.ok(html.includes(`<style media="screen" nonce="abc">@import url("${ORIGIN}/base.css");\nbody { color: blue; }\n.x::after { content: "<\\/style>"; }</style>`), html);
  assert.ok(html.includes('<link rel="stylesheet" href="/app.css">'), "a linked stylesheet's element is not kept raw");
  assert.ok(html.endsWith("<style>.adopted { margin: 0; }</style></head><body></body></html>"), "adopted stylesheets are not last in the head");
  assert.deepEqual([...collector.references.keys()], [`${ORIGIN}/base.css`, `${ORIGIN}/app.css`, `${ORIGIN}/theme.css`, `${ORIGIN}/deep.css`]);
  assert.deepEqual([...collector.unavailable], ["https://cdn.test/lib.css"]);
});

test("a stylesheet that fails for another reason than being unreadable is not taken for one", async (t) => {
  const { run } = await serializer(t);
  const style = h("style", {}) as StubStyle;
  style.sheet = unreadableSheet(`${ORIGIN}/x.css`, "NotSupportedError");
  assert.throws(() => run(page(URL_HERE, [style], [])), { name: "NotSupportedError" });
});

test("images are referred to by their current source, once; data images stay in the document", async (t) => {
  const { run } = await serializer(t);
  const image = (attributes: Record<string, string>, currentSrc: string): StubImage => {
    const element = h("img", attributes) as StubImage;
    element.currentSrc = currentSrc;
    element.src = currentSrc;
    return element;
  };
  const { html, collector } = run(page(URL_HERE, [], [
    image({ src: "/i/1.jpg", srcset: "/i/1@2x.jpg 2x" }, `${ORIGIN}/i/1@2x.jpg`),
    image({ src: "/i/1.jpg", srcset: "/i/1@2x.jpg 2x" }, `${ORIGIN}/i/1@2x.jpg`),
    image({ src: "data:image/gif;base64,R0lGOD" }, "data:image/gif;base64,R0lGOD"),
    image({ src: "https://img.cdn.test/2.jpg" }, "https://img.cdn.test/2.jpg"),
    image({ src: "blob:https://shop.test/abc" }, "blob:https://shop.test/abc"),
    image({ alt: "no source" }, "")
  ]));
  assert.ok(html.includes('<img src="/i/1.jpg" srcset="/i/1@2x.jpg 2x">'), "an image's raw source was rewritten");
  assert.deepEqual([...collector.references.values()], [{ kind: "fetch", source: `${ORIGIN}/i/1@2x.jpg` }]);
  assert.deepEqual([...collector.unavailable].sort(), ["blob:https://shop.test/abc", "https://img.cdn.test/2.jpg"]);
});

test("frames: same-origin documents are carried serialized, about: documents go into srcdoc, others are counted", async (t) => {
  const { run } = await serializer(t);
  const child = h("iframe", { src: "/widget" }) as StubFrame;
  child.src = `${ORIGIN}/widget`;
  const childImage = h("img", { src: "logo.png" }) as StubImage;
  childImage.currentSrc = `${ORIGIN}/w/logo.png`;
  child.contentDocument = page(`${ORIGIN}/widget`, [h("script", {}, "w()")], [h("p", { onclick: "y()" }, "Widget"), childImage]);
  const blank = h("iframe", {}) as StubFrame;
  blank.contentDocument = page("about:blank", [], [h("b", {}, "written by script")]);
  const empty = h("iframe", { name: "empty" }) as StubFrame;
  empty.contentDocument = page("about:blank", [], []);
  const foreign = h("iframe", { src: "https://ads.test/slot", srcdoc: "<script>bad()</script>" }) as StubFrame;
  foreign.src = "https://ads.test/slot";
  const { html, collector } = run(page(URL_HERE, [], [child, blank, empty, foreign]));
  assert.ok(html.includes('<iframe src="/widget"></iframe>'));
  assert.ok(html.includes('<iframe srcdoc="<!DOCTYPE html><html lang=&quot;en&quot;><head></head><body><b>written by script</b></body></html>"></iframe>'), html);
  assert.ok(html.includes('<iframe name="empty"></iframe>'), "an empty about:blank frame gained a srcdoc");
  assert.ok(html.includes('<iframe src="https://ads.test/slot"></iframe>'), "a srcdoc the capture did not write survived");
  const widget = collector.references.get(`${ORIGIN}/widget`);
  assert.equal(widget?.kind, "inline");
  assert.ok(widget?.kind === "inline" && widget.text.includes('<p>Widget</p><img src="logo.png">') && !widget.text.includes("w()"), "the frame document was not serialized by the same rules");
  assert.ok(collector.references.has(`${ORIGIN}/w/logo.png`), "the frame's own image was not referred to");
  assert.deepEqual([...collector.unavailable], ["https://ads.test/slot"]);
});
