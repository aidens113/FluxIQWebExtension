// Which page addresses the chat may tell Core the person is on. Only a web page
// is a place a Flow can start from, so only http: and https: pass; an extension
// page, about:, file: and anything unparseable do not. The address is data for
// Core only and is never logged.

const MAX_PAGE_URL_LENGTH = 2048;

/** `value` when it is an http: or https: URL of at most 2048 characters, else undefined. */
export function acceptedPageUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || !value || value.length > MAX_PAGE_URL_LENGTH) return undefined;
  const protocol = parsedProtocol(value);
  return protocol === "http:" || protocol === "https:" ? value : undefined;
}

// `URL.canParse` arrived in Firefox 115 and the manifest still admits 109 (as
// `open-fluxiq.ts` notes). A `TypeError` from the constructor is the one failure
// that means "not an address"; anything else is rethrown.
function parsedProtocol(value: string): string | undefined {
  try {
    return new URL(value).protocol;
  } catch (error) {
    if (error instanceof TypeError) return undefined;
    throw error;
  }
}
