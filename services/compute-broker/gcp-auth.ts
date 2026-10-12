// Auth for GCP APIs (Compute, Storage, Secret Manager) via the Cloud Run /
// GCE metadata server. No service-account keys anywhere — the broker's own
// runtime identity carries the permissions granted by terraform.

const METADATA_URL =
  "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token";

let cached: { token: string; expiresAt: number } | null = null;

export async function metadataAccessToken(
  fetchImpl: typeof fetch = globalThis.fetch,
): Promise<string> {
  const now = Date.now();
  if (cached && cached.expiresAt - 60_000 > now) return cached.token;

  const response = await fetchImpl(METADATA_URL, {
    headers: { "Metadata-Flavor": "Google" },
  });
  if (!response.ok) {
    throw new Error(`metadata server returned ${response.status}`);
  }
  const body = (await response.json()) as {
    access_token?: unknown;
    expires_in?: unknown;
  };
  if (typeof body.access_token !== "string" || body.access_token.length === 0) {
    throw new Error("metadata token response missing access_token");
  }
  const expiresInSeconds =
    typeof body.expires_in === "number" ? body.expires_in : 3600;
  cached = {
    token: body.access_token,
    expiresAt: now + expiresInSeconds * 1000,
  };
  return cached.token;
}
