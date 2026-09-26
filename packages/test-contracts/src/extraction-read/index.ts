// One `web.dom.extract_list` read's account of itself, as a run bundle records
// it: the counts, flags and closed words the extraction computed and nothing
// downstream could see. The type is the shape published; the validator is what
// holds a producer to it.
export * from "./read.js";
export * from "./validation.js";
