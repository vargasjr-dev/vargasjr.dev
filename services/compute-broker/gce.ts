import { BrokerHttpError } from "./contract";
import { metadataAccessToken } from "./gcp-auth";

// Minimal Compute Engine REST client for the instance lifecycle the broker
// needs: create (boot disk + startup script + labels), get status, delete.

export interface CreateInstanceInput {
  name: string;
  machineType: string;
  sourceImage: string;
  diskSizeGb: number;
  labels: Record<string, string>;
  startupScript: string;
}

export interface GceApi {
  createInstance(input: CreateInstanceInput): Promise<void>;
  getInstance(name: string): Promise<{ status: string } | null>;
  deleteInstance(name: string): Promise<void>;
}

export function createGceApi(
  project: string,
  zone: string,
  fetchImpl: typeof fetch = globalThis.fetch,
): GceApi {
  const baseUrl = `https://compute.googleapis.com/compute/v1/projects/${project}/zones/${zone}`;

  async function token(): Promise<string> {
    return metadataAccessToken(fetchImpl);
  }

  async function createInstance(input: CreateInstanceInput): Promise<void> {
    const response = await fetchImpl(`${baseUrl}/instances`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${await token()}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: input.name,
        machineType: `zones/${zone}/machineTypes/${input.machineType}`,
        disks: [
          {
            boot: true,
            autoDelete: true,
            initializeParams: {
              sourceImage: input.sourceImage,
              diskSizeGb: input.diskSizeGb,
            },
          },
        ],
        metadata: {
          items: [{ key: "startup-script", value: input.startupScript }],
        },
        labels: input.labels,
        networkInterfaces: [
          {
            network: "global/networks/default",
            accessConfigs: [{ type: "ONE_TO_ONE_NAT", name: "external-ip" }],
          },
        ],
      }),
    });
    if (response.ok) return;
    if (response.status === 409) {
      throw new BrokerHttpError(
        409,
        "already_exists",
        `Instance ${input.name} already exists.`,
      );
    }
    const text = await response.text();
    throw new BrokerHttpError(
      502,
      "gce_create_failed",
      `GCE instance create failed (${response.status}): ${text.slice(0, 400)}`,
    );
  }

  async function getInstance(name: string): Promise<{ status: string } | null> {
    const response = await fetchImpl(`${baseUrl}/instances/${name}`, {
      headers: { authorization: `Bearer ${await token()}` },
    });
    if (response.status === 404) return null;
    if (!response.ok) {
      throw new BrokerHttpError(
        502,
        "gce_get_failed",
        `GCE instance get failed (${response.status}).`,
      );
    }
    const body = (await response.json()) as { status?: unknown };
    return {
      status: typeof body.status === "string" ? body.status : "UNKNOWN",
    };
  }

  async function deleteInstance(name: string): Promise<void> {
    const response = await fetchImpl(`${baseUrl}/instances/${name}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${await token()}` },
    });
    if (response.ok || response.status === 404) return;
    throw new BrokerHttpError(
      502,
      "gce_delete_failed",
      `GCE instance delete failed (${response.status}).`,
    );
  }

  return { createInstance, getInstance, deleteInstance };
}
