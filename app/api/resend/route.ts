import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { db } from "@/db";
import { emails } from "@/db/schema";
import { createHmac, timingSafeEqual } from "crypto";

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

  // Store full payload in Blob
  const blobKey = `emails/${to.split("@")[0]}/${receivedAt.toISOString()}-${messageId}.json`;
  await put(blobKey, JSON.stringify({ ...data, raw_event: event }), {
    access: "public",
    contentType: "application/json",
  });

  // Store metadata in DB
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
