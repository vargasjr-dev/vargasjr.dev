const [prNumberRaw, scriptPath] = [process.env.PR_NUMBER, process.env.OPERATION_SCRIPT];

if (!prNumberRaw || !scriptPath) {
  console.error("PR_NUMBER and OPERATION_SCRIPT are required");
  process.exit(1);
}

const prNumber = Number(prNumberRaw);
if (!Number.isInteger(prNumber) || prNumber < 1) {
  console.error("pr_number must be a positive integer");
  process.exit(1);
}

if (!scriptPath.match(/^scripts\/infra-operations\/[a-z0-9-]+\.sh$/) || scriptPath.includes("..")) {
  console.error("script must be a .sh file directly under scripts/infra-operations/");
  process.exit(1);
}

const token = process.env.GITHUB_TOKEN;
if (!token) {
  console.error("GITHUB_TOKEN is not set");
  process.exit(1);
}

const { GITHUB_REPOSITORY } = process.env;
if (!GITHUB_REPOSITORY) {
  console.error("GITHUB_REPOSITORY is not set");
  process.exit(1);
}

const [owner, repo] = GITHUB_REPOSITORY.split("/");
const api = (path: string) =>
  fetch(`https://api.github.com${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
    },
  });

const pull = await api(`/repos/${owner}/${repo}/pulls/${prNumber}`).then((r) => r.json());
if (pull.state !== "open") {
  console.error(`PR #${prNumber} must be open; it is ${pull.state}`);
  process.exit(1);
}
if (pull.base?.ref !== "main") {
  console.error(`PR #${prNumber} must target main; it targets ${pull.base?.ref}`);
  process.exit(1);
}
if (pull.head?.repo?.full_name !== `${owner}/${repo}`) {
  console.error("The operation PR must come from this repository, not a fork");
  process.exit(1);
}

const files = await api(`/repos/${owner}/${repo}/pulls/${prNumber}/files?per_page=100`).then((r) =>
  r.json(),
);
const selected = files.find((file: { filename: string; status: string }) => file.filename === scriptPath && file.status === "added");
if (!selected) {
  console.error(`The PR must add ${scriptPath}`);
  process.exit(1);
}
const unexpected = files.filter((file: { filename: string }) => file.filename !== scriptPath);
if (unexpected.length > 0) {
  console.error(`The PR may only add the script; also received ${unexpected.map((f: { filename: string }) => f.filename).join(", ")}`);
  process.exit(1);
}

const outputFile = process.env.GITHUB_OUTPUT;
if (outputFile) {
  const fs = await import("node:fs");
  fs.appendFileSync(outputFile, `head_sha=${pull.head.sha}\n`);
}
console.log(`Using ${owner}/${repo}@${pull.head.sha}`);

# Make this file a module so bun can type-check it during the app build.
export {};
