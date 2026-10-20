// Which Flow a live run spends on, and reading that Flow's spend from Core.
//
// Core keeps one purse per Flow (`./flow-spend.ts`), so the run's spend is
// read by the Flow's id. A direct build and the Flow's playback name it to the
// run's hooks (`buildAuthorizer`, `repairAuthorizer`) and the playback's run
// detail carries it. A build typed into the extension's chat does not: FluxIQ's
// chat makes the Flow inside its own command. Its Flow is the one the project
// gained during the build, found the way the chat lane finds it
// (`flow-lane/creation/chat/chat-thread.ts`, `projectFlowIds`): the project's
// Flows are listed before the chat is sent and again at settlement, and the
// one new Flow, Subflow graphs left out, is the run's. Anything else -- no new
// Flow, or several -- names no Flow, and the spend is reported unknown.

import type { ExistingFlowSpend } from "../existing-fluxiq-control/index.js";
import { liveLlmRunSpend, type LiveLlmFlowSpendControl, type LiveLlmRunSpend } from "./flow-spend.js";

/** What lists a project's Flows: Core's `list-flows`, as the chat lane reads it. */
type LiveLlmFlowListControl = { automationStudioCall(endpoint: string, payload: Record<string, unknown>): Promise<unknown> };

export class LiveLlmFlowSpendReader {
  private control: LiveLlmFlowSpendControl | undefined;
  private projectId: string | undefined;
  private flowId: string | null = null;
  private flowsBefore: { control: LiveLlmFlowListControl; ids: ReadonlySet<string> } | undefined;

  /** The run's Flow, named by a hook or a run detail. A control without the spend read leaves the read to a later one that has it. */
  name(control: object, projectId: string, flowId: string): void {
    this.remember(control, projectId);
    this.flowId = flowId;
  }

  /**
   * Before a chat build: the project's Flows as they stand, so settlement can
   * tell the one the chat makes. Only a control that can also read the spend
   * is listed; a read that fails is raised, as the chat lane's own is.
   */
  async beforeChatBuild(control: LiveLlmFlowListControl, projectId: string): Promise<void> {
    if (!hasSpendRead(control)) return;
    this.remember(control, projectId);
    this.flowsBefore = { control, ids: new Set(await projectFlowIds(control, projectId)) };
  }

  /** The Flow's spend as Core recorded it now, or why it is unknown. Never raises: a read that failed is `unreadable`. */
  async read(ceilingUsd: number): Promise<LiveLlmRunSpend> {
    const control = this.control;
    const projectId = this.projectId;
    if (!control || !projectId) return liveLlmRunSpend(null, ceilingUsd, "flow_unknown");
    let spend: ExistingFlowSpend | null;
    try {
      const flowId = this.flowId ?? await this.chatFlow(projectId);
      if (flowId === null) return liveLlmRunSpend(null, ceilingUsd, "flow_unknown");
      spend = await control.getFlowSpend(projectId, flowId);
    } catch {
      return liveLlmRunSpend(null, ceilingUsd, "unreadable");
    }
    return liveLlmRunSpend(spend, ceilingUsd, "no_record");
  }

  /** The one Flow the project gained since `beforeChatBuild`, or `null`. */
  private async chatFlow(projectId: string): Promise<string | null> {
    if (!this.flowsBefore) return null;
    const before = this.flowsBefore.ids;
    const made = (await projectFlowIds(this.flowsBefore.control, projectId)).filter((flowId) => !before.has(flowId));
    if (made.length !== 1) return null;
    this.flowId = made[0]!;
    return this.flowId;
  }

  private remember(control: object, projectId: string): void {
    this.projectId = projectId;
    if (hasSpendRead(control)) this.control = control;
  }
}

function hasSpendRead(control: object): control is LiveLlmFlowSpendControl & object {
  return typeof (control as Partial<LiveLlmFlowSpendControl>).getFlowSpend === "function";
}

/** The project's own Flows by id, Subflow graphs left out (`metadata.subflowGraph`), as the chat lane counts them. */
async function projectFlowIds(control: LiveLlmFlowListControl, projectId: string): Promise<string[]> {
  const listed = asRecord(await control.automationStudioCall("list-flows", { projectId }));
  return (Array.isArray(listed?.flows) ? listed.flows : []).flatMap((entry: unknown) => {
    const item = asRecord(entry);
    const flow = asRecord(item?.flow) ?? item;
    if (!flow || typeof flow.flowId !== "string") return [];
    return asRecord(flow.metadata)?.subflowGraph === true ? [] : [flow.flowId];
  });
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}
