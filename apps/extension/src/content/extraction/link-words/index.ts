// Whose words a link offers. `own-words.ts` decides whether an `<a href>`'s
// words are a column of their own beside its URL -- never when they are one
// span's, a card's, or one span's once the marks inside the link are left out
// -- and `text-leaf.ts` is the element those words are measured in, which
// inference offers as a text column by the same rule.

export { offersOwnText } from "./own-words";
export { isTextLeaf } from "./text-leaf";
