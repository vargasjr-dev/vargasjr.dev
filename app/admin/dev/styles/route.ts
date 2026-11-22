import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

/** Serve the dependency's precompiled CSS without the site's Tailwind 3 pass. */
export async function GET() {
  const css = await readFile(require.resolve("@mycadet/app/style.css"), "utf8");
  return new Response(css, {
    headers: { "Content-Type": "text/css; charset=utf-8" },
  });
}
