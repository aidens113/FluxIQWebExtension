import { booleanValue, compareBasic } from "../shared/definition";
export function compareValues(left, right, operator) {
    return compareBasic(left, right, operator);
}
export function everyBoolean(values) {
    return values.every(booleanValue);
}
export function someBoolean(values) {
    return values.some(booleanValue);
}
