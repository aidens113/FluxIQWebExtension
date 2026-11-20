import type { BrowserActionResult } from "../../types";

/** The place as the domain's summary carries it (`domain/src/actions/extraction/list-continues.ts`). */
export type ExtractionPlace = NonNullable<NonNullable<BrowserActionResult["extraction"]>["place"]>;
