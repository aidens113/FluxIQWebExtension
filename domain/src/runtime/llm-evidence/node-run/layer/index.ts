// Barrel for what a layer in front of the page is: whether one element is a
// layer (`./element.ts`), whether an element belongs to one (`./member.ts`),
// and whether the runtime's own defence clears it (`./runtime-clears.ts`).
export { webIsLayer } from "./element";
export { webInLayer } from "./member";
export { webRuntimeClearsLayers } from "./runtime-clears";
