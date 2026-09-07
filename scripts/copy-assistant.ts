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
  // @vellumai/web 0.11.9 keeps the command-palette section in index-*.js.
  {
    filePrefix: "index-",
    description: "Command-palette recent conversations 5 → 20",
    from: "label:`Recent`,items:e.slice(0,5).map(e=>({id:`conv-${e.conversationId}`",
    to: "label:`Recent`,items:e.slice(0,20).map(e=>({id:`conv-${e.conversationId}`",
  },
  // @vellumai/web 0.11.9 consolidated the Inspect access gate into ck().
  {
    filePrefix: "index-",
    description: "Allow Inspect/developer access for all users",
    from: "function ck(e){return e?.isStaff===!0||e?.email?.toLowerCase().endsWith(`@vellum.ai`)===!0}",
    to: "function ck(e){return!0}",
  },
];

// ── index.html: inject feature flag overrides ──────────────────────────────
// Injects window.__VELLUM_FLAG_OVERRIDES__ before </head> so the flag is
// baked in at build time and can't be reverted by server-side values.
//
// `self-hosted-assistant` (defaultEnabled: false in feature-flag-catalog):
// enables self-hosted assistant support in the web client. Without this,
// the chat page renders "Conversations for self-hosted assistants aren't
// available from the web yet" because the flag-gate short-circuits to the
// "not supported" UI. Toggling it tells the SPA to treat self-hosted mode
// as a first-class citizen and use the conversations API for self-hosted
// assistants (not the desktop-app-only fallback).
const indexHtmlPath = join(destDir, "index.html");
const indexHtml = await readFile(indexHtmlPath, "utf-8");
const flagScript = `<script>window.__VELLUM_FLAG_OVERRIDES__={"settings-developer-nav":true,"developer-menu-items":true,"self-hosted-assistant":true}</script>`;
if (indexHtml.includes(flagScript)) {
  console.log("⏭️  Already patched: index.html (feature flag overrides)");
} else {
  await writeFile(
    indexHtmlPath,
    indexHtml.replace("</head>", `${flagScript}</head>`),
  );
  console.log("🩹 Patched: index.html — injected __VELLUM_FLAG_OVERRIDES__");
}

// ── index.html: preload lockfile + token into localStorage so local-mode handshake fires ──
// In 0.8.x AND 0.10.x, the SPA never fetches /assistant/__local/lockfile on
// startup — `Q()` (0.10.x) / `G()` (0.8.x) only reads localStorage and falls
// back to the empty default. The local-mode handshake (`oe()` → `Ms()` →
// `pe()` → `fe()` POSTs `/auth/token`) only fires when the lockfile is
// already in localStorage. With no lockfile, `oe()` returns false,
// `initSession` skips the local-mode branch, and SDK calls 401.
//
// Fix: inject a synchronous IIFE into <head> that writes the lockfile to
// `localStorage['vellum:local:lockfile']` BEFORE the SPA module loads.
// Synchronous matters here — the SPA module is `defer`-loaded by default,
// so our IIFE runs first and populates localStorage before `initSession`
// ever fires.
//
// We ALSO write `localStorage['vellum:gw:token']` so the ge-bootstrap IIFE
// in local-mode.js picks up the token at module load — without this, the
// auth-store fires `/v1/conversations/` etc. BEFORE the handshake
// (`fe()` → POST `/auth/token` → `_e()`) completes, so `Rn()` (= Ln) returns
// null when C5() runs → Authorization header gets DELETED → 401 from daemon.
//
// Embedding the token in HTML is intentional — the lockfile route already
// returns it as a JSON field, and the SPA needs it to sign local-mode API
// calls. Long-lived Vellum actor tokens; we use a far-future expiresAt
// (year 2099) since the token rotation happens server-side, not via this
// expiresAt (which is just a localStorage cache hint).
//
// `cloud: "local"` is required — xs() in local-mode.js checks
// `e.cloud === 'local' || e.cloud === 'docker'` before treating an assistant
// as locally-hosted. Without it, xs() returns false → ks() returns false →
// As() returns undefined → oe() returns false → the handshake never fires
// and assistantState stays 'initializing' forever (stuck skeleton).
//
// Idempotent: skip if lockfile already in localStorage (preserves any
// runtime updates the SPA made).
const assistantId = process.env.VELLUM_ASSISTANT_ID;
const accessToken = process.env.VELLUM_ACCESS_TOKEN;
if (!assistantId) {
  console.warn(
    "⚠️  VELLUM_ASSISTANT_ID not set — skipping lockfile preload (SPA will fall through to platform auth)",
  );
} else {
  const lockfilePayload: Record<string, unknown> = {
    assistants: [
      {
        assistantId,
        cloud: "local",
        resources: { gatewayPort: 7830, daemonPort: 7830 },
      },
    ],
    activeAssistant: assistantId,
  };
  // Include token in payload so the IIFE can write it to vellum:gw:token too.
  // Only when the token is available — otherwise we still preload the lockfile
  // and the handshake (Ms() → fe()) will populate the token normally.
  if (accessToken) {
    lockfilePayload.token = accessToken;
  }
  // Far-future expiresAt (year 2099 = ~4070908800 seconds since epoch). The
  // ge-bootstrap IIFE treats expiresAt as a hint and warns if expired, but
  // still uses the token. Real token rotation happens server-side via the
  // handshake endpoint (which sets a fresh 2-hour expiresAt).
  const lockfileScript = `<script>(function(){try{var p=${JSON.stringify(lockfilePayload)};localStorage.setItem("vellum:local:lockfile",JSON.stringify(p));if(p.token){localStorage.setItem("vellum:gw:token",p.token);localStorage.setItem("vellum:gw:expiresAt","4070908800")}}catch(e){}})();</script>`;

  if (indexHtml.includes(lockfileScript)) {
    console.log("⏭️  Already patched: index.html (lockfile preload)");
  } else {
    await writeFile(
      indexHtmlPath,
      indexHtml.replace("</head>", `${flagScript}${lockfileScript}</head>`),
    );
    console.log(
      "🩹 Patched: index.html — preloaded lockfile + token into localStorage",
    );
  }
}

// ── index.html: inject SPA→parent navigation emitter ───────────────────────
// The SPA uses path-based browser history (React Router on the `history` lib).
// history.pushState/replaceState fire NO event a parent frame can observe, so
// when the SPA navigates inside the admin iframe the parent browser URL stays
// stuck. This script monkeypatches those primitives + listens for
// popstate/hashchange and postMessages the parent with the new path + nav type.
//
// Runs before the SPA module (classic <script> in <head> vs. the deferred
// module bundle), so the patches are in place before the router boots. The
// original methods are called first, so SPA routing is untouched.
//
// Idempotent: skip if the marker comment is already present.
const navEmitterScript = `<script>/*vellum-nav-emitter*/(function(){var M={source:'vellum-spa-nav'};function emit(nav){try{parent.postMessage(Object.assign({},M,{nav:nav,path:location.pathname+location.search+location.hash}),'*')}catch(e){}}['pushState','replaceState'].forEach(function(m){var orig=history[m];history[m]=function(){var r=orig.apply(this,arguments);emit(m==='pushState'?'push':'replace');return r}});window.addEventListener('popstate',function(){emit('pop')});window.addEventListener('hashchange',function(){emit('pop')})})();</script>`;
{
  const html = await readFile(indexHtmlPath, "utf-8");
  if (html.includes("/*vellum-nav-emitter*/")) {
    console.log("⏭️  Already patched: index.html (nav emitter)");
  } else {
    await writeFile(
      indexHtmlPath,
      html.replace("</head>", `${navEmitterScript}</head>`),
    );
    console.log("🩹 Patched: index.html — injected SPA→parent nav emitter");
  }
}

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
