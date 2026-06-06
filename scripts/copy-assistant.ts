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
  {
    filePrefix: "local-mode-",
    description:
      "K() falls back to lockfile url+token when no gatewayPort, so the fetch interceptor gets a token to inject as Authorization header",
    from: "async function K(){let e=v();if(!e)return;",
    // Use A() (live fetch) not j() (stale cache) so the lockfile is always
    // fresh and resources.gatewayPort is present for the I() filter in R().
    to: "async function K(){let e=v();if(!e){let lf=await A();lf.url&&lf.token&&x({url:lf.url,token:lf.token});return}",
  },
  {
    filePrefix: "auth-store-",
    description:
      "In self-hosted docker branch (m()&&!v()), call g() to load lockfile token before any API requests; remove allauth fire-and-forget that always 401s in self-hosted mode",
    from: "if(m()&&!v()){e({isLoggedIn:!0,isLoading:!1,user:Y}),a().then(t=>{t.ok&&t.data.user&&e({hasPlatformSession:!0,user:K(t.data.user)})}).catch(()=>{});return}",
    to: "if(m()&&!v()){try{await g()}catch{}e({isLoggedIn:!0,isLoading:!1,user:Y});return}",
  },
  // TEST: strip Authorization header entirely to diagnose 429s from daemon.
  // LU() is used by SDK calls; the fetch interceptor covers raw fetch.
  {
    filePrefix: "index-",
    description:
      "TEST: remove Authorization header injection from LU() and fetch interceptor",
    from: "function LU(e){let t={...e??{}},n=yt();if(n)return t.Authorization=`Bearer ${n}`,t;let r=Ft();return r&&(t[`Vellum-Organization-Id`]=r),t}",
    to: "function LU(e){let t={...e??{}};let r=Ft();return r&&(t[`Vellum-Organization-Id`]=r),t}",
  },
  {
    filePrefix: "index-",
    description:
      "TEST: nullify token in raw fetch interceptor so Authorization header is deleted",
    from: "let s=yt();s?o.set(`Authorization`,`Bearer ${s}`):o.delete(`Authorization`)",
    to: "let s=null;s?o.set(`Authorization`,`Bearer ${s}`):o.delete(`Authorization`)",
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
