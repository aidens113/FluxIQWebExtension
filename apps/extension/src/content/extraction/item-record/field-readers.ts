// The included fields of a `web.dom.extract_list` request, normalized before
// anything on the page is read (`list-reader.ts`, decision D12). Moved out of
// `list-reader.ts` on 2026-10-20 with the rest of `item-record/`, unchanged.

import type { WebAutomationExtractListRequest } from "../../types";
import { normalizeExtractField, type ExtractFieldReader } from "../field-spec";

export type FieldReaders = ReadonlyArray<readonly [name: string, reader: ExtractFieldReader]>;

/** The included fields' readers, in declaration order, refusing a request that names none or reads none. */
export function fieldReaders(fields: WebAutomationExtractListRequest["fields"]): FieldReaders {
  const declared = Object.entries(fields);
  if (declared.length === 0) throw new Error("An extract_list request names no fields.");
  const readers = declared.flatMap(([name, field]) => {
    const reader = normalizeExtractField(name, field);
    return reader === undefined ? [] : [[name, reader] as const];
  });
  if (readers.length === 0) throw new Error("An extract_list request reads no fields: every field it names is excluded.");
  return readers;
}
