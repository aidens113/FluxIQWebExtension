// The domain binding a rebuild hands Core's compiler in place of the build's.
//
// A script names elements by build handles (`t476`, `extraction.1`), and what a
// handle means lived only in the build process: the web domain numbers and
// keeps them in memory as it shows the model each page
// (`domain/src/runtime/llm-evidence/plan-resolution/target-packets.ts`); the
// build's durable state keeps shown addresses and opened layers, never them. So
// Core's compiler, asking the domain to resolve each step
// (`binding.resolvePlanNodeParameters`), is answered here from what the build
// itself resolved, as the persisted candidate holds it
// (`./recorded-resolutions.ts`), and from nothing else:
//
// - a step written exactly as a recorded step is answered with that step's
//   resolution (`unchanged` where the resolution is what was written);
// - a step naming no handle at all is answered `unchanged`, as the domain
//   answers a literal step;
// - a read written as a recorded read except in its `where` clause is answered
//   with the recorded resolution and the clause read by the domain's own
//   condition reader over the recorded read's columns, but only when that
//   reader, run on the recorded read's own clause, gives back exactly what the
//   build resolved (`verifiedWhere`);
// - a read written as a recorded read except in its Core-side record
//   processing (`recordOutput.process`, a tier-1 change) is answered with the
//   recorded resolution and that processing as written, but only when the
//   recorded read's own processing reached its resolution as it was written,
//   or was not written and reached it as Core's default (`verifiedProcess`):
//   processing is handed on, and Core applies it after the rows are stored.
//   That a written processing replaces the default whole is an assumption no
//   recorded twin can check, so a rebuild answered this way is a new
//   candidate, never a verified one;
// - anything else is refused `web.handle.unknown`, as the domain refuses a
//   handle it does not hold, and noted with how it differs from the nearest
//   recorded step of its node.
//
// Core's digests of what comes out are compared with the recorded ones by the
// caller: a seam that answered differently from the build cannot pass that.

import type { JsonObject, JsonValue } from "fluxiq/core";
import type { CoreAuthoring } from "./core-authoring.js";
import { differingPaths } from "./differing-paths.js";
import type { RecordedResolution, UnresolvedStep } from "../types.js";

/** What Core asks the binding for one step, narrowed to what this answers by. */
export type ResolutionRequest = { nodeDefinitionId: string; parameters: JsonObject; writtenByModel?: boolean };

export type ResolutionAnswer = { status: "resolved"; parameters: JsonObject } | { status: "unchanged" } | { status: "refused"; issueCodes: string[] };

export type RecordedResolutionBinding = Readonly<{
  binding: { runsNodes: unknown; resolvePlanNodeParameters(input: ResolutionRequest): Promise<ResolutionAnswer> };
  /** Every step refused so far, in the order Core asked. */
  unresolved(): readonly UnresolvedStep[];
}>;

const WHERE_PATH = "extractList.where";
const PROCESS_PATH = "recordOutput.process";
const seamPath = (path: string): boolean => path === WHERE_PATH || path === PROCESS_PATH || path.startsWith(`${PROCESS_PATH}.`);

export function recordedResolutionBinding(input: {
  resolutions: readonly RecordedResolution[];
  runsNodes: unknown;
  conditions: CoreAuthoring["extractionConditions"];
  canonical: (value: unknown) => string;
}): RecordedResolutionBinding {
  const { canonical } = input;
  const missed: UnresolvedStep[] = [];
  const exact = new Map(input.resolutions.map((entry) => [canonical({ node: entry.nodeDefinitionId, written: entry.written }), entry]));
  const verified = new Set(input.resolutions.filter((entry) => verifiedWhere(entry, input.conditions, canonical)));
  const passesProcess = new Set(input.resolutions.filter((entry) => verifiedProcess(entry, canonical)));
  const answer = (entry: RecordedResolution, resolved: JsonObject, written: JsonObject): ResolutionAnswer =>
    canonical(resolved) === canonical(written) ? { status: "unchanged" } : { status: "resolved", parameters: structuredClone(resolved) };
  const refuse = (request: ResolutionRequest, reason: string): ResolutionAnswer => {
    missed.push(Object.freeze({ nodeDefinitionId: request.nodeDefinitionId, differingPaths: Object.freeze(nearestDifference(request, input.resolutions, canonical)), reason }));
    return { status: "refused", issueCodes: ["web.handle.unknown"] };
  };
  return Object.freeze({
    binding: {
      runsNodes: input.runsNodes,
      async resolvePlanNodeParameters(request: ResolutionRequest): Promise<ResolutionAnswer> {
        // A composed Flow's steps were resolved when each proposal was accepted; Core asks again only as itself.
        if (request.writtenByModel !== true) return { status: "unchanged" };
        const recorded = exact.get(canonical({ node: request.nodeDefinitionId, written: request.parameters }));
        if (recorded) return answer(recorded, recorded.resolved, request.parameters);
        if (!namesHandle(request.parameters)) return { status: "unchanged" };
        const reads = input.resolutions.filter((entry) => entry.nodeDefinitionId === request.nodeDefinitionId && differingPaths(entry.written, request.parameters, canonical).every(seamPath));
        const read = reads[0];
        if (!read) return refuse(request, "no recorded resolution: the build resolved no step written this way, and its handles' meanings lived only in the build process");
        const differs = differingPaths(read.written, request.parameters, canonical);
        const resolved = structuredClone(read.resolved);
        if (differs.includes(WHERE_PATH)) {
          if (!verified.has(read)) return refuse(request, "the recorded read differs only in its where clause, but the domain's condition reader does not give back the recorded read's own clause, so it cannot stand in for the build here");
          const where = readWhere(request.parameters, read, input.conditions);
          if (!where.ok) return refuse(request, `the domain's condition reader refused the where clause (${where.issue})`);
          const list = resolved.extractList as JsonObject;
          if (where.where.length > 0) list.where = where.where as JsonValue;
          else delete list.where;
        }
        if (differs.some((path) => path !== WHERE_PATH)) {
          if (!passesProcess.has(read)) return refuse(request, "the recorded read differs only in its record processing, but its own processing did not reach its resolution as written, so it cannot stand in for the build here");
          const output = resolved.recordOutput as JsonObject;
          const process = (request.parameters.recordOutput as JsonObject | undefined)?.process;
          if (process === undefined) delete output.process;
          else output.process = structuredClone(process);
        }
        return answer(read, resolved, request.parameters);
      },
    },
    unresolved: () => Object.freeze([...missed]),
  });
}

/**
 * Whether the recorded read's Core-side processing reached its resolution as
 * it was written, or was left unwritten and resolved to the default alone
 * (`minRows` and nothing else): no condition, order or cut the build added
 * that a written processing would have to keep (header).
 */
function verifiedProcess(entry: RecordedResolution, canonical: (value: unknown) => string): boolean {
  const written = entry.written.recordOutput;
  const resolved = entry.resolved.recordOutput;
  if (!isObject(written) || !isObject(resolved)) return false;
  if (written.process !== undefined) return resolved.process !== undefined && canonical(written.process) === canonical(resolved.process);
  return resolved.process === undefined || (isObject(resolved.process) && Object.keys(resolved.process).every((key) => key === "minRows"));
}

/** Whether the domain's reader, given the recorded read's own clause, gives back exactly the clause the build resolved (header). */
function verifiedWhere(entry: RecordedResolution, conditions: CoreAuthoring["extractionConditions"], canonical: (value: unknown) => string): boolean {
  const list = entry.resolved.extractList;
  if (!isObject(list) || !isObject(entry.written.extractList)) return false;
  const read = readWhere(entry.written, entry, conditions);
  if (!read.ok) return false;
  return read.where.length === 0 ? list.where === undefined : canonical(read.where) === canonical(list.where);
}

/**
 * The domain's reading of `written`'s where clause over the recorded read's
 * columns: those the plan keeps under its own keys, and the detected columns
 * those keys were written from (each written field value, a detected column's
 * name, standing for the column the build resolved it to).
 */
function readWhere(written: JsonObject, recorded: RecordedResolution, conditions: CoreAuthoring["extractionConditions"]): ReturnType<CoreAuthoring["extractionConditions"]> {
  const writtenList = isObject(written.extractList) ? written.extractList : {};
  const resolvedList = isObject(recorded.resolved.extractList) ? recorded.resolved.extractList : {};
  const kept = isObject(resolvedList.fields) ? resolvedList.fields : {};
  const detected: Record<string, unknown> = {};
  const writtenFields = isObject(writtenList.fields) ? writtenList.fields : {};
  for (const [key, name] of Object.entries(writtenFields)) if (typeof name === "string" && kept[key] !== undefined) detected[name] = kept[key];
  if (writtenList.where === undefined) return { ok: true, where: [] };
  return conditions(writtenList.where, { detected, kept: kept as Record<string, unknown> }, ["where"]);
}

/** Whether any value names a build handle: a `{handle}` reference, or a target or extraction handle written bare. */
function namesHandle(value: unknown): boolean {
  if (typeof value === "string") return /^(t\d+|target\.\d+|extraction\.\d+)$/.test(value.trim());
  if (Array.isArray(value)) return value.some(namesHandle);
  if (isObject(value)) return Object.hasOwn(value, "handle") || Object.values(value).some(namesHandle);
  return false;
}

/** The fewest differing paths against any recorded step of the request's node; none recorded, none named. */
function nearestDifference(request: ResolutionRequest, resolutions: readonly RecordedResolution[], canonical: (value: unknown) => string): string[] {
  let best: string[] | undefined;
  for (const entry of resolutions) {
    if (entry.nodeDefinitionId !== request.nodeDefinitionId) continue;
    const paths = differingPaths(entry.written, request.parameters, canonical);
    if (best === undefined || paths.length < best.length) best = paths;
  }
  return best ?? [];
}

function isObject(value: unknown): value is Record<string, JsonValue> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
