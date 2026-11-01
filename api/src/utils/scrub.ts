const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
// Pakistani mobiles: 03001234567, +923001234567, 923001234567, with optional separators.
const PHONE = /(?<![\d])(?:\+?92|0)[ -]?3\d{2}[ -]?\d{7}(?![\d])/g;

/** Removes emails and phone numbers. Database errors quote the values that caused them. */
export function scrubText(text: string): string {
  return text.replace(EMAIL, "[email]").replace(PHONE, "[phone]");
}

/** A URL safe to record: no query string, and no secrets in the path. */
export function scrubUrl(url: string): string {
  return url.split("?")[0]!.replace(/(\/invitations\/)[^/]+/, "$1[token]");
}
