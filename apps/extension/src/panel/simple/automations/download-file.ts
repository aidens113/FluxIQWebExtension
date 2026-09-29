// Saves a dataset export the relay sent inline: a Blob, a temporary
// `<a download>` clicked once, and the object URL released after. Touches the
// DOM only when called, so importing it stays safe outside a browser.

/** Hands `body` to the browser as a download named `fileName`. */
export function downloadFile(fileName: string, contentType: string, body: string): void {
  const url = URL.createObjectURL(new Blob([body], { type: contentType }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.hidden = true;
  document.body.append(link);
  try {
    link.click();
  } finally {
    link.remove();
    // The click starts the download before the URL is let go.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}
