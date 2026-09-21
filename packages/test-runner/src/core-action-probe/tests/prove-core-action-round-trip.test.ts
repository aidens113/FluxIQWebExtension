import assert from "node:assert/strict";
import test from "node:test";
import type { RunActionTiming } from "@fluxiq-web-extension/test-contracts";
import { RunnerFailure } from "../../failure.js";
import { proveCoreActionRoundTrip, type CoreActionProbeInput, type CoreProbeMark, type CoreProbePage } from "../prove-core-action-round-trip.js";

/**
 * The probe used to type into a start-page field in a fresh tab, and lost the
 * race with the sites' load-timed overlays (E1 lane C, L1). It now reads a mark
 * it planted, so these pin both halves of what that has to mean: an overlay has
 * nothing to refuse, and a broken gateway, extension or content script, or a
 * read of any other document, still fails.
 */

/** The start page: its root element's attributes, set and removed by the probe's own in-page function. */
function startPage(options: { removalFails?: boolean } = {}) {
  const attributes = new Map<string, string>();
  const marks: CoreProbeMark[] = [];
  const page: CoreProbePage = {
    evaluate: async (pageFunction, mark) => {
      marks.push(mark);
      if (options.removalFails && mark.value === null) throw new Error("page.evaluate: Execution context was destroyed");
      const documentElement = { setAttribute: (name: string, value: string) => { attributes.set(name, value); }, removeAttribute: (name: string) => { attributes.delete(name); } };
      Object.defineProperty(globalThis, "document", { value: { documentElement }, configurable: true });
      try { pageFunction(mark); } finally { Reflect.deleteProperty(globalThis, "document"); }
    },
  };
  return { page, attributes, marks };
}

type Command = { actionType: string; parameters: { selector: string; extract: { mode: string; attribute: string } }; metadata: { correlationId: string } };
type Dispatch = { sessionId: string; command: Command; authorizationPin: string };

/** Core answering as the production bridge does, `{ ok, payload: { result } }`, with the page's reply in the result's `payload`. */
function core(answer: (command: Command) => unknown) {
  const dispatched: Dispatch[] = [];
  return {
    dispatched,
    control: {
      executeClientAction: async (sessionId: string, command: Record<string, unknown>, authorizationPin: string) => {
        dispatched.push({ sessionId, command: command as Command, authorizationPin });
        return answer(command as Command);
      },
    },
  };
}
const succeeded = (extracted: unknown) => ({ ok: true, payload: { result: { commandId: "command.1", status: "succeeded", payload: extracted === undefined ? {} : { extracted } } } });
/** A content script reading the live start page, as `web.dom.extract` in attribute mode does. */
const readingThe = (attributes: Map<string, string>) => (command: Command) => succeeded(attributes.get(command.parameters.extract.attribute) ?? "");

function probe(page: CoreProbePage, control: CoreActionProbeInput["control"]) {
  const published: { trigger: string; summary: string; details: Record<string, unknown> }[] = [];
  const recorded: { timing: RunActionTiming; result: unknown }[] = [];
  const input: CoreActionProbeInput = {
    page, control, sessionId: "session.one", authorizationPin: "pin",
    publish: async (trigger, summary, details) => { published.push({ trigger, summary, details }); },
    record: (timing, result) => { recorded.push({ timing, result }); },
  };
  return { input, published, recorded };
}

async function rejection(promise: Promise<unknown>): Promise<RunnerFailure> {
  const error = await promise.then(() => undefined, (cause: unknown) => cause);
  assert.ok(error instanceof RunnerFailure, `expected a RunnerFailure, got ${String(error)}`);
  return error;
}

test("the probe passes when Core's read, through the gateway, returns the mark it planted on the start page", async () => {
  const start = startPage();
  const gateway = core(readingThe(start.attributes));
  const run = probe(start.page, gateway.control);
  await proveCoreActionRoundTrip(run.input);

  // One command, and it is a read: nothing on the page is pressed, typed into or navigated.
  assert.equal(gateway.dispatched.length, 1);
  const [dispatch] = gateway.dispatched;
  assert.deepEqual({ sessionId: dispatch?.sessionId, pin: dispatch?.authorizationPin, actionType: dispatch?.command.actionType, parameters: dispatch?.command.parameters },
    { sessionId: "session.one", pin: "pin", actionType: "web.dom.extract", parameters: { selector: "html", extract: { mode: "attribute", attribute: "data-fluxiq-core-probe" } } });
  // The mark is random, set before the read and removed after it, so the recording starts on an unmarked page.
  const [planted, removed] = start.marks;
  assert.match(planted?.value ?? "", /^[0-9a-f]{24}$/u);
  assert.deepEqual(removed, { attribute: "data-fluxiq-core-probe", value: null });
  assert.equal(start.attributes.size, 0);
  assert.deepEqual(run.recorded.map((entry) => [entry.timing.actionType, entry.timing.status]), [["web.dom.extract", "succeeded"]]);
  assert.deepEqual(run.published.map((event) => event.summary), ["Dispatch Core action through the production gateway", "Core action read the mark planted on the start page"]);
  assert.equal(JSON.stringify(run.published).includes(planted?.value ?? "-"), false, "the mark is not published");
});

test("a gateway that does not know the session fails the probe, and the page is left unmarked", async () => {
  const start = startPage();
  const refused = new RunnerFailure("action.dispatch", "FluxIQ control request failed: /api/programs/automation-studio/execute-client-action (400): Unknown client gateway session: session.one");
  const gateway = core(() => { throw refused; });
  const run = probe(start.page, gateway.control);
  assert.equal(await rejection(proveCoreActionRoundTrip(run.input)), refused);
  assert.deepEqual(run.recorded, [], "no result came back, so no action is recorded");
  assert.equal(start.attributes.size, 0);
});

test("a failed result fails as action.dispatch with Core's message, after the action is recorded", async () => {
  const start = startPage();
  const gateway = core(() => ({ ok: true, payload: { result: { commandId: "command.1", status: "failed", message: "The content script did not answer" } } }));
  const run = probe(start.page, gateway.control);
  const failure = await rejection(proveCoreActionRoundTrip(run.input));
  assert.equal(failure.category, "action.dispatch");
  assert.equal(failure.message, "Core action did not succeed: failed: The content script did not answer");
  assert.deepEqual(run.recorded.map((entry) => entry.timing.status), ["failed"]);
  assert.equal(run.published.at(-1)?.summary, "Core action returned a failed result");
  assert.equal(start.attributes.size, 0);
});

test("an answer that carries no result at all fails as action.dispatch", async () => {
  const start = startPage();
  const run = probe(start.page, core(() => ({ ok: true, payload: {} })).control);
  const failure = await rejection(proveCoreActionRoundTrip(run.input));
  assert.equal(failure.category, "action.dispatch");
  assert.match(failure.message, /missing result/u);
  assert.deepEqual(run.recorded.map((entry) => entry.timing.status), ["unknown"]);
});

test("a successful read of any other document fails as runtime.behavior, without quoting what it read", async () => {
  // The extension's own page, a tab left behind, or a document that is not the start page: none of them holds the mark.
  for (const other of ["", "Hammerline: film cameras", undefined]) {
    const start = startPage();
    const run = probe(start.page, core(() => succeeded(other)).control);
    const failure = await rejection(proveCoreActionRoundTrip(run.input));
    assert.equal(failure.category, "runtime.behavior");
    assert.match(failure.message, /did not return the mark planted on the start page/u);
    assert.equal(JSON.stringify({ message: failure.message, details: failure.details, published: run.published }).includes("Hammerline"), false);
    assert.equal(run.published.at(-1)?.summary, "Core action read did not return the mark planted on the start page");
    assert.equal(start.attributes.size, 0);
  }
});

test("each probe plants a fresh mark, so an answer replayed from an earlier probe cannot pass a later one", async () => {
  const start = startPage();
  let first: unknown;
  const gateway = core((command) => {
    const answer = readingThe(start.attributes)(command);
    first ??= answer;
    return first;
  });
  await proveCoreActionRoundTrip(probe(start.page, gateway.control).input);
  const failure = await rejection(proveCoreActionRoundTrip(probe(start.page, gateway.control).input));
  assert.equal(failure.category, "runtime.behavior");
  assert.notEqual(start.marks[0]?.value, start.marks[2]?.value);
});

test("a mark that cannot be removed fails the probe, and a failed read is still the failure reported", async () => {
  const good = startPage({ removalFails: true });
  const afterGoodRead = await rejection(proveCoreActionRoundTrip(probe(good.page, core(readingThe(good.attributes)).control).input));
  assert.equal(afterGoodRead.category, "runtime.behavior");
  assert.equal(afterGoodRead.message, "The Core action probe could not remove its mark from the start page");

  const bad = startPage({ removalFails: true });
  const afterFailedRead = await rejection(proveCoreActionRoundTrip(probe(bad.page, core(() => ({ ok: true, payload: { result: { commandId: "c", status: "timed_out" } } })).control).input));
  assert.equal(afterFailedRead.category, "action.dispatch");
  assert.match(afterFailedRead.message, /timed_out/u);
});
