import type { WebAutomationElementContext } from "../../actions/types";
import { webRecordedRecordValueMatches } from "./value-match";

type Identity = NonNullable<WebAutomationElementContext["record"]>;

/** A saved record gates a candidate even when its control is the only descriptive match. */
export function webRecordedRecordMatches(recorded: Identity | undefined, candidate: Identity | undefined): boolean {
  if (recorded === undefined) return true;
  if (candidate === undefined || recorded.values?.length) return false;
  const key = normalized(recorded.key);
  if (key !== undefined) {
    const attribute = normalized(recorded.keyAttribute);
    if (attribute !== undefined && attribute !== normalized(candidate.keyAttribute)) return false;
    return webRecordedRecordValueMatches(normalized(candidate.key), key, "key");
  }
  const text = normalized(recorded.text)?.toLowerCase();
  return text !== undefined && webRecordedRecordValueMatches(normalized(candidate.text)?.toLowerCase(), text, "text");
}

function normalized(value: string | undefined): string | undefined {
  const text = value?.replace(/\s+/gu, " ").trim();
  return text || undefined;
}
