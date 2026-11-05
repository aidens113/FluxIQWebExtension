import type { SubflowCard, SubflowValue } from "@fluxiq/ui-components";
import { readClasses } from "./classes";
import { count, list, record, text } from "./values";

const TIERS: readonly string[] = ["unproven", "provisional", "established"];

function readValues(value: unknown): SubflowValue[] {
  return list(value).flatMap((item) => {
    const port = record(item);
    const id = text(port?.id);
    const name = text(port?.name);
    return id === undefined || name === undefined ? [] : [{ id, name, required: port?.required === true }];
  });
}

function readCheck(value: unknown): SubflowCard["startCheck"] {
  const check = record(value);
  const conditions = count(check?.conditions);
  if (conditions === undefined) return undefined;
  const says = text(check?.says);
  return says === undefined ? { conditions } : { conditions, says };
}

/**
 * One card as Core lists it, with the hashes and digests left behind: they never reach a person. A card without an
 * id, a name or a trust tier is not shown, because a row of guesses is worse than a missing row.
 */
export function readCard(value: unknown): SubflowCard | undefined {
  const card = record(value);
  const partId = text(card?.partId);
  const name = text(card?.name);
  const version = count(card?.version);
  const trust = record(card?.trust);
  const counts = record(trust?.counts);
  const tier = trust?.tier;
  if (card === undefined || partId === undefined || name === undefined || version === undefined || typeof tier !== "string" || !TIERS.includes(tier)) return undefined;
  const lastFailureAtMs = count(trust?.lastFailureAtMs);
  const startCheck = readCheck(card.startCheck);
  const endCheck = readCheck(card.endCheck);
  return {
    partId,
    version,
    name,
    purpose: text(card.purpose) ?? "",
    sites: list(card.sites).filter((site): site is string => typeof site === "string"),
    inputs: readValues(card.inputs),
    outputs: readValues(card.outputs),
    fixedValues: list(card.fixedValues).filter((item): item is string => typeof item === "string"),
    lastingClasses: readClasses(card.lastingClasses),
    ...(startCheck === undefined ? {} : { startCheck }),
    ...(endCheck === undefined ? {} : { endCheck }),
    calls: list(card.calls).flatMap((call) => {
      const pin = record(call);
      const callee = text(pin?.partId);
      const pinned = count(pin?.version);
      return callee === undefined || pinned === undefined ? [] : [{ partId: callee, version: pinned }];
    }),
    trust: {
      tier: tier as SubflowCard["trust"]["tier"],
      counts: { judgedYes: count(counts?.judgedYes) ?? 0, zeroModelRuns: count(counts?.zeroModelRuns) ?? 0, failures: count(counts?.failures) ?? 0 },
      ...(lastFailureAtMs === undefined ? {} : { lastFailureAtMs })
    }
  };
}
