/**
 * Splits `text` into `{ key, text, isHighlight }` tokens around the
 * case-insensitive matches of `term`, so an option row can `<mark>` them.
 * Every index comes from `text` itself, so letters whose lower case is longer
 * (such as "İ") do not shift the highlight.
 *
 * @param {string} text - The option title.
 * @param {string} term - The search term; surrounding whitespace is ignored.
 * @returns {Array<{key: string, text: string, isHighlight: boolean}>}
 */
export function buildTokens(text, term) {
  const query = term.trim();
  if (!text || !query) {
    return [{ key: "token-0", text, isHighlight: false }];
  }
  const pattern = new RegExp(
    query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    "giu"
  );
  const parts = [];
  let start = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > start) {
      parts.push({
        key: `token-${parts.length}`,
        text: text.slice(start, match.index),
        isHighlight: false
      });
    }
    parts.push({
      key: `token-${parts.length}`,
      text: match[0],
      isHighlight: true
    });
    start = match.index + match[0].length;
  }
  if (start < text.length) {
    parts.push({
      key: `token-${parts.length}`,
      text: text.slice(start),
      isHighlight: false
    });
  }
  return parts;
}
