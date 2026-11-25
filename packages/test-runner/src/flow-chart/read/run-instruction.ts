import path from "node:path";
import { listFolder } from "./list-folder.js";
import { readJsonFile } from "./read-json-file.js";
import { userMessageText, type RequestMessages } from "./user-message-json.js";

/** The instruction the chat received, from the first chat step's request; `null` when none was logged. */
export async function readRunInstruction(stepsDirectory: string): Promise<string | null> {
  const chat = (await listFolder(stepsDirectory)).filter((name) => /^\d+-chat$/u.test(name)).sort()[0];
  if (chat === undefined) return null;
  const request = await readJsonFile<RequestMessages>(path.join(stepsDirectory, chat, "request.json"));
  const text = request === undefined ? undefined : userMessageText(request);
  return text === undefined || text.trim() === "" ? null : text;
}
