// One step folder of a run's `steps/` read into the facts the watcher counts.
//
// Core writes `meta.json` last, so a folder without a parseable one is still
// being written and is read again on the next poll. Only counts, ids and
// hashes leave this file; page text is hashed, never kept or printed.

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { isActNode } from "./is-act-node.mjs";

const RUN_TOOLS = new Set(["core.run_node", "core.run_flow"]);

/**
 * @param {string} stepsDirectory
 * @param {string} name the step folder's name, such as `0128-tool-core.run_node`
 * @returns {Promise<null | {
 *   step: number, name: string, kind: string, toolId: string | null, callId: string | null, callKey: string | null,
 *   node: string | null, startUrl: string | null, initial: boolean, act: boolean, costUsd: number,
 *   decision: string | null, verdict: string | null, pattern: string | null, toolIds: string[], location: string | null, pageHash: string | null, rows: number | null,
 * }>} null while the step is not finished
 */
export async function readStep(stepsDirectory, name) {
  try {
    return await readFacts(stepsDirectory, name);
  } catch (error) {
    // A file cut short mid-write: the step is not finished, and is read again on the next look.
    if (error instanceof SyntaxError) return null;
    throw error;
  }
}

async function readFacts(stepsDirectory, name) {
  const directory = path.join(stepsDirectory, name);
  const meta = await readJson(path.join(directory, "meta.json"));
  if (meta === null || typeof meta !== "object") return null;
  const kind = typeof meta.kind === "string" ? meta.kind : "note";
  const event = {
    step: Number.isInteger(meta.step) ? meta.step : Number.parseInt(name, 10),
    name, kind,
    toolId: typeof meta.toolId === "string" ? meta.toolId : null,
    callId: typeof meta.callId === "string" ? meta.callId : null,
    callKey: null, node: null, startUrl: null, initial: false, act: false,
    costUsd: typeof meta.costUsd === "number" && Number.isFinite(meta.costUsd) ? meta.costUsd : 0,
    decision: typeof meta.decision === "string" ? meta.decision : null,
    verdict: typeof meta.verdict === "string" ? meta.verdict : null,
    pattern: typeof meta.pattern === "string" ? meta.pattern : null,
    toolIds: Array.isArray(meta.toolIds) ? meta.toolIds.filter((id) => typeof id === "string") : [],
    location: null, pageHash: null, rows: null,
  };
  if (kind !== "tool") return event;
  const call = await readJson(path.join(directory, "call.json"));
  if (call === null || typeof call !== "object") return event;
  const toolId = typeof call.toolId === "string" ? call.toolId : event.toolId;
  event.toolId = toolId;
  event.callId = typeof call.callId === "string" ? call.callId : event.callId;
  event.callKey = `${toolId}:${createHash("sha1").update(JSON.stringify(call.input ?? null)).digest("hex").slice(0, 12)}`;
  event.initial = event.callId?.startsWith("initial.") === true;
  if (RUN_TOOLS.has(toolId ?? "")) {
    event.node = typeof call.input?.node === "string" ? call.input.node : null;
    event.act = !event.initial && isActNode(event.node);
    // `held` is the draft's acts given as context: they do not run, so a navigate inside it is only
    // where the draft starts. It names the start URL; whether the page really lands there is read from
    // the step's own location below.
    const navigations = [call.input, ...(Array.isArray(call.input?.held) ? call.input.held : [])].filter((node) => typeof node?.node === "string" && node.node.endsWith("browser-navigate"));
    const url = navigations.map((node) => node.parameters?.url).find((value) => typeof value === "string");
    if (url !== undefined) event.startUrl = url;
  }
  const result = await readJson(path.join(directory, "result.json"));
  if (result !== null && typeof result === "object") {
    if (typeof result.page?.location === "string") event.location = result.page.location;
    const rows = result.rowCount ?? result.rows?.length ?? result.items?.length;
    if (Number.isInteger(rows)) event.rows = rows;
  }
  const page = await readText(path.join(directory, "page.txt"));
  if (page !== null) {
    event.pageHash = createHash("sha1").update(page).digest("hex").slice(0, 12);
    event.location ??= pageUrl(page);
  }
  return event;
}

/** The page's URL from the first lines of `page.txt` (`URL ~?q=x   (~ = http://site/search)` or a full URL). */
function pageUrl(page) {
  const line = page.split(/\r?\n/, 6).find((one) => one.startsWith("URL "));
  if (line === undefined) return null;
  const match = /^URL (\S+)(?:\s+\(~ = (\S+)\))?/.exec(line);
  if (match === null) return null;
  if (!match[1].startsWith("~")) return match[1];
  return match[2] === undefined ? null : match[2] + match[1].slice(1);
}

async function readJson(file) {
  const text = await readText(file);
  if (text === null) return null;
  return JSON.parse(text);
}

async function readText(file) {
  try { return await readFile(file, "utf8"); } catch (error) {
    if (error?.code === "ENOENT" || error?.code === "ENOTDIR") return null;
    throw error;
  }
}
