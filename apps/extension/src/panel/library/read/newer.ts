import type { SubflowCallerNewer } from "@fluxiq/ui-components";
import { record, text } from "./values";

/** A caller's note that a newer version passed: Core's own words, and whether it passed a judged run. Nothing without the words. */
export function readNewer(value: unknown): SubflowCallerNewer | undefined {
  const newer = record(value);
  const said = text(newer?.said);
  return newer === undefined || said === undefined ? undefined : { passed: newer.passedElsewhere === true, said };
}
