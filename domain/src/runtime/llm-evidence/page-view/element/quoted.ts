// How the page view prints words: in double quotes, an inner quote written
// `\"`, and nothing cut.

/** The words in double quotes, an inner `"` written `\"`. */
export function quotedWords(words: string): string {
  return `"${words.replace(/"/gu, "\\\"")}"`;
}
