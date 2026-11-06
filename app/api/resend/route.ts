import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { db } from "@/db";
import { emails } from "@/db/schema";
import { createHmac, timingSafeEqual } from "crypto";
import {
  ALLOWED_FORWARDER,
  extractForwardedSender,
  fromAddress,
  htmlToText,
} from "@/lib/email-filter-request";
import { createGmailFilter, findOrCreateVargasJrLabel } from "@/lib/gmail-auth";

// Cold Neon connects + Google token refresh can be slow; give the webhook room.
export const maxDuration = 60;

const VARGAS_ADDRESS = "vargas@vargasjr.dev";
const HELLO_ADDRESS = "hello@vargasjr.dev";
const SUPPORT_ADDRESS = "support@mycadet.ai";
const FILTER_ADDRESS = "filter@vargasjr.dev";
const FORWARD_TO = "dvargasfuertes@gmail.com";

// filter@vargasjr.dev — Vargas forwards an email and the ORIGINAL sender
// becomes a Gmail filter (archived + VargasJR label). Only forwards from
// his work Gmail are honored; anything else is logged and dropped.
async function sendNotice(subject: string, text: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;
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
      text,
    }),
  });
  if (!res.ok) {
    console.warn(`[filter@] notice send failed (${res.status})`);
  }
}

async function handleFilterRequest(
  data: Record<string, unknown>,
  messageId: string,
): Promise<void> {
  const from = (data.from as string) ?? "";
  if (fromAddress(from) !== ALLOWED_FORWARDER) {
    console.warn(
      `[filter@] ignoring forward from ${from} — only ${ALLOWED_FORWARDER} may create filters`,
    );
    return;
  }

  // The webhook payload is metadata-only; fetch the full body.
  let text = (data.text as string) ?? (data.plain_text as string) ?? "";
  let html = (data.html as string) ?? "";
  if (messageId) {
    try {
      const contentRes = await fetch(
        `https://api.resend.com/emails/receiving/${messageId}`,
        { headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` } },
      );
      if (contentRes.ok) {
        const content = (await contentRes.json()) as {
          html?: string | null;
          text?: string | null;
        };
        html = content.html ?? html;
        text = content.text ?? text;
      } else {
        console.warn(
          `[filter@] receiving fetch failed (${contentRes.status}) for ${messageId}`,
        );
      }
    } catch (err) {
      console.warn(`[filter@] receiving fetch error for ${messageId}:`, err);
    }
  }

  const sender = extractForwardedSender(text || htmlToText(html));
  if (!sender) {
    await sendNotice(
      "filter@: no sender found",
      "I couldn't find a forwarded message header in that email — no filter was created. Forward it with Gmail's inline forward so the original From: header is included.",
    );
    return;
  }

  let labelNote = "";
  let labelId: string | null = null;
  try {
    labelId = await findOrCreateVargasJrLabel();
  } catch {
    labelNote =
      " (couldn't attach the VargasJR label — reconnect on /admin/gmail to grant the labels scope)";
  }

  try {
    await createGmailFilter({
      criteria: { from: sender },
      action: {
        ...(labelId ? { addLabelIds: [labelId] } : {}),
        // archive (remove from INBOX) + mark as read (remove UNREAD)
        removeLabelIds: ["INBOX", "UNREAD"],
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await sendNotice(
      `filter@: filter for ${sender} failed`,
      `Gmail rejected the filter: ${msg}`,
    );
    console.error(`[filter@] create failed for ${sender}:`, msg);
    return;
  }

  await sendNotice(
    `Filter created: ${sender}`,
    `Anything from ${sender} will now be archived and labeled VargasJR${labelNote}.`,
  );
  console.log(`[filter@] created filter for ${sender}`);
}

async function forwardEmail(data: Record<string, unknown>): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY not set");

  const originalFrom = (data.from as string) ?? "";
  const subject = (data.subject as string) ?? "(no subject)";
  const messageId = (data.email_id ?? data.id ?? "") as string;
  let html = (data.html as string) ?? "";
  let plainText = (data.text as string) ?? (data.plain_text as string) ?? "";

  // The email.received webhook payload is metadata-only — fetch the full
  // content from the Receiving API, falling back to the payload fields.
  if (messageId) {
    try {
      const contentRes = await fetch(
        `https://api.resend.com/emails/receiving/${messageId}`,
        { headers: { Authorization: `Bearer ${apiKey}` } },
      );
      if (contentRes.ok) {
        const content = (await contentRes.json()) as {
          html?: string | null;
          text?: string | null;
        };
        html = content.html ?? html;
        plainText = content.text ?? plainText;
      } else {
        console.warn(
          `[resend webhook] receiving fetch failed (${contentRes.status}) for ${messageId}`,
        );
      }
    } catch (err) {
      console.warn(
        `[resend webhook] receiving fetch error for ${messageId}:`,
        err,
      );
    }
  }

  // Pass the body through as-is — no forwarding headers, no "Fwd:" prefix.
  // reply_to points back to the original sender so replies go to them.
  const body = html ? { html } : { text: plainText || "(content unavailable)" };

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
  let plainText = (data.text as string) ?? (data.plain_text as string) ?? "";

  if (!messageId || !to) {
    console.warn("[resend webhook] missing id or to field", { messageId, to });
    return NextResponse.json({ ok: true });
  }

  // ── Routing ──────────────────────────────────────────────────────────────
  // vargas@ → forward to personal Gmail
  // support@mycadet.ai → forward to personal Gmail
  // filter@ → create a Gmail filter from the forwarded sender
  //           (only dvargasfuertes@gmail.com may trigger this)
  // hello@  → store in DB (webhook inbox)
  // other   → drop
  if (to === FILTER_ADDRESS) {
    try {
      await handleFilterRequest(data, messageId);
    } catch (err) {
      console.error("[filter@] unexpected failure:", err);
    }
    return NextResponse.json({ ok: true });
  }

  if (to === VARGAS_ADDRESS || to === SUPPORT_ADDRESS) {
    await forwardEmail(data);
    console.log(
      `[resend webhook] forwarded ${messageId} from ${from} → ${FORWARD_TO}`,
    );
    return NextResponse.json({ ok: true });
  }

  if (to !== HELLO_ADDRESS) {
    console.log(
      `[resend webhook] dropping email to ${to} (not a handled address)`,
    );
    return NextResponse.json({ ok: true });
  }

  // hello@ — fetch full content from Resend's Receiving API (the webhook
  // payload is metadata-only), store it in the table + payload in Blob.
  let html: string | null = null;
  let bodyText: string | null = null;
  const fetchUrl = `https://api.resend.com/emails/receiving/${messageId}`;
  try {
    const contentRes = await fetch(fetchUrl, {
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
    });
    if (contentRes.ok) {
      const content = (await contentRes.json()) as {
        html?: string | null;
        text?: string | null;
      };
      html = content.html ?? null;
      bodyText = content.text ?? null;
    } else {
      console.warn(
        `[resend webhook] receiving fetch failed (${contentRes.status}) for ${messageId}`,
      );
    }
  } catch (err) {
    console.warn(
      `[resend webhook] receiving fetch error for ${messageId}:`,
      err,
    );
  }

  if (!plainText && bodyText) {
    plainText = bodyText;
  }

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
      html,
      body: bodyText,
      preview: plainText.slice(0, 200).replace(/\s+/g, " ").trim(),
    })
    .onConflictDoNothing();

  console.log(`[resend webhook] stored email ${messageId} → ${to}`);
  return NextResponse.json({ ok: true });
}
