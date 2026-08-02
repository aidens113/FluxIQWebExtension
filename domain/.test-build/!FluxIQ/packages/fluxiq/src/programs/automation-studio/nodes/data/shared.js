export function variableName(value) {
    return String(value ?? "").trim();
}
export function readVariable(variables, name) {
    return variables?.get(name) ?? null;
}
export function writeVariable(variables, name, value) {
    variables?.set(name, value);
}
