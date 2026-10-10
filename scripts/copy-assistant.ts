/**
 * Copies BOTH admin-shell SPA bundles → public/assistant/:
 *   @mycadet/web/dist → index.html (the default shell) + assets/
 *   @vellumai/web/dist → vellum.html (the revert shell) + assets merged in
 *
 * Run as part of the build: "prebuild": "bun scripts/copy-assistant.ts"
 *
 * Both SPA index files hardcode /assistant/ as their base path, so the
 * contents must live at public/assistant/ for Next.js static serving.
 * Asset filenames are content-hashed, so the two dists' assets coexist in
 * the shared assets/ dir without colliding; only the shell document
 * differs, and the vellum one is kept as vellum.html next to index.html.
 * Which shell a request gets is decided at serve time (see
 * app/assistant/[[...slug]]/route.ts + proxy.ts) from the
 * `webClientBundle` localStorage key — keeping @vellumai/web installed
 * means we can revert to it with one click if cadet misbehaves.
 *
 * After copying, applies patches to BOTH bundles so self-hosted
 * (docker/cloud) mode works without a gateway port.
 */
import { cp, mkdir, readFile, readdir, rm, writeFile } from "fs/promises";
import { join } from "path";

const destDir = join(process.cwd(), "public/assistant");
const cadetSrc = join(process.cwd(), "node_modules/@mycadet/web/dist");
const vellumSrc = join(process.cwd(), "node_modules/@vellumai/web/dist");

await rm(destDir, { recursive: true, force: true });
await mkdir(destDir, { recursive: true });
await cp(cadetSrc, destDir, { recursive: true });
console.log(
  "✅ Copied @mycadet/web/dist → public/assistant/ (default shell: index.html)",
);

// Merge the vellum dist in without clobbering anything cadet already
// copied (cadet is the default shell, so its files win any name
// collision — content-hashed assets shouldn't collide anyway). The vellum
// index.html is held out of the merge and saved as vellum.html instead.
const vellumIndexHtml = await readFile(join(vellumSrc, "index.html"), "utf-8");
await cp(vellumSrc, destDir, {
  recursive: true,
  force: false, // existing files (cadet's) are kept as-is
  errorOnExist: false,
});
await writeFile(join(destDir, "vellum.html"), vellumIndexHtml);
console.log(
  "✅ Merged @vellumai/web/dist → public/assistant/ (revert shell: vellum.html)",
);

// Patch the SPA bundles for self-hosted mode.
// vercel.json overrides buildCommand, bypassing package.json build scripts,
// so patches must be applied here after copying.
//
// Files use content-hash names (e.g. local-mode-DTyhlxIJ.js) — find by prefix.
const assetsDir = join(destDir, "assets");
const assetFiles = await readdir(assetsDir);

function findAsset(prefix: string | null): string[] {
  const js = assetFiles.filter((f) => f.endsWith(".js"));
  const matches = prefix ? js.filter((f) => f.startsWith(prefix)) : js;
  return matches.map((f) => join(assetsDir, f));
}

const patches: Array<{
  filePrefix: string | null;
  description: string;
  from: string;
  to: string;
}> = [
  // The main bundle's hash-prefix churns across releases (index-*.js in
  // 0.11.9–0.12.1, app-*.js in 0.12.2+), so filePrefix null scans every
  // asset .js — a patch applies wherever its pattern lives, in EITHER
  // bundle's files (both dists are merged into assets/).
  // Command palette: recent conversations 5 → 20.
  {
    filePrefix: null,
    description: "Command-palette recent conversations 5 → 20",
    from: "label:`Recent`,items:e.slice(0,5).map(e=>({id:`conv-${e.conversationId}`",
    to: "label:`Recent`,items:e.slice(0,20).map(e=>({id:`conv-${e.conversationId}`",
  },
  // Inspect/developer access: 0.11.9 gated it in one minified helper
  // (ck, later zk); 0.12.1+ moved the flag into two parse sites. Force
  // both to true.
  {
    filePrefix: null,
    description: "Allow Inspect/developer access (isStaff parse site 1)",
    from: "isStaff:t.isStaff===!0",
    to: "isStaff:!0",
  },
  {
    filePrefix: null,
    description: "Allow Inspect/developer access (isStaff parse site 2)",
    from: "isStaff:e.is_staff??!1",
    to: "isStaff:!0",
  },
];

// ── bundle-switch plumbing ─────────────────────────────────────────────────
// localStorage["webClientBundle"] ("cadet" | "vellum", default "cadet") is
// the user-facing switch. The browser can't put it on the wire itself, so
// the sync snippet mirrors it into a cookie of the same name on every load
// — proxy.ts then resolves that cookie into the x-web-client-bundle request
// header, which the shell route and the local-API dispatch read.
// `?bundle=vellum|cadet` in the URL is the server-side escape hatch: the
// snippet persists it to localStorage (and thus the cookie) even when the
// pill can't render, so a broken bundle can always be swapped.
const bundleSyncScript = `<script>/*web-bundle-switch*/(function(){try{var K="webClientBundle";var m=location.search.match(/[?&]bundle=(vellum|cadet)(?=&|#|$)/);if(m)localStorage.setItem(K,m[1]);var v=localStorage.getItem(K)==="vellum"?"vellum":"cadet";localStorage.setItem(K,v);document.cookie=K+"="+v+";path=/;max-age=31536000;samesite=lax"}catch(e){}})();</script>`;

// The click-to-switch pill: bottom-right, shows the active bundle, one
// click toggles it and reloads. Injected into both shells so the switch is
// always visible regardless of which one is active.
const switchPillScript = `<script>/*web-bundle-pill*/(function(){try{var K="webClientBundle";function cur(){return localStorage.getItem(K)==="vellum"?"vellum":"cadet"}var b=document.createElement("button");function render(){b.textContent="web: "+cur()}function toggle(){var n=cur()==="vellum"?"cadet":"vellum";localStorage.setItem(K,n);document.cookie=K+"="+n+";path=/;max-age=31536000;samesite=lax";location.reload()}render();b.style.cssText="position:fixed;bottom:10px;right:10px;z-index:2147483647;opacity:.5;background:#111;color:#eee;border:1px solid #555;border-radius:999px;font:11px ui-monospace,SFMono-Regular,monospace;padding:4px 10px;cursor:pointer";b.onclick=toggle;b.onmouseenter=function(){b.style.opacity="1"};b.onmouseleave=function(){b.style.opacity=".5"};document.body.appendChild(b)}catch(e){}})();</script>`;

// Flag overrides — injected as BOTH globals since each brand reads its own
// name (__VELLUM_FLAG_OVERRIDES__ in @vellumai/web, __CADET_FLAG_OVERRIDES__
// in @mycadet/web; the flag KEYS themselves are unchanged).
//
// `self-hosted-assistant` (defaultEnabled: false in feature-flag-catalog):
// enables self-hosted assistant support in the web client. Without this,
// the chat page renders "Conversations for self-hosted assistants aren't
// available from the web yet" because the flag-gate short-circuits to the
// "not supported" UI. Toggling it tells the SPA to treat self-hosted mode
// as a first-class citizen and use the conversations API for self-hosted
// assistants (not the desktop-app-only fallback).
const flagOverrides = JSON.stringify({
  "settings-developer-nav": true,
  "developer-menu-items": true,
  "self-hosted-assistant": true,
});
const flagScript = `<script>window.__VELLUM_FLAG_OVERRIDES__=${flagOverrides};window.__CADET_FLAG_OVERRIDES__=${flagOverrides}</script>`;

// ── shell documents: preload lockfile + token into localStorage ────────────
// In 0.8.x AND 0.10.x, the SPA never fetches /assistant/__local/lockfile on
// startup — `Q()` (0.10.x) / `G()` (0.8.x) only reads localStorage and falls
// back to the empty default. The local-mode handshake (`oe()` → `Ms()` →
// `pe()` → `fe()` POSTs `/auth/token`) only fires when the lockfile is
// already in localStorage. With no lockfile, `oe()` returns false,
// `initSession` skips the local-mode branch, and SDK calls 401.
//
// Fix: inject a synchronous IIFE into <head> that writes the lockfile to
// localStorage BEFORE the SPA module loads. Synchronous matters here — the
// SPA module is `defer`-loaded by default, so our IIFE runs first and
// populates localStorage before `initSession` ever fires.
//
// We ALSO write the `gw:token` keys so the gateway bootstrap IIFE in
// local-mode.js picks up the token at module load — without this, the
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
// Written to BOTH localStorage namespaces (vellum:* and cadet:*) since
// either bundle may be served; extra keys are inert to the other bundle.
//
// Idempotent: skip if lockfile already in localStorage (preserves any
// runtime updates the SPA made).
const assistantId = process.env.VELLUM_ASSISTANT_ID;
const accessToken = process.env.VELLUM_ACCESS_TOKEN;
let lockfileScript = "";
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
  // Include token in payload so the IIFE can write it to gw:token too.
  // Only when the token is available — otherwise we still preload the
  // lockfile and the handshake (Ms() → fe()) will populate the token
  // normally.
  if (accessToken) {
    lockfilePayload.token = accessToken;
  }
  // Far-future expiresAt (year 2099 = ~4070908800 seconds since epoch). The
  // ge-bootstrap IIFE treats expiresAt as a hint and warns if expired, but
  // still uses the token. Real token rotation happens server-side via the
  // handshake endpoint (which sets a fresh 2-hour expiresAt).
  lockfileScript = `<script>(function(){try{var p=${JSON.stringify(lockfilePayload)};var s=JSON.stringify(p);localStorage.setItem("cadet:local:lockfile",s);localStorage.setItem("vellum:local:lockfile",s);if(p.token){localStorage.setItem("cadet:gw:token",p.token);localStorage.setItem("vellum:gw:token",p.token);localStorage.setItem("cadet:gw:expiresAt","4070908800");localStorage.setItem("vellum:gw:expiresAt","4070908800")}}catch(e){}})();</script>`;
}

// ── shell documents: inject SPA→parent navigation emitter ──────────────────
// The SPA uses path-based browser history (React Router on the `history` lib).
// history.pushState/replaceState fire NO event a parent frame can observe, so
// when the SPA navigates inside the admin iframe the parent browser URL stays
// stuck. This script monkeypatches those primitives + listens for
// popstate/hashchange and postMessages the parent with the new path + nav type.
//
// Bundle-independent — works identically in both shells.
//
// Runs before the SPA module (classic <script> in <head> vs. the deferred
// module bundle), so the patches are in place before the router boots. The
// original methods are called first, so SPA routing is untouched.
//
// Idempotent: skip if the marker comment is already present.
const navEmitterScript = `<script>/*vellum-nav-emitter*/(function(){var M={source:'vellum-spa-nav'};function emit(nav){try{parent.postMessage(Object.assign({},M,{nav:nav,path:location.pathname+location.search+location.hash}),'*')}catch(e){}}['pushState','replaceState'].forEach(function(m){var orig=history[m];history[m]=function(){var r=orig.apply(this,arguments);emit(m==='pushState'?'push':'replace');return r}});window.addEventListener('popstate',function(){emit('pop')});window.addEventListener('hashchange',function(){emit('pop')})})();</script>`;

// Inject everything into both shell documents.
const shells: Array<{ file: string }> = [
  { file: "index.html" },
  { file: "vellum.html" },
];

for (const { file } of shells) {
  const htmlPath = join(destDir, file);
  let html = await readFile(htmlPath, "utf-8");

  // <head> injections (run before the deferred SPA module).
  for (const [snippet, marker, what] of [
    [flagScript, "__VELLUM_FLAG_OVERRIDES__", "feature flag overrides"],
    [
      lockfileScript,
      'setItem("vellum:local:lockfile"',
      "lockfile + token preload",
    ],
    [navEmitterScript, "/*vellum-nav-emitter*/", "SPA→parent nav emitter"],
    [bundleSyncScript, "/*web-bundle-switch*/", "bundle-switch sync"],
  ] as Array<[string, string, string]>) {
    if (!snippet) continue;
    if (html.includes(marker)) {
      console.log(`⏭️  Already patched: ${file} (${what})`);
    } else {
      html = html.replace("</head>", `${snippet}</head>`);
      console.log(`🩹 Patched: ${file} — ${what}`);
    }
  }

  // The pill lives at the end of <body> so document.body exists.
  if (html.includes("/*web-bundle-pill*/")) {
    console.log(`⏭️  Already patched: ${file} (bundle-switch pill)`);
  } else {
    html = html.replace("</body>", `${switchPillScript}</body>`);
    console.log(`🩹 Patched: ${file} — bundle-switch pill`);
  }

  await writeFile(htmlPath, html);
}

for (const { filePrefix, description, from, to } of patches) {
  const filePaths = findAsset(filePrefix);

  if (filePaths.length === 0) {
    console.warn(`⚠️  No file matching ${filePrefix ?? "*"}*.js — skipping`);
    console.warn(`    ${description}`);
    continue;
  }

  for (const filePath of filePaths) {
    const name = filePath.split("/").at(-1);
    const content = await readFile(filePath, "utf-8");

    if (content.includes(to)) {
      console.log(`⏭️  Already patched: ${name}`);
      continue;
    }

    if (!content.includes(from)) continue; // pattern lives in another asset

    await writeFile(filePath, content.replace(from, to));
    console.log(`🩹 Patched: ${name}`);
    console.log(`    ${description}`);
  }
}
