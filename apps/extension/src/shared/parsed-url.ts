// An address parsed without `URL.canParse`. That static arrived in Chrome 120
// and Firefox 115, and `manifest.chrome.json` still admits Chrome 116, where
// calling it throws a `TypeError` of its own ("URL.canParse is not a function")
// and takes the whole path down. The constructor exists everywhere the manifests
// admit, and a `TypeError` from it is the one failure that means "not an
// address"; anything else is rethrown. `tests/no-url-can-parse.test.ts` keeps
// `URL.canParse` out of the extension's source.

/** `raw` parsed as a URL, resolved against `base` when one is given; `undefined` when it does not parse. */
export function parsedUrl(raw: string, base?: string): URL | undefined {
  try {
    return base === undefined ? new URL(raw) : new URL(raw, base);
  } catch (error) {
    if (error instanceof TypeError) return undefined;
    throw error;
  }
}
