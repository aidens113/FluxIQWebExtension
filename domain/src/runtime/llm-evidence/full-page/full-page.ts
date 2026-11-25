// The whole page, when the model asks for it (t1036, D5 and D15): Core's
// `core.full_page` binding hook, which runs the domain's full capture.
//
// There is no page search and no look command any more. The view every result
// carries shows the elements with visible words or a control; this is the one
// way to see the rest: the same capture a result check takes (`includeHidden`,
// every element the page holds, each hidden one flagged), published as the
// ordinary view with the hidden elements and every element's attributes as
// extra lines between its own (`../page-view/full-view.ts`). Core resets the
// page key's base to the lines that are not extra and sends the view in parts
// when it is over the page budget; nothing here cuts it.
//
// The capture is restamped as every authoring capture is, so a hidden
// element's handle is one a press binds, and a hidden element never moves a
// visible one's handle (`../stable-handles.ts`). It is kept under the result it
// was shown as (`keep`), so a repair that names one of its handles finds the
// packet behind it. It only observes: `permission` is accepted because the hook
// carries it, and nothing it does needs one.

import type { AutomationStudioActionPermissionCheck } from "fluxiq/automation";
import type { JsonObject } from "fluxiq/core";
import type { WebLlmEvidenceToolRequest } from "../capture";
import { publishedWebLlmPage, webLlmFullPageView } from "../page-view";
import type { WebLlmSnapshotBinding } from "../sanitize";
import { RecoverableToolRejection } from "../tool-rejection";
import { boundedIdentifier } from "../untrusted-json";

/** What Core's full-page hook is called with. */
export type WebLlmFullPageRequest = Pick<WebLlmEvidenceToolRequest, "projectId" | "flowId" | "callId" | "signal"> & { permission?: AutomationStudioActionPermissionCheck };

/** What the hook is built on: the capture that also lists hidden elements, the run's restamp, and where a shown packet is kept. */
export type WebLlmFullPageRun = {
  /** One capture of the page with its hidden elements (`includeHidden`). */
  capture: (request: WebLlmFullPageRequest) => Promise<WebLlmSnapshotBinding>;
  /** Stable handles, as every authoring capture gets them. */
  restamp: (request: WebLlmFullPageRequest, binding: WebLlmSnapshotBinding) => WebLlmSnapshotBinding;
  /** Keep the packet under the result it was shown as, and the handles that result printed. */
  keep: (request: WebLlmFullPageRequest, binding: WebLlmSnapshotBinding, shown: JsonObject) => void;
};

/**
 * Core's full-page hook: the published page with `pageView` holding the whole
 * page, or `undefined` when there is no page to read now (the page refused the
 * capture: still loading, mid-navigation, or a person is needed on it).
 */
export function webLlmFullPage(run: WebLlmFullPageRun): (input: WebLlmFullPageRequest) => Promise<JsonObject | undefined> {
  return async (input) => {
    input.signal?.throwIfAborted();
    boundedIdentifier(input.projectId, "projectId");
    boundedIdentifier(input.flowId, "flowId");
    boundedIdentifier(input.callId, "callId");
    let captured: WebLlmSnapshotBinding;
    try {
      captured = await run.capture(input);
    } catch (error) {
      if (error instanceof RecoverableToolRejection) return undefined;
      throw error;
    }
    input.signal?.throwIfAborted();
    const binding = run.restamp(input, captured);
    const shown = publishedWebLlmPage(binding.evidence, webLlmFullPageView(binding.evidence)) as unknown as JsonObject;
    run.keep(input, binding, shown);
    return shown;
  };
}
