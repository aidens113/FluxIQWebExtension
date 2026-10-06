// The authoring tool that finds a repeating structure and hands the model an
// opaque extraction handle for it, and the store that remembers what each
// handle stands for.
//
// `detect.ts` is the tool, `packet.ts` splits what the page detected into the
// model's half and the handle's half, `handles.ts` keeps the handle's half
// behind `resolveExtractionHandle`, and `refusal.ts` says which of the four
// things "no repeating structure" means happened. `list-name.ts` reads what the
// page calls the list, for the packet's `list`. Neither of those two is
// re-exported: nothing outside this directory refuses a detection or names one.

export { detectRepeatingStructure, type WebLlmStructureDetectionContext } from "./detect";
export {
  createWebLlmExtractionHandles,
  RETAINED_EXTRACTION_HANDLES,
  WEB_LLM_EXTRACTION_HANDLE_PATTERN,
  type WebLlmExtractionBinding,
  type WebLlmExtractionHandleResolution,
  type WebLlmExtractionHandles,
  type WebLlmExtractionHandleScope
} from "./handles";
export {
  WEB_LLM_STRUCTURE_PAGINATION_MODES,
  WEB_LLM_STRUCTURE_SCHEMA_VERSION,
  type WebLlmRepeatingStructure,
  type WebLlmStructureField,
  type WebLlmStructurePaginationMode
} from "./packet";
