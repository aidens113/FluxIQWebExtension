import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AutomationStudioService } from "fluxiq/automation";
import type { CreatedFlowBuildRequest } from "../../flow-lane/index.js";
import { RECORDED_CAPTURE_FILES } from "./files.js";
import { recordedStartReceipt, type RecordedStartFacts } from "./receipt.js";
import { recordedCaptureServiceEntry } from "./service-entry.js";

type ServiceRequest = Parameters<AutomationStudioService["generateFlowBootstrapAdaptation"]>[0];
type Configuration = { facts: RecordedStartFacts; declared: CreatedFlowBuildRequest; wireFile: string };

/**
 * Binds the stopped store's receipt to the entry the service received, inside
 * the Core host, and leaves it for the runner (`RECORDED_CAPTURE_FILES.entry`).
 * A refusal leaves its code (`RECORDED_CAPTURE_FILES.refusal`) before it is
 * thrown, because the route answers any build failure with one generic sentence
 * and the runner would otherwise see only that no model request was made.
 */
export async function bindRecordedCaptureEntry<Input extends ServiceRequest>(root: string, routed: Input) {
  try {
    const configuration: Configuration = JSON.parse(await readFile(path.join(root, RECORDED_CAPTURE_FILES.configuration), "utf8"));
    const relative = path.relative(path.dirname(root), path.resolve(configuration.wireFile));
    if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("recorded_capture_wire_scope_refused");
    const entry = recordedCaptureServiceEntry(routed, configuration.declared);
    const { receipt, receiptBytes, attach } = recordedStartReceipt(configuration.facts, entry);
    await writeFile(path.join(root, RECORDED_CAPTURE_FILES.entry), JSON.stringify({ entry, receipt, receiptBase64: receiptBytes.toString("base64") }), { flag: "wx" });
    return { entry, wireFile: configuration.wireFile, attach: () => attach(entry) };
  } catch (error) {
    const code = error instanceof Error && /^recorded_capture_[a-z_]+$/u.test(error.message) ? error.message : "recorded_capture_entry_unbound";
    try {
      await writeFile(path.join(root, RECORDED_CAPTURE_FILES.refusal), JSON.stringify({ code }), { flag: "wx" });
    } catch (written) {
      // The first refusal is the one kept; a later one does not replace it.
      if ((written as NodeJS.ErrnoException).code !== "EEXIST") throw written;
    }
    throw error;
  }
}
