/** The part of the extension's status a host reads: where its gateway connection stands. It never carries the ticket or a token. */
export type ExtensionConnection = { connectionState: string; sessionId?: string | undefined; lastError?: string | undefined; enrolmentRefusalCode?: string | undefined };
