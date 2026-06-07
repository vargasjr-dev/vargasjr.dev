import { existsSync, readFileSync, writeFileSync } from "fs";
import { join, dirname, basename } from "path";
import { fileURLToPath } from "url";

/**
 * Patches @vellumai/web sidebar conversation limit from 5 → 16.
 *
 * The upstream default shows only 5 conversations in the sidebar before
 * a "Show more" button appears. This script bumps that to 16 everywhere
 * the constant appears in the minified bundle.
 *
 * Run automatically via postinstall / build.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));

const TARGET = join(
  __dirname,
  "../node_modules/@vellumai/web/dist/assets/index-DUwiZuxe.js",
);

if (!existsSync(TARGET)) {
  console.log(`patch-vellum-sidebar: ${basename(TARGET)} not found, skipping`);
  process.exit(0);
}

let content = readFileSync(TARGET, "utf8");

const replacements = [
  // Command palette recent conversations list
  [
    "e.slice(0,5).map(e=>({id:`conv-${e.conversationId}`,icon:rm,",
    "e.slice(0,16).map(e=>({id:`conv-${e.conversationId}`,icon:rm,",
  ],
  // Command palette: Set of tracked conversation IDs
  [
    "new Set(n.slice(0,5).map(e=>e.conversationId",
    "new Set(n.slice(0,16).map(e=>e.conversationId",
  ],
  // Sidebar: initial useState(5) for both recents (D) and slack (k) sections
  [
    "useState)(5),[k,A]=(0,X.useState)(5)",
    "useState)(16),[k,A]=(0,X.useState)(16)",
  ],
  // Sidebar: showLess threshold for recents
  ["showLess:D>5&&w.recents.length>5", "showLess:D>16&&w.recents.length>16"],
  // Sidebar: onShowLess reset value for recents
  ["onShowLess:()=>O(5)}},[w.recents", "onShowLess:()=>O(16)}},[w.recents"],
  // Sidebar: showLess threshold for slack section
  ["showLess:k>5&&w.slack.length>5", "showLess:k>16&&w.slack.length>16"],
  // Sidebar: onShowLess reset value for slack section
  ["onShowLess:()=>A(5)}},[w.slack", "onShowLess:()=>A(16)}},[w.slack"],
];

let applied = 0;
for (const [from, to] of replacements) {
  if (content.includes(from)) {
    content = content.replace(from, to);
    applied++;
  } else {
    console.warn(
      `patch-vellum-sidebar: pattern not found (may already be patched): ${from.slice(0, 60)}...`,
    );
  }
}

writeFileSync(TARGET, content, "utf8");
console.log(
  `patch-vellum-sidebar: applied ${applied}/${replacements.length} replacements to ${basename(TARGET)}`,
);
