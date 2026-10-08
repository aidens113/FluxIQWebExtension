// The path of the document a child frame held when one of its elements was
// shown, kept beside a target handle (`target-packets.ts`).
//
// A handle's element in a child frame keeps the path of the document the
// frame held when the element was shown (`frameUrlPath`), read off the frame
// address the merge published with the element (`data-fluxiq-frame-url`). The
// frame id names nothing once a Flow reloads the page -- Chrome renumbers a
// frame when it navigates -- and the path finds the same document again, as it
// does for a recorded node (`output-nodes/payloads.ts`). The pathname only: the
// origin differs run to run and the query may carry a token.

import { webAutomationUrlPath } from "../../../output-nodes";
import type { WebLlmEvidenceElement } from "../elements";

/** The attribute the frame merge publishes a child frame's element with: its frame document's URL, screened as a link is. */
const FRAME_URL_ATTRIBUTE = "data-fluxiq-frame-url";

/**
 * The pathname of the document a child frame's element was shown in, by the
 * rule a recorded node's path follows (`output-nodes/url-path.ts`); nothing for
 * the top frame, for a frame whose document is not http(s), or for an element
 * published without its frame's address.
 */
export function webLlmFrameUrlPath(element: WebLlmEvidenceElement): string | undefined {
  if (element.frameId === undefined || element.frameId <= 0) return undefined;
  const url = element.attributes?.find(([name]) => name.toLowerCase() === FRAME_URL_ATTRIBUTE)?.[1];
  if (url === undefined || !URL.canParse(url)) return undefined;
  const parsed = new URL(url);
  return parsed.protocol === "http:" || parsed.protocol === "https:" ? webAutomationUrlPath(parsed.pathname) : undefined;
}
