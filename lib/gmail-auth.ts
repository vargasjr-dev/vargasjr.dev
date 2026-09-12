import {
  createHash,
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { gmailConnection } from "@/db/schema";

export const GMAIL_SETTINGS_SCOPES = [
  "https://www.googleapis.com/auth/gmail.settings.basic",
  "https://www.googleapis.com/auth/gmail.settings.sharing",
  "https://www.googleapis.com/auth/gmail.labels", // list/create labels (no message content)
];

export const VARGASJR_LABEL_NAME = "VargasJR";

// --- token encryption -------------------------------------------------------

function encryptionKey(): Buffer {
  // Derives a stable key from the admin token so no extra secret is needed.
  return createHash("sha256")
    .update(`${process.env.ADMIN_TOKEN}:gmail-connection-tokens`)
    .digest();
}

export function encryptToken(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

export function decryptToken(stored: string): string {
  const [ivB64, tagB64, encB64] = stored.split(":");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(ivB64, "base64"),
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(encB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

// --- OAuth plumbing ---------------------------------------------------------

export function googleClientCredentials() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not configured",
    );
  }
  return { clientId, clientSecret };
}

export function buildAuthorizeUrl(redirectUri: string, state: string): string {
  const { clientId } = googleClientCredentials();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GMAIL_SETTINGS_SCOPES.join(" "),
    access_type: "offline", // needed to get a refresh_token
    prompt: "consent", // forces refresh_token issuance on repeat connects
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string, redirectUri: string) {
  const { clientId, clientSecret } = googleClientCredentials();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok)
    throw new Error(`token exchange failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope?: string;
    id_token?: string;
  };
}

// --- stored-connection helpers ----------------------------------------------

export async function getStoredConnection() {
  const rows = await db
    .select()
    .from(gmailConnection)
    .where(eq(gmailConnection.id, "google"))
    .limit(1);
  return rows[0] ?? null;
}

async function persistTokens(params: {
  email: string;
  accessToken: string;
  refreshToken?: string | null;
  expiresAt: Date;
  scope: string;
}) {
  await db
    .insert(gmailConnection)
    .values({
      id: "google",
      email: params.email,
      accessToken: encryptToken(params.accessToken),
      refreshToken: params.refreshToken
        ? encryptToken(params.refreshToken)
        : null,
      expiresAt: params.expiresAt,
      scope: params.scope,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: gmailConnection.id,
      set: {
        email: params.email,
        accessToken: encryptToken(params.accessToken),
        ...(params.refreshToken
          ? { refreshToken: encryptToken(params.refreshToken) }
          : {}),
        expiresAt: params.expiresAt,
        scope: params.scope,
        updatedAt: new Date(),
      },
    });
}

/** Returns a valid access token, refreshing via Google if needed. */
export async function getValidAccessToken(): Promise<string> {
  const conn = await getStoredConnection();
  if (!conn) throw new Error("gmail not connected");

  if (conn.expiresAt.getTime() > Date.now() + 60_000) {
    return decryptToken(conn.accessToken);
  }

  if (!conn.refreshToken)
    throw new Error("gmail connection has no refresh token");
  const { clientId, clientSecret } = googleClientCredentials();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: decryptToken(conn.refreshToken),
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok)
    throw new Error(`refresh failed: ${res.status} ${await res.text()}`);
  const tok = (await res.json()) as {
    access_token: string;
    expires_in: number;
    scope?: string;
  };

  await persistTokens({
    email: conn.email,
    accessToken: tok.access_token,
    refreshToken: null, // keep existing refresh token
    expiresAt: new Date(Date.now() + tok.expires_in * 1000),
    scope: tok.scope ?? conn.scope,
  });
  return tok.access_token;
}

// --- Gmail settings API ------------------------------------------------------

async function gmailFetch(path: string, init?: RequestInit) {
  const token = await getValidAccessToken();
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/${path}`,
    {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...init?.headers,
      },
    },
  );
  if (!res.ok)
    throw new Error(
      `gmail api ${path} failed: ${res.status} ${await res.text()}`,
    );
  // 204 / empty bodies (e.g. forwarding addresses when none exist yet)
  const text = await res.text();
  return { json: () => (text.trim() ? JSON.parse(text) : {}) };
}

export async function listGmailFilters() {
  const res = await gmailFetch("settings/filters");
  const data = (await res.json()) as {
    filter?: Array<{
      id: string;
      criteria: {
        from?: string;
        subject?: string;
        query?: string;
        hasAttachment?: boolean;
      };
      action: {
        addLabelIds?: string[];
        removeLabelIds?: string[];
        // NB: the Gmail API reads/writes forwarding filters as `forward`,
        // despite the docs calling it `forwardTo`
        forward?: string;
      };
    }>;
  };
  return data.filter ?? [];
}

export async function createGmailFilter(filter: {
  criteria: { from?: string; subject?: string; query?: string };
  action: {
    forwardTo?: string;
    addLabelIds?: string[];
    removeLabelIds?: string[];
  };
}) {
  // the API silently ignores `forwardTo` — the real field is `forward`
  const { forwardTo, ...rest } = filter.action;
  const action = { ...rest, ...(forwardTo ? { forward: forwardTo } : {}) };
  const res = await gmailFetch("settings/filters", {
    method: "POST",
    body: JSON.stringify({ ...filter, action }),
  });
  return res.json();
}

export async function deleteGmailFilter(id: string) {
  await gmailFetch(`settings/filters/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function listForwardingAddresses() {
  const res = await gmailFetch("settings/forwardingAddresses");
  const data = (await res.json()) as {
    forwardingAddresses?: Array<{
      forwardingEmail: string;
      verificationStatus: string;
    }>;
  };
  return data.forwardingAddresses ?? [];
}

/** Triggers Google's verification email to the given address. */
export async function createForwardingAddress(email: string) {
  const res = await gmailFetch("settings/forwardingAddresses", {
    method: "POST",
    body: JSON.stringify({ forwardingEmail: email }),
  });
  return res.json();
}

export async function decodeGoogleIdEmail(
  idToken: string | undefined,
): Promise<string | null> {
  if (!idToken) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(idToken.split(".")[1], "base64url").toString("utf8"),
    );
    return typeof payload.email === "string" ? payload.email : null;
  } catch {
    return null;
  }
}

// --- labels -------------------------------------------------------------------

type GmailLabel = { id: string; name: string; type: string };

export async function listGmailLabels(): Promise<GmailLabel[]> {
  const res = await gmailFetch("labels");
  const data = (await res.json()) as { labels?: GmailLabel[] };
  return data.labels ?? [];
}

/** Finds the VargasJR label, creating it if it doesn't exist yet. */
export async function findOrCreateVargasJrLabel(): Promise<string> {
  const labels = await listGmailLabels();
  const existing = labels.find(
    (l) => l.type === "user" && l.name === VARGASJR_LABEL_NAME,
  );
  if (existing) return existing.id;

  const res = await gmailFetch("labels", {
    method: "POST",
    body: JSON.stringify({
      name: VARGASJR_LABEL_NAME,
      labelListVisibility: "labelShow",
      messageListVisibility: "show",
    }),
  });
  const created = (await res.json()) as GmailLabel;
  return created.id;
}
