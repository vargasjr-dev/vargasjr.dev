import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const revision = "b434b2445fa070b4ac85e73230e25a4fd655425d";
const cache = path.join(root, ".cadet-app");
const source = path.join(cache, "source");
const output = path.join(cache, "package");
const patch = path.join(root, "patches/mycadet-app.patch");
const stamp = createHash("sha256")
  .update(revision)
  .update(readFileSync(patch))
  .digest("hex");
const stampFile = path.join(cache, "stamp");

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`${command} failed (${result.status})`);
}

export function prepareCadetApp() {
  mkdirSync(cache, { recursive: true });
  if (
    !existsSync(stampFile) ||
    readFileSync(stampFile, "utf8") !== stamp ||
    !existsSync(path.join(output, "index.js"))
  ) {
    rmSync(source, { recursive: true, force: true });
    mkdirSync(source, { recursive: true });
    run("git", ["init", "-q"], source);
    run(
      "git",
      [
        "fetch",
        "--depth",
        "1",
        "https://github.com/vargasjr-dev/mycadet-temp.git",
        revision,
      ],
      source,
    );
    run("git", ["checkout", "--detach", "FETCH_HEAD"], source);
    run("git", ["apply", "--unidiff-zero", patch], source);
    const bun = process.env.BUN_BINARY || "bun";
    run(
      bun,
      [
        "install",
        "--frozen-lockfile",
        "--ignore-scripts",
        "--filter",
        "@mycadet/app",
      ],
      source,
    );
    // Use the package's existing Vite library build, not a website-specific config.
    const app = path.join(source, "clients/app");
    const build = spawnSync(
      bun,
      ["--bun", "node_modules/vite/bin/vite.js", "build"],
      {
        cwd: app,
        env: { ...process.env, APP_BUILD_TARGET: "package" },
        stdio: "inherit",
        windowsHide: true,
      },
    );
    if (build.error || build.status !== 0)
      throw build.error ?? new Error("Cadet package build failed");
    rmSync(output, { recursive: true, force: true });
    cpSync(path.join(app, "dist/package"), output, { recursive: true });
    // Leave React/ReactDOM as peers of the website; install only library runtime dependencies.
    run(
      "npm",
      [
        "install",
        "--omit=dev",
        "--ignore-scripts",
        "--legacy-peer-deps",
        "--no-package-lock",
        "--no-audit",
        "--no-fund",
      ],
      output,
    );
    writeFileSync(stampFile, stamp);
  }

  // Keep the patch outside package-manager caches. Repoint only this project's
  // installed package after a normal npm/bun install has resolved the pinned release.
  const installed = path.join(root, "node_modules/@mycadet/app");
  try {
    if (lstatSync(installed).isSymbolicLink()) unlinkSync(installed);
    else rmSync(installed, { recursive: true });
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  mkdirSync(path.dirname(installed), { recursive: true });
  symlinkSync(
    path.relative(path.dirname(installed), output),
    installed,
    "junction",
  );
}
