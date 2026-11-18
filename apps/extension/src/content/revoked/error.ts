/** Thrown inside a wait the revocation interrupted; page-free, and never a verdict about the action. */
export class ContentRevokedError extends Error {
  constructor() {
    super("The content script was revoked while this work was in flight.");
    this.name = "ContentRevokedError";
  }
}
