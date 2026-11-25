import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ChartFlow } from "../chart/index.js";

/** A flow with every kind of thing the chart draws. */
export const SAMPLE_FLOW: ChartFlow = {
  source: "draft",
  instruction: "On the shop, search for paper towels and show me the cheapest as a table with columns name and price.",
  parameters: [{ name: "Search (step 2)", value: "paper towels" }],
  nodes: [
    { step: 1, kind: "navigate", example: ["went to http://127.0.0.1:5000/shop/"], result: false },
    { step: 2, kind: "act: type", target: "Search", typed: "paper towels", example: [], result: false },
    { step: 3, kind: "read", target: "name, price and 2 more", example: ["8 rows read", "first row: name: Soft Rolls 6pk | price: $10.47"], result: true },
    { step: 4, kind: "act: next page", target: "Next page", example: [], act: "a1", result: false },
  ],
  loops: [{ from: 3, to: 4, label: "repeats over name, price and 2 more until nothing more" }],
  branches: [{ from: 4, to: 2, label: "if a consent dialog covers the page" }],
  otherSteps: 3,
  output: { kind: "rows", source: "shown to the person", check: [], headline: "Found 8 rows", columns: ["name", "price"], rows: [["Soft Rolls 6pk", "$10.47"], ["Big Rolls 12pk", "$17.48"]], total: 8 },
};

const draftStep = (step: number, actionId: string, extra: object = {}): object => ({ step, actionId, input: { parameters: {} }, inResult: true, ...extra });

/** A run directory shaped as the Lab writes one: a chat step, a draft in the newest decision's request, a read's result, an answer. */
export async function writeRunFixture(directory: string, options: { answer?: boolean; secret?: boolean; offered?: boolean } = {}): Promise<void> {
  const steps = path.join(directory, "steps");
  const put = async (folder: string, file: string, value: unknown): Promise<void> => {
    await mkdir(path.join(steps, folder), { recursive: true });
    await writeFile(path.join(steps, folder, file), JSON.stringify(value));
  };
  await put("0001-chat", "request.json", { messages: [{ role: "user", content: "Find the cheapest paper towels and list them." }] });
  const newest = [
    draftStep(1, "web.output.browser-navigate", { input: { parameters: { url: "http://127.0.0.1:5000/shop/" } } }),
    draftStep(2, "web.output.dom-type", { does: { target: options.secret ? "Password" : "Search", text: options.secret ? "hunter2" : "paper towels" }, bindable: ["text"] }),
    draftStep(3, "web.output.dom-extract_list", { input: { parameters: { extractList: { fields: { name: "a_b", price: "c_d" } } } }, does: { target: "name and price" }, callId: "read.1", runs: "repeats through step 4 while it succeeds" }),
    draftStep(4, "web.output.dom-next_page", { does: { target: "Next page" } }),
    { step: 5, actionId: "web.detect_repeating_structure", inResult: false },
  ];
  const request = (list: unknown[]): object => ({ messages: [{ role: "user", content: JSON.stringify({ context: { evidenceLoop: { evidence: [{ toolId: "core.flow_draft", value: { steps: list } }] } } }) }] });
  await put("0002-decide", "request.json", request([draftStep(1, "web.output.browser-navigate")]));
  await put("0003-tool-core.run_node", "call.json", { callId: "read.1" });
  await put("0003-tool-core.run_node", "result.json", { read: { extraction: { recordCount: 8 }, firstRows: [{ name: "Soft Rolls 6pk", price: "$10.47", x: "ignored" }] } });
  await put("0004-decide", "request.json", request(newest));
  if (options.offered) {
    await put("0005-answer-unusable", "result.json", { feedback: [{ toolId: "core.completion_check", value: { code: "answer_first.judged_unsure", instruction: "The check said yes, but Core held it unconfirmed: Some evidence was missing. The evidence Core could not read: read-first (web_judge.read_invalid); witnesses.before (judge_evidence.before_state_missing). Only new evidence changes it.", resultHolds: { totalRows: 16, columns: ["name", "price"], rowsInOrder: [{ name: "Soft Rolls 6pk", price: "$10.47" }, { name: "Big Rolls 12pk", price: "$17.48" }] } } }] });
    await put("0003-answer-unusable", "result.json", { feedback: [{ toolId: "core.completion_check", value: { code: "answer_first.judged_no", instruction: "Older.", resultHolds: { totalRows: 1, columns: ["name"], rowsInOrder: [{ name: "Older row" }] } } }] });
  }
  if (options.answer !== false) await writeFile(path.join(directory, "answer-turn.json"), JSON.stringify({ visible: true, headline: "Found 8 rows", columns: ["name", "price"], rows: [["Soft Rolls 6pk", "$10.47"]], note: "Showing 1 of 8 rows", text: null }));
}
