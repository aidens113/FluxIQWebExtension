import { createHash } from "node:crypto";
import type { JsonObject } from "fluxiq/core";
import { createWebAutomationLlmEvidenceRuntime } from "@fluxiq-web-extension/domain";
import type { InstalledBuild } from "./installed-build";

/** A short stable digest: the proofs compare evidence by it and never print page values. */
export const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value) ?? "undefined").digest("hex").slice(0, 20);

const record = (value: unknown): JsonObject => typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonObject : {};

/** One start-state read the domain answered: its complete lists by opaque token, and its stateful controls. */
export type ObservedRead = {
  call: string;
  location?: string;
  scope?: string;
  scopes: string[];
  groups: string[];
  sizes: number[];
  hash: string;
  subjects: string[];
  resourceHash?: string;
  stateHashes: string[][];
  controls?: Record<string, Record<string, number>>;
};

/** One permission question the domain put to Core, with the control tokens it carried. */
export type ObservedDeclaration = {
  call: string;
  consequences: unknown;
  scope?: string;
  subject?: string;
  page?: string;
  item?: string;
  dialog?: string;
  place?: string;
  state?: string;
  resourceHash?: string;
  permitted: boolean;
};

/** What every tool call answered. */
export type ObservedOutcome = { call: string; tool: string; ok: unknown; code: unknown };

export type InstrumentedRuntime = {
  reads: ObservedRead[];
  declarations: ObservedDeclaration[];
  outcomes: ObservedOutcome[];
  /** Click actions dispatched to the browser so far, by any caller: the builder, a trial, or Core's own look. */
  clicks: () => number;
};

/**
 * Binds the real web-automation evidence runtime to the build, observing it
 * without changing anything it does: start-state answers, permission
 * declarations, tool outcomes and dispatched clicks are recorded as the
 * gateway carried them.
 */
export function bindInstrumentedRuntime(build: Pick<InstalledBuild, "fluxiq" | "service">): InstrumentedRuntime {
  const { fluxiq, service } = build;
  const reads: ObservedRead[] = [];
  const declarations: ObservedDeclaration[] = [];
  const outcomes: ObservedOutcome[] = [];
  let clickDispatches = 0;
  const runtime = createWebAutomationLlmEvidenceRuntime({
    eligibleSessionIds: () => fluxiq.programs.clientGateway.snapshot().sessions.filter(session => session.status === "ready").map(session => session.sessionId),
    executeAction: (session, command) => {
      if (command.actionType === "web.dom.click") clickDispatches++;
      return fluxiq.programs.automationStudioClientGateway.executeAction(session, command);
    }
  });
  const startState = runtime.startState!.bind(runtime);
  runtime.startState = async input => {
    const result = await startState(input);
    if (result) {
      const collections = result.collections ?? [];
      reads.push({
        call: input.callId,
        ...(typeof result.location === "string" ? { location: result.location } : {}),
        ...(typeof result.scope === "string" ? { scope: result.scope } : {}),
        scopes: collections.map(collection => collection.scope),
        groups: collections.map(collection => collection.group),
        sizes: collections.map(collection => collection.subjects.length),
        hash: digest(collections),
        subjects: collections.flatMap(collection => collection.subjects),
        ...(result.resource ? { resourceHash: digest(result.resource) } : {}),
        stateHashes: collections.map(collection => collection.subjects.map(subject => digest(collection.states[subject]))),
        ...(result.controls ? { controls: structuredClone(result.controls) } : {})
      });
    }
    return result;
  };
  const execute = runtime.executeTool.bind(runtime);
  runtime.executeTool = async input => {
    const permission = input.permission;
    const watched = permission ? { permission: async (declaration: Parameters<typeof permission>[0]) => {
      const verdict = await permission(declaration);
      const control = declaration.control;
      declarations.push({
        call: input.callId,
        consequences: declaration.consequences,
        ...(control?.scope ? { scope: control.scope } : {}),
        ...(control?.subject ? { subject: control.subject } : {}),
        ...(control?.page ? { page: control.page } : {}),
        ...(control?.item ? { item: control.item } : {}),
        ...(control?.dialog ? { dialog: control.dialog } : {}),
        ...(control?.place ? { place: control.place } : {}),
        ...(control?.state ? { state: control.state } : {}),
        ...(control?.resource ? { resourceHash: digest(control.resource) } : {}),
        permitted: verdict.permitted
      });
      return verdict;
    } } : {};
    const result = await execute({ ...input, ...watched });
    const evidence = record(result.evidence);
    outcomes.push({ call: input.callId, tool: input.toolId, ok: evidence.ok, code: evidence.code });
    return result;
  };
  service.bindLlmEvidenceRuntime(runtime);
  return { reads, declarations, outcomes, clicks: () => clickDispatches };
}
