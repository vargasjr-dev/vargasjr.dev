# Switching vargasjr.dev's admin UI from `@vellumai/web` to `@mycadet/web`

Investigation branch for swapping the admin-shell SPA from the upstream Vellum
web client (`@vellumai/web@0.12.2`, exact-pinned) to our own published Cadet web
client.

**Package name note:** `@cadet/web` does not exist on npm (404). The published
name is **`@mycadet/web`** (same scope as the rest of the release: assistant,
gateway, cli, credential-executor, plugin-api, `mycadet`). The dev channel
already serves `0.12.6-dev.*` versions; `latest` is still the `0.0.1`
placeholder until the v0.12.7 staging release run publishes it.

---

## Current wiring (what exists on main today)

Five surfaces, all in this repo:

| # | Surface | File |
|---|---------|------|
| 1 | Dep, exact-pinned `0.12.2` | `package.json` |
| 2 | Build-time copy `node_modules/@vellumai/web/dist` → `public/assistant/` + minified-JS patches + three `index.html` injections (flag overrides, lockfile preload, nav emitter) | `scripts/copy-assistant.ts` |
| 3 | More minified-JS patches, runs at `postinstall` + `build` | `scripts/patch-vellum.js` |
| 4 | Host-side lockfile/status/healthz/gateway-token API routes | `app/api/vellum-local/*` |
| 5 | Rewrite table: `/v1/*` → upstream, `/assistant/__local/*` + `/assistant/__gateway/7830/*` short-circuits, `beforeFiles` ordering | `next.config.ts` |

The SPA mounts same-origin at `/assistant/` (hardcoded base path) inside the
admin iframe (`app/admin/assistant/[[...slug]]/page.tsx`), which mirrors SPA
routes under `/admin/assistant/...` and syncs history via postMessage.

## Verified against the cadet bundle

Probed `@mycadet/web@0.12.6-dev.202610091338.ee7f3e3` (dist in `/workspace/tmp/cadet-web-probe`, disposable):

**Renames the switch must apply:**

- Flag global: `window.__VELLUM_FLAG_OVERRIDES__` → `window.__CADET_FLAG_OVERRIDES__` (2 refs in the main bundle).
- localStorage namespace swept `vellum:*` → `cadet:*`:
  `cadet:local:lockfile`, `cadet:gw:token`, `cadet:gw:expiresAt`.
  The copy-assistant lockfile-preload IIFE must write the `cadet:` keys.
- Copy source dir: `node_modules/@mycadet/web/dist` (same `dist/assets/*` shape).
- Config global is `__CADET_CONFIG__` — the host doesn't inject it today; no
  action unless we start using remote-gateway mode.

**Unchanged / still working:**

- Bundle base path stays `/assistant/` (absolute `/assistant/assets/*` script srcs) — no hosting change.
- Flag keys unchanged: `self-hosted-assistant`, `settings-developer-nav`,
  `developer-menu-items` all still exist in the bundle. The same override
  values carry over, just under the renamed global.
- Local-mode lockfile contract holds: `cloud === 'local'` check still gates the
  handshake; `cloud: "local"` + numeric `gatewayPort`/`daemonPort` in the
  lockfile payload remain valid.
- `/auth/token` handshake still present.
- Minified patch 1 (command palette recents `slice(0,5)`) — pattern present verbatim.
- Minified patch 2 (both `isStaff` parse sites) — patterns present verbatim.

**Changed / needs work:**

- **Patch 3 (sidebar-hide-telegram) is dead** — its minified anchor
  (`conversations:i.data?.conversations??hK,isLoading`) no longer exists, and
  the bundle now natively segregates channel conversations into their own
  section kind (`kind: 'chats'` vs channel kinds, keyed on
  `originChannel == null || originChannel === 'cadet'`). Re-derive against the
  real bundle if hiding Telegram still matters — it may be partially obsolete.
- **The SPA now fetches AND mutates the lockfile over HTTP**: reads
  `GET /assistant/__local/lockfile` at startup (previously it only ever read
  localStorage, which is why the preload IIFE exists), and writes mutations
  (rename, onboarded, stamp, replacePlatform*) via `POST /assistant/__local/lockfile`.
  The host rewrite already maps that path to `/api/vellum-local/lockfile`, but
  the route is GET-only — it needs POST handlers (or at minimum honest
  `{ok:false}` responses) or rename/onboarding mutations will fail.
- **Cloud taxonomy expanded**: `local` / `cadet` (managed cloud) / `paired` /
  docker, plus a new `isPlatformHosted` flag on assistants. Doesn't affect the
  self-hosted lockfile path, but explains the new select-assistant UI strings.
- **Bundler is now rolldown** (`rolldown-runtime-*.js`) — minified identifiers
  will churn differently across releases; the string-patch approach (scan all
  assets, idempotent, warn-on-miss) remains the right shape.
- **Native SPA→parent nav bridge is NOT in this dev bundle** — it postdates
  commit ee7f3e3 (cadet-temp #138, merged later the same day) and should be in
  0.12.7 stable. It emits `{source:'mycadet-web-nav', nav, path}` and accepts
  `{source:'mycadet-web-parent-nav', path}`. Our injected nav emitter is
  bundle-independent (pure host-side monkeypatch) and speaks `vellum-spa-nav`
  — keep it for the switch (works on any bundle), then optionally adopt the
  native bridge + rename the parent-side protocol as a follow-up. If both run,
  the parent filters by `source`, so no conflict.

**Vestigial / cleanup candidates:**

- `patches/@vellumai+web+0.8.*.patch` ×4 + the `patch-package` devDep: target
  0.8.x while the dep is 0.12.2 — patch-package is not even wired into the
  scripts (patch-vellum.js is the postinstall). Delete with the switch.
- `.gitignore` `/vellum/dist` `/browser/dist` `/worker/dist` entries — stale.
- `app/api/vellum-local/` dir name is cosmetic; rename only if we want it.

**Host env names** (`VELLUM_ASSISTANT_ID`, `VELLUM_ACCESS_TOKEN`, `VELLUM_API_URL`):
these are vargasjr.dev's own variable names (consumed by our routes and
copy-assistant), not bundle internals. Renaming to `CADET_*` is optional
cosmetics bundled with this switch — decide once, apply everywhere including
Vercel env settings.

## Migration checklist

1. `package.json`: `@vellumai/web` → `@mycadet/web`, exact-pin `0.12.7` once
   the stable release publishes (use the dev version locally to smoke first).
2. `scripts/copy-assistant.ts`: srcDir rename; flag global + localStorage key
   renames in both index.html injections; keep the lockfile preload IIFE (the
   SPA now fetches the endpoint, but the preload still removes the
   first-paint race where auth-store fires before the handshake completes).
3. `scripts/patch-vellum.js`: keep patches 1+2 as-is, re-derive or drop
   patch 3, rename the script + its console labels.
4. `app/api/vellum-local/lockfile/route.ts`: add POST handling for the SPA's
   lockfile mutations (rename/onboarded/stamp/replacePlatform*) — decide
   persist-vs-ack semantics per operation.
5. Re-run the whole local smoke: build → serve → admin iframe → local-mode
   handshake → conversation list renders → history sync both directions.
6. Cleanup commit: dead patches/ + patch-package, stale .gitignore entries.
7. After 0.12.7 stable lands: flip the pin, confirm patch anchors one more
   time (hashes churn), adopt the native nav bridge if we're keen.

## Open questions

- Version pin cadence: 0.12.2 is a long-lived pin; do we track `latest` with
  renovate-style bumps or keep exact pins and bump deliberately? Minified
  patches argue for deliberate bumps.
- Do we still need the `isStaff` patches at all? The cadet client is ours —
  the cleaner long-term fix is a feature flag or removing the gate in
  cadet-temp, not patching the minified bundle every release.
