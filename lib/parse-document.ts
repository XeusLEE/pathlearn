// ============================================================================
// Tiny helpers used by the /api/generate route to sanitize and bound the
// document text we feed to Claude. Keeps prompt size predictable.
// ============================================================================

/**
 * Normalize raw document text:
 *  - Strip ASCII / Unicode control characters (except newlines & tabs).
 *  - Collapse runs of whitespace (but keep paragraph breaks readable).
 *  - Trim leading/trailing whitespace.
 */
export function cleanText(raw: string): string {
  if (!raw) return "";

  // Strip control chars except \n (0x0A) and \t (0x09).
  // eslint-disable-next-line no-control-regex
  const stripped = raw.replace(/[\x00-\x08\x0B-\x1F\x7F]/g, "");

  // Normalize line endings.
  const normalized = stripped.replace(/\r\n?/g, "\n");

  // Collapse runs of 3+ newlines into 2 (preserve paragraph breaks).
  const paragraphs = normalized.replace(/\n{3,}/g, "\n\n");

  // Collapse runs of horizontal whitespace into a single space.
  const horizontal = paragraphs.replace(/[ \t\f\v]+/g, " ");

  // Trim space at the start of each line.
  const lines = horizontal
    .split("\n")
    .map((line) => line.trim())
    .join("\n");

  return lines.trim();
}

/**
 * Hard-cap the text length so we don't blow Claude's input budget.
 * If we have to cut, prefer a sentence boundary inside the last ~500 chars.
 */
export function truncateText(text: string, maxChars = 18000): string {
  if (!text) return "";
  if (text.length <= maxChars) return text;

  const slice = text.slice(0, maxChars);

  // Look for a clean sentence-ending boundary in the last 500 chars.
  const tail = slice.slice(-500);
  const sentenceEnd = tail.search(/[.!?][\s"')\]]*$/);

  if (sentenceEnd >= 0) {
    const cutAt = slice.length - 500 + sentenceEnd + 1;
    return slice.slice(0, cutAt).trim();
  }

  // Otherwise, fall back to the last paragraph break or whitespace.
  const paragraphBreak = slice.lastIndexOf("\n\n");
  if (paragraphBreak > maxChars * 0.5) {
    return slice.slice(0, paragraphBreak).trim();
  }

  const lastSpace = slice.lastIndexOf(" ");
  if (lastSpace > maxChars * 0.8) {
    return slice.slice(0, lastSpace).trim();
  }

  return slice.trim();
}
