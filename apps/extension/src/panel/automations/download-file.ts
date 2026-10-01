// Saves a dataset export the relay sent inline: a Blob, a temporary
// `<a download>` clicked once, and the object URL released after. Touches the
// DOM only when called, so importing it stays safe outside a browser.

/** Hands `body` to the browser as a download named `fileName`. */
export function downloadFile(fileName: string, contentType: string, body: string): void {
  const url = URL.createObjectURL(new Blob([body], { type: contentType }));
  let link: HTMLAnchorElement | undefined;
  try {
    link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.hidden = true;
    document.body.append(link);
    link.click();
  } finally {
    try { link?.remove(); }
    catch { /* best-effort: temporary link cleanup must not obscure download delivery */ }
    // The click starts the download before the URL is let go.
    setTimeout(() => {
      try { URL.revokeObjectURL(url); }
      catch { /* best-effort: deferred browser URL cleanup cannot change delivery feedback */ }
    }, 0);
  }
}
