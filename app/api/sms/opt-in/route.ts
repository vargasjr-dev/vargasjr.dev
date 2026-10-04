import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { smsOptIns } from "@/db/schema";

// Must stay in sync with the disclosure rendered on /sms-consent.
// Bump consentVersion whenever the language changes.
const OPT_IN_DISCLOSURE =
  "By checking this box and submitting my phone number, I agree to receive " +
  "text messages from VargasJR, the AI assistant service operated by " +
  "Vargas JR, LLC, from the toll-free number +1 (833) 659-7364. Messages " +
  "include task confirmations, calendar and deadline reminders, status " +
  "alerts, and one-to-one conversational replies to requests I've made. " +
  "Message frequency varies. Message and data rates may apply. Reply STOP " +
  "to opt out or HELP for help. Consent is optional and not required to " +
  "use any other part of vargasjr.dev.";
const CONSENT_VERSION = "2026-10-01";

// Normalize common US formats to E.164: (833) 659-7364, 833-659-7364,
// 1 833 659 7364, +18336597364 -> +18336597364
function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

const optInSchema = z.object({
  phone: z.string().min(7).max(32),
  consent: z.literal(true),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  const parsed = optInSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "A valid phone number and consent checkbox are required." },
      { status: 400 },
    );
  }

  const phone = normalizePhone(parsed.data.phone);
  if (!phone) {
    return NextResponse.json(
      { error: "Enter a valid US phone number, e.g. (555) 123-4567." },
      { status: 400 },
    );
  }

  const forwardedFor = req.headers.get("x-forwarded-for") ?? "";
  const ip = forwardedFor.split(",")[0]?.trim() || null;

  try {
    await db.insert(smsOptIns).values({
      phone,
      consentText: OPT_IN_DISCLOSURE,
      consentVersion: CONSENT_VERSION,
      ip,
      userAgent: req.headers.get("user-agent"),
    });
  } catch (err) {
    console.error("[sms opt-in] failed to record consent:", err);
    return NextResponse.json(
      { error: "Couldn't save your opt-in. Please try again." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
