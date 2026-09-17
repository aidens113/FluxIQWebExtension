// What a demo launcher may print about a failed lane. The runner's own
// failures carry fixed messages written in this repository, so they print in
// full; any other error prints only its first line, because a Playwright call
// log can quote the page. Every credential literal is redacted either way.

import { RunnerFailure } from "../../failure.js";

const MAX_CAUSES = 8;
const MAX_MESSAGE_CHARACTERS = 400;
const NODE_ERROR_CODES = /^(?:EACCES|EPERM|EBUSY|ENOENT|EEXIST|ENOTEMPTY|EADDRINUSE|ECONNREFUSED|ECONNRESET|ETIMEDOUT)$/u;
const ERROR_CLASS = /^[A-Za-z][A-Za-z0-9]{0,63}$/u;
const REASON_CODE = /^[a-z][a-z0-9_]*(?:\.[a-z0-9_]+){1,3}$/u;

export type DemoLauncherFailure = Readonly<{
  failureCode: string;
  reasonCode?: string;
  sourceLocation?: string;
  causes: ReadonlyArray<Readonly<{ errorClass?: string; message: string }>>;
}>;

/** The failure and everything it was caused by, outermost first, safe to print. */
export function describeDemoLauncherFailure(error: unknown, secretLiterals: readonly string[]): DemoLauncherFailure {
  const secrets = secretLiterals.filter(secret => secret.length > 0);
  const causes: Array<{ errorClass?: string; message: string }> = [];
  let reasonCode: string | undefined;
  for (let current: unknown = error; current !== undefined && current !== null && causes.length < MAX_CAUSES; current = (current as { cause?: unknown }).cause) {
    const errorClass = current instanceof Error && ERROR_CLASS.test(current.name) ? current.name : undefined;
    const raw = current instanceof Error ? current.message : String(current);
    const message = current instanceof RunnerFailure ? raw : raw.split(/\r?\n/u, 1)[0] ?? "";
    causes.push({ ...(errorClass ? { errorClass } : {}), message: redact(message, secrets).slice(0, MAX_MESSAGE_CHARACTERS) });
    const candidate = current instanceof RunnerFailure ? current.details?.reasonCode : undefined;
    if (reasonCode === undefined && typeof candidate === "string" && REASON_CODE.test(candidate)) reasonCode = candidate;
    if (typeof current !== "object") break;
  }
  const sourceLocation = sourceLocationOf(error);
  return Object.freeze({
    failureCode: failureCodeOf(error),
    ...(reasonCode ? { reasonCode } : {}),
    ...(sourceLocation ? { sourceLocation } : {}),
    causes: Object.freeze(causes.map(cause => Object.freeze(cause))),
  });
}

function failureCodeOf(error: unknown): string {
  if (error instanceof RunnerFailure) return `runner.${error.category}`;
  if (error && typeof error === "object") {
    const { name, code } = error as { name?: unknown; code?: unknown };
    if (typeof code === "string" && NODE_ERROR_CODES.test(code)) return `node.${code.toLowerCase()}`;
    if (name === "TimeoutError") return "playwright.timeout";
  }
  return "unknown";
}

function sourceLocationOf(error: unknown): string | undefined {
  if (!(error instanceof Error) || typeof error.stack !== "string") return undefined;
  const match = error.stack.match(/[\\/]([a-z0-9.-]+)\.(?:js|ts):(\d{1,6}):(\d{1,5})(?:\)?$|[\s)])/mu);
  return match ? `${match[1]}:${Number(match[2])}:${Number(match[3])}` : undefined;
}

function redact(message: string, secrets: readonly string[]): string {
  return secrets.reduce((text, secret) => text.split(secret).join("[redacted]"), message);
}
