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
    if (from instanceof RegExp) {
      // Regex patches survive minifier name churn between releases; `to` is
      // called with the match array so replacements can reuse captures.
      const m = content.match(from);
      if (m) {
        content = content.replace(from, to);
        applied += 1;
      } else {
        console.warn(`patch-vellum: [${label}] regex not found: ${from}`);
      }
    } else if (content.includes(from)) {
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

// Vellum gates Inspect/developer access through the user's isStaff flag.
// 0.11.9 computed it in one minified helper (ck/zk); 0.12.1 moved it into
// two parse sites, so force both to true.
patchAsset(
  "index-",
  [
    ["isStaff:t.isStaff===!0", "isStaff:!0"],
    ["isStaff:e.is_staff??!1", "isStaff:!0"],
  ],
  "inspect-access",
);
