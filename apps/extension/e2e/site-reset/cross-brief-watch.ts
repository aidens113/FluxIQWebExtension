import { AsyncLocalStorage } from "node:async_hooks";
import type { JsonObject } from "fluxiq/core";
import type { InstalledBuild } from "./installed-build";

const record = (value: unknown): JsonObject => typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonObject : {};

/** One evidence-runtime call as the gateway carried it: who made it, where a navigation went, what it answered, and every browser command it sent. */
export type CrossBriefCall = {
  call: string;
  tool: string;
  /** The node the call named, as written. */
  node?: string;
  /** A navigation's address, as the call wrote it (Lab fixture addresses only). */
  url?: string;
  /** The keys of the call's value, for an opening call (`initial.*`) only. */
  openingKeys?: string[];
  /** `places` on an opening call's value, as Core sent them. */
  places?: string[];
  ok: unknown;
  code: unknown;
  /** Each browser command this call dispatched, by action type, in order. */
  actions: string[];
};

export type CrossBriefWatch = { calls: CrossBriefCall[] };

/**
 * Watches every evidence-runtime call of a build without changing it: the
 * value an opening call carried (`places`), each navigation's address, its
 * answer's code, and every browser command dispatched while it ran -- so a
 * spec can tell a call that sent a navigation from one refused unrun. Binds
 * around whatever runtime is bound next, so it must be called before
 * `bindInstrumentedRuntime`.
 */
export function watchCrossBrief(build: Pick<InstalledBuild, "fluxiq" | "service">): CrossBriefWatch {
  const calls: CrossBriefCall[] = [];
  const running = new AsyncLocalStorage<CrossBriefCall>();
  const gateway = build.fluxiq.programs.automationStudioClientGateway;
  const executeAction = gateway.executeAction.bind(gateway);
  gateway.executeAction = ((session: Parameters<typeof executeAction>[0], command: Parameters<typeof executeAction>[1]) => {
    running.getStore()?.actions.push(String(record(command).actionType ?? "unknown"));
    return executeAction(session, command);
  }) as typeof gateway.executeAction;
  const service = build.service;
  const bind = service.bindLlmEvidenceRuntime.bind(service);
  service.bindLlmEvidenceRuntime = (runtime => {
    const execute = runtime.executeTool.bind(runtime);
    runtime.executeTool = async input => {
      const value = record((input as unknown as { value?: unknown }).value);
      const parameters = record(value.parameters);
      const opening = input.callId.startsWith("initial.");
      const places = Array.isArray(value.places) ? value.places.filter((place): place is string => typeof place === "string") : undefined;
      const entry: CrossBriefCall = {
        call: input.callId,
        tool: input.toolId,
        ...(typeof value.node === "string" ? { node: value.node } : {}),
        ...(typeof parameters.url === "string" ? { url: parameters.url } : {}),
        ...(opening ? { openingKeys: Object.keys(value).sort() } : {}),
        ...(opening && places ? { places } : {}),
        ok: null,
        code: null,
        actions: []
      };
      calls.push(entry);
      const result = await running.run(entry, () => execute(input));
      // A tool answers an execution with its evidence, or a bare value (`record` reads anything else as empty).
      const evidence = record(record(result).evidence);
      entry.ok = evidence.ok ?? null;
      entry.code = evidence.code ?? null;
      return result;
    };
    return bind(runtime);
  }) as typeof service.bindLlmEvidenceRuntime;
  return { calls };
}
