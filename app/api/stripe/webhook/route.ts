import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { z } from "zod";

const ROUTES: Record<string, string> = {
  mycadet: "https://mycadet.ai/api/stripe/webhook",
};

const metadataSchema = z.object({ project: z.string().optional() }).optional();

const eventObjectSchema = z.object({
  metadata: metadataSchema,
  subscription_details: z.object({ metadata: metadataSchema }).optional(),
});

function projectFromEvent(event: Stripe.Event): string | null {
  const parsed = eventObjectSchema.safeParse(event.data?.object);
  if (!parsed.success) return null;
  return (
    parsed.data.metadata?.project ??
    parsed.data.subscription_details?.metadata?.project ??
    null
  );
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.STRIPE_API_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = req.headers.get("stripe-signature");
  if (!apiKey || !webhookSecret || !signature) {
    return NextResponse.json(
      { error: "webhook_not_configured" },
      { status: 503 },
    );
  }

  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = new Stripe(apiKey).webhooks.constructEvent(
      raw,
      signature,
      webhookSecret,
    );
  } catch (err) {
    console.error("[stripe dispatcher] signature verification failed:", err);
    return NextResponse.json({ error: "bad_signature" }, { status: 400 });
  }

  const project = projectFromEvent(event);
  if (!project) {
    return NextResponse.json({
      received: true,
      skipped: "no_project_metadata",
    });
  }

  const route = ROUTES[project];
  if (!route) {
    return NextResponse.json({ received: true, skipped: "no_route", project });
  }

  const res = await fetch(route, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Stripe-Signature": signature,
      "X-Dispatcher-Project": project,
      "X-Dispatcher-Event": event.type,
    },
    body: raw,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(
      `[stripe dispatcher] handler ${project} failed with ${res.status}:`,
      body.slice(0, 500),
    );
    return NextResponse.json(
      { error: "handler_failed", project, status: res.status },
      { status: 502 },
    );
  }

  return NextResponse.json({ received: true, project });
}
