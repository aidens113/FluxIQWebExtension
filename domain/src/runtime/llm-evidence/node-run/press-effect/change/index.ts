// What a node call changed on the page it found, walked once (`./walk.ts`) and
// quoted in one rule (`./words.ts`): the outcome's change list
// (`../page-changes.ts`) and the draft statement's (`./statement.ts`), whose
// counts that went up read `rose` (`./rose.ts`), both come from it (t285).

export { webWordsRose } from "./rose";
export { webNodePageChangeStatement, type WebNodePageChangeLine } from "./statement";
export { webPageChangeWalk, type WebPageChange } from "./walk";
export { webChangeWords } from "./words";
