// T1 coverage of who gets a read's rejected-row samples: a command that asks
// for every one (the exploring model's node run adds `rejectedSamples: true`
// beside `extractList`), a command that asks for the rows each condition removed
// by itself (a Flow's playback, `rejectedSamples: "alone"`, t194 w49), and
// nobody else -- a command that does not ask stays counts alone. The rows that
// are sent survive the domain's wire copy whole: nothing cuts them.

import assert from "node:assert/strict";
import test from "node:test";
import { webAutomationActionResultPayload } from "@fluxiq-web-extension/domain/client";
import { extractListAction } from "../extract-list";
import type { ActionResultEvidence } from "../../action-runtime";
import type { ListExtractionOptions, ListExtractionOutcome } from "../../extraction";
import type { ContentActionDependencies } from "../types";
import type { BrowserActionCommand, BrowserActionResult } from "../../types";

const COMMAND: BrowserActionCommand = {
  commandId: "cmd-extract-list",
  actionType: "web.dom.extract_list",
  extractList: { item: ".row", fields: { name: ".name" }, where: [{ field: "name", contains: ["charging case"], not: true }] }
};

/** What a read that was asked for samples answers with: one kept row and one rejected, which is a true answer. */
function outcome(sampled: boolean): ListExtractionOutcome {
  return {
    records: [{ name: "Basic Earbuds" }],
    pagesRead: 1,
    truncated: false,
    timedOut: false,
    missingFields: [],
    filtered: 1,
    conditions: { applied: 2, kept: 1, rejected: [1], unfiltered: false },
    ...(sampled ? { rejectedSamples: [[{ name: `Pro Earbuds Wireless Charging Case ${"x".repeat(200)}` }]] } : {})
  };
}

/** Runs the verb, recording the options the read was given and the evidence the result was built from. */
async function run(command: BrowserActionCommand): Promise<{ options: ListExtractionOptions | undefined; evidence: ActionResultEvidence | undefined }> {
  let options: ListExtractionOptions | undefined;
  let evidence: ActionResultEvidence | undefined;
  const result = (): BrowserActionResult => ({ commandId: command.commandId, actionType: command.actionType, status: "succeeded", validation: { status: "none", reason: "evidence-only" }, startedAt: 1, finishedAt: 2 });
  const deps = {
    extractList: async (_request: unknown, given?: ListExtractionOptions) => {
      options = given;
      return outcome(given?.sampleRejected === true);
    },
    captureSnapshot: () => ({ url: "https://example.test/", title: "Example", viewport: { width: 1, height: 1, scrollX: 0, scrollY: 0 }, interactiveElements: [] }),
    success: (_action: unknown, _startedAt: unknown, _message: unknown, _validation: unknown, built?: ActionResultEvidence) => {
      evidence = built;
      return result();
    },
    failure: (_action: unknown, error: unknown) => { throw error; }
  } as unknown as ContentActionDependencies;
  await extractListAction(command, deps, 1);
  return { options, evidence };
}

test("a command that asks for samples gets them on the summary, and they survive the wire copy whole", async () => {
  const { options, evidence } = await run({ ...COMMAND, options: { extractList: {}, rejectedSamples: true } });
  assert.equal(options?.sampleRejected, true);
  assert.equal(evidence?.extraction?.rejectedSamples?.[0]?.[0]?.name?.startsWith("Pro Earbuds Wireless Charging Case"), true);
  const wire = webAutomationActionResultPayload({
    commandId: COMMAND.commandId,
    actionType: COMMAND.actionType,
    status: "succeeded",
    validation: { status: "none", reason: "evidence-only" },
    ...(evidence?.extraction ? { extraction: evidence.extraction } : {}),
    startedAt: 1,
    finishedAt: 2
  }).extraction as { rejectedSamples?: Array<Array<{ name: string }>> } | undefined;
  assert.equal(wire?.rejectedSamples?.[0]?.[0]?.name, `Pro Earbuds Wireless Charging Case ${"x".repeat(200)}`);
  // The kept rows are the records, untouched by the samples beside them.
  assert.deepEqual(evidence?.extracted, [{ name: "Basic Earbuds" }]);
});

test("a command that does not ask neither collects samples nor carries them", async () => {
  for (const options of [undefined, { extractList: {} }, { extractList: {}, rejectedSamples: "yes" }]) {
    const { options: given, evidence } = await run({ ...COMMAND, ...(options === undefined ? {} : { options }) });
    assert.equal(given?.sampleRejected, undefined, JSON.stringify(options));
    assert.equal(evidence?.extraction?.rejectedSamples, undefined, JSON.stringify(options));
  }
  // The same command, asking: the difference is the request alone.
  assert.notEqual((await run({ ...COMMAND, options: { extractList: {}, rejectedSamples: true } })).evidence?.extraction?.rejectedSamples, undefined);
});

test("the summary carries each condition's alone count on every read, and the alone lead of each list only beside the samples", async () => {
  const counted = (given?: ListExtractionOptions): ListExtractionOutcome => ({
    ...outcome(given?.sampleRejected === true),
    conditions: { applied: 2, kept: 1, rejected: [1], unfiltered: false, alone: [1] },
    ...(given?.sampleRejected === true ? { rejectedSamplesAlone: [1] } : {})
  });
  const summaries: Array<BrowserActionResult["extraction"]> = [];
  for (const options of [undefined, { extractList: {}, rejectedSamples: true }]) {
    let evidence: ActionResultEvidence | undefined;
    const deps = {
      extractList: async (_request: unknown, given?: ListExtractionOptions) => counted(given),
      captureSnapshot: () => ({ url: "https://example.test/", title: "Example", viewport: { width: 1, height: 1, scrollX: 0, scrollY: 0 }, interactiveElements: [] }),
      success: (_action: unknown, _startedAt: unknown, _message: unknown, _validation: unknown, built?: ActionResultEvidence) => {
        evidence = built;
        return { commandId: COMMAND.commandId, actionType: COMMAND.actionType, status: "succeeded", validation: { status: "none", reason: "evidence-only" }, startedAt: 1, finishedAt: 2 };
      },
      failure: (_action: unknown, error: unknown) => { throw error; }
    } as unknown as ContentActionDependencies;
    await extractListAction({ ...COMMAND, ...(options === undefined ? {} : { options }) }, deps, 1);
    summaries.push(evidence?.extraction);
  }
  const [playback, asked] = summaries;
  // A playback: the count, and no rows.
  assert.deepEqual(playback?.conditions?.alone, [1]);
  assert.equal(playback?.rejectedSamplesAlone, undefined);
  // The exploring model's read: the count, and the lead of its list, through the wire copy.
  const wire = webAutomationActionResultPayload({
    commandId: COMMAND.commandId,
    actionType: COMMAND.actionType,
    status: "succeeded",
    validation: { status: "none", reason: "evidence-only" },
    ...(asked ? { extraction: asked } : {}),
    startedAt: 1,
    finishedAt: 2
  }).extraction as { conditions?: { alone?: number[] }; rejectedSamplesAlone?: number[] } | undefined;
  assert.deepEqual(wire?.conditions?.alone, [1]);
  assert.deepEqual(wire?.rejectedSamplesAlone, [1]);
});

// Live run 15 (run-muqj2bgb-d048ec37): the accessory rule removed by itself three earbuds sold "with Wireless
// Charging Case", and the judge of the playback was told only how many. A playback now asks for those rows.
test("a playback that asks for the alone rows gets each condition's alone lead and nothing else, through the wire copy", async () => {
  const earbud = { name: "Trevio T5 Wireless Earbuds, Wireless Charging Case, Rose Gold" };
  const alsoFailedPrice = { name: "Charging Case Replacement" };
  let given: ListExtractionOptions | undefined;
  let evidence: ActionResultEvidence | undefined;
  const deps = {
    extractList: async (_request: unknown, options?: ListExtractionOptions): Promise<ListExtractionOutcome> => {
      given = options;
      return {
        ...outcome(false),
        conditions: { applied: 3, kept: 1, rejected: [2], unfiltered: false, alone: [1] },
        rejectedSamples: [[earbud, alsoFailedPrice]],
        rejectedSamplesAlone: [1]
      };
    },
    captureSnapshot: () => ({ url: "https://example.test/", title: "Example", viewport: { width: 1, height: 1, scrollX: 0, scrollY: 0 }, interactiveElements: [] }),
    success: (_action: unknown, _startedAt: unknown, _message: unknown, _validation: unknown, built?: ActionResultEvidence) => {
      evidence = built;
      return { commandId: COMMAND.commandId, actionType: COMMAND.actionType, status: "succeeded", validation: { status: "none", reason: "evidence-only" }, startedAt: 1, finishedAt: 2 };
    },
    failure: (_action: unknown, error: unknown) => { throw error; }
  } as unknown as ContentActionDependencies;
  await extractListAction({ ...COMMAND, options: { extractList: {}, rejectedSamples: "alone" } }, deps, 1);
  // The page collects as it does for every row; the summary sends the alone lead only.
  assert.equal(given?.sampleRejected, true);
  const wire = webAutomationActionResultPayload({
    commandId: COMMAND.commandId,
    actionType: COMMAND.actionType,
    status: "succeeded",
    validation: { status: "none", reason: "evidence-only" },
    ...(evidence?.extraction ? { extraction: evidence.extraction } : {}),
    startedAt: 1,
    finishedAt: 2
  }).extraction as { rejectedSamples?: unknown; rejectedSamplesAlone?: unknown } | undefined;
  assert.deepEqual(wire?.rejectedSamples, [[earbud]]);
  assert.deepEqual(wire?.rejectedSamplesAlone, [1]);
});
