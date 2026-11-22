# Experimental app host

`/admin/dev/assistant/` mounts the actual Cadet app route tree with React Router's
`basename=/admin/dev`. Account and pairing routes live below the same mount.
The existing `/admin/assistant/` embed remains available.

The registry's `@mycadet/app@0.0.1` is a placeholder. The frontend instead installs
`file:vendor/mycadet-app-0.0.0-dev.b434b24.1.tgz`, built from the MIT-licensed
`vargasjr-dev/mycadet-temp` commit `b434b2445fa070b4ac85e73230e25a4fd655425d`.
`embedded.patch` records the full source changes: a browser-only EmbeddedApp
export, a router factory accepting a basename, and a basename-independent
assistant iframe path. React remains a peer, rather than a second bundled copy.

Rebuild with Bun 1.3.11, Node, npm and Git:

```sh
bash scripts/cadet-app/build.sh
bun install
```

The build checks out the exact source revision and applies the checked-in patch.
It copies compiled Tailwind 4 CSS to `public/cadet-dev/app.css`; this is loaded as
a stylesheet so the website's Tailwind 3 processor does not reinterpret it.
Do not hand-edit the tarball or generated CSS. Bump the experimental version when
changing its runtime code so package managers do not reuse a cached local tarball.

The app's same-origin contract requires `/v1/*`, `/web/*` and `/_allauth/*` to
forward to the fixed `https://assistant.vargasjr.dev` gateway. These transport
paths intentionally remain outside the React Router basename. The proxy strips
website admin cookies and Authorization, forwards only Cadet/auth session cookies,
preserves HttpOnly Set-Cookie headers and streaming responses, and rejects
cross-origin mutations. It does not inject a guardian credential or bypass
Cadet authorization. Browser pairing on this website establishes a separate
session from directly visiting the assistant subdomain.

Tests:

```sh
node --import tsx --test lib/cadet-dev-proxy.test.ts lib/assistant-navigation.test.ts
npx playwright install chromium
npx playwright test --config playwright.cadet.config.ts
```

The browser tests stub gateway resolution and pairing responses, never exchange a
real pairing code, and cover mobile/desktop redirects, pairing completion, frame
paths, deep-link navigation and Back. Live pairing still needs a real gateway and
an approved code after deploying the experiment. Cloud account OAuth/provider flows
WebSocket upgrades (such as live voice) need an ingress that supports upgrades;
Next route handlers here cover HTTP and SSE only. Cloud OAuth/provider flows
and native desktop-only actions are outside this experiment's browser validation.
