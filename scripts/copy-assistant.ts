/**
 * Copies @vellumai/web/dist → public/assistant/
 * Run as part of the build: "prebuild": "bun scripts/copy-assistant.ts"
 *
 * The SPA's index.html hardcodes /assistant/ as its base path, so the
 * contents must live at public/assistant/ for Next.js static serving.
 *
 * After copying, applies patches to the SPA bundle so self-hosted
 * (docker/cloud) mode works without a gateway port.
 */
import { cp, mkdir, readFile, readdir, rm, writeFile } from "fs/promises";
import { join } from "path";

const srcDir = join(process.cwd(), "node_modules/@vellumai/web/dist");
const destDir = join(process.cwd(), "public/assistant");

await rm(destDir, { recursive: true, force: true });
await mkdir(destDir, { recursive: true });
await cp(srcDir, destDir, { recursive: true });
console.log("✅ Copied @vellumai/web/dist → public/assistant/");

// Patch the SPA bundle for self-hosted mode.
// vercel.json overrides buildCommand, bypassing package.json build scripts,
// so patches must be applied here after copying.
//
// Files use content-hash names (e.g. local-mode-DTyhlxIJ.js) — find by prefix.
const assetsDir = join(destDir, "assets");
const assetFiles = await readdir(assetsDir);

function findAsset(prefix: string): string | null {
  const match = assetFiles.find(
    (f) => f.startsWith(prefix) && f.endsWith(".js"),
  );
  return match ? join(assetsDir, match) : null;
}

const patches: Array<{
  filePrefix: string;
  description: string;
  from: string;
  to: string;
}> = [
  // ── Sidebar conversation limit 5 → 16 ────────────────────────────────────
  // The minifier assigns different variable names across @vellumai/web versions.
  // Only the matching version's pattern will apply; others are silent no-ops.
  //
  // NOTE: As of 0.8.10 the sidebar main component already ships with 16,
  // so only the command-palette slice still needs patching.

  // Version A  (0.8.8 — index-DUwiZuxe.js)
  {
    filePrefix: "index-",
    description: "Sidebar useState init (vA)",
    from: "useState)(5),[k,A]=(0,X.useState)(5)",
    to: "useState)(16),[k,A]=(0,X.useState)(16)",
  },
  {
    filePrefix: "index-",
    description: "Sidebar showLess recents (vA)",
    from: "showLess:D>5&&w.recents.length>5",
    to: "showLess:D>16&&w.recents.length>16",
  },
  {
    filePrefix: "index-",
    description: "Sidebar onShowLess recents (vA)",
    from: "onShowLess:()=>O(5)}},[w.recents",
    to: "onShowLess:()=>O(16)}},[w.recents",
  },
  {
    filePrefix: "index-",
    description: "Sidebar showLess slack (vA)",
    from: "showLess:k>5&&w.slack.length>5",
    to: "showLess:k>16&&w.slack.length>16",
  },
  {
    filePrefix: "index-",
    description: "Sidebar onShowLess slack (vA)",
    from: "onShowLess:()=>A(5)}},[w.slack",
    to: "onShowLess:()=>A(16)}},[w.slack",
  },
  {
    filePrefix: "index-",
    description: "Sidebar conv palette slice (vA — icon:rm)",
    from: "e.slice(0,5).map(e=>({id:`conv-${e.conversationId}`,icon:rm,",
    to: "e.slice(0,16).map(e=>({id:`conv-${e.conversationId}`,icon:rm,",
  },

  // Version B  (Vercel-deployed — index-D6-nsIUa.js)
  {
    filePrefix: "index-",
    description: "Sidebar useState init (vB)",
    from: "[f,p]=(0,G.useState)(5),[m,h]=(0,G.useState)(5)",
    to: "[f,p]=(0,G.useState)(16),[m,h]=(0,G.useState)(16)",
  },
  {
    filePrefix: "index-",
    description: "Sidebar showLess recents (vB)",
    from: "showLess:f>5&&l.recents.length>5",
    to: "showLess:f>16&&l.recents.length>16",
  },
  {
    filePrefix: "index-",
    description: "Sidebar onShowLess recents (vB)",
    from: "onShowLess:()=>p(5)}},[l.recents",
    to: "onShowLess:()=>p(16)}},[l.recents",
  },
  {
    filePrefix: "index-",
    description: "Sidebar showLess slack (vB)",
    from: "showLess:m>5&&l.slack.length>5",
    to: "showLess:m>16&&l.slack.length>16",
  },
  {
    filePrefix: "index-",
    description: "Sidebar onShowLess slack (vB)",
    from: "onShowLess:()=>h(5)}},[l.slack",
    to: "onShowLess:()=>h(16)}},[l.slack",
  },
  {
    filePrefix: "index-",
    description: "Sidebar conv palette slice (vB — icon:RA)",
    from: "e.slice(0,5).map(e=>({id:`conv-${e.conversationId}`,icon:RA,",
    to: "e.slice(0,16).map(e=>({id:`conv-${e.conversationId}`,icon:RA,",
  },

  // Version C  (0.8.10 — index-DGojzQtP.js)
  // Sidebar main component already uses 16 natively; only palette slice needed.
  {
    filePrefix: "index-",
    description: "Sidebar conv palette slice (vC — icon:pm)",
    from: "e.slice(0,5).map(e=>({id:`conv-${e.conversationId}`,icon:pm,",
    to: "e.slice(0,16).map(e=>({id:`conv-${e.conversationId}`,icon:pm,",
  },

  // ── Hide Scheduled and Background nav sections ────────────────────────────
  // The system groups array defines which sections appear in the sidebar nav.
  // Pattern is version-agnostic (matches array content, not the variable name).
  {
    filePrefix: "index-",
    description: "Hide Scheduled and Background from sidebar nav",
    from: "[{id:`system:pinned`,name:`Pinned`},{id:`system:scheduled`,name:`Scheduled`},{id:`system:background`,name:`Background`},{id:`system:all`,name:`Recents`}]",
    to: "[{id:`system:pinned`,name:`Pinned`},{id:`system:all`,name:`Recents`}]",
  },
];

for (const { filePrefix, description, from, to } of patches) {
  const filePath = findAsset(filePrefix);

  if (!filePath) {
    console.warn(
      `⚠️  No file matching ${filePrefix}*.js found — skipping patch`,
    );
    continue;
  }

  const content = await readFile(filePath, "utf-8");

  if (content.includes(to)) {
    console.log(`⏭️  Already patched: ${filePrefix}*.js`);
    continue;
  }

  if (!content.includes(from)) {
    console.warn(`⚠️  Patch target not found in ${filePrefix}*.js — skipping`);
    console.warn(`    ${description}`);
    continue;
  }

  await writeFile(filePath, content.replace(from, to));
  console.log(`🩹 Patched: ${filePrefix}*.js`);
  console.log(`    ${description}`);
}
