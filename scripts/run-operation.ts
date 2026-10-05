import { appendFileSync } from "node:fs";

const [owner, repo] = (process.env.GITHUB_REPOSITORY ?? "").split("/");
if (!owner || !repo) {
  console.error("GITHUB_REPOSITORY is not set");
  process.exit(1);
}

const branch = process.env.GITHUB_REF_NAME;
if (!branch || branch === "main") {
  console.error("Dispatch this workflow from the operation branch, not main");
  process.exit(1);
}

const token = process.env.GITHUB_TOKEN;
if (!token) {
  console.error("GITHUB_TOKEN is not set");
  process.exit(1);
}

const api = (path: string) =>
  fetch(`https://api.github.com${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
    },
  });

const pulls = await api(
  `/repos/${owner}/${repo}/pulls?state=open&base=main&head=${owner}:${branch}&per_page=100`,
).then((r) => r.json());
if (!Array.isArray(pulls) || pulls.length !== 1) {
  console.error(
    `Expected exactly one open PR from branch ${branch} targeting main; found ${Array.isArray(pulls) ? pulls.length : 0}`,
  );
  process.exit(1);
}
const pull = pulls[0];
if (pull.base?.ref !== "main") {
  console.error(
    `The operation PR must target main; it targets ${pull.base?.ref}`,
  );
  process.exit(1);
}
if (pull.head?.repo?.full_name !== `${owner}/${repo}`) {
  console.error("The operation PR must come from this repository, not a fork");
  process.exit(1);
}

type ChangedFile = { filename: string; status: string };

const files: ChangedFile[] = [];
for (let page = 1; ; page += 1) {
  const batch = await api(
    `/repos/${owner}/${repo}/pulls/${pull.number}/files?per_page=100&page=${page}`,
  ).then((r) => r.json());
  if (!Array.isArray(batch)) {
    console.error(`Could not list files for PR #${pull.number}`);
    process.exit(1);
  }
  files.push(...batch);
  if (batch.length < 100) break;
}

const dataPattern = /^scripts\/data-migrations\/[^/]+\.(ts|js)$/;
const infraPattern = /^scripts\/infra-operations\/[^/]+\.sh$/;
const isOperationScript = (file: ChangedFile) =>
  (dataPattern.test(file.filename) || infraPattern.test(file.filename)) &&
  file.status === "added" &&
  !file.filename.includes("..");
const allowedSupportingFiles = new Set([
  ".github/workflows/run-operation.yml",
  "scripts/data-migrations/README.md",
]);
const operationScripts = files.filter(isOperationScript);
const unexpected = files.filter(
  (file) =>
    !isOperationScript(file) && !allowedSupportingFiles.has(file.filename),
);
if (operationScripts.length !== 1 || unexpected.length > 0) {
  console.error(
    `The PR must add exactly one script under scripts/data-migrations/ or scripts/infra-operations/ and may only modify the runner workflow or the data-migrations README; received ${files.map((f) => `${f.status}:${f.filename}`).join(", ") || "no files"}`,
  );
  process.exit(1);
}

const script = operationScripts[0].filename;
const outputFile = process.env.GITHUB_OUTPUT;
if (outputFile) {
  appendFileSync(
    outputFile,
    `kind=${dataPattern.test(script) ? "data" : "infra"}\nscript=${script}\nhead_sha=${pull.head.sha}\n`,
  );
}
console.log(
  `Using ${owner}/${repo}@${pull.head.sha} from PR #${pull.number}: ${script}`,
);
