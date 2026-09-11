import { RunnerFailure } from "../failure.js";

/**
 * A manifest target or extract field selector:
 * - `testid:<id>` — the element whose `data-testid` is `<id>`;
 * - `role:<role>[:<name>]` — by ARIA role and exact accessible name (the older
 *   `role:<role>[name=<name>]` spelling is read the same way);
 * - `frame:<title>/<inner>` — `<inner>` inside the iframe titled `<title>`,
 *   across origins; frames nest;
 * - anything else — a raw Playwright/CSS selector.
 */
export type ScenarioTarget =
  | { kind: "testid"; id: string }
  | { kind: "role"; role: string; name?: string }
  | { kind: "frame"; title: string; inner: ScenarioTarget }
  | { kind: "css"; selector: string };

const ROLE = /^[a-z]+$/u;
const LEGACY_ROLE_NAME = /^([a-z]+)\[name=(.+)\]$/u;

export function parseScenarioTarget(text: string | undefined): ScenarioTarget {
  if (text === undefined || !text.trim()) throw new RunnerFailure("fixture.invalid", "Scenario step target is required");
  if (text.startsWith("testid:")) {
    const id = text.slice("testid:".length);
    if (!id) throw invalid(text, "names no test id");
    return { kind: "testid", id };
  }
  if (text.startsWith("role:")) return parseRole(text);
  if (text.startsWith("frame:")) {
    const body = text.slice("frame:".length);
    const separator = body.indexOf("/");
    const title = separator < 0 ? "" : body.slice(0, separator);
    const inner = separator < 0 ? "" : body.slice(separator + 1);
    if (!title || !inner) throw invalid(text, "must read frame:<title>/<target>");
    return { kind: "frame", title, inner: parseScenarioTarget(inner) };
  }
  return { kind: "css", selector: text };
}

function parseRole(text: string): ScenarioTarget {
  const body = text.slice("role:".length);
  const legacy = LEGACY_ROLE_NAME.exec(body);
  if (legacy) return { kind: "role", role: legacy[1]!, name: legacy[2]! };
  const separator = body.indexOf(":");
  const role = separator < 0 ? body : body.slice(0, separator);
  if (!ROLE.test(role)) throw invalid(text, "names no ARIA role");
  if (separator < 0) return { kind: "role", role };
  const name = body.slice(separator + 1);
  if (!name) throw invalid(text, "has an empty accessible name");
  return { kind: "role", role, name };
}

function invalid(text: string, reason: string): RunnerFailure {
  return new RunnerFailure("fixture.invalid", `Scenario target ${JSON.stringify(text)} ${reason}`);
}
