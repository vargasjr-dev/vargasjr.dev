/**
 * Applies the intentional @vellumai/web customizations used by vargasjr.dev.
 *
 * These patches target stable minified code rather than hashed filenames:
 * the main bundle changed name every release (index-*.js in 0.11.9–0.12.1,
 * app-*.js in 0.12.2), so patches scan every asset .js for their pattern
 * unless a prefix is given.
 */

import { existsSync, readFileSync, readdirSync, writeFileSync } from "fs";
import { basename, join } from "path";

const root = process.cwd();
const assetsDir = join(root, "node_modules/@vellumai/web/dist/assets");

function jsAssets() {
  if (!existsSync(assetsDir)) return [];
  return readdirSync(assetsDir)
    .filter((name) => name.endsWith(".js"))
    .map((name) => join(assetsDir, name));
}

function patchAsset(prefix, patches, label) {
  const files = prefix
    ? jsAssets().filter((f) => basename(f).startsWith(prefix))
    : jsAssets();
  if (files.length === 0) {
    console.warn(`patch-vellum: [${label}] no matching asset files`);
    return false;
  }

  let ok = true;
  for (const file of files) {
    if (patchFile(file, patches, label)) ok = ok && true;
  }
  return ok;
}

function patchFile(file, patches, label) {
  let content = readFileSync(file, "utf8");
  let applied = 0;
  let matched = false;
  for (const [from, to] of patches) {
    if (from instanceof RegExp) {
      // Regex patches survive minifier name churn between releases; `to` is
      // called with the match array so replacements can reuse captures.
      const m = content.match(from);
      if (m) {
        content = content.replace(from, to);
        applied += 1;
        matched = true;
      }
    } else if (content.includes(from)) {
      content = content.replace(from, to);
      applied += 1;
      matched = true;
    } else if (content.includes(to)) {
      // Idempotent when postinstall and build both run the patcher.
      applied += 1;
      matched = true;
    }
  }

  if (!matched) return true; // this asset simply doesn't carry the patch

  writeFileSync(file, content, "utf8");
  console.log(
    `patch-vellum: [${label}] ${applied}/${patches.length} patches applied to ${basename(file)}`,
  );
  if (applied < patches.length) {
    console.warn(
      `patch-vellum: [${label}] ${patches.length - applied} pattern(s) not found in ${basename(file)} — needs a retarget`,
    );
  }
  return applied === patches.length;
}

// Vellum 0.11.9's command palette still limits Recent to five conversations.
patchAsset(
  null,
  [
    [
      "label:`Recent`,items:e.slice(0,5).map(e=>({id:`conv-${e.conversationId}`",
      "label:`Recent`,items:e.slice(0,20).map(e=>({id:`conv-${e.conversationId}`",
    ],
  ],
  "command-palette-recent-limit",
);

// Vellum gates Inspect/developer access through the user's isStaff flag.
// 0.11.9 computed it in one minified helper (ck/zk); 0.12.1 moved it into
// two parse sites, so force both to true.
patchAsset(
  null,
  [
    ["isStaff:t.isStaff===!0", "isStaff:!0"],
    ["isStaff:e.is_staff??!1", "isStaff:!0"],
  ],
  "inspect-access",
);
