// filter@vargasjr.dev — forwarded-email → Gmail-filter parsing.
//
// Vargas forwards an email (Gmail inline forward) to filter@vargasjr.dev;
// the resend webhook extracts the ORIGINAL sender from the forwarded
// message's headers and creates a Gmail filter that archives + labels
// everything from that sender.

/** The only sender whose forwards may trigger filter creation. */
export const ALLOWED_FORWARDER = "dvargasfuertes@gmail.com";

/** Address part of a From header value ("Name <a@b.com>" → "a@b.com"). */
export function fromAddress(from: string): string {
  const match = from.match(/[\w.+=-]+@[\w-]+(?:\.[\w-]+)+/);
  return (match?.[0] ?? from.trim()).toLowerCase();
}

const EMAIL_RE = /[\w.+=-]+@[\w-]+(?:\.[\w-]+)+/;

// "Forwarded message" separator in a few UI languages (Gmail localizes it).
const FWD_SEPARATOR_RE =
  /forwarded message|message transf|mensaje reenviado|weitergeleitete nachricht/i;

// The From-header label, also localized (French puts a space before the
// colon: "De : Name <a@b.com>").
const FROM_LABEL_RE =
  /^(?:>?[\s>]*)(?:from|de|von|da|expéditeur|expediteur|remetente)\s*:/i;

/**
 * Extracts the original sender's email from a forwarded message body.
 * Gmail inline forwards embed the original headers after a separator
 * line, sender first ("De : Name <a@b.com>" in French UIs). Tier 1 reads
 * the first email in the lines right after the separator; tier 2 falls
 * back to scanning localized From: lines. Returns null when neither hits.
 */
export function extractForwardedSender(body: string): string | null {
  const lines = body.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (!FWD_SEPARATOR_RE.test(lines[i])) continue;
    for (let j = i + 1; j < Math.min(i + 7, lines.length); j++) {
      const email = lines[j].match(EMAIL_RE)?.[0];
      if (email) return email.toLowerCase();
    }
  }
  for (const line of lines) {
    if (!FROM_LABEL_RE.test(line)) continue;
    const email = line.match(EMAIL_RE)?.[0];
    if (email) return email.toLowerCase();
  }
  return null;
}

/** Naive HTML → text so header parsing works on html-only forwards. */
export function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .trim();
}
