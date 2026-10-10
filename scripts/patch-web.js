/**
 * Applies the intentional @mycadet/web + @vellumai/web customizations used
 * by vargasjr.dev.
 *
 * Both SPA bundles are installed side by side (see copy-assistant.ts) so we
 * can flip between them at runtime; this patcher normalizes both dists so
 * whichever is served behaves the same. Patches target stable minified code
 * rather than hashed filenames: the main bundle changed name every release
 * (index-*.js in 0.11.9–0.12.1, app-*.js in 0.12.2+), so patches scan every
 * asset .js for their pattern unless a prefix is given.
 */

import { existsSync, readFileSync, readdirSync, writeFileSync } from "fs";
import { basename, join } from "path";

const root = process.cwd();

// Per-package telegram anchor: the minified empty-array const referenced by
// the shared nav-list hook churns between brands ($q in @mycadet/web, hK in
// @vellumai/web 0.12.2). Everything else is identical across both.
const PACKAGES = [
  { pkg: "@mycadet/web", telegramAnchor: "$q" },
  { pkg: "@vellumai/web", telegramAnchor: "hK" },
];

function jsAssets(assetsDir) {
  if (!existsSync(assetsDir)) return [];
  return readdirSync(assetsDir)
    .filter((name) => name.endsWith(".js"))
    .map((name) => join(assetsDir, name));
}

function patchAsset(assetsDir, prefix, patches, label) {
  const all = jsAssets(assetsDir);
  const files = prefix
    ? all.filter((f) => basename(f).startsWith(prefix))
    : all;
  if (files.length === 0) {
    console.warn(`patch-web: [${label}] no matching asset files`);
    return;
  }

  for (const file of files) {
    patchFile(file, patches, label);
  }
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

  if (!matched) return; // this asset simply doesn't carry the patch

  writeFileSync(file, content, "utf8");
  console.log(
    `patch-web: [${label}] ${applied}/${patches.length} patches applied to ${basename(file)}`,
  );
  if (applied < patches.length) {
    console.warn(
      `patch-web: [${label}] ${patches.length - applied} pattern(s) not found in ${basename(file)} — needs a retarget`,
    );
  }
}

for (const { pkg, telegramAnchor } of PACKAGES) {
  const assetsDir = join(root, "node_modules", pkg, "dist", "assets");
  if (!existsSync(assetsDir)) {
    console.warn(`patch-web: ${pkg} not installed — skipping`);
    continue;
  }

  // The command palette still limits Recent to five conversations.
  patchAsset(
    assetsDir,
    null,
    [
      [
        "label:`Recent`,items:e.slice(0,5).map(e=>({id:`conv-${e.conversationId}`",
        "label:`Recent`,items:e.slice(0,20).map(e=>({id:`conv-${e.conversationId}`",
      ],
    ],
    `${pkg} command-palette-recent-limit`,
  );

  // The client gates Inspect/developer access through the user's isStaff
  // flag. The two minified parse sites below force it to true.
  patchAsset(
    assetsDir,
    null,
    [
      ["isStaff:t.isStaff===!0", "isStaff:!0"],
      ["isStaff:e.is_staff??!1", "isStaff:!0"],
    ],
    `${pkg} inspect-access`,
  );

  // Hide Telegram-sourced conversations from the sidebar: every nav list
  // (pinned, groups, recents, channel sections) flows through this shared
  // hook.
  patchAsset(
    assetsDir,
    null,
    [
      [
        `{conversations:i.data?.conversations??${telegramAnchor},isLoading:i.isLoading`,
        `{conversations:(i.data?.conversations??${telegramAnchor}).filter(e=>e.originChannel!==\`telegram\`),isLoading:i.isLoading`,
      ],
    ],
    `${pkg} sidebar-hide-telegram`,
  );
}
