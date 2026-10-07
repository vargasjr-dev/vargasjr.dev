import http from "node:http";
import { z } from "zod";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_API_KEY ?? "");

// Each mode gets its own dispatcher service (prod + dev), all running
// this same image. Terraform passes each instance exactly one signing
// secret plus the mode it serves.
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "";
const MODE = process.env.DISPATCHER_MODE === "dev" ? "dev" : "prod";

// Per-mode routes. Cadet's handler is mode-agnostic and its sandbox
// workspace runs no handler of its own (cadet's modules/dev is Vercel-side
// only), so both modes point at the same handler today — split them here
// when cadet grows a sandbox handler.
const ROUTES: Record<string, Record<"prod" | "dev", string>> = {
  mycadet: {
    prod: "https://stripe-handler-235870281591.us-central1.run.app",
    dev: "https://stripe-handler-235870281591.us-central1.run.app",
  },
};

const objectMetadata = z.object({
  metadata: z.object({ project: z.string() }).optional(),
  subscription_details: z
    .object({ metadata: z.object({ project: z.string() }) })
    .optional(),
});

function projectFromEvent(event: Stripe.Event): string | null {
  const parsed = objectMetadata.safeParse(event.data.object);
  if (!parsed.success) return null;
  return (
    parsed.data.metadata?.project ??
    parsed.data.subscription_details?.metadata?.project ??
    null
  );
}

function sendJson(
  res: http.ServerResponse,
  status: number,
  body: unknown,
): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

http
  .createServer(async (req, res) => {
    if (req.method !== "POST" || req.url !== "/api/stripe/webhook") {
      sendJson(res, 404, { error: "not_found" });
      return;
    }

    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const raw = Buffer.concat(chunks).toString();

    const signatureHeader = req.headers["stripe-signature"];
    const signature =
      typeof signatureHeader === "string" ? signatureHeader : "";

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(raw, signature, WEBHOOK_SECRET);
    } catch {
      console.error("[stripe dispatcher] signature verification failed");
      sendJson(res, 400, { error: "bad_signature" });
      return;
    }

    const project = projectFromEvent(event);
    if (!project) {
      sendJson(res, 200, { received: true, skipped: "no_project_metadata" });
      return;
    }

    const route = ROUTES[project]?.[MODE];
    if (!route) {
      sendJson(res, 200, { received: true, skipped: "no_route", project });
      return;
    }

    const identity = await fetch(
      `http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity?audience=${encodeURIComponent(route)}`,
      { headers: { "Metadata-Flavor": "Google" } },
    );
    if (!identity.ok) {
      sendJson(res, 502, { error: "identity_failed" });
      return;
    }
    const idToken = await identity.text();

    const forward = await fetch(route, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
        "Stripe-Signature": signature,
        "X-Dispatcher-Project": project,
        "X-Dispatcher-Event": event.type,
      },
      body: raw,
    });

    if (!forward.ok) {
      const body = await forward.text().catch(() => "");
      console.error(
        `[stripe dispatcher] handler ${project} failed with ${forward.status}:`,
        body.slice(0, 500),
      );
      sendJson(res, 502, {
        error: "handler_failed",
        project,
        status: forward.status,
      });
      return;
    }

    sendJson(res, 200, { received: true, project });
  })
  .listen(process.env.PORT ?? 8080);
