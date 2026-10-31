import assert from "node:assert/strict";
import test from "node:test";
import { runAutomationStudioFlowCandidateAuthoringLoop } from "fluxiq/automation-studio";
import type { WebLlmEvidenceGateway } from "../../capture";
import { createWebAutomationLlmEvidenceRuntime } from "../../tools";
import { exampleSupport } from "./support";

test("the actual candidate submit schema carries the unchanged wrapper and four pinned original web sections", async () => {
  const { registry, resolution, sections } = exampleSupport;
  let executions = 0;
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => [],
    executeAction: async () => {
      executions += 1;
      throw new Error("no gateway should execute");
    }
  };
  const binding = createWebAutomationLlmEvidenceRuntime(gateway);
  const captured: unknown[] = [];
  const stop = new Error("captured actual schema before the loop starts");
  await assert.rejects(runAutomationStudioFlowCandidateAuthoringLoop({
    submission: {
      projectId: "project.examples", flowId: "flow.examples", registry, resolution,
      baseDependencyDigest: "accepted.examples", binding
    },
    observe: (loop) => {
      const tool = loop.tools.find((item) => item.toolId === "core.submit_candidate");
      assert.ok(tool);
      const properties = tool.inputSchema.properties as { flow: { description: unknown } };
      captured.push(properties.flow.description);
      throw stop;
    },
    loop: {
      tools: [], maxIterations: 1, maxToolCalls: 1,
      executeTool: async () => { throw new Error("no tool should execute"); },
      decide: async () => { throw new Error("no model should execute"); }
    }
  }), (error: unknown) => error === stop);
  assert.equal(executions, 0);
  assert.deepEqual(captured, [`The whole Flow as a script. ${sections.format}\n${sections.act}\n${sections.loop}\n${sections.state}`]);
});

// Subflow builder-loop is private to Core. Its owning schema-capture tests
// assert the actual unchanged brief wrapper and ordered sections for six
// metadata cases. Down's parity tests independently fix all four rendered web
// sections to their original byte/hash pins. No private builder is imported.
