/**
 * Applies all @vellumai/web patches without requiring the `patch` CLI.
 * Runs via postinstall and build — works on Vercel and locally.
 *
 * Patches:
 *   1. gateway-session — fall back to runtimeUrl when no gateway URL
 *   2. auth-store      — try gateway session init in local-no-assistants path
 *   3. sidebar         — bump conversation limit from 5 → 16
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

// ── 1. gateway-session ──────────────────────────────────────────────────────
// When no local gateway URL exists, fall back to runtimeUrl + stored token
// from the active Vellum assistant entry in the lockfile.
patchFile(
  "node_modules/@vellumai/web/dist/assets/gateway-session-CaFk8wfN.js",
  [
    [
      `}async function F(){let e=Q();if(!e)return;let t=A();`,
      `}async function F(){let e=Q();if(!e){let active=A();active&&active.runtimeUrl&&Y()&&s({url:active.runtimeUrl,token:Y()});return}let t=A();`,
    ],
  ],
  "gateway-session",
);

// ── 2. auth-store ───────────────────────────────────────────────────────────
// In local mode with no registered assistants, attempt gateway session init
// before marking the user as logged-in (drops background platform check).
patchFile(
  "node_modules/@vellumai/web/dist/assets/auth-store-CYbo7naZ.js",
  [
    [
      `e(X());return}e(Y()),q?e({platformSession:\`absent\`}):We(e,{setUserOnSuccess:!0}),q=!1;return}`,
      `e(X());return}try{await pe()}catch{}e(Y()),q=!1;return}`,
    ],
  ],
  "auth-store",
);

// ── 3. sidebar conversation limit ───────────────────────────────────────────
// Bump the initial visible count in the sidebar from 5 → 16.
// The exact index-*.js filename is stable across installs (content hash).
const assetsDir = join(root, "node_modules/@vellumai/web/dist/assets");
const indexFile = existsSync(assetsDir)
  ? readdirSync(assetsDir).find(
      (f) => f.startsWith("index-") && f.endsWith(".js") && f.length < 30,
    )
  : null;

if (indexFile) {
  patchFile(
    `node_modules/@vellumai/web/dist/assets/${indexFile}`,
    [
      [
        "e.slice(0,5).map(e=>({id:`conv-${e.conversationId}`,icon:rm,",
        "e.slice(0,16).map(e=>({id:`conv-${e.conversationId}`,icon:rm,",
      ],
      [
        "new Set(n.slice(0,5).map(e=>e.conversationId",
        "new Set(n.slice(0,16).map(e=>e.conversationId",
      ],
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
    ],
    "sidebar",
  );
} else {
  console.warn("patch-vellum: [sidebar] index-*.js not found in assets dir");
}
