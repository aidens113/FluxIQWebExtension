// What an extract step read, judged and measured.
//
// `judgement.ts` compares one step's records against one `ExpectedExtraction`
// -- the assertion that fails a run and the counts that go into an evaluation,
// sharing one record comparison so the two can never disagree.
// `measurements.ts` is the recording lane's list of those counts, one per
// extract step of a workflow. `mismatches.ts` is what a failed comparison
// leaves behind: which records differed and what each side held, bounded and
// inside the evidence boundary. `value-match.ts` decides what equal means for
// one value, and is where every judge of extracted records goes for it.
export * from "./judgement.js";
export * from "./measurements.js";
export * from "./mismatches.js";
export * from "./value-match.js";
