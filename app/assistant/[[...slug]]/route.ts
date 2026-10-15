import { NextResponse } from "next/server";
import {
  gatewayAssistantUrl,
  ASSISTANT_GATEWAY_ORIGIN,
} from "@/lib/assistant-navigation";

/** Cadet deep links redirect to its fixed ingress domain. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  return NextResponse.redirect(
    gatewayAssistantUrl(ASSISTANT_GATEWAY_ORIGIN, url.pathname + url.search),
    307,
  );
}
