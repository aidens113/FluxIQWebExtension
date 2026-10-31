import assert from "node:assert/strict";
import {
  AutomationStudioNodeRegistry,
  renderAutomationStudioFlowScriptFormat
} from "fluxiq/automation-studio";
import { listWebAutomationOutputNodeDefinitions } from "../../../../output-nodes";
import { WEB_FLOW_SCRIPT_EXAMPLES } from "../index";
import { WEB_FLOW_SCRIPT_GUIDANCE } from "../../script-guidance";

const resolution = { scope: { kind: "domain" as const, domainId: "web-automation" }, runtimeCapabilities: ["web.actions"], permissions: ["web-automation.action"] };
const registry = new AutomationStudioNodeRegistry();
for (const definition of listWebAutomationOutputNodeDefinitions()) registry.register(definition);
const sections = renderAutomationStudioFlowScriptFormat(WEB_FLOW_SCRIPT_EXAMPLES, WEB_FLOW_SCRIPT_GUIDANCE);

function blocks(text: string): Array<[string, string]> {
  const found: Array<[string, string[]]> = [];
  for (const line of text.split("\n")) {
    if (/^Example\b.*:$/u.test(line)) found.push([line, []]);
    else found.at(-1)?.[1].push(line);
  }
  return found.map(([name, lines]) => [name, lines.join("\n")]);
}

function subset(actual: unknown, expected: unknown): void {
  if (expected !== null && typeof expected === "object" && !Array.isArray(expected)) {
    assert.ok(actual !== null && typeof actual === "object");
    for (const [key, value] of Object.entries(expected)) subset((actual as Record<string, unknown>)[key], value);
  } else assert.deepEqual(actual, expected);
}

export const exampleSupport = { resolution, registry, sections, blocks, subset };
