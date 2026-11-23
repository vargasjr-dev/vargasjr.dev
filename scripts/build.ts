import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { prepareCadetApp } from "./prepare-cadet-app.mjs";

prepareCadetApp();
const require = createRequire(import.meta.url);
const result = spawnSync(
  process.execPath,
  [require.resolve("next/dist/bin/next"), "build", ...process.argv.slice(2)],
  {
    stdio: "inherit",
    windowsHide: true,
  },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
