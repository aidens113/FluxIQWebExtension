import assert from "node:assert/strict";
import test from "node:test";
import { ownedUiHosts } from "..";
import { fakeShadowDom } from "../../extraction/tests/fake-shadow-dom";

test("only the exact registered closed host gains private ownership, never markers or copied markup", () => {
  const dom = fakeShadowDom();
  const attributes = { "data-fluxiq-activity": "" };
  const host = dom.el("fluxiq-activity-overlay", attributes);
  const copy = dom.el("fluxiq-activity-overlay", attributes);
  assert.equal(ownedUiHosts.ownsHost(host), false);
  ownedUiHosts.registerClosed(host, { host, mode: "closed" });
  assert.equal(ownedUiHosts.ownsHost(host), true);
  assert.equal(ownedUiHosts.ownsHost(copy), false);
  assert.equal(ownedUiHosts.ownsHost(dom.el("div", { "data-fluxiq-picker": "" })), false);
});

test("open roots and closed roots belonging to another host cannot register ownership", () => {
  const dom = fakeShadowDom();
  const open = dom.el("fluxiq-activity-overlay");
  ownedUiHosts.registerClosed(open, { host: open, mode: "open" });
  assert.equal(ownedUiHosts.ownsHost(open), false);
  const wrong = dom.el("fluxiq-activity-overlay");
  const other = dom.el("fluxiq-activity-overlay");
  ownedUiHosts.registerClosed(wrong, { host: other, mode: "closed" });
  assert.equal(ownedUiHosts.ownsHost(wrong), false);
  assert.equal(ownedUiHosts.ownsHost(other), false);
});

test("a registered host carrying any light DOM is refused, including transient text or element content", () => {
  const dom = fakeShadowDom();
  const host = dom.el("fluxiq-activity-overlay", {}, " ");
  ownedUiHosts.registerClosed(host, { host, mode: "closed" });
  assert.equal(ownedUiHosts.ownsHost(host), false, "even whitespace is page light DOM");
  host.replaceChildren();
  assert.equal(ownedUiHosts.ownsHost(host), true);
  const child = dom.el("span", {}, "page content");
  host.append(child);
  assert.equal(ownedUiHosts.ownsHost(host), false);
  assert.equal(ownedUiHosts.ownsHost(child), false, "ownership does not spread to descendants");
  host.replaceChildren();
  assert.equal(ownedUiHosts.ownsHost(host), true);
});
