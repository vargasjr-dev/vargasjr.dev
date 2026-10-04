const http = require("node:http");
const Stripe = require("stripe");

const stripe = new Stripe(process.env.STRIPE_API_KEY);

const ROUTES = {
  mycadet: "https://mycadet.ai/api/stripe/webhook",
};

function projectFromEvent(event) {
  const object = event?.data?.object ?? {};
  return (
    object?.metadata?.project ??
    object?.subscription_details?.metadata?.project ??
    null
  );
}

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

http
  .createServer(async (req, res) => {
    if (req.method !== "POST" || req.url !== "/api/stripe/webhook") {
      sendJson(res, 404, { error: "not_found" });
      return;
    }

    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const raw = Buffer.concat(chunks).toString();

    let event;
    try {
      event = stripe.webhooks.constructEvent(
        raw,
        req.headers["stripe-signature"],
        process.env.STRIPE_WEBHOOK_SECRET,
      );
    } catch (err) {
      console.error(
        "[stripe dispatcher] signature verification failed:",
        err.message,
      );
      sendJson(res, 400, { error: "bad_signature" });
      return;
    }

    const project = projectFromEvent(event);
    if (!project) {
      sendJson(res, 200, { received: true, skipped: "no_project_metadata" });
      return;
    }

    const route = ROUTES[project];
    if (!route) {
      sendJson(res, 200, { received: true, skipped: "no_route", project });
      return;
    }

    const forward = await fetch(route, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Stripe-Signature": req.headers["stripe-signature"],
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
  .listen(process.env.PORT || 8080);
