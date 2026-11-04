import type { SubflowLastingClass } from "@fluxiq/ui-components";
import { list } from "./values";

const CLASSES: readonly string[] = ["move_money", "delete", "send_or_publish", "modify_existing", "create_new"];

/** The lasting classes Core names, in the order it gave them, and nothing it did not. */
export function readClasses(value: unknown): SubflowLastingClass[] {
  return list(value).filter((item): item is SubflowLastingClass => typeof item === "string" && CLASSES.includes(item));
}
