// What a `web.dom.capture_snapshot` may ask of the capture, read once from the
// command and handed to every frame that captures for it (t223).
//
// `includeHidden` is a search's look: `web.find_on_page` and
// `web.describe_element` capture with it so words in a closed menu or a
// collapsed panel can be found, each such element flagged `hidden`
// (`content/rendered-elements.ts`). Without it -- every look a model is given
// by default -- the capture is the one it always was.
//
// The gateway mapping copies every raw parameter of a command into its
// `options` (`domain/src/client/gateway-mapping.ts`), so the parameter is read
// from there. Only `true` turns it on; any other value is a capture without it.

import type { BrowserActionCommand } from "./protocol";

/** What one capture is asked for. Absent fields are the default capture. */
export type SnapshotCaptureOptions = {
  /** Also list the elements that are not rendered, each flagged `hidden`. */
  readonly includeHidden?: boolean | undefined;
};

/** The capture options a `web.dom.capture_snapshot` command asks for; `{}` for any other action, or none asked. */
export function snapshotCaptureOptionsFor(action: BrowserActionCommand): SnapshotCaptureOptions {
  if (action.actionType !== "web.dom.capture_snapshot") return {};
  const options = (action.options ?? {}) as Record<string, unknown>;
  return options["includeHidden"] === true ? { includeHidden: true } : {};
}
