import { stableFingerprintMatches, type ElementFingerprint } from "../../element-finder";
import { accessibleNameFor, normalizedText } from "../../identity";
import type { LookupRoot } from "../../selector";
import type { DomElementContext } from "../../types";
import { inRecordedLandmark } from "./in-recorded-landmark";
import { scanTagMatches } from "./scan-tag-matches";

/** What a read target's fingerprint lookup reads of it. */
type ReadFingerprint = ElementFingerprint & {
  role?: string | undefined;
  implicitRole?: string | undefined;
  accessibleName?: string | undefined;
  context?: DomElementContext | undefined;
};

/**
 * What a read's fingerprint matches (`./index.ts`): its stable signals, and its
 * accessible name only where that name is not the words it reads -- the reading
 * `identity/read-words.ts` gives the veto and the scorer -- each in the recorded
 * landmark. Never its words. A role-less target only, as the resolver's own
 * name lookup: a target with a role is left to enumeration.
 */
export function readFingerprintMatches(target: ReadFingerprint, roots: readonly LookupRoot[]): Element[] {
  const { visibleText, ...stable } = target;
  const placed = (elements: Element[]): Element[] => elements.filter((element) => inRecordedLandmark(target.context, element));
  const exact = placed(roots.flatMap((root) => stableFingerprintMatches(stable, root).matches));
  if (exact.length) return exact;
  const words = normalizedText(visibleText)?.toLowerCase();
  const name = target.role?.trim() || target.implicitRole?.trim() ? undefined : normalizedText(target.accessibleName);
  if (!name || words === undefined || name.toLowerCase() === words) return [];
  return placed(scanTagMatches(target.tagName, roots, (element) => accessibleNameFor(element) === name));
}
