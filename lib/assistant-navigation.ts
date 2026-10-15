const SPA_PREFIX = "/assistant";
const ADMIN_PREFIX = "/admin/assistant";

function remap(path: string, from: string, to: string): string {
  const url = new URL(path, "https://site.example");
  if (url.pathname !== from && !url.pathname.startsWith(`${from}/`)) {
    throw new Error("Not an assistant route");
  }
  const suffix = url.pathname.slice(from.length);
  const pathname = `${to}${suffix}`.replace(/\/*$/, "/");
  return pathname + url.search + url.hash;
}

export function parentToSpa(path: string): string {
  return remap(path, ADMIN_PREFIX, SPA_PREFIX);
}

export function spaToParent(path: string): string {
  return remap(path, SPA_PREFIX, ADMIN_PREFIX);
}

export function gatewayAssistantUrl(gateway: string, spaPath: string): string {
  const target = new URL(gateway);
  const route = new URL(spaPath, "https://site.example");
  const base = target.pathname.replace(/\/+$/, "").replace(/\/assistant$/, "");
  target.pathname = base + route.pathname;
  target.search = route.search;
  target.hash = route.hash;
  return target.href;
}

export function assistantReturnPath(value: string | null): string | null {
  if (!value || !value.startsWith(`${ADMIN_PREFIX}/`)) return null;
  return value;
}

export const ASSISTANT_RETURN_KEY = "adminAssistantReturnTo";

export const ASSISTANT_GATEWAY_ORIGIN = "https://assistant.vargasjr.dev";

export function assistantFrameUrl(parentPath: string): string {
  return gatewayAssistantUrl(ASSISTANT_GATEWAY_ORIGIN, parentToSpa(parentPath));
}

export function assistantNavigationMessage(
  value: unknown,
): { path: string; nav: "push" | "replace" | "pop" } | null {
  if (
    !value ||
    typeof value !== "object" ||
    !("source" in value) ||
    !("path" in value) ||
    !("nav" in value)
  )
    return null;
  // "mycadet-web-nav" is the remote-gateway cadet SPA's bridge protocol
  // (mycadet-temp clients/web/src/lib/auth/remote-gateway-nav-bridge.ts).
  if (value.source !== "mycadet-web-nav") return null;
  if (typeof value.path !== "string" || !value.path.startsWith("/assistant/"))
    return null;
  if (value.nav !== "push" && value.nav !== "replace" && value.nav !== "pop")
    return null;
  try {
    spaToParent(value.path);
  } catch {
    return null;
  }
  return { path: value.path, nav: value.nav };
}
