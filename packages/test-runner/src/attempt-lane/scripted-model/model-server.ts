import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { anthropicStreamBody, scriptedModelReplyText, scriptedModelUsage } from "./anthropic-stream.js";
import type { ScriptedModelScript, ScriptedReply } from "./script.js";
import { readScriptedModelRequest, type ScriptedModelKind, type ScriptedModelRequest } from "./wire-request.js";
import { SCRIPTED_MODEL_CORRELATION_HEADER } from "./correlation-header.js";

/** One request as it went: its kind and count, and why it was refused. Never its contents. */
export type ScriptedModelCall = Readonly<{ at: number; kind: ScriptedModelKind; ordinal: number; answered: boolean; refused?: string; correlationId?: string }>;

/** The running scripted model. `refusals` are the requests the script did not expect, which fail the run. */
export type ScriptedModelServer = {
  origin: string;
  calls(): readonly ScriptedModelCall[];
  counts(): Readonly<Record<ScriptedModelKind, number>>;
  refusals(): readonly ScriptedModelCall[];
  close(): Promise<void>;
};

const MESSAGES_PATH = "/v1/messages";

function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}

/** A refusal Core takes as what it is: not a reply, and not worth a retry. */
function refuse(response: ServerResponse, status: number, message: string): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify({ type: "error", error: { type: "invalid_request_error", message } }));
}

/**
 * A small HTTP server in the Lab's process speaking Anthropic Messages with `stream:
 * true`. It holds no judgement: each request is read off the wire and answered by the
 * next reply its kind has in the script. A request with another key, of a kind the
 * script has no reply for, or whose reply could not be made is refused and recorded, so
 * the driver fails the run naming it. `logDirectory` keeps each call's kind and count in
 * `calls.jsonl`, and each request's decoded body, in a run-scoped ignored folder, for
 * writing the next script.
 */
export async function startScriptedModelServer(input: { script: ScriptedModelScript; key: string; logDirectory?: string; onCall?: (call: ScriptedModelCall) => void }): Promise<ScriptedModelServer> {
  const calls: ScriptedModelCall[] = [];
  const counts: Record<ScriptedModelKind, number> = {};
  const correlatedCounts = new Map<string, Record<ScriptedModelKind, number>>();
  /** A chat turn's words, by the scripted reply that first read them. */
  const answeredWords = new Map<string, ScriptedReply>();
  if (input.logDirectory) await mkdir(input.logDirectory, { recursive: true });
  const note = (call: ScriptedModelCall): void => {
    calls.push(call);
    input.onCall?.(call);
    if (input.logDirectory) void appendFile(path.join(input.logDirectory, "calls.jsonl"), `${JSON.stringify(call)}\n`).catch(/* best-effort: `calls` holds the record the run reads */ () => undefined);
  };
  const server = createServer((request, response) => {
    const header = request.headers[SCRIPTED_MODEL_CORRELATION_HEADER];
    const correlationId = typeof header === "string" && /^fnr-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u.test(header) ? header : undefined;
    const record = (call: ScriptedModelCall): void => note(correlationId ? { ...call, correlationId } : call);
    void (async () => {
      const at = Date.now();
      const refused = (kind: ScriptedModelKind, ordinal: number, why: string, status = 400): void => {
        record({ at, kind, ordinal, answered: false, refused: why });
        refuse(response, status, why);
      };
      if (header !== undefined && correlationId === undefined) {
        refused("invalid_correlation", 0, "The synthetic Lab correlation header is not a run identifier");
        return;
      }
      if (request.method !== "POST" || request.url !== MESSAGES_PATH) {
        refused("not_messages", 0, `The scripted model takes only POST ${MESSAGES_PATH}`, 404);
        return;
      }
      if (request.headers.authorization !== `Bearer ${input.key}`) {
        refused("wrong_key", 0, "The call was not signed with the key the run installed", 401);
        return;
      }
      const body = await readBody(request);
      let read: ScriptedModelRequest;
      try {
        read = readScriptedModelRequest(body, (kind) => {
          counts[kind] = (counts[kind] ?? 0) + 1;
          if (!correlationId) return counts[kind]!;
          const own = correlatedCounts.get(correlationId) ?? {};
          correlatedCounts.set(correlationId, own);
          return own[kind] = (own[kind] ?? 0) + 1;
        });
      } catch (error) {
        refused("unreadable", 0, error instanceof Error ? error.message : String(error));
        return;
      }
      if (input.logDirectory) await writeFile(path.join(input.logDirectory, `${read.kind}-${String(read.ordinal).padStart(3, "0")}.request.json`), read.payload ? JSON.stringify(read.payload, null, 1) : read.message).catch(/* best-effort: a request kept for the next script decides nothing */ () => undefined);
      const scripted = input.script.replies[read.kind]?.[read.ordinal - 1];
      // A person's same words, put again in a later attempt, are read as they were read before, as a
      // model reading them the same way would. So a series of deterministic attempts runs to its end and
      // its report counts each interpretation call a later attempt still makes, instead of stopping at
      // the first one the script did not write out.
      const wordsKey = JSON.stringify([correlationId ?? null, read.message]);
      const reply = scripted ?? (read.kind === "panel_command" ? answeredWords.get(wordsKey) : undefined);
      if (scripted !== undefined && read.kind === "panel_command" && !answeredWords.has(wordsKey)) answeredWords.set(wordsKey, scripted);
      if (reply === undefined) {
        refused(read.kind, read.ordinal, `The script for ${input.script.taskId} expects no request ${read.ordinal} of kind ${read.kind}`);
        return;
      }
      let value: unknown;
      try {
        value = reply(read);
      } catch (error) {
        refused(read.kind, read.ordinal, `The script for ${input.script.taskId} could not answer request ${read.ordinal} of kind ${read.kind}: ${error instanceof Error ? error.message : String(error)}`);
        return;
      }
      const text = scriptedModelReplyText(value, read.jsonText);
      const stream = anthropicStreamBody({ model: read.model, text, usage: scriptedModelUsage(Buffer.byteLength(body), Buffer.byteLength(text)) });
      record({ at, kind: read.kind, ordinal: read.ordinal, answered: true });
      response.writeHead(200, { "content-type": "text/event-stream" });
      response.end(stream);
    })().catch((error: unknown) => {
      record({ at: Date.now(), kind: "server_error", ordinal: 0, answered: false, refused: error instanceof Error ? error.message : String(error) });
      if (!response.headersSent) refuse(response, 400, "The scripted model failed");
      else response.destroy();
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  return {
    origin: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    calls: () => [...calls],
    counts: () => ({ ...counts }),
    refusals: () => calls.filter((call) => !call.answered),
    close: () => new Promise((resolve) => {
      server.closeAllConnections();
      server.close(() => resolve());
    }),
  };
}
