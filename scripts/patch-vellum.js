/**
 * Applies all @vellumai/web patches without requiring the `patch` CLI.
 * Runs via postinstall and build — works on Vercel and locally.
 *
 * Patches:
 *   1. auth-store      — skip allauth platform check in self-hosted mode (no-op in 0.10.x — pattern removed upstream)
 *   2. sidebar         — bump conversation limit from 5 → 16
 *   3. staff-check     — always return true for inspect/developer features
 *   4. nav-sections    — hide Scheduled and Background (no-op in 0.10.x — sections hidden by default upstream)
 *   5. message-poll    — make the post-send fallback a single history check instead of a 120-second poll loop
 *
 * NOTE: The lockfile-preload that makes local-mode handshake fire on startup
 * lives in scripts/copy-assistant.ts (it injects a sync <script> into
 * index.html that writes the lockfile to localStorage before the SPA module
 * loads). See the bottom of that file.
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
// (zn() fails silently, no clearOnFailure). As of 0.10.x the upstream auth
// flow was refactored entirely — `zn()` is no longer the auth-store helper
// (it's now a utility used elsewhere) and the `Nn?e({...}):zn(...)` pattern
// no longer exists in the bundle. This section is kept as a best-effort
// hardening pass; missing patterns are non-fatal.
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
      // of fire-and-forget zn() platform check. Pattern was removed in 0.10.x.
      [
        `e(Fn()),Nn?e({platformSession:\`absent\`}):zn(e,{setUserOnSuccess:!0}),Nn=!1;return`,
        `e(Fn()),e({platformSession:\`absent\`}),Nn=!1;return`,
      ],
    ],
    "auth-store",
  );
} else {
  console.warn(
    "patch-vellum: [auth-store] auth-store-*.js not found in assets dir",
  );
}

// ── 2. sidebar conversation limit ───────────────────────────────────────────
// Bump the initial visible count in the sidebar from 5 → 16.
// As of 0.8.10 the main sidebar component already ships with 16; only the
// command-palette conv slice (in $A / equivalent function) still needs patching.
// In 0.10.x the sidebar was refactored — module renamed (Y→W), variables
// renamed ([D,O]/[k,ee] → [E,D]/[O,ee]), and the conv-slice icon is now `t_`.
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
      // vE (0.10.x — icon:t_)
      [
        "e.slice(0,5).map(e=>({id:`conv-${e.conversationId}`,icon:t_,",
        "e.slice(0,16).map(e=>({id:`conv-${e.conversationId}`,icon:t_,",
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
      // vE main sidebar useState (0.10.x — module W, vars [E,D]/[O,ee], no slack state)
      [
        "[E,D]=(0,W.useState)(5),[O,ee]=(0,W.useState)({})",
        "[E,D]=(0,W.useState)(16),[O,ee]=(0,W.useState)({})",
      ],
      // vE showLess (0.10.x — single `t>5&&e.length>5` shape, no w.recents/slack split)
      ["showLess:t>5&&e.length>5", "showLess:t>16&&e.length>16"],
    ],
    "sidebar",
  );
} else {
  console.warn("patch-vellum: [sidebar] index-*.js not found in assets dir");
}

// ── 3. staff check — always return true for inspect/developer features ───────
// OO(user) / CA(user, _) gates Inspect (message + conversation) behind
// isStaff or @vellum.ai email. Make it always return true so Inspect is
// available to everyone.
//
// 0.10.x renamed the wrapper from `OO(e)` to `CA(e, t)` and added a `t`
// short-circuit argument. The `return t || ...` chain is otherwise identical
// to the 0.8.x body.
if (indexFile) {
  patchFile(
    `node_modules/@vellumai/web/dist/assets/${indexFile}`,
    [
      // vA (0.8.x — function OO(e))
      [
        "function OO(e){return e?.isStaff===!0||e?.email?.toLowerCase().endsWith(`@vellum.ai`)===!0}",
        "function OO(e){return!0}",
      ],
      // vE (0.10.x — function CA(e, t), t short-circuits the gate)
      [
        "function CA(e,t){return t||e?.isStaff===!0||e?.email?.toLowerCase().endsWith(`@vellum.ai`)===!0}",
        "function CA(e,t){return!0}",
      ],
    ],
    "staff-check",
  );
}

// ── 4. nav sections — hide Scheduled and Background ─────────────────────────
// The system groups array defines all system sidebar groups. Strip the two
// noise sections so only Pinned and Recents appear in the nav.
//
// 0.10.x removed this literal entirely — the sidebar now uses
// `backgroundActivated` / `scheduledActivated` flags that default to false
// (off), so Scheduled and Background are hidden by default without patching.
// The patch below remains as a fallback for any 0.8.x → 0.9.x intermediate
// that still shipped the literal. Missing patterns are non-fatal.
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

// ── 5. message polling ──────────────────────────────────────────────────────
// The fallback used after a non-streaming send polls the entire conversation
// history every second for up to two minutes while waiting for the assistant
// message. The backend's stream/reconciliation path owns delivery now, so this
// client-side loop is both redundant and unnecessarily expensive. Keep one
// immediate history check as a compatibility fallback, but never schedule a
// timer or repeat the full-history request.
const messagesFile = existsSync(assetsDir)
  ? readdirSync(assetsDir).find(
      (f) => f.startsWith("messages-") && f.endsWith(".js"),
    )
  : null;

if (messagesFile) {
  patchFile(
    `node_modules/@vellumai/web/dist/assets/${messagesFile}`,
    [
      // @vellumai/web 0.10.8: async function H is exported as the polling
      // helper (the `i` export). Preserve the response lookup, but remove the
      // deadline loop and setTimeout retry.
      [
        "async function H(e,t,n){let r=Date.now()+B;for(;Date.now()<r;){let{data:r,error:i,response:o}=await a({path:{assistant_id:e},query:{conversationId:n},throwOnError:!1});if(d(o,i,`Failed to poll for messages`),!o.ok){let e=f(i,o,`Failed to poll for messages`);throw Error(e)}let s=r?.messages??[],c=s.findIndex(e=>e.id===t);if(c>=0){let e=s.slice(c+1).find(e=>e.role===`assistant`);if(e)return e}await new Promise(e=>setTimeout(e,z))}return null}",
        "async function H(e,t,n){let{data:r,error:i,response:o}=await a({path:{assistant_id:e},query:{conversationId:n},throwOnError:!1});if(d(o,i,`Failed to fetch fallback message`),!o.ok){let e=f(i,o,`Failed to fetch fallback message`);throw Error(e)}let s=r?.messages??[],c=s.findIndex(e=>e.id===t);return c<0?null:s.slice(c+1).find(e=>e.role===`assistant`)??null}",
      ],
    ],
    "message-poll",
  );
} else {
  console.warn(
    "patch-vellum: [message-poll] messages-*.js not found in assets dir",
  );
}
