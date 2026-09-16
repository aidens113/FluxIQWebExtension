import type { JsonObject, JsonValue } from "fluxiq/core";
import { webAutomationRecordedExtraction } from "../actions/extraction";
import { isSensitiveElementDescriptor } from "../sensitivity";
import { webAutomationRecordedElementKey } from "./recorded-element-key";
import { webAutomationSecretBinding } from "./secret-binding";
import { compact, elementFingerprint, numberValue, objectValue, stringValue } from "./targets";
import { webAutomationUploadBinding } from "./upload-binding";
import { webAutomationUrlPath } from "./url-path";

/**
 * Shared output-node payload normalization. Keep the full fingerprint
 * alongside executable selectors so replay can fall back when selectors drift,
 * and the recorded frame so replay reaches the document the user acted in.
 */
export function webAutomationOutputPayload(outputId: string, payload: JsonObject): JsonObject {
  return withRecordedFrame(outputId, payload, recordedOutputParameters(outputId, payload));
}

/**
 * The frame the interaction was recorded in, carried onto the replayable
 * parameters. `client/gateway-mapping.ts` puts `browserFrameId` on the recorded
 * event and `client/gateway-action-parameters.ts` lifts it back off the
 * dispatched command onto `action.frameId`, so this is the middle link of the
 * one chain that lets a command reach a child frame; without it every replay
 * runs against the top document.
 *
 * Only a DOM-scoped action takes a frame: a navigation, a tab operation and a
 * download act on the tab. A dispatch-only action has no recorded parameters
 * at all and stays empty rather than gaining a lone frame, which would turn an
 * unexecutable event into a command carrying nothing to execute.
 *
 * A child frame also carries `browserFrameUrlPath`, its document's pathname,
 * which the lift puts on `action.frameUrlPath`. Chrome renumbers a frame when it
 * navigates, and a Flow loads its start page before it runs, so the recorded id
 * can name no frame on replay; the path finds the same document again, and the
 * id becomes a tie-break. The pathname alone: an origin differs run to run (a
 * cross-origin frame is served from another loopback port) and a query may
 * carry tokens. Frame 0, and a frame whose document is not http(s) such as
 * `about:blank` or `srcdoc`, gains no path, so every top-frame node is
 * byte-identical to what it was before the path existed.
 */
function withRecordedFrame(outputId: string, payload: JsonObject, parameters: JsonObject): JsonObject {
  const browserFrameId = frameIdValue(payload.browserFrameId);
  if (browserFrameId === undefined || !outputId.startsWith("web.dom.")) return parameters;
  if (Object.keys(parameters).length === 0) return parameters;
  const browserFrameUrlPath = browserFrameId > 0 ? httpUrlPath(payload.url) : undefined;
  return { ...parameters, browserFrameId, ...(browserFrameUrlPath !== undefined ? { browserFrameUrlPath } : {}) };
}

/** Frame 0 is the top document, so `0` is a frame rather than an absent one; a negative or fractional id names none. */
function frameIdValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}

/** The pathname of an http(s) URL, and nothing else of it. Any other scheme, or a string that is no URL, names no path. */
function httpUrlPath(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.pathname : undefined;
  } catch {
    return undefined;
  }
}

function recordedOutputParameters(outputId: string, payload: JsonObject): JsonObject {
  const element = elementFingerprint(payload.element);
  const selector = stringValue(element?.selector);
  const visualTarget = objectValue(payload.visualTarget);
  const target = compact({ ...(element ? { element } : {}), ...(visualTarget ? { visualTarget } : {}) });
  const hasTarget = Object.keys(target).length > 0;
  if (outputId === "web.browser.navigate") return compact({ url: stringValue(payload.url) });
  if (outputId === "web.dom.click" || outputId === "web.dom.clear") return compact({ selector, ...(hasTarget ? target : {}) });
  if (outputId === "web.dom.type") return compact({ selector, text: recordedTypedText(payload), ...(hasTarget ? target : {}) });
  if (outputId === "web.dom.select") return compact({ selector, value: stringValue(payload.inputValue) ?? "", ...(hasTarget ? target : {}) });
  if (outputId === "web.dom.keypress") return compact({ selector, key: stringValue(payload.key) ?? "", ...(hasTarget ? target : {}) });
  if (outputId === "web.dom.scroll") {
    const scroll = objectValue(payload.scroll);
    return compact({ x: numberValue(scroll?.x), y: numberValue(scroll?.y) });
  }
  if (outputId === "web.dom.check") {
    const checked = recordedCheckedState(payload);
    return compact({ selector, checked, ...(hasTarget ? target : {}) });
  }
  if (outputId === "web.dom.wait_for_selector") return compact({ selector, ...(hasTarget ? target : {}) });
  if (outputId === "web.dom.wait_for_text") return compact({ text: stringValue(payload.inputValue) ?? stringValue(payload.title) });
  if (outputId === "web.dom.extract") {
    const read = recordedValueRead(payload);
    return compact({ selector, ...(hasTarget ? target : {}), ...(read !== undefined ? { extract: read } : {}) });
  }
  if (outputId === "web.dom.extract_list") return recordedListExtractionParameters(payload);
  if (outputId === "web.dom.upload") return recordedUploadParameters(payload, selector, target);
  if (outputId === "web.browser.tab") return recordedTabParameters(payload);
  if (outputId === "web.dom.capture_snapshot") return {};
  // The remaining Week 1 outputs — assert, dialog and download — are
  // dispatch-only: no recorded user event maps to one, so there is no recorded
  // payload to normalize into their parameters.
  return {};
}

/**
 * A recorded list extraction replays as the request the picker recorded, and
 * nothing else of what it sent.
 *
 * The definition is rebuilt by `webAutomationRecordedExtraction` rather than
 * read off the payload, so the node carries selectors, keys and counts and no
 * value read from the page (D3). A payload whose definition the reader refuses
 * builds nothing, and `hasExecutableParameters` then keeps the event as
 * evidence rather than proposing a read of something other than what was
 * picked. The single-value form builds nothing here: it is `web.dom.extract`.
 */
function recordedListExtractionParameters(payload: JsonObject): JsonObject {
  const definition = webAutomationRecordedExtraction(payload.extraction);
  return definition?.form === "list" ? { extractList: definition.request as unknown as JsonValue } : {};
}

/** The single value a recorded `web.dom.extract` reads, or nothing when the payload defines no value extraction. */
function recordedValueRead(payload: JsonObject): JsonValue | undefined {
  const definition = webAutomationRecordedExtraction(payload.extraction);
  return definition?.form === "value" ? definition.read as unknown as JsonValue : undefined;
}

/**
 * A file choice replays as an upload that asks for its files at run time:
 * `upload-binding.ts` has the request's shape and why it has no fallback.
 *
 * Nothing about the files is written, because the recording holds nothing of
 * them that may travel: no name, no count, no content. The descriptor's `value`
 * is dropped from the fingerprint for the same reason. On a file input it is
 * Chrome's `C:\fakepath\<name>`, the user's local file name, and it is no
 * identity signal either, since the same control holds a different name on
 * every run. With no identity to key a request on there is nothing to ask for;
 * the node then has no `upload` and stays evidence.
 */
function recordedUploadParameters(payload: JsonObject, selector: string | undefined, target: JsonObject): JsonObject {
  const key = webAutomationRecordedElementKey(payload);
  if (key === undefined) return {};
  const element = objectValue(target.element);
  const fileTarget = element === undefined ? target : { ...target, element: Object.fromEntries(Object.entries(element).filter(([name]) => name !== "value")) as JsonObject };
  return compact({ selector, upload: webAutomationUploadBinding(key), ...fileTarget });
}

/**
 * A recorded tab change replays through `web.browser.tab`, carrying only what
 * replay needs: the operation, and for a switch the exact path of the tab it
 * went to. Never a tab id, which does not survive to a replay, and never a
 * URL's origin or query.
 *
 * A path that is not a bare pathname is not trimmed into one. The switch is
 * built without it, and `io/input-model.ts` `hasExecutableParameters` keeps a
 * switch that names no tab as evidence. An entry with no `tab` at all, which is
 * what the recording-start marker is, builds nothing.
 */
function recordedTabParameters(payload: JsonObject): JsonObject {
  const tab = objectValue(payload.tab);
  if (tab?.operation === "close") return { tab: { operation: "close" } };
  if (tab?.operation !== "switch") return {};
  const urlPath = webAutomationUrlPath(tab.urlPath);
  return { tab: { operation: "switch", ...(urlPath !== undefined ? { urlPath } : {}) } };
}

/**
 * The text a recorded entry replays, which is not always a string.
 *
 * A recorded value is replayed as itself. **No recorded value at all means the
 * recorder withheld it**, and on a control the one sensitivity rule marks that
 * is the only way it can happen: `readElementValue` returns nothing for such a
 * control, and every other path yields a string -- an entry the user emptied
 * arrives as `""` and is mapped to `web.dom.clear`, not here
 * (`io/input-model.ts`, `recordedActionInputId`).
 *
 * So the node asks for the value instead of carrying one: see
 * `secret-binding.ts` for the request's shape and for why it has no fallback.
 * What it must never do is what this line did until now -- substitute `""`,
 * which replays as a password field typed empty and an action reporting
 * success.
 *
 * A withheld value on a control the rule does *not* mark keeps the old `""`.
 * That combination should not occur, and asking for a secret on a control
 * nothing calls sensitive would invent a request no manifest declares; the
 * sensitivity rule stays the single authority over which controls hold one.
 */
function recordedTypedText(payload: JsonObject): JsonValue {
  const recorded = stringValue(payload.inputValue);
  if (recorded !== undefined) return recorded;
  if (!isSensitiveElementDescriptor(payload.element)) return "";
  const key = webAutomationRecordedElementKey(payload);
  return key === undefined ? "" : webAutomationSecretBinding(key);
}

/**
 * The state a recorded toggle left the control in, for `web.dom.check`.
 *
 * A radio's `change` can only mean "now selected", so it needs no recorded
 * state. A checkbox's toggles either way, and the value the recorder reports
 * is the control's `value` attribute ("on" by default), not its checked state,
 * so the state has to come from the descriptor's own `checked` field or from a
 * captured `aria-checked`. When neither is present the field is absent, and
 * `hasExecutableParameters` keeps the event as evidence rather than replaying
 * a guess that could invert the user's action.
 */
function recordedCheckedState(payload: JsonObject): boolean | undefined {
  const element = objectValue(payload.element);
  if (!element) return undefined;
  if (typeof element.checked === "boolean") return element.checked;
  const ariaChecked = stringValue(objectValue(element.attributes)?.["aria-checked"]);
  if (ariaChecked === "true") return true;
  if (ariaChecked === "false") return false;
  return isRadioElement(element) ? true : undefined;
}

function isRadioElement(element: JsonObject): boolean {
  return stringValue(element.inputType)?.toLowerCase() === "radio" || stringValue(element.role)?.toLowerCase() === "radio";
}
