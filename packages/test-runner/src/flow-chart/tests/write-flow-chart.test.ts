import assert from "node:assert/strict";
import { mkdtemp, readFile, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { writeFlowChart } from "../write-flow-chart.js";
import type { ChartFlow } from "../chart/index.js";
import { SAMPLE_FLOW, writeRunFixture } from "./chart-fixture.js";

const tempDirectory = (): Promise<string> => mkdtemp(path.join(os.tmpdir(), "t1039-"));

test("a run's chart is written as flow.svg and a real flow.png, and the report line names it and says draft or saved", async () => {
  const dir = await tempDirectory();
  await writeRunFixture(dir);
  const line = await writeFlowChart(dir);
  assert.match(line, /flow\.png .*shows the draft, 4 nodes/u);
  const png = await readFile(path.join(dir, "flow.png"));
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.ok(png.length > 5000);
  assert.ok((await readFile(path.join(dir, "flow.svg"), "utf8")).startsWith("<svg"));
});

test("a broken Flow writes flow-chart-error.txt and does not throw", async () => {
  const dir = await tempDirectory();
  const line = await writeFlowChart(dir, { ...SAMPLE_FLOW, nodes: undefined as unknown as ChartFlow["nodes"] });
  assert.match(line, /not written, see flow-chart-error\.txt/u);
  assert.ok((await stat(path.join(dir, "flow-chart-error.txt"))).size > 0);
});

test("an attempt that never got a draft writes no image and says so", async () => {
  const dir = await tempDirectory();
  assert.match(await writeFlowChart(dir), /none written, the attempt never got a draft/u);
  await assert.rejects(stat(path.join(dir, "flow.png")));
});
