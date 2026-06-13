/**
 * Applies all @vellumai/web patches without requiring the `patch` CLI.
 * Runs via postinstall and build — works on Vercel and locally.
 *
 * Patches:
 *   1. auth-store      — skip allauth platform check in self-hosted mode
 *   2. sidebar         — bump conversation limit from 5 → 16
 */

import { existsSync, readFileSync, writeFileSync, readdirSync } from "fs";
import { join, basename } from "path";

const root = process.cwd();

function patchFile(relPath, patches, label) {
  const full = join(root, relPath);
  if (!existsSync(full)) {
    console.warn(`patch-vellum: [${label}] file not found: ${relPath}`);
    return false;
  }
  let content = readFileSync(full, "utf8");
  let applied = 0;
  for (const [from, to] of patches) {
    if (content.includes(from)) {
      content = content.replace(from, to);
      applied++;
    } else if (content.includes(to)) {
      // Already patched — idempotent
      applied++;
    } else {
      console.warn(
        `patch-vellum: [${label}] pattern not found: ${from.slice(0, 60)}...`,
      );
    }
  }
  writeFileSync(full, content, "utf8");
  console.log(
    `patch-vellum: [${label}] ${applied}/${patches.length} patches applied to ${basename(full)}`,
  );
  return true;
}

const assetsDir = join(root, "node_modules/@vellumai/web/dist/assets");

// ── 1. auth-store ───────────────────────────────────────────────────────────
// In local mode with no registered assistants, skip the platform session check
// that always fires (and 401s) in self-hosted mode. Instead immediately set
// platformSession absent and skip the background zn() call.
//
// NOTE: As of 0.8.10 the auth flow handles this gracefully without patching
// (zn() fails silently, no clearOnFailure). This section is kept as a
// best-effort hardening pass; missing patterns are non-fatal.
const authStoreFile = existsSync(assetsDir)
  ? readdirSync(assetsDir).find(
      (f) => f.startsWith("auth-store-") && f.endsWith(".js"),
    )
  : null;

if (authStoreFile) {
  patchFile(
    `node_modules/@vellumai/web/dist/assets/${authStoreFile}`,
    [
      // 0.8.10 self-hosted path: set platformSession absent immediately instead
      // of fire-and-forget zn() platform check.
      [
        `e(Fn()),Nn?e({platformSession:\`absent\`}):zn(e,{setUserOnSuccess:!0}),Nn=!1;return`,
        `e(Fn()),e({platformSession:\`absent\`}),Nn=!1;return`,
      ],
    ],
    "auth-store",
  );
} else {
  console.warn("patch-vellum: [auth-store] auth-store-*.js not found in assets dir");
}

// ── 2. sidebar conversation limit ───────────────────────────────────────────
// Bump the initial visible count in the sidebar from 5 → 16.
// As of 0.8.10 the main sidebar component already ships with 16; only the
// command-palette conv slice (in $A / equivalent function) still needs patching.
const indexFile = existsSync(assetsDir)
  ? readdirSync(assetsDir).find(
      (f) => f.startsWith("index-") && f.endsWith(".js") && f.length < 30,
    )
  : null;

if (indexFile) {
  patchFile(
    `node_modules/@vellumai/web/dist/assets/${indexFile}`,
    [
      // vA (0.8.8 — icon:rm)
      [
        "e.slice(0,5).map(e=>({id:`conv-${e.conversationId}`,icon:rm,",
        "e.slice(0,16).map(e=>({id:`conv-${e.conversationId}`,icon:rm,",
      ],
      // vB (earlier Vercel — icon:RA)
      [
        "e.slice(0,5).map(e=>({id:`conv-${e.conversationId}`,icon:RA,",
        "e.slice(0,16).map(e=>({id:`conv-${e.conversationId}`,icon:RA,",
      ],
      // vC (0.8.10 — icon:pm)
      [
        "e.slice(0,5).map(e=>({id:`conv-${e.conversationId}`,icon:pm,",
        "e.slice(0,16).map(e=>({id:`conv-${e.conversationId}`,icon:pm,",
      ],
      // vD (0.8.12 — icon:Pm, capital P)
      [
        "e.slice(0,5).map(e=>({id:`conv-${e.conversationId}`,icon:Pm,",
        "e.slice(0,16).map(e=>({id:`conv-${e.conversationId}`,icon:Pm,",
      ],
      // vA main sidebar useState (0.8.8)
      [
        "useState)(5),[k,A]=(0,X.useState)(5)",
        "useState)(16),[k,A]=(0,X.useState)(16)",
      ],
      [
        "showLess:D>5&&w.recents.length>5",
        "showLess:D>16&&w.recents.length>16",
      ],
      ["onShowLess:()=>O(5)}},[w.recents", "onShowLess:()=>O(16)}},[w.recents"],
      ["showLess:k>5&&w.slack.length>5", "showLess:k>16&&w.slack.length>16"],
      ["onShowLess:()=>A(5)}},[w.slack", "onShowLess:()=>A(16)}},[w.slack"],
      // vD main sidebar useState (0.8.12 — [D,O]/[k,ee] vars)
      [
        "[D,O]=(0,Y.useState)(5),[k,ee]=(0,Y.useState)(5)",
        "[D,O]=(0,Y.useState)(16),[k,ee]=(0,Y.useState)(16)",
      ],
      // vD slack onShowLess (recents already ships with 16 in 0.8.12)
      [
        "onShowLess:()=>ee(5)}},[w.slack,k,r]",
        "onShowLess:()=>ee(16)}},[w.slack,k,r]",
      ],
    ],
    "sidebar",
  );
} else {
  console.warn("patch-vellum: [sidebar] index-*.js not found in assets dir");
}

// ── 3. nav sections — hide Scheduled and Background ─────────────────────────
// The system groups array defines all system sidebar groups. Strip the two
// noise sections so only Pinned and Recents appear in the nav.
// Pattern is version-agnostic (matches array content, not the variable name).
if (indexFile) {
  patchFile(
    `node_modules/@vellumai/web/dist/assets/${indexFile}`,
    [
      [
        `[{id:\`system:pinned\`,name:\`Pinned\`},{id:\`system:scheduled\`,name:\`Scheduled\`},{id:\`system:background\`,name:\`Background\`},{id:\`system:all\`,name:\`Recents\`}]`,
        `[{id:\`system:pinned\`,name:\`Pinned\`},{id:\`system:all\`,name:\`Recents\`}]`,
      ],
    ],
    "nav-sections",
  );
}
