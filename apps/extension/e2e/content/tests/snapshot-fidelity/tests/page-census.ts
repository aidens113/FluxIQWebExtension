// A count, by category, of what a page holds that a capture may not carry:
// shadow roots, canvases, frames, images, custom elements, form state, fonts,
// visibility and layout. Taken on the live page and on each offline reload so
// the spike can say which categories survived. Counts only, never page text.
// Runs through `page.evaluate`, so it is self-contained.

export type PageCensus = {
  elements: number;
  renderedElements: number;
  openShadowRoots: number;
  canvases: number;
  canvasesWithSize: number;
  iframes: number;
  iframesWithDocument: number;
  images: number;
  imagesLoaded: number;
  lazyImages: number;
  customElements: number;
  customElementsDefined: number;
  formControlsWithValue: number;
  checkedControls: number;
  fontFaces: number;
  fontFacesLoaded: number;
  documentHeight: number;
  scripts: number;
};

export function pageCensus(): PageCensus {
  const all: Element[] = [];
  const shadowRoots: ShadowRoot[] = [];
  const walk = (root: Document | ShadowRoot): void => {
    for (const element of Array.from(root.querySelectorAll("*"))) {
      all.push(element);
      if (element.shadowRoot) {
        shadowRoots.push(element.shadowRoot);
        walk(element.shadowRoot);
      }
    }
  };
  walk(document);
  const of = (tag: string): Element[] => all.filter((element) => element.localName === tag);
  const rendered = all.filter((element) => {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }).length;
  const images = of("img") as HTMLImageElement[];
  const customs = all.filter((element) => element.localName.includes("-"));
  const iframes = of("iframe") as HTMLIFrameElement[];
  const canvases = of("canvas") as HTMLCanvasElement[];
  const fields = all.filter((element): element is HTMLInputElement | HTMLTextAreaElement => (element.localName === "input" || element.localName === "textarea"));
  const fonts = Array.from(document.fonts as unknown as Iterable<FontFace>);
  return {
    elements: all.length,
    renderedElements: rendered,
    openShadowRoots: shadowRoots.length,
    canvases: canvases.length,
    canvasesWithSize: canvases.filter((canvas) => canvas.width > 0 && canvas.height > 0).length,
    iframes: iframes.length,
    iframesWithDocument: iframes.filter((frame) => { try { return Boolean(frame.contentDocument?.body?.childElementCount); } catch { return false; } }).length,
    images: images.length,
    imagesLoaded: images.filter((image) => image.complete && image.naturalWidth > 0).length,
    lazyImages: images.filter((image) => image.loading === "lazy").length,
    customElements: customs.length,
    customElementsDefined: customs.filter((element) => customElements.get(element.localName) !== undefined).length,
    formControlsWithValue: fields.filter((field) => !["checkbox", "radio", "hidden", "submit", "button"].includes((field as HTMLInputElement).type) && field.value !== "").length,
    checkedControls: all.filter((element) => element.localName === "input" && (element as HTMLInputElement).checked).length,
    fontFaces: fonts.length,
    fontFacesLoaded: fonts.filter((font) => font.status === "loaded").length,
    documentHeight: document.documentElement.scrollHeight,
    scripts: of("script").length
  };
}
