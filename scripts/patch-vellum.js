/**
 * Applies the intentional @vellumai/web customizations used by vargasjr.dev.
 *
 * Vellum 0.11.9 consolidated the previous feature bundles into the hashed
 * index bundle, so these patches target stable minified code rather than old
 * auth-store/messages/local-mode filenames.
 */

import { existsSync, readFileSync, readdirSync, writeFileSync } from "fs";
import { basename, join } from "path";

const root = process.cwd();
const assetsDir = join(root, "node_modules/@vellumai/web/dist/assets");

function findAsset(prefix) {
  if (!existsSync(assetsDir)) return null;
  const file = readdirSync(assetsDir).find(
    (name) => name.startsWith(prefix) && name.endsWith(".js"),
  );
  return file ? join(assetsDir, file) : null;
}

function patchAsset(prefix, patches, label) {
  const file = findAsset(prefix);
  if (!file) {
    console.warn(`patch-vellum: [${label}] ${prefix}*.js not found`);
    return false;
  }

  let content = readFileSync(file, "utf8");
  let applied = 0;
  for (const [from, to] of patches) {
    if (content.includes(from)) {
      content = content.replace(from, to);
      applied += 1;
    } else if (content.includes(to)) {
      // Idempotent when postinstall and build both run the patcher.
      applied += 1;
    } else {
      console.warn(
        `patch-vellum: [${label}] pattern not found: ${from.slice(0, 100)}...`,
      );
    }
  }

  writeFileSync(file, content, "utf8");
  console.log(
    `patch-vellum: [${label}] ${applied}/${patches.length} patches applied to ${basename(file)}`,
  );
  return applied === patches.length;
}

// Vellum 0.11.9's command palette still limits Recent to five conversations.
patchAsset(
  "index-",
  [
    [
      "label:`Recent`,items:e.slice(0,5).map(e=>({id:`conv-${e.conversationId}`",
      "label:`Recent`,items:e.slice(0,20).map(e=>({id:`conv-${e.conversationId}`",
    ],
  ],
  "command-palette-recent-limit",
);

// Vellum 0.11.9 gates Inspect/developer access through ck(user).
patchAsset(
  "index-",
  [
    [
      "function ck(e){return e?.isStaff===!0||e?.email?.toLowerCase().endsWith(`@vellum.ai`)===!0}",
      "function ck(e){return!0}",
    ],
  ],
  "inspect-access",
);
