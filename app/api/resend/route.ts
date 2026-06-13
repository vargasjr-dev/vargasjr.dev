import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { db } from "@/db";
import { emails } from "@/db/schema";
import { createHmac, timingSafeEqual } from "crypto";

const VARGAS_ADDRESS = "vargas@vargasjr.dev";
const HELLO_ADDRESS = "hello@vargasjr.dev";
const FORWARD_TO = "dvargasfuertes@gmail.com";

async function forwardEmail(data: Record<string, unknown>): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY not set");

  const originalFrom = (data.from as string) ?? "";
  const subject = (data.subject as string) ?? "(no subject)";
  const html = (data.html as string) ?? "";
  const plainText = (data.text as string) ?? (data.plain_text as string) ?? "";

  // Pass the body through as-is — no forwarding headers, no "Fwd:" prefix.
  // reply_to points back to the original sender so replies go to them.
  const body = html ? { html } : { text: plainText || " " };

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: VARGAS_ADDRESS,
      to: [FORWARD_TO],
      subject,
      reply_to: originalFrom,
      ...body,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend forward failed (${res.status}): ${err}`);
  }
}

// Resend uses Svix for webhook signing.
// Spec: https://docs.svix.com/receiving/verifying-payloads/how-manual
// Signed content = "{svix-id}.{svix-timestamp}.{body}"
// Key = base64-decode(secret after stripping "whsec_" prefix)
// Signature = base64(HMAC-SHA256(key, signedContent))
// Header format: "v1,<base64sig> [v1,<base64sig> ...]"
function verifySignature(
  secret: string,
  payload: string,
  svixId: string,
  svixTimestamp: string,
  svixSig: string,
): boolean {
  try {
    const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
    const signedContent = `${svixId}.${svixTimestamp}.${payload}`;
    const hmac = createHmac("sha256", key);
    hmac.update(signedContent);
    const expected = hmac.digest("base64");
    const expectedBuf = Buffer.from(expected, "base64");

    // svix-signature may contain multiple space-separated "v1,<base64>" entries
    const sigs = svixSig.split(" ").map((s) => s.replace(/^v\d+,/, ""));
    return sigs.some((s) => {
      try {
        return timingSafeEqual(expectedBuf, Buffer.from(s, "base64"));
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[resend webhook] RESEND_WEBHOOK_SECRET not set");
    return NextResponse.json({ error: "misconfigured" }, { status: 500 });
  }

  const raw = await req.text();

  const svixId = req.headers.get("svix-id") ?? "";
  const svixTimestamp = req.headers.get("svix-timestamp") ?? "";
  const svixSig = req.headers.get("svix-signature") ?? "";
  if (
    secret !== "dev" &&
    !verifySignature(secret, raw, svixId, svixTimestamp, svixSig)
  ) {
    console.warn("[resend webhook] invalid signature");
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  if (event.type !== "email.received") {
    // Ack non-inbound events (e.g. delivery, bounce) without processing
    return NextResponse.json({ ok: true });
  }

  const data = event.data as Record<string, unknown>;
  const messageId = (data.email_id ?? data.id ?? "") as string;
  const to = ((data.to as string[]) ?? [])[0] ?? "";
  const from = (data.from as string) ?? "";
  const subject = (data.subject as string) ?? "";
  const receivedAt = new Date((data.created_at as string) ?? Date.now());
  const plainText = (data.text as string) ?? (data.plain_text as string) ?? "";
  const html = (data.html as string) ?? "";

  if (!messageId || !to) {
    console.warn("[resend webhook] missing id or to field", { messageId, to });
    return NextResponse.json({ ok: true });
  }

  // ── Routing ──────────────────────────────────────────────────────────────
  // vargas@ → forward to personal Gmail
  // hello@  → store in DB (webhook inbox)
  // other   → drop
  if (to === VARGAS_ADDRESS) {
    await forwardEmail(data);
    console.log(`[resend webhook] forwarded ${messageId} from ${from} → ${FORWARD_TO}`);
    return NextResponse.json({ ok: true });
  }

  if (to !== HELLO_ADDRESS) {
    console.log(`[resend webhook] dropping email to ${to} (not a handled address)`);
    return NextResponse.json({ ok: true });
  }

  // hello@ — store full payload in Blob + metadata in DB
  const blobKey = `emails/${to.split("@")[0]}/${receivedAt.toISOString()}-${messageId}.json`;
  await put(blobKey, JSON.stringify({ ...data, raw_event: event }), {
    access: "public",
    contentType: "application/json",
  });

  await db
    .insert(emails)
    .values({
      id: messageId,
      to,
      from,
      subject,
      receivedAt,
      blobKey,
      preview: plainText.slice(0, 200).replace(/\s+/g, " ").trim(),
    })
    .onConflictDoNothing();

  console.log(`[resend webhook] stored email ${messageId} → ${to}`);
  return NextResponse.json({ ok: true });
}
