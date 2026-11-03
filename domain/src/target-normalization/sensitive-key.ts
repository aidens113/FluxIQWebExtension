export function isSensitiveKey(key: string): boolean {
  return /password|passwd|passcode|secret|token|credential|authorization|cookie|session|csrf/i.test(key);
}
