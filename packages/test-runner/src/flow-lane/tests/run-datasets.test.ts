// Covers run-datasets.ts. The property these cases exist for is the domain
// scope: Core's dataset endpoints refuse a request whose scope is not the
// project's own, so a reader that drops it reads nothing at all. Observed
// against a real isolated Core, same project and same body:
//
//   POST get-run-dataset-page              -> 400 {"ok":false,"error":"Automation Studio project is unavailable in this domain scope."}
//   POST get-run-dataset-page?domainId=web-automation -> 200 {"ok":true,"payload":{"dataset":null}}
//
// The rest pins what the reader does with a page once it has one.

import assert from "node:assert/strict";
import test from "node:test";
import { readRunDatasets, runDatasetSummaries, type RunDatasetControl } from "../run-datasets.js";

type Call = { endpoint: string; payload: Record<string, unknown>; domainId: string | undefined };

function control(pages: Array<Record<string, unknown>>): { client: RunDatasetControl; calls: Call[] } {
  const calls: Call[] = [];
  let index = 0;
  const client: RunDatasetControl = {
    automationStudioCall: async (endpoint, payload, _bounds, domainId) => {
      calls.push({ endpoint, payload, domainId });
      const dataset = pages[index] ?? pages.at(-1);
      index += 1;
      return { dataset };
    },
  };
  return { client, calls };
}

const summary = { datasetId: "products", nodeIds: ["node.extract"], recordCount: 2, storeTruncated: false, invalidCount: 0 };
const page = (rows: unknown[], nextCursor: string | null = null) => ({ schema: { fields: [{ id: "name" }, { id: "price" }] }, rows, nextCursor });

test("every dataset page is read under the project's domain scope, because Core refuses a page read without one", async () => {
  const { client, calls } = control([page([{ name: "Widget", price: "1" }, { name: "Gadget", price: "2" }])]);

  await readRunDatasets(client, { projectId: "project.web", runId: "run.one", domainId: "web-automation", summaries: [summary] });

  assert.deepEqual(calls.map(call => [call.endpoint, call.domainId]), [["get-run-dataset-page", "web-automation"]]);
});

test("the scope travels with every page of a paged dataset, not only the first", async () => {
  const { client, calls } = control([
    page([{ name: "Widget", price: "1" }], "cursor.two"),
    page([{ name: "Gadget", price: "2" }]),
  ]);

  await readRunDatasets(client, { projectId: "project.web", runId: "run.one", domainId: "other-domain", summaries: [summary] });

  assert.deepEqual(calls.map(call => call.domainId), ["other-domain", "other-domain"]);
  assert.deepEqual(calls.map(call => call.payload.cursor), [null, "cursor.two"]);
});

test("a run that stored no dataset makes no dataset call at all", async () => {
  const { client, calls } = control([]);

  const datasets = await readRunDatasets(client, { projectId: "project.web", runId: "run.one", domainId: "web-automation", summaries: [] });

  assert.deepEqual(datasets, []);
  assert.deepEqual(calls, []);
});

test("a record is rebuilt over the page's schema, with null for a field the row lacks and a count for a value that is not a string", async () => {
  const { client } = control([page([{ name: "Widget", price: 1 }, { name: "Gadget" }])]);

  const [dataset] = await readRunDatasets(client, { projectId: "project.web", runId: "run.one", domainId: "web-automation", summaries: [summary] });

  assert.deepEqual(dataset?.records, [{ name: "Widget" }, { name: "Gadget", price: null }]);
  assert.equal(dataset?.nonStringValues, 1);
  assert.equal(dataset?.pages, 1);
});

test("reading back fewer rows than Core says it stored is a runtime failure, not a quietly short dataset", async () => {
  const { client } = control([page([{ name: "Widget", price: "1" }])]);

  await assert.rejects(
    () => readRunDatasets(client, { projectId: "project.web", runId: "run.one", domainId: "web-automation", summaries: [summary] }),
    /Core stored 2 record\(s\) for a run dataset and returned 1/,
  );
});

test("the summaries a run detail carries are read from the detail, and a detail with none is not an error", () => {
  assert.deepEqual(runDatasetSummaries({ datasets: [{ datasetId: "products", nodeIds: ["node.extract"], recordCount: 4, truncated: true, invalidCount: 1 }] }), [
    { datasetId: "products", nodeIds: ["node.extract"], recordCount: 4, storeTruncated: true, invalidCount: 1 },
  ]);
  assert.deepEqual(runDatasetSummaries({}), []);
});
