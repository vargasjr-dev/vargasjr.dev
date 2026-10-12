import { createGceApi } from "./gce";
import { createGcsStore } from "./store";
import { createBroker } from "./broker";
import { createServer } from "./server";
import { metadataAccessToken } from "./gcp-auth";

const project = process.env.GCP_PROJECT ?? "vargasjr-dev";
const zone = process.env.ZONE ?? "us-central1-a";
const stateBucket = process.env.STATE_BUCKET ?? "";
const brokerToken = process.env.BROKER_TOKEN ?? "";
const brokerUrl = process.env.BROKER_PUBLIC_URL ?? "";

// Optional read token for worker clones of private repositories. Absent
// locally or unset in Secret Manager → workers can only clone public repos.
async function readOptionalSecret(name: string): Promise<string | undefined> {
  try {
    const token = await metadataAccessToken();
    const response = await fetch(
      `https://secretmanager.googleapis.com/v1/projects/${project}/secrets/${name}/versions/latest:access`,
      { headers: { authorization: `Bearer ${token}` } },
    );
    if (response.status === 404) return undefined;
    if (!response.ok)
      throw new Error(`secret read failed (${response.status})`);
    const body = (await response.json()) as { payload?: { data?: string } };
    const data = body.payload?.data
      ? Buffer.from(body.payload.data, "base64").toString("utf8")
      : "";
    if (data.length === 0 || data === "unset") return undefined;
    return data;
  } catch {
    return undefined;
  }
}

async function main(): Promise<void> {
  if (stateBucket.length === 0) throw new Error("STATE_BUCKET is required");
  if (brokerToken.length === 0) throw new Error("BROKER_TOKEN is required");

  const githubToken = await readOptionalSecret("COMPUTE_BROKER_GITHUB_TOKEN");
  const broker = createBroker({
    gce: createGceApi(project, zone),
    store: createGcsStore(stateBucket),
    brokerUrl,
    githubToken,
  });

  const port = Number(process.env.PORT ?? 8080);
  createServer({ broker, brokerToken }).listen(port, () => {
    console.log(`[compute-broker] listening on port ${port}`);
  });
}

if (process.env.NODE_ENV !== "test") {
  void main();
}
