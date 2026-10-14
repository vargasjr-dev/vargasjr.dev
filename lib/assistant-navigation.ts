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
