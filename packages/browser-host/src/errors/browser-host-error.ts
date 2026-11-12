/** A browser-host failure with a stable code; its message never carries a ticket, token, cookie or profile content. */
export class BrowserHostError extends Error {
  readonly code: string;
  readonly hostId: string | undefined;

  constructor(code: string, message: string, options: { hostId?: string | undefined; cause?: unknown } = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "BrowserHostError";
    this.code = code;
    this.hostId = options.hostId;
  }
}
