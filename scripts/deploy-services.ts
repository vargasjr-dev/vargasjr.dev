// Build, push, and roll the Cloud Run services changed on this commit.
// Replaces what used to be two inline dispatcher.yml steps (build+push,
// then revision roll) so the deploy loop lives in one reviewable place.
// Node builtins only — this file sits inside the app's tsconfig (include
// **/*.ts), so no runtime-specific imports Vercel's build can't resolve.
import { spawnSync } from "node:child_process";

const SERVICES = (process.env.SERVICES ?? "").split(/\s+/).filter(Boolean);
const SHA = process.env.GITHUB_SHA;
const PROJECT = "vargasjr-dev";
const REGION = "us-central1";
const REGISTRY = `us-central1-docker.pkg.dev/${PROJECT}/portfolio`;

if (!SHA || SERVICES.length === 0) {
  console.error("GITHUB_SHA and SERVICES are required");
  process.exit(1);
}

function run(cmd: string[], mustSucceed = false): number {
  console.log(`+ ${cmd.join(" ")}`);
  const result = spawnSync(cmd[0], cmd.slice(1), { stdio: "inherit" });
  if (mustSucceed && (result.status !== 0 || result.error)) {
    console.error(`command failed: ${cmd.join(" ")}`);
    process.exit(1);
  }
  return result.status ?? 1;
}

run(["gcloud", "auth", "configure-docker", "us-central1-docker.pkg.dev", "--quiet"], true);

for (const service of SERVICES) {
  const image = `${REGISTRY}/${service}`;

  run([
    "gcloud", "builds", "submit", `services/${service}`,
    `--service-account=projects/${PROJECT}/serviceAccounts/terraform-apply@${PROJECT}.iam.gserviceaccount.com`,
    "--default-buckets-behavior=regional-user-owned-bucket",
    "--pack", `image=${image}:${SHA}`,
  ], true);
  run(["gcloud", "artifacts", "docker", "tags", "add", `${image}:${SHA}`, `${image}:latest`], true);

  // New image -> new revision. Dev twins (e.g. stripe-dispatcher-dev) run
  // the same image under a "-dev" service name — roll them too so they
  // don't stay pinned to the image from their creation apply.
  const roll = (name: string) =>
    run(["gcloud", "run", "services", "update", name, "--region", REGION, "--image", `${image}:${SHA}`, "--quiet"], true);
  roll(service);
  const twin = run(["gcloud", "run", "services", "describe", `${service}-dev`, "--region", REGION]);
  if (twin === 0) {
    roll(`${service}-dev`);
  }
}
