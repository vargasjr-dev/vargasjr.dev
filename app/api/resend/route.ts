import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { db } from "@/db";
import { emails } from "@/db/schema";
import { createHmac, timingSafeEqual } from "crypto";

// Resend signs inbound webhooks with HMAC-SHA256 using the signing secret.
// https://resend.com/docs/dashboard/webhooks/introduction#securing-webhooks
function verifySignature(
  secret: string,
  payload: string,
  sig: string,
): boolean {
  const hmac = createHmac("sha256", secret);
  hmac.update(payload);
  const expected = hmac.digest("hex");
  try {
    return timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(sig, "hex"),
    );
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

  const sig =
    req.headers.get("svix-signature") ??
    req.headers.get("resend-signature") ??
    "";
  if (
    secret !== "dev" &&
    !verifySignature(secret, raw, sig.replace(/^v1,/, ""))
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
