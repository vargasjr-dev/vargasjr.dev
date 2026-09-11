import { NextResponse } from "next/server";
import {
  decodeGoogleIdEmail,
  exchangeCodeForTokens,
  encryptToken,
} from "@/lib/gmail-auth";
import { db } from "@/db";
import { gmailConnection } from "@/db/schema";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const cookieState = request.headers
    .get("cookie")
    ?.match(/gmail_oauth_state=([^;]+)/)?.[1];

  const origin = process.env.NEXT_PUBLIC_SITE_URL || url.origin;
  const back = (msg: string, ok = false) =>
    NextResponse.redirect(
      `${origin}/admin/gmail?${ok ? "connected=1" : "error=" + encodeURIComponent(msg)}`,
    );

  if (error) return back(`Google returned: ${error}`);
  if (!code) return back("missing code");
  if (!state || !cookieState || state !== cookieState) {
    return back("state mismatch — start the connect flow again");
  }

  try {
    const redirectUri = `${origin}/api/gmail/callback`;
    const tok = await exchangeCodeForTokens(code, redirectUri);
    const email = (await decodeGoogleIdEmail(tok.id_token)) ?? "unknown";

    await db
      .insert(gmailConnection)
      .values({
        id: "google",
        email,
        accessToken: encryptToken(tok.access_token),
        refreshToken: tok.refresh_token
          ? encryptToken(tok.refresh_token)
          : null,
        expiresAt: new Date(Date.now() + tok.expires_in * 1000),
        scope: tok.scope ?? "",
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: gmailConnection.id,
        set: {
          email,
          accessToken: encryptToken(tok.access_token),
          ...(tok.refresh_token
            ? { refreshToken: encryptToken(tok.refresh_token) }
            : {}),
          expiresAt: new Date(Date.now() + tok.expires_in * 1000),
          scope: tok.scope ?? "",
          updatedAt: new Date(),
        },
      });

    return back("", true);
  } catch (e) {
    return back(e instanceof Error ? e.message : "token exchange failed");
  }
}
