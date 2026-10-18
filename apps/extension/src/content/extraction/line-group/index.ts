// A group of lines only a position can name, offered whole beside its lines.
//
// **Until 2026-10-17 such a group was never a column.** A results card listed
// its ways to get the item as sibling lines of one container, each with the
// same class -- "Pickup today", "Delivery today", "Shipping, arrives ..." -- and
// not every card had every line. A sibling sharing its class has no name but
// its position, so the lines were offered as `div:1`, `div:2`, `div:3`, and on
// a card without the first line "Delivery" sat in `div:1`: no column held "can
// be delivered", so a read asked for the deliverable items kept every row (live
// run `run-mvcxvr3k-af919462`, step 0025).
//
// Now a container whose text lines are named by position is offered beside
// them as one `text` field with `lines` (`../field-reader.ts`): its children's
// words joined in order, labelled with its path and `(all lines)`, so a
// condition that `contains` a line's words tests the whole group. The
// positional lines stay as they were, since Flows already saved name them.
// `positional-line.ts` decides which container is a group; `kept-groups.ts`
// keeps a group under the proposal bound before a later one of its own lines.

export { keepLineGroups } from "./kept-groups";
export { positionalLine } from "./positional-line";
