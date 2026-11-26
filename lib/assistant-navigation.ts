// The admin page renders Cadet in-process (@mycadet/app's EmbeddedApp at
// basename /admin), so the old iframe nav protocol and its url remapping are
// gone. What survives: the gateway's fixed origin (deep links + the proxy)
// and the login-return path bookkeeping.

/** Cadet deep links redirect to its fixed ingress domain. */
export function gatewayAssistantUrl(gateway: string, spaPath: string): string {
  const target = new URL(gateway);
  const route = new URL(spaPath, "https://site.example");
  const base = target.pathname.replace(/\/+$/, "").replace(/\/assistant$/, "");
  target.pathname = base + route.pathname;
  target.search = route.search;
  target.hash = route.hash;
  return target.href;
}

const ADMIN_PREFIX = "/admin/assistant";

export function assistantReturnPath(value: string | null): string | null {
  if (!value || !value.startsWith(`${ADMIN_PREFIX}/`)) return null;
  return value;
}

export const ASSISTANT_RETURN_KEY = "adminAssistantReturnTo";

export const ASSISTANT_GATEWAY_ORIGIN = "https://assistant.vargasjr.dev";
