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

  // Version D  (0.8.12 — index-87hTkD_v.js)
  // Palette slice uses capital Pm. Main sidebar useState still inits to 5;
  // recents showLess/onShowLess already ship with 16, but slack onShowLess doesn't.
  {
    filePrefix: "index-",
    description: "Sidebar conv palette slice (vD — icon:Pm)",
    from: "e.slice(0,5).map(e=>({id:`conv-${e.conversationId}`,icon:Pm,",
    to: "e.slice(0,16).map(e=>({id:`conv-${e.conversationId}`,icon:Pm,",
  },
  {
    filePrefix: "index-",
    description: "Sidebar useState init (vD — [D,O]/[k,ee])",
    from: "[D,O]=(0,Y.useState)(5),[k,ee]=(0,Y.useState)(5)",
    to: "[D,O]=(0,Y.useState)(16),[k,ee]=(0,Y.useState)(16)",
  },
  {
    filePrefix: "index-",
    description: "Sidebar slack onShowLess (vD — ee)",
    from: "onShowLess:()=>ee(5)}},[w.slack,k,r]",
    to: "onShowLess:()=>ee(16)}},[w.slack,k,r]",
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

      // ── Bootstrap `ge` (in-memory {url,token} state) from localStorage ───────
              // The fetch interceptor S5() in index-* reads ge.url (In()) and ge.token
              // (Rn()) before injecting Authorization. Both start as {url:null,token:null}
              // and only get populated by _e({url,token}) inside Ms() AFTER the handshake
              // completes. When pe() short-circuits (de() returns truthy because a cached
              // token is in localStorage), _e() never runs, ge.token stays null, and S5()
              // deletes the Authorization header — every SDK call 401s.
              //
              // Fix: replace the bare var ge initialization with an IIFE that reads the
              // lockfile + cached token from localStorage synchronously at module load.
              // S5() then sees valid {url,token} on its first call. The handshake can
              // still run and overwrite ge with fresh data via _e() — bootstrap is just
              // the fallback that lets the SDK work even when the handshake never fires.
              //
              // DEBUG (Jun 28 2026): the localStorage expiresAt timestamp is treated as
              // authoritative and rejected expired tokens. In our deploy the cached
              // expiresAt is stale (token still works server-side), so we ignore expiry
              // and console.warn instead. If the server actually does reject the expired
              // token, S5() will still 401 — but at least we'll know the header was set
              // and the problem is server-side rejection, not client-side non-injection.
              //
              // 0.8.x: this exact pattern lives in local-mode-*.js but with different
              //        var names (Ds/Es etc.) — no patch (the 0.10.x upgrade refreshes).
              {
                filePrefix: "local-mode-",
                description: "Bootstrap `ge` (gateway url+token) from localStorage at module load (warn on expired, but still use)",
                from: "var ge={url:null,token:null}",
                to: "var ge=(function(){try{var lf=localStorage.getItem(`vellum:local:lockfile`);var tk=localStorage.getItem(`vellum:gw:token`)||localStorage.getItem(`gw:token`);var ex=localStorage.getItem(`vellum:gw:expiresAt`)||localStorage.getItem(`gw:expiresAt`);var url=null;if(lf){try{var p=JSON.parse(lf);var id=p&&p.activeAssistant;var arr=p&&p.assistants;var a=Array.isArray(arr)&&arr.find(function(x){return x&&x.assistantId===id});if(a&&a.resources&&a.resources.gatewayPort!=null)url=window.location.origin+`/assistant/__gateway/`+a.resources.gatewayPort}catch(_){};}if(tk){if(ex&&Date.now()/1000>=Number(ex)){console.warn(`[vellum-debug] gw:token expired (expiresAt=${ex}, now=${Math.floor(Date.now()/1000)}), using anyway`)}return{url:url,token:tk}}}catch(_){};return{url:null,token:null};})()",
              },
              // ── Make T5 (local-mode interceptor) fall through to C5() like E5 does ──
                              // w5() is the main interceptor factory. It tries S5() first (allowlist-based
                              // Authorization for paths in `b5`), then falls through. With default flags
                              // (T5 = w5()), w5() never calls C5() — only E5 = w5({allowRemoteGatewayDirect:!0})
                              // does. In local mode the SDK uses T5, so requests like /v1/guardian/refresh
                              // (NOT in the b5 allowlist) go through with NO Authorization.
                              //
                              // Fix: change T5 to also pass allowRemoteGatewayDirect:!0 so w5() calls C5()
                              // as a fallback after S5() bails. C5() (with my next patch) then adds
                              // Authorization to any /v1/* request that doesn't match the gateway prefix.
                              {
                                filePrefix: "index-",
                                description: "T5 = w5() → T5 = w5({allowRemoteGatewayDirect:!0}) so C5() runs as fallback after S5() bails on non-allowlisted paths",
                                from: "var T5=w5(),E5=w5({skipSegmentAllowlist:!0,allowRemoteGatewayDirect:!0})",
                                to: "var T5=w5({allowRemoteGatewayDirect:!0}),E5=w5({skipSegmentAllowlist:!0,allowRemoteGatewayDirect:!0})",
                              },

                              // ── Patch C5() pathname check to accept /v1/* (local-mode relative paths) ──
                                                              // C5() originally required pathname to start with `${ge.url.pathname}/v1/`
                                                              // (i.e., /assistant/__gateway/7830/v1/*) — which only matches in REMOTE mode
                                                              // where requests use absolute gateway URLs. In LOCAL mode, the SDK uses
                                                              // RELATIVE paths (/v1/guardian/refresh) that Next.js rewrites to ngrok, so
                                                              // the prefix check fails and C5() returns null.
                                                              //
                                                              // Fix: also accept paths starting with /v1/ — the local-mode relative form.
                                                              // Origin check (n.origin !== r.origin) still guards against adding
                                                              // Authorization to requests going to vellum.ai (only gateway-origin requests
                                                              // get auth, matching the original security model).
                                              {
                                                filePrefix: "index-",
                                                description: "C5() pathname check accepts /v1/* paths (not just ${i}/v1/*) so local-mode relative URLs get Authorization",
                                                from: "!n.pathname.startsWith(`${i}/v1/`)",
                                                to: "!(n.pathname.startsWith(`${i}/v1/`)||n.pathname.startsWith('/v1/'))",
                                              },

                                                              // ── Make C5() fire when gateway URL is set, not just in remote-gateway mode ──
                                                              // Previously we patched X() to return true when ge.url is set, but that
                                                              // broke `shouldRefreshRemoteGatewaySession` (which uses X() to decide
                                                              // whether to run — see next two patches). Instead, make C5() depend on
                                                              // `ge.url` (In()) directly. In() returns the gateway URL — true in BOTH
                                                              // remote mode AND local mode (when our IIFE above populates ge.url from
                                                              // the lockfile). Kn() (X()) is only true in remote mode, so the old check
                                                              // `if(!Kn())return null` was too restrictive — local mode was excluded.
                                                              //
                                                              // The new check `if(!Kn()&&!In())return null` fires C5() whenever EITHER
                                                              // we're in remote mode OR a gateway URL is configured (local mode). The
                                                              // remaining `let t=In();if(!t)return null` below still gates on the URL
                                                              // existing — defense in depth.
                                              {
                                                filePrefix: "index-",
                                                description: "C5() Authorization interceptor fires when gateway URL is set (local mode) or remote-gateway mode",
                                                from: "if(!Kn())return null;",
                                                to: "if(!Kn()&&!In())return null;",
                                              },

                                                              // ── Import X() (remote-gateway-mode check) into return-to bundle ──
                                                              // The next patch adds a short-circuit to shouldRefreshRemoteGatewaySession
                                                              // that depends on knowing whether we're in remote-gateway mode. X() is
                                                              // exported from local-mode-*.js as `h`. The return-to bundle currently
                                                              // only imports `$ as e,nt as t,st as n` from local-mode — extend it to
                                                              // also bring in `h as X` so the short-circuit can call X().
                                              {
                                                filePrefix: "return-to-",
                                                description: "Import X() (remote-gateway mode check, exported as `h` from local-mode) into return-to bundle",
                                                from: "import{$ as e,nt as t,st as n}from\"./local-mode-CvrNMtPF.js\"",
                                                to: "import{$ as e,nt as t,st as n,h as X}from\"./local-mode-CvrNMtPF.js\"",
                                              },

                                                              // ── Short-circuit shouldRefreshRemoteGatewaySession when not in remote-gateway mode ──
                                                              // shouldRefreshRemoteGatewaySession (bundled as C()) is the gate that decides
                                                              // whether refreshRemoteGatewaySessionOnce (bundled as F()) should fire its
                                                              // raw fetch() to /v1/guardian/refresh. The source's intent is clear:
                                                              // this refresh is only for the remote-web pairing flow. In local mode we
                                                              // have a local-mode token cached in localStorage and DON'T need to
                                                              // refresh anything — but in the bundled code, C() only checks time-based
                                                              // conditions, so it can incorrectly return true in local mode (when no
                                                              // cached token exists yet on first visit) and F() fires its raw fetch()
                                                              // with no Authorization header → 401.
                                                              //
                                                              // Fix: prepend `if(!X())return!1` so C() returns false (refresh not
                                                              // needed) when we're not in remote-gateway mode. The short-circuit
                                                              // `if(!C())return!0` in F() then fires, no fetch is made, no 401. Local
                                                              // mode never tries to refresh the (non-existent) remote-gateway session.
                                                              //
                                                              // Remote mode unchanged: X()=true so the short-circuit doesn't fire and
                                                              // the existing time-based logic runs.
                                              {
                                                filePrefix: "return-to-",
                                                description: "C() (= shouldRefreshRemoteGatewaySession) short-circuits to false when not in remote-gateway mode (local mode skips the refresh entirely)",
                                                from: "function C(){return!t()||p<=0?!0:Date.now()>=p-s}",
                                                to: "function C(){if(!X())return!1;return!t()||p<=0?!0:Date.now()>=p-s}",
                                              },
                                    ];

// ── index.html: inject feature flag overrides ──────────────────────────────
// Injects window.__VELLUM_FLAG_OVERRIDES__ before </head> so the flag is
// baked in at build time and can't be reverted by server-side values.
const indexHtmlPath = join(destDir, "index.html");
const indexHtml = await readFile(indexHtmlPath, "utf-8");
const flagScript = `<script>window.__VELLUM_FLAG_OVERRIDES__={"settings-developer-nav":true,"developer-menu-items":true}</script>`;
if (indexHtml.includes(flagScript)) {
  console.log("⏭️  Already patched: index.html (feature flag overrides)");
} else {
  await writeFile(
    indexHtmlPath,
    indexHtml.replace("</head>", `${flagScript}</head>`),
  );
  console.log("🩹 Patched: index.html — injected __VELLUM_FLAG_OVERRIDES__");
}

// ── index.html: preload lockfile into localStorage so local-mode handshake fires ──
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
// We omit `cloud` from the assistant (matches the route's intentional
// omission); `Vo()` in local-mode.js derives it to `'local'` via `Lo()`.
// We omit `url` and `token` too — after handshake, `_e()` sets
// `url = origin + As(t)` and `token = de()` (freshly-fetched gateway token),
// so lockfile `url`/`token` aren't needed.
//
// Idempotent: skip if lockfile already in localStorage (preserves any
// runtime updates the SPA made).
const assistantId = process.env.VELLUM_ASSISTANT_ID;
if (!assistantId) {
  console.warn(
    "⚠️  VELLUM_ASSISTANT_ID not set — skipping lockfile preload (SPA will fall through to platform auth)",
  );
} else {
  const lockfilePayload = JSON.stringify({
    assistants: [
      {
        assistantId,
        resources: { gatewayPort: 7830, daemonPort: 7830 },
      },
    ],
    activeAssistant: assistantId,
  });
  const lockfileScript = `<script>(function(){try{localStorage.setItem("vellum:local:lockfile",${JSON.stringify(lockfilePayload)})}catch(e){}})();</script>`;

  if (indexHtml.includes(lockfileScript)) {
    console.log("⏭️  Already patched: index.html (lockfile preload)");
  } else {
    await writeFile(
      indexHtmlPath,
      indexHtml.replace("</head>", `${flagScript}${lockfileScript}</head>`),
    );
    console.log("🩹 Patched: index.html — preloaded lockfile into localStorage");
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
