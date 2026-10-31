/** Private observed browser scope; an omitted claim is unknown, never a default. */
export type WebTargetScope = {
  kind: "single-frame" | "merged";
  /** The correlated gateway session, never a page-supplied identifier. */
  sessionId?: string;
  browserTabId?: number;
  browserFrameId?: number;
  browserFrameUrlPath?: string;
  /** Existing opaque identity of the session and full tab/frame source. */
  resetResource?: string;
  /** A whole safe observed address; a selector does not establish this claim. */
  location?: string;
  /** The observed document's identity, belonging only to this capture's scope. */
  timeOrigin?: number;
};
