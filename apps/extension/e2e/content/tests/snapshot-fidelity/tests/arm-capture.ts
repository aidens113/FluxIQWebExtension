// Adds to a captured document the canaries that prove no page script ran in
// the sandbox: a `<script>` at the end of the body and a `<body onload>`
// handler, each of which would mark the root element if it ran. The capture's
// measured size is taken before this, so neither counts toward it.
// offline-capture.ts serves the document with `script-src 'none'` and reads
// the attributes the canaries set.

const SCRIPT_CANARY = "<script>document.documentElement.setAttribute('data-snapshot-canary','ran')</script>";
const HANDLER_CANARY = ` onload="document.documentElement.setAttribute('data-snapshot-handler','ran')"`;

export function armCapture(html: string): string {
  const bodyAt = html.search(/<body\b/iu);
  if (bodyAt < 0) throw new Error("The captured document has no <body> to arm.");
  const opened = bodyAt + "<body".length;
  const armed = html.slice(0, opened) + HANDLER_CANARY + html.slice(opened);
  const close = armed.lastIndexOf("</body>");
  return close < 0 ? armed + SCRIPT_CANARY : armed.slice(0, close) + SCRIPT_CANARY + armed.slice(close);
}
