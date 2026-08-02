export const systemClock = {
    now: () => new Date(),
    nowMs: () => Date.now()
};
export function createId(prefix, value) {
    const cleanPrefix = slugify(prefix) || "id";
    const cleanValue = slugify(value) || "item";
    return `${cleanPrefix}.${cleanValue}`;
}
export function slugify(value) {
    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_.-]+/g, "-")
        .replace(/^-+|-+$/g, "");
}
