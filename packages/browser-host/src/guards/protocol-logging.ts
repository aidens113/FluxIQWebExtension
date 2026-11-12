import { BrowserHostError } from "../errors/index.js";

const PROTOCOL_CHANNEL = "pw:protocol";

/**
 * Refuses to go on while Playwright protocol logging is on. The ticket reaches
 * the extension as an `evaluate` argument, and protocol logging prints every
 * protocol message, arguments included. `DEBUG` enables it by naming
 * `pw:protocol` or a wildcard covering it (`pw:*`, `*`); a later `-` entry
 * switches it off again, as the `debug` package reads the list.
 */
export function assertProtocolLoggingOff(environment: NodeJS.ProcessEnv = process.env): void {
  if (!protocolLoggingOn(environment["DEBUG"])) return;
  throw new BrowserHostError("browser_host.protocol_logging_on", "Refusing to enrol a browser host while DEBUG enables Playwright protocol logging: it would print the enrolment ticket. Unset DEBUG or exclude pw:protocol.");
}

function protocolLoggingOn(debug: string | undefined): boolean {
  if (!debug) return false;
  let on = false;
  for (const entry of debug.split(/[\s,]+/u).filter(Boolean)) {
    const excluded = entry.startsWith("-");
    if (wildcard(excluded ? entry.slice(1) : entry).test(PROTOCOL_CHANNEL)) on = !excluded;
  }
  return on;
}

function wildcard(pattern: string): RegExp {
  return new RegExp(`^${pattern.split("*").map(part => part.replace(/[.+?^${}()|[\]\\]/gu, "\\$&")).join(".*")}$`, "u");
}
