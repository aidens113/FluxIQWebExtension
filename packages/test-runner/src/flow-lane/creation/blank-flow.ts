// The Flow a live build fills in: a new, blank, top-level Flow in the run's
// own project. Core builds only onto a blank orchestration Flow with no Router
// and no Subflow (`assertBlankBootstrapTarget`), so that is checked here, where
// a Core that seeds new Flows with anything fails before a grant is issued
// rather than as a generation refusal after one.

import { RunnerFailure } from "../../failure.js";
import type { FluxIQHttpOptions } from "../../http-control/index.js";

export type BlankFlowControl = {
  automationStudioCall(endpoint: string, payload: Record<string, unknown>, bounds?: FluxIQHttpOptions, domainId?: string): Promise<unknown>;
};

/** Creates the Flow through Core's own `create-flow`, which chooses its id, and returns that id once the Flow is shown to be blank. */
export async function createBlankCreationFlow(
  control: BlankFlowControl,
  input: { projectId: string; name: string; authorizationPin: string },
  bounds: FluxIQHttpOptions = {},
): Promise<string> {
  const created = record(await control.automationStudioCall("create-flow", {
    projectId: input.projectId,
    name: input.name,
    description: "FluxIQ Testing Lab: built from a live instruction task",
    authorizationPin: input.authorizationPin,
  }, bounds), "create-flow payload");
  const flowId = identifier(record(created.flow, "create-flow flow").flowId, "create-flow flow.flowId");
  const flow = record(record(await control.automationStudioCall("get-flow", { projectId: input.projectId, flowId }, bounds), "get-flow payload").flow, "get-flow flow");
  const metadata = flow.metadata === undefined ? {} : record(flow.metadata, "get-flow flow.metadata");
  const representation = metadata.flowRepresentationKind;
  if (!isEmptyArray(flow.nodes) || !isEmptyArray(flow.edges) || (representation !== undefined && representation !== "orchestration") || metadata.subflowGraph === true) {
    throw notBlank(flowId, "it is not an empty orchestration Flow");
  }
  const subflows = record(await control.automationStudioCall("list-flow-subflows", { projectId: input.projectId, flowId, limit: 1, offset: 0 }, bounds), "list-flow-subflows payload");
  const page = subflows.page === undefined ? undefined : record(subflows.page, "list-flow-subflows page");
  const listed = subflows.subflows ?? page?.subflows;
  if (!Array.isArray(listed) || listed.length !== 0) throw notBlank(flowId, "it already owns a Subflow");
  const router = record(await control.automationStudioCall("get-flow-router", { projectId: input.projectId, flowId }, bounds), "get-flow-router payload");
  if (router.router != null) throw notBlank(flowId, "it already has a Router");
  return flowId;
}

function notBlank(flowId: string, why: string): RunnerFailure {
  return new RunnerFailure("runtime.behavior", `Core created a Flow a live build cannot fill: ${why}`, { details: { flowId } });
}

function isEmptyArray(value: unknown): boolean {
  return Array.isArray(value) && value.length === 0;
}

function record(value: unknown, at: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new RunnerFailure("runtime.behavior", `${at} must be an object`);
  return value as Record<string, unknown>;
}

function identifier(value: unknown, at: string): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/u.test(value)) throw new RunnerFailure("runtime.behavior", `${at} must be a bounded identifier`);
  return value;
}
