// Capture method B of the snapshot-fidelity spike: the settled document
// serialized in the page itself. Runs through `page.evaluate`, so the function
// is self-contained -- no imports, nothing from outside its own body.
//
// What it writes: the composed tree as HTML, with
// - live form state as attributes (`value`, `checked`, `selected`, textarea
//   text), except a password or file input, which never carries a value;
// - every open shadow root as a declarative `<template shadowrootmode="open">`
//   holding the root's adopted stylesheets as `<style>`;
// - a `<style>` as the CSSOM now holds it, and adopted stylesheets as
//   `<style>`;
// - every attribute exactly as the page wrote it, URLs included: the capture
//   is served at the URL it was taken from, so a relative URL resolves as it
//   did, and a read that matches an attribute's raw value (`a[href^="/p/"]`)
//   still matches. Blink's MHTML serializer makes every URL absolute, which is
//   exactly what breaks such a read.
// Beside the document it returns the resources the page had loaded, to be
// served at their own URLs rather than rewritten into the document: each
// `<link>` stylesheet's rules, each same-origin loaded image (as PNG, through
// a canvas), and each same-origin frame's document, serialized the same way.
// What it drops: `<script>`, `<noscript>`, comments, and every inline `on*`
// handler. Closed shadow roots, canvas paint, cross-origin frames and images,
// and anything a script would draw later are not reachable and are counted.

/** What the serializer did, by kind; counts only. */
export type SerializeCounts = {
  elements: number;
  shadowRoots: number;
  stylesheetsInlined: number;
  stylesheetsUnreadable: number;
  imagesCarried: number;
  imagesNotCarried: number;
  iframesCarried: number;
  iframesUnreachable: number;
  handlersStripped: number;
  scriptsStripped: number;
  formStateWritten: number;
  canvases: number;
};

/** A resource the page had loaded, as the sandbox serves it: text, or a data URL for an image. */
export type SerializedResource = { url: string; contentType: string; text?: string; dataUrl?: string };

export function serializeDocument(): { html: string; resources: SerializedResource[]; counts: SerializeCounts; elapsedMs: number } {
  const started = performance.now();
  const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);
  const counts: SerializeCounts = {
    elements: 0, shadowRoots: 0, stylesheetsInlined: 0, stylesheetsUnreadable: 0, imagesCarried: 0, imagesNotCarried: 0,
    iframesCarried: 0, iframesUnreachable: 0, handlersStripped: 0, scriptsStripped: 0, formStateWritten: 0, canvases: 0
  };
  const text = (value: string): string => value.replace(/&/gu, "&amp;").replace(/</gu, "&lt;").replace(/>/gu, "&gt;");
  const attr = (value: string): string => value.replace(/&/gu, "&amp;").replace(/"/gu, "&quot;");
  const resources = new Map<string, SerializedResource>();
  const carried = (url: string): boolean => /^https?:/iu.test(url) && new URL(url).origin === location.origin;
  const sheetText = (sheet: CSSStyleSheet): string | null => {
    try { return Array.from(sheet.cssRules).map((rule) => rule.cssText).join("\n"); } catch { return null; }
  };
  const styleTag = (css: string, media?: string | null): string =>
    `<style${media ? ` media="${attr(media)}"` : ""}>${css.replace(/<\/style/giu, "<\\/style")}</style>`;
  const adopted = (owner: Document | ShadowRoot): string => (owner.adoptedStyleSheets ?? [])
    .map((sheet) => sheetText(sheet))
    .map((css) => {
      if (css === null) {
        counts.stylesheetsUnreadable += 1;
        return "";
      }
      counts.stylesheetsInlined += 1;
      return styleTag(css);
    })
    .join("");

  const children = (parent: Node, doc: Document): string => {
    let out = "";
    for (const child of Array.from(parent.childNodes)) out += node(child, doc);
    return out;
  };

  const node = (current: Node, doc: Document): string => {
    if (current.nodeType === Node.TEXT_NODE) return text(current.nodeValue ?? "");
    if (current.nodeType !== Node.ELEMENT_NODE) return "";
    return element(current as Element, doc);
  };

  const imageData = (image: HTMLImageElement): string | null => {
    if (!image.complete || !image.naturalWidth) return null;
    try {
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d");
      if (!context) return null;
      context.drawImage(image, 0, 0);
      return canvas.toDataURL("image/png");
    } catch {
      return null;
    }
  };

  const element = (el: Element, doc: Document): string => {
    const tag = el.localName;
    if (tag === "script") {
      counts.scriptsStripped += 1;
      return "";
    }
    if (tag === "noscript") return "";
    if (tag === "link" && /\bstylesheet\b/iu.test(el.getAttribute("rel") ?? "")) {
      // Kept as the page wrote it; its rules are carried at its URL.
      const sheet = (el as HTMLLinkElement).sheet;
      const css = sheet ? sheetText(sheet) : null;
      if (css === null || !sheet?.href) {
        counts.stylesheetsUnreadable += 1;
      } else {
        counts.stylesheetsInlined += 1;
        resources.set(sheet.href, { url: sheet.href, contentType: "text/css", text: css });
      }
    }
    if (tag === "style") {
      const sheet = (el as HTMLStyleElement).sheet;
      const css = sheet ? sheetText(sheet) : null;
      counts.stylesheetsInlined += 1;
      return styleTag(css ?? el.textContent ?? "", el.getAttribute("media"));
    }
    counts.elements += 1;

    const attributes = new Map<string, string>();
    for (const attribute of Array.from(el.attributes)) {
      const name = attribute.name;
      if (/^on/iu.test(name)) {
        counts.handlersStripped += 1;
        continue;
      }
      attributes.set(name, attribute.value);
    }

    let inner: string | undefined;
    if (tag === "input") {
      const input = el as HTMLInputElement;
      const type = input.type.toLowerCase();
      attributes.delete("value");
      attributes.delete("checked");
      if (type === "checkbox" || type === "radio") {
        if (input.checked) {
          attributes.set("checked", "");
          counts.formStateWritten += 1;
        }
        if (input.getAttribute("value") !== null) attributes.set("value", input.getAttribute("value") ?? "");
      } else if (type !== "password" && type !== "file" && input.value !== "") {
        attributes.set("value", input.value);
        if (input.value !== input.defaultValue) counts.formStateWritten += 1;
      }
    } else if (tag === "textarea") {
      const area = el as HTMLTextAreaElement;
      inner = text(area.value);
      if (area.value !== area.defaultValue) counts.formStateWritten += 1;
    } else if (tag === "option") {
      const option = el as HTMLOptionElement;
      if (option.selected) attributes.set("selected", ""); else attributes.delete("selected");
      if (option.selected !== option.defaultSelected) counts.formStateWritten += 1;
    } else if (tag === "img") {
      // A `data:` image is already in the document; a same-origin one is
      // carried at its own URL; a cross-origin one cannot be read.
      const image = el as HTMLImageElement;
      const url = image.currentSrc || image.src;
      if (url && !url.startsWith("data:") && !resources.has(url)) {
        const data = carried(url) ? imageData(image) : null;
        if (data) {
          resources.set(url, { url, contentType: "image/png", dataUrl: data });
          counts.imagesCarried += 1;
        } else {
          counts.imagesNotCarried += 1;
        }
      }
    } else if (tag === "iframe" || tag === "frame") {
      // A same-origin frame's document is carried at its URL; a frame whose
      // document is `about:` (blank, srcdoc) is written into `srcdoc`.
      let frameDoc: Document | null = null;
      try {
        frameDoc = (el as HTMLIFrameElement).contentDocument;
      } catch {
        frameDoc = null;
      }
      if (frameDoc?.documentElement && carried(frameDoc.URL)) {
        resources.set(frameDoc.URL, { url: frameDoc.URL, contentType: "text/html", text: documentHtml(frameDoc) });
        counts.iframesCarried += 1;
      } else if (frameDoc?.documentElement && frameDoc.URL.startsWith("about:")) {
        attributes.set("srcdoc", documentHtml(frameDoc));
        counts.iframesCarried += 1;
      } else {
        counts.iframesUnreachable += 1;
      }
    } else if (tag === "canvas") {
      counts.canvases += 1;
    } else if (tag === "template") {
      inner = (el as HTMLTemplateElement).innerHTML;
    }

    let open = `<${tag}`;
    for (const [name, value] of attributes) open += value === "" ? ` ${name}` : ` ${name}="${attr(value)}"`;
    open += ">";
    if (VOID.has(tag) && el.namespaceURI === "http://www.w3.org/1999/xhtml") return open;

    let body = "";
    if (el === doc.head) body += adopted(doc);
    const root = (el as HTMLElement).shadowRoot;
    if (root) {
      counts.shadowRoots += 1;
      body += `<template shadowrootmode="${root.mode}"${root.delegatesFocus ? " shadowrootdelegatesfocus" : ""}>${adopted(root)}${children(root, doc)}</template>`;
    }
    body += inner ?? children(el, doc);
    return `${open}${body}</${tag}>`;
  };

  const documentHtml = (doc: Document): string => {
    const doctype = doc.doctype ? `<!DOCTYPE ${doc.doctype.name}>` : "";
    return `${doctype}${element(doc.documentElement, doc)}`;
  };

  const html = documentHtml(document);
  return { html, resources: [...resources.values()], counts, elapsedMs: performance.now() - started };
}
