// The picker's session, held in the background worker and nowhere else.
//
// A session exists from the moment the user starts a pick until the extraction
// is recorded or cancelled. It is **memory only**: nothing here is ever written
// to `chrome.storage`, because it holds a preview -- rows read off the page --
// and a preview is shown to the person confirming the columns and then thrown
// away (D3). Storage would make it durable, and a durable preview is exactly
// the artefact D12 says an excluded column must never reach. A service worker
// that is torn down loses the session, and the panel starts the pick again;
// that is the intended trade.
//
// Keyed by session id, with at most one session per tab: starting a pick on a
// tab replaces whatever that tab had. `clearTab` is what tab removal and a
// top-frame navigation call, because both leave the page the proposal's
// selectors were written against.

import type { WebAutomationExtractionProposal } from "@fluxiq-web-extension/domain/client";
import type { ExtractionPickForm, ExtractionPreviewRow, ExtractionSessionRefusal } from "../../shared/extraction-messages";

/** How many rows the confirmation preview may hold. The content message's own bound is the same. */
export const EXTRACTION_PREVIEW_MAX_ROWS = 20;

/**
 * `picking`, the overlay is up and nothing has been chosen; `picked`, the frame
 * has answered with a proposal; `recorded`, the definition is in the recording
 * and the session is spent.
 */
export type ExtractionSessionState = "picking" | "picked" | "recorded";

/** The two forms a pick can be for, named once in `shared/extraction-messages.ts` and re-exported so a caller of this store needs one import. */
export type ExtractionSessionForm = ExtractionPickForm;

export type { ExtractionPreviewRow };

export type ExtractionSession = {
  readonly sessionId: string;
  readonly tabId: number;
  readonly form: ExtractionSessionForm;
  state: ExtractionSessionState;
  proposal?: WebAutomationExtractionProposal | undefined;
  /** Why there is nothing to confirm: the frame proposed nothing, or the worker refused the form. Cleared by the next pick that succeeds. */
  refused?: ExtractionSessionRefusal | undefined;
  /**
   * Which columns the stored rows were read under, as a stable string, so the
   * same columns are never read twice.
   *
   * **What happens when the user excludes a column.** The first read is under
   * the columns the *proposal* named, which already leave out every field
   * inference marked sensitive, so those are never read at all (D12). When the
   * user then excludes a column, the panel sends the columns it may still show
   * on `fluxiq.getExtractionSession` (`popup/extraction/panel.ts`), this key
   * stops matching, and `control.ts` asks the page for a fresh read that does
   * not name the excluded column -- so what this map holds for it is replaced,
   * not filtered. Nothing is persisted either way; the preview lives here and
   * nowhere else.
   */
  previewKey?: string | undefined;
  preview: ExtractionPreviewRow[];
};

export class ExtractionSessions {
  private readonly sessions = new Map<string, ExtractionSession>();
  private latestId: string | undefined;

  /** Begins a pick on `tabId`, replacing any session that tab already had. */
  start(sessionId: string, tabId: number, form: ExtractionSessionForm): ExtractionSession {
    this.clearTab(tabId);
    const session: ExtractionSession = { sessionId, tabId, form, state: "picking", preview: [] };
    this.sessions.set(sessionId, session);
    this.latestId = sessionId;
    return session;
  }

  /** The session named, or the most recently started one when the caller names none. */
  get(sessionId?: string | undefined): ExtractionSession | undefined {
    const id = sessionId ?? this.latestId;
    return id === undefined ? undefined : this.sessions.get(id);
  }

  /**
   * Records what a frame picked, or `undefined` when the pick belongs to no
   * open session **of that tab**. A pick is the one message in this flow that
   * arrives from a content script, so the tab it came from is checked here
   * rather than trusted: another tab's script must not be able to fill a
   * session the user opened against the automation tab.
   */
  picked(sessionId: string, tabId: number, proposal: WebAutomationExtractionProposal): ExtractionSession | undefined {
    const session = this.sessions.get(sessionId);
    if (!session || session.tabId !== tabId || session.state !== "picking") return undefined;
    session.proposal = proposal;
    session.state = "picked";
    session.refused = undefined;
    session.preview = [];
    session.previewKey = undefined;
    return session;
  }

  /**
   * There is nothing to confirm from what the user clicked. The session stays
   * open and stays `picking`, and the panel reads `refused` and says why.
   *
   * The overlay is *not* still up: the frame closes it on every pick, refused
   * or not, and forgets its own session when the press finishes. `control.ts`
   * therefore re-arms the pick after calling this, which is what makes "the
   * next click is still the pick" true rather than merely intended.
   */
  refuse(sessionId: string, tabId: number, refusal: ExtractionSessionRefusal): ExtractionSession | undefined {
    const session = this.sessions.get(sessionId);
    if (!session || session.tabId !== tabId || session.state !== "picking") return undefined;
    session.refused = refusal;
    return session;
  }

  /**
   * The user pressed Escape in the page. The frame has already taken its overlay
   * down and forgotten the pick, so the session goes with it and the panel finds
   * nothing to show.
   *
   * Only a session still `picking` is cancelled, and only from its own tab: a
   * press that had already taken a pick is not cancelled here, and the frame
   * does not send this for one either.
   */
  cancelled(sessionId: string, tabId: number): ExtractionSession | undefined {
    const session = this.sessions.get(sessionId);
    if (!session || session.tabId !== tabId || session.state !== "picking") return undefined;
    return this.clear(sessionId);
  }

  /** Holds at most `EXTRACTION_PREVIEW_MAX_ROWS` rows, under the columns `previewKey` names. */
  setPreview(sessionId: string, previewKey: string, rows: readonly ExtractionPreviewRow[]): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.preview = rows.slice(0, EXTRACTION_PREVIEW_MAX_ROWS).map((row) => ({ ...row }));
    session.previewKey = previewKey;
  }

  /**
   * Drops the rows without putting any in their place: the page was asked to
   * read a different set of columns and would not.
   *
   * What is held was read under columns the caller has since said it no longer
   * wants -- the commonest reason being that the user just excluded one of them
   * -- so keeping it would be keeping values for a column that is out (D12). The
   * key goes too, so the next `getSession` asks again rather than treating a
   * failed read as the answer.
   */
  clearPreview(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.preview = [];
    session.previewKey = undefined;
  }

  /** The extraction is in the recording; the preview it was confirmed from is dropped. */
  markRecorded(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.state = "recorded";
    session.preview = [];
    session.previewKey = undefined;
  }

  clear(sessionId: string): ExtractionSession | undefined {
    const session = this.sessions.get(sessionId);
    if (session) this.sessions.delete(sessionId);
    if (this.latestId === sessionId) this.latestId = undefined;
    return session;
  }

  /** Drops every session against `tabId`: the tab closed, or its top frame navigated away. */
  clearTab(tabId: number): void {
    for (const [id, session] of this.sessions) {
      if (session.tabId === tabId) this.clear(id);
    }
  }
}
