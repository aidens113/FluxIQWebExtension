// The web-automation failure taxonomy's producing half: the closed set of
// codes, the convention by which a producer reports one it already knows, and
// the classifier that lands an outcome on one of them when nobody does. Core
// owns the categories and the record shape; nothing here restates them.
//
// There is one mechanism, and `carrier.ts` is it: build a record with
// `webAutomationFailureRecord` and attach it to what you throw. The Error
// subclass that used to be the alternative is gone -- see that file for why.
export * from "./carrier";
export * from "./classify";
export * from "./codes";
