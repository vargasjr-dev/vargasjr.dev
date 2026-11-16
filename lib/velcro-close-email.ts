import { eq } from "drizzle-orm";

import { db } from "@/db";
import {
  velcroCaseEvents,
  velcroCustomerAccounts,
  velcroCustomers,
} from "@/db/schema";

/**
 * Case-closure notification.
 *
 * When a case with a customer closes, the customer gets a short email
 * (case closed, fix should be live on the next release) and Vargas gets
 * a bcc. Resolution order for the customer's address: the customer's
 * `email`-channel account handle first, falling back to the customer's
 * name itself — customers created from the picker use the typed email as
 * both, so the fallback covers rows made before accounts existed.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const FROM_ADDRESS = "Vargas JR <hello@vargasjr.dev>";

/**
 * Vargas's address, read from the environment (wired through terraform:
 * GCP Secret Manager OWNER_EMAIL -> vercel_project_environment_variable).
 * When unset the mail goes out without the owner bcc/reply-to.
 */
const OWNER_EMAIL = process.env.OWNER_EMAIL;

export function isClosingTransition(
  prevStatus: string | null | undefined,
  nextStatus: string | null | undefined,
): boolean {
  return prevStatus !== "closed" && nextStatus === "closed";
}

/** The email-channel handle, or the customer's name when it is an email. */
export function customerEmailFrom(
  accounts: Array<{ channel: string; handle: string }>,
  customerName: string | null | undefined,
): string | null {
  const emailHandle = accounts.find(
    (a) => a.channel === "email" && EMAIL_RE.test(a.handle),
  )?.handle;
  if (emailHandle) return emailHandle;
  if (customerName && EMAIL_RE.test(customerName.trim())) {
    return customerName.trim();
  }
  return null;
}

export function buildCaseClosedEmail(caseId: number, title: string) {
  const subject = `Case #${caseId} closed: ${title}`;
  const text = [
    `We've closed case #${caseId} — "${title}".`,
    "",
    "The fix should be live on the next release. If anything still looks",
    "off after you upgrade, just reply to this email.",
    "",
    "— Vargas JR",
  ].join("\n");
  const html = [
    `<p>We've closed case <b>#${caseId}</b> — &ldquo;${escapeHtml(title)}&rdquo;.</p>`,
    "<p>The fix should be live on the next release. If anything still looks",
    "off after you upgrade, just reply to this email.</p>",
    '<p style="color:#666">— Vargas JR</p>',
  ].join("");
  return { subject, text, html };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function recordEvent(caseId: number, body: string): Promise<void> {
  await db.insert(velcroCaseEvents).values({ caseId, kind: "action", body });
}

/**
 * Best-effort closure notification for a just-closed case. Resolves the
 * customer's email, sends the customer + owner-bcc email through Resend,
 * and appends an action event recording the outcome. Never throws — a
 * failed notice must not fail the PATCH that closed the case.
 */
export async function notifyCaseClosed(
  caseId: number,
  title: string,
  customerId: number | null,
): Promise<void> {
  try {
    if (customerId === null) {
      await recordEvent(
        caseId,
        "Closed without a customer — no closing email.",
      );
      return;
    }

    const accounts = await db
      .select({
        channel: velcroCustomerAccounts.channel,
        handle: velcroCustomerAccounts.handle,
      })
      .from(velcroCustomerAccounts)
      .where(eq(velcroCustomerAccounts.customerId, customerId));
    const [customer] = await db
      .select({ name: velcroCustomers.name })
      .from(velcroCustomers)
      .where(eq(velcroCustomers.id, customerId))
      .limit(1);

    const to = customerEmailFrom(accounts, customer?.name);
    if (!to) {
      await recordEvent(
        caseId,
        "Customer has no email on file — no closing email.",
      );
      return;
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.warn(
        `[velcro] case #${caseId} closed but RESEND_API_KEY unset — no closing email`,
      );
      return;
    }

    const { subject, text, html } = buildCaseClosedEmail(caseId, title);
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [to],
        subject,
        text,
        html,
        // Owner bcc + reply-to ride on Vargas's address when configured.
        ...(OWNER_EMAIL ? { bcc: [OWNER_EMAIL], reply_to: OWNER_EMAIL } : {}),
      }),
    });
    if (!res.ok) {
      console.warn(
        `[velcro] closing email for case #${caseId} failed (${res.status})`,
      );
      await recordEvent(
        caseId,
        `Closing email to ${to} failed (${res.status}).`,
      );
      return;
    }
    await recordEvent(
      caseId,
      OWNER_EMAIL
        ? `Closing email sent to ${to} (bcc Vargas).`
        : `Closing email sent to ${to}.`,
    );
  } catch (err) {
    console.warn(
      `[velcro] closing email for case #${caseId} errored:`,
      err instanceof Error ? err.message : err,
    );
  }
}
