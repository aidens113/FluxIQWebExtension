import type { ScriptedModelScript, ScriptedReply } from "../script.js";
import { currentPageOf, latestOf, pageLine, pressOf, toolCall } from "./evidence.js";

/** The chat turn: what a model decides of the person's message, which is to start the attempt. Core saves the person's own words as the instruction. */
const startAttempt: ScriptedReply = (request) => ({ do: "flow.createHere", with: { instruction: request.message } });

/** What stands over the page on a first visit, in the order a person clears it, each only while it shows. */
const COVERS: readonly { summary: string; callId: string; words: RegExp }[] = [
  { summary: "Close the chat greeting that sits over the page.", callId: "close-chat", words: /\bclickable\b.*(?:"×"|"Close"|title="Close")|button "Close"/u },
  { summary: "Accept cookies so the page can be used.", callId: "accept-cookies", words: /"Accept all"/u },
  { summary: "Decline the newsletter offer.", callId: "decline-newsletter", words: /No thanks, I will pay full price/u },
];

/** Whether the grid's last apprentice has loaded, which the instruction's "every apprentice" needs. */
const lastBatchLoaded = (page: string): boolean => page.includes("Megan Ashdown");

/**
 * `company-website-apprentices`: clear what covers the page, go to the team page, load the
 * grid to its last batch, read it keeping the apprentices, and finish. Each decision
 * looks at the page as it stands now and takes the first step not yet done, because the
 * newsletter offer comes up on a timer. Every handle and field key is read from the real
 * evidence in the request.
 */
const decide: ScriptedReply = (request) => {
  const page = currentPageOf(request);
  const taken = new Set((request.payload ? JSON.stringify(request.payload).match(/"callId":"[^"]+"/gu) ?? [] : []).map((text) => text.slice(10, -1)));
  const read = taken.has("read-team");
  if (read) return { kind: "evidence_tool_decision", summary: "The four apprentices are read.", decision: { kind: "complete", result: { summary: "Listed every apprentice across the branches, from the team page." } } };
  for (const cover of COVERS) {
    if (!taken.has(cover.callId) && pageLine(page, cover.words)) return pressOf(request, cover.summary, cover.callId, cover.words);
  }
  if (!/^URL ~\/team\b/mu.test(page)) return pressOf(request, "Go to the team page.", "open-team", /link "Our team"/u);
  if (!lastBatchLoaded(page)) {
    const more = pageLine(page, /"Show more people"/u);
    if (more) return pressOf(request, "Load the next people on the team page.", `show-more-${request.ordinal}`, /"Show more people"/u);
    return toolCall("Scroll down so the next people load.", `scroll-${request.ordinal}`, "core.run_node", { node: "web.output.dom-scroll", parameters: { y: 4000 }, consequences: [] });
  }
  const structure = latestOf(request, "web.detect_repeating_structure");
  if (!structure) {
    const card = pageLine(page, /"Megan Ashdown"/u);
    if (!card) throw new Error("The team page does not show the last apprentice's card");
    return toolCall("See the shape of the people's cards.", "detect-team", "web.detect_repeating_structure", { target: card.handle });
  }
  const fields = (Array.isArray(structure.value.fields) ? structure.value.fields : []) as readonly { key: string; sample?: string; label?: string }[];
  const keyOf = (holds: (field: { key: string; sample?: string }) => boolean, what: string): string => {
    const field = fields.find(holds);
    if (!field) throw new Error(`The read's fields hold no ${what}: ${fields.map((candidate) => `${candidate.key}=${candidate.sample ?? ""}`).join("; ")}`);
    return field.key;
  };
  // A card's name is its heading and its role the line under it, as the first item shows them.
  const columns = {
    name: keyOf((field) => field.key.startsWith("h3"), "heading"),
    role: keyOf((field) => /Director|Engineer|Manager|Adviser|Apprentice/u.test(field.sample ?? ""), "role"),
    branch: keyOf((field) => /Eastmoor|Hollins Cross|Wrenfield|Sallowmere/u.test(field.sample ?? "") && !field.key.endsWith("_label"), "branch"),
  };
  return toolCall("Read the people, keeping the apprentices.", "read-team", "core.run_node", {
    node: "web.output.dom-extract_list",
    parameters: {
      extractList: { handle: structure.value.extraction, fields: columns, where: [{ field: columns.role, contains: "Apprentice" }], minItems: 1 },
      recordOutput: {
        datasetId: "apprentices",
        schema: { schemaVersion: "0.1", fields: [{ id: "name", label: "name", valueType: "string" }, { id: "role", label: "role", valueType: "string" }, { id: "branch", label: "branch", valueType: "string" }] },
        writeMode: "append",
      },
    },
    consequences: [],
  }, true);
};

/** The judge: yes, on what the person asked for, which Core shows it from its own records. */
const answersRequest: ScriptedReply = () => ({ kind: "diagnosis", diagnosis: { answersRequest: "yes", defects: [] }, summary: "The rows are the apprentices the person asked for." });

/** The most decisions this script answers: enough for every step of its honest path, and few enough that a loop fails it. */
const MOST_DECISIONS = 24;

export const COMPANY_WEBSITE_APPRENTICES_SCRIPT: ScriptedModelScript = Object.freeze({
  taskId: "company-website-apprentices",
  replies: {
    panel_command: [startAttempt],
    evidence_tool_decision: Array.from({ length: MOST_DECISIONS }, () => decide),
    loop_verification: [answersRequest],
  },
});
