import assert from "node:assert/strict";
import test from "node:test";
import { RUNTIME_MESSAGES } from "../../../shared/constants";
import { fake, withFakeDocument } from "../../chat/tests/fake-dom";
import type { PanelContext } from "../../shell";
import { PROBLEM_REPORT_COPIED, PROBLEM_REPORT_SAVE_ONLY } from "../problem-report-plan";
import { createProblemReportSection } from "../problem-report-section";

const report = { schema: "fluxiq.problem-report/1", createdAt: "2026-10-01T00:00:00Z", withheld: ["synthetic fixture"] };
const success = { ok: true, value: { report } } as const;
const context = (request: unknown) => ({ surface: "sidepanel", store: { request } }) as PanelContext;
async function flush() { for (let i = 0; i < 12; i++) await Promise.resolve(); }
function deferred() { let resolve!: () => void; return { promise: new Promise<void>((yes) => { resolve = yes; }), resolve }; }
function controls(request: unknown) {
  const root = fake(createProblemReportSection(context(request)));
  return { button: root.children[2]!.children[0]!, save: root.children[2]!.children[1]!, line: root.children[3]! };
}
async function withClipboard(writeText: ((text: string) => Promise<void>) | undefined, run: () => Promise<void>) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: writeText ? { clipboard: { writeText } } : {} });
  try { await withFakeDocument(run); }
  finally { if (descriptor) Object.defineProperty(globalThis, "navigator", descriptor); else Reflect.deleteProperty(globalThis, "navigator"); }
}

test("report button stays locked through clipboard acknowledgement", async () => {
  const copied = deferred(); let calls = 0; const messages: unknown[] = [];
  await withClipboard(() => copied.promise, async () => {
    const view = controls(async (message: unknown) => { calls++; messages.push(message); return success; });
    view.button.dispatch("click"); await flush();
    assert.equal(view.button.disabled, true);
    view.button.dispatch("click"); await flush(); assert.equal(calls, 1);
    copied.resolve(); await flush(); assert.equal(view.button.disabled, false); assert.equal(view.line.textContent, PROBLEM_REPORT_COPIED);
    assert.deepEqual(messages, [{ type: RUNTIME_MESSAGES.panelReportProblem }]);
  });
});

test("a new request hides the old download while preserving successful copy text", async () => {
  let calls = 0; const pending = deferred();
  await withClipboard(async () => {}, async () => {
    const view = controls(async () => { if (++calls === 2) await pending.promise; return success; });
    view.button.dispatch("click"); await flush(); assert.equal(view.save.hidden, false);
    view.button.dispatch("click"); assert.equal(view.save.hidden, true); assert.equal(view.line.hidden, true);
    pending.resolve(); await flush(); assert.equal(view.save.hidden, false); assert.equal(view.line.textContent, PROBLEM_REPORT_COPIED);
  });
});

test("copy rejection keeps the current download and makes retry usable", async () => {
  await withClipboard(async () => { throw new Error("synthetic-private-error"); }, async () => {
    const view = controls(async () => success); view.button.dispatch("click"); await flush();
    assert.equal(view.save.hidden, false); assert.equal(view.line.textContent, PROBLEM_REPORT_SAVE_ONLY);
    assert.equal(view.button.disabled, false); assert.equal(view.line.hidden, false);
  });
});

test("missing clipboard API keeps the report download", async () => {
  await withClipboard(undefined, async () => {
    const view = controls(async () => success); view.button.dispatch("click"); await flush();
    assert.equal(view.save.hidden, false); assert.equal(view.line.textContent, PROBLEM_REPORT_SAVE_ONLY); assert.equal(view.button.disabled, false);
  });
});

test("download creation failure still attempts and reports a successful copy", async () => {
  const original = URL.createObjectURL; let copies = 0;
  URL.createObjectURL = () => { throw new Error("synthetic-private-error"); };
  try {
    await withClipboard(async () => { copies++; }, async () => {
      const view = controls(async () => success); view.button.dispatch("click"); await flush();
      assert.equal(copies, 1); assert.equal(view.save.hidden, true); assert.equal(view.line.textContent, PROBLEM_REPORT_COPIED); assert.equal(view.button.disabled, false);
    });
  } finally { URL.createObjectURL = original; }
});

test("failure of both browser delivery methods gives fixed recovery feedback", async () => {
  const original = URL.createObjectURL; URL.createObjectURL = () => { throw new Error("synthetic-private-error"); };
  try {
    await withClipboard(undefined, async () => {
      const view = controls(async () => success); view.button.dispatch("click"); await flush();
      assert.equal(view.save.hidden, true); assert.equal(view.button.disabled, false); assert.equal(view.line.hidden, false);
      assert.match(view.line.textContent, /couldn't copy or prepare/i); assert.equal(view.line.textContent.includes("synthetic-private-error"), false);
    });
  } finally { URL.createObjectURL = original; }
});

test("background refusal preserves its sentence and detail", async () => {
  await withClipboard(async () => {}, async () => {
    const view = controls(async () => ({ ok: false, sentence: "Synthetic refused", detail: "Synthetic reason" }));
    view.button.dispatch("click"); await flush(); assert.equal(view.line.textContent, "Synthetic refused (Synthetic reason)");
    assert.equal(view.save.hidden, true); assert.equal(view.button.disabled, false);
  });
});

test("defensive request rejection never displays exception content", async () => {
  await withClipboard(async () => {}, async () => {
    const view = controls(async () => { throw new Error("synthetic-private-error"); }); view.button.dispatch("click"); await flush();
    assert.equal(view.button.disabled, false); assert.equal(view.line.hidden, false); assert.match(view.line.textContent, /try again/i);
    assert.equal(view.line.textContent.includes("synthetic-private-error"), false);
  });
});

test("successful replacement revokes only its previous owned download", async () => {
  const create = URL.createObjectURL, revoke = URL.revokeObjectURL; const revoked: string[] = []; let created = 0;
  URL.createObjectURL = () => `blob:synthetic-${++created}`; URL.revokeObjectURL = (url) => { revoked.push(url); };
  try {
    await withClipboard(async () => {}, async () => {
      const view = controls(async () => success); view.button.dispatch("click"); await flush(); view.button.dispatch("click"); await flush();
      assert.deepEqual(revoked, ["blob:synthetic-1"]); assert.equal(created, 2); assert.equal(view.save.hidden, false);
    });
  } finally { URL.createObjectURL = create; URL.revokeObjectURL = revoke; }
});
