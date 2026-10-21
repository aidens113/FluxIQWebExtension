// The canaries that prove no page script ran in the sandbox (lane T U3): a
// `<script>` at the end of the body and a `<body onload>` handler, each of
// which would mark the root element if it ran. The primary is served with
// `script-src 'none'`, so neither should; the page reads the two attributes
// back after the action and counts any that are set as scripts that ran. The
// spike's own copy is `apps/extension/e2e/content/tests/snapshot-fidelity/tests/arm-capture.ts`.

const SCRIPT_CANARY = "<script>document.documentElement.setAttribute('data-snapshot-canary','ran')</script>";
const HANDLER_CANARY = ` onload="document.documentElement.setAttribute('data-snapshot-handler','ran')"`;

export const snapshotCanaries = Object.freeze({
  /** The root element's attributes the two canaries set when they run. */
  attributes: Object.freeze(["data-snapshot-canary", "data-snapshot-handler"] as const),
  /** `html` with both canaries added; a document with no `<body>` gets the script canary at its end. */
  arm(html: string): string {
    const bodyAt = html.search(/<body\b/iu);
    if (bodyAt < 0) return html + SCRIPT_CANARY;
    const opened = bodyAt + "<body".length;
    const armed = html.slice(0, opened) + HANDLER_CANARY + html.slice(opened);
    const close = armed.lastIndexOf("</body>");
    return close < 0 ? armed + SCRIPT_CANARY : armed.slice(0, close) + SCRIPT_CANARY + armed.slice(close);
  }
});
