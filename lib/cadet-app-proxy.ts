import { ASSISTANT_GATEWAY_ORIGIN } from "./assistant-navigation";

/**
 * Same-origin reverse proxy for the embedded Cadet app's gateway traffic
 * (/v1, /web, /_allauth, /assistant/assets). Fixed upstream only — Cadet
 * remains responsible for pairing and API authorization.
 */
export async function proxyCadetApp(request: Request): Promise<Response> {
  const url = new URL(request.url);
  if (
    !/^\/(?:v1|web|_allauth)(?:\/|$)/.test(url.pathname) &&
    !url.pathname.startsWith("/assistant/assets/")
  ) {
    return new Response("Not found", { status: 404 });
  }
  const mutating = !["GET", "HEAD", "OPTIONS"].includes(request.method);
  const origin = request.headers.get("origin");
  if (mutating && origin !== url.origin) {
    return new Response("Origin not allowed", { status: 403 });
  }
  const target = new URL(url.pathname + url.search, ASSISTANT_GATEWAY_ORIGIN);
  const headers = new Headers();
  for (const [name, value] of request.headers) {
    if (
      /^(accept|accept-language|content-type|range|if-none-match|last-event-id|x-cadet-.+|cadet-device-id|x-csrftoken)$/.test(
        name,
      )
    ) {
      headers.set(name, value);
    }
  }
  // Never disclose admin_session or unrelated website cookies to the gateway.
  const cookies = (request.headers.get("cookie") ?? "")
    .split(";")
    .map((part) => part.trim())
    .filter((part) =>
      /^(cadet_web_access|cadet_web_refresh|csrftoken|sessionid)=/.test(part),
    );
  if (cookies.length) headers.set("cookie", cookies.join("; "));
  headers.set("ngrok-skip-browser-warning", "1");
  if (origin) headers.set("origin", target.origin);
  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers,
      redirect: "manual",
      cache: "no-store",
      signal: request.signal,
      ...(mutating ? { body: await request.arrayBuffer() } : {}),
    });
  } catch {
    return Response.json(
      { error: "Assistant gateway unavailable" },
      { status: 502 },
    );
  }
  const responseHeaders = new Headers(upstream.headers);
  responseHeaders.delete("content-encoding");
  responseHeaders.delete("content-length");
  responseHeaders.delete("set-cookie");
  for (const cookie of upstream.headers.getSetCookie()) {
    if (
      /^(cadet_web_access|cadet_web_refresh|csrftoken|sessionid)=/.test(cookie)
    ) {
      responseHeaders.append(
        "set-cookie",
        cookie.replace(/;\s*Domain=[^;]+/gi, ""),
      );
    }
  }
  const location = responseHeaders.get("location");
  if (location) {
    const redirect = new URL(location, target);
    if (redirect.origin === target.origin) {
      responseHeaders.set(
        "location",
        redirect.pathname + redirect.search + redirect.hash,
      );
    }
  }
  responseHeaders.set("cache-control", "private, no-store");
  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}
