import assert from "node:assert/strict";
import test from "node:test";
import type { BrowserContext } from "@playwright/test";
import {
  FluxIQPanelVerificationError,
  automationStudioFlowTreeItemId,
  buildFluxIQPanelVerificationUrl,
  fluxIQSessionCookieDescriptor,
  verifyAuthenticatedFluxIQPanel,
} from "../panel-verification.js";

test("builds an exact encoded Automation Studio runtime URL", () => {
  assert.equal(
    buildFluxIQPanelVerificationUrl({
      origin: "https://fluxiq.fixture.test/",
      projectId: "project / one",
      flowId: "flow?one",
      runId: "run#one",
    }),
    "https://fluxiq.fixture.test/programs/automation-studio?project=project+%2F+one&flow=flow%3Fone&view=runtime-debug&detail=run%3Arun%23one",
  );
  assert.throws(() => buildFluxIQPanelVerificationUrl({ origin: "https://fluxiq.fixture.test/path", projectId: "p", flowId: "f" }), /exact HTTP/);
});

test("derives the current stable Automation Studio root-Flow tree key", () => {
  assert.equal(automationStudioFlowTreeItemId("a"), "flow-2p");
  assert.equal(automationStudioFlowTreeItemId("flow.one"), automationStudioFlowTreeItemId("flow.one"));
  assert.notEqual(automationStudioFlowTreeItemId("flow.one"), automationStudioFlowTreeItemId("flow.two"));
});

test("creates one origin-scoped HttpOnly Lax cookie descriptor", () => {
  assert.deepEqual(fluxIQSessionCookieDescriptor("https://fluxiq.fixture.test", "opaque-value"), {
    name: "fluxiq_session",
    value: "opaque-value",
    url: "https://fluxiq.fixture.test",
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
  });
  assert.equal(fluxIQSessionCookieDescriptor("http://127.0.0.1:3000", "opaque").secure, false);
  assert.throws(() => fluxIQSessionCookieDescriptor("https://fluxiq.fixture.test", "bad;cookie"), /parsed FluxIQ session/);
});

test("verifies rendered project and exact selected Flow without returning the cookie", async () => {
  const fixture = mockedPanel();
  const result = await verifyAuthenticatedFluxIQPanel({
    context: fixture.context,
    origin: "https://fluxiq.fixture.test",
    sessionCookieValue: "private-cookie-value",
    projectId: "project.one",
    flowId: "flow.one",
    timeoutMs: 200,
  });
  assert.equal(result.status, "verified");
  assert.deepEqual(result.run, { status: "not-requested" });
  assert.equal(fixture.cookies.length, 1);
  assert.equal(fixture.visited[0], result.panelUrl);
  assert.equal(JSON.stringify(result).includes("private-cookie-value"), false);
});

test("reports limited run verification when the current UI cannot select the requested run", async () => {
  const fixture = mockedPanel({ runUnavailable: true });
  const result = await verifyAuthenticatedFluxIQPanel({
    context: fixture.context,
    origin: "https://fluxiq.fixture.test",
    sessionCookieValue: "private-cookie-value",
    projectId: "project.one",
    flowId: "flow.one",
    runId: "run.not-visible",
    timeoutMs: 200,
  });
  assert.equal(result.status, "limited");
  assert.deepEqual(result.run, {
    runId: "run.not-visible",
    status: "limited",
    limitation: "run-detail-deep-link-not-authoritative-and-run-row-not-selectable",
  });
});

test("sanitizes browser failures instead of exposing cookie material", async () => {
  const context = {
    addCookies: async () => { throw new Error("private-cookie-value"); },
  } as unknown as BrowserContext;
  await assert.rejects(
    verifyAuthenticatedFluxIQPanel({ context, origin: "https://fluxiq.fixture.test", sessionCookieValue: "private-cookie-value", projectId: "p", flowId: "f" }),
    (error: unknown) => error instanceof FluxIQPanelVerificationError && error.phase === "cookie" && !error.message.includes("private-cookie-value"),
  );
});

function mockedPanel(options: { runUnavailable?: boolean } = {}) {
  const cookies: unknown[] = [];
  const visited: string[] = [];
  class MockLocator {
    constructor(readonly kind: string) {}
    async waitFor() { if (options.runUnavailable && ["run-search", "run-row"].includes(this.kind)) throw new Error("not visible"); }
    async isVisible() { return this.kind !== "action-log" && !(options.runUnavailable && ["run-search", "run-row"].includes(this.kind)); }
    async getAttribute(name: string) { return name === "aria-selected" && this.kind === "flow" ? "true" : null; }
    async click() {}
    async fill() {}
    filter() { return new MockLocator("run-row"); }
    getByText() { return new MockLocator(options.runUnavailable ? "missing-run" : "run-text"); }
  }
  const page = {
    async goto(url: string) { visited.push(url); },
    locator(selector: string) {
      if (selector.includes("data-tree-item-id")) return new MockLocator("flow");
      if (selector.includes("automation-runtime-log-page")) return new MockLocator("action-log");
      if (selector.includes("automation-runtime-run-row")) return new MockLocator("run-row");
      return new MockLocator("visible");
    },
    getByRole(role: string, input?: { name?: string }) {
      if (role === "textbox" && input?.name === "Find a run") return new MockLocator("run-search");
      return new MockLocator("visible");
    },
  };
  const context = {
    async addCookies(value: unknown[]) { cookies.push(...value); },
    async newPage() { return page; },
  } as unknown as BrowserContext;
  return { context, cookies, visited };
}
