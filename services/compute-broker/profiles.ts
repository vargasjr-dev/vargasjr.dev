import { EXECUTION_PROFILE_SCHEMA_VERSION } from "./contract";

// Broker-side registry of the execution profiles the force plugin declares
// (execution-profiles/*.json). Keep the two in sync: the plugin loads its
// copy from disk, the broker validates dispatches against this one.
// INSTANCE_BACKENDS maps each profile onto the GCP resources this broker
// provisions; a profile without a backend answers dispatches with
// profile_backend_unavailable (macos-qa needs a Mac backend to exist).

// Global ceiling on per-profile concurrency: the broker's worker fleet stays
// bounded no matter what a profile declares.
export const MAX_PROFILE_CONCURRENCY = 4;

export interface ExecutionProfile {
  schemaVersion: number;
  name: string;
  description: string;
  taskModel: "per-task";
  runtime: {
    os: "linux" | "macos";
    architecture: "arm64" | "x64";
    size: "small" | "standard" | "large";
  };
  capabilities: string[];
  cachePolicy: {
    gitObjects: boolean;
    dependencies: boolean;
    buildArtifacts: boolean;
  };
  limits: {
    maxConcurrentTasks: number;
    idleTtlMinutes: number;
    maxLifetimeMinutes: number;
  };
  isolation: {
    freshHome: boolean;
    freshTemp: boolean;
    mountWorkspace: false;
    mountPersonalData: false;
  };
  requiresReason: boolean;
  allowedReasons?: string[];
}

export interface InstanceBackend {
  machineType: string;
  sourceImage: string;
  diskSizeGb: number;
}

export const EXECUTION_PROFILES: Record<string, ExecutionProfile> = {
  "linux-dev": {
    schemaVersion: EXECUTION_PROFILE_SCHEMA_VERSION,
    name: "linux-dev",
    description:
      "Disposable Linux worker for one repository implementation or validation task.",
    taskModel: "per-task",
    runtime: { os: "linux", architecture: "arm64", size: "standard" },
    capabilities: ["docker", "git", "github", "network-egress"],
    cachePolicy: { gitObjects: true, dependencies: true, buildArtifacts: true },
    limits: {
      maxConcurrentTasks: 3,
      idleTtlMinutes: 20,
      maxLifetimeMinutes: 240,
    },
    isolation: {
      freshHome: true,
      freshTemp: true,
      mountWorkspace: false,
      mountPersonalData: false,
    },
    requiresReason: false,
  },
  "macos-qa": {
    schemaVersion: EXECUTION_PROFILE_SCHEMA_VERSION,
    name: "macos-qa",
    description:
      "Gated macOS lane for validation that cannot be proven on Linux.",
    taskModel: "per-task",
    runtime: { os: "macos", architecture: "arm64", size: "standard" },
    capabilities: ["apple-platform", "git", "github", "network-egress"],
    cachePolicy: { gitObjects: true, dependencies: true, buildArtifacts: true },
    limits: {
      maxConcurrentTasks: 1,
      idleTtlMinutes: 20,
      maxLifetimeMinutes: 240,
    },
    isolation: {
      freshHome: false,
      freshTemp: false,
      mountWorkspace: false,
      mountPersonalData: false,
    },
    requiresReason: true,
    allowedReasons: [
      "apple-platform",
      "arm-macos-regression",
      "sandbox-parity",
    ],
  },
};

for (const [name, profile] of Object.entries(EXECUTION_PROFILES)) {
  if (profile.limits.maxConcurrentTasks > MAX_PROFILE_CONCURRENCY) {
    throw new Error(
      `Execution profile ${name} declares maxConcurrentTasks=${profile.limits.maxConcurrentTasks}, above the global limit of ${MAX_PROFILE_CONCURRENCY}.`,
    );
  }
}

export const INSTANCE_BACKENDS: Record<string, InstanceBackend> = {
  "linux-dev": {
    // Tau T2A: arm64, matching the profile's runtime.architecture.
    machineType: "t2a-standard-2",
    sourceImage: "projects/debian-cloud/global/images/family/debian-12-arm64",
    diskSizeGb: 20,
  },
};
