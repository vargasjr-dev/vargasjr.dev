/**
 * GET /api/github-stats
 *
 * Returns a GitHub-style contribution grid SVG showing PRs merged per day
 * across the vargasjr-dev org, split between Vargas (@dvargas92495) and
 * VargasJR (app/vargas-jr). Each cell has a <title> tooltip with the
 * per-day breakdown on hover.
 *
 * Auth: uses GITHUB_PRIVATE_KEY + GITHUB_APP_ID env vars (already in Vercel)
 * to mint an installation token via the GitHub App — no separate PAT needed.
 *
 * Results are cached for 1 hour.
 */

const GITHUB_GRAPHQL_URL = "https://api.github.com/graphql";
const GITHUB_APP_ID = process.env.GITHUB_APP_ID ?? "1344447";
const GITHUB_INSTALLATION_ID = process.env.GITHUB_INSTALLATION_ID ?? "97994364";

// Brand colors
const COLOR_VARGAS = "#3ba4dc";
const COLOR_VARGASJR = "#fb923c";
const COLOR_BOTH = "#a78bfa";
const COLOR_EMPTY = "#161b22";
const COLOR_LIGHT = "#21262d";

type DayData = { vargas: number; vargasJR: number };
type GridData = Record<string, DayData>;

// ── JWT signing via Web Crypto (no jsonwebtoken dependency) ──────────────────

function base64url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function signJWT(payload: Record<string, unknown>): Promise<string> {
  const rawKey = (process.env.GITHUB_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");
  if (!rawKey) throw new Error("GITHUB_PRIVATE_KEY not set");

  const pemBody = rawKey
    .replace(/-----BEGIN RSA PRIVATE KEY-----/, "")
    .replace(/-----END RSA PRIVATE KEY-----/, "")
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const keyDer = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));

  const key = await crypto.subtle.importKey(
    "pkcs8",
    keyDer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const header = base64url(
    new TextEncoder().encode(JSON.stringify({ alg: "RS256", typ: "JWT" }))
      .buffer as ArrayBuffer,
  );
  const body = base64url(
    new TextEncoder().encode(JSON.stringify(payload)).buffer as ArrayBuffer,
  );
  const signingInput = `${header}.${body}`;
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signingInput),
  );
  return `${signingInput}.${base64url(sig)}`;
}

async function getInstallationToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const jwt = await signJWT({
    iat: now - 60,
    exp: now + 540,
    iss: GITHUB_APP_ID,
  });

  const res = await fetch(
    `https://api.github.com/app/installations/${GITHUB_INSTALLATION_ID}/access_tokens`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: "application/vnd.github+json",
      },
    },
  );
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status}`);
  const data = await res.json();
  return data.token as string;
}

// ── PR data fetching ─────────────────────────────────────────────────────────

async function fetchMergedPRs(): Promise<GridData> {
  let token: string;
  try {
    token = await getInstallationToken();
  } catch {
    return {};
  }

  const grid: GridData = {};
  const since = new Date();
  since.setFullYear(since.getFullYear() - 1);
  const sinceDate = since.toISOString().slice(0, 10);

  async function fetchForAuthor(
    authorQuery: string,
    field: keyof DayData,
  ): Promise<void> {
    let cursor: string | null = null;
    let hasMore = true;

    while (hasMore) {
      const after: string = cursor ? `, after: "${cursor}"` : "";
      const query: string = `{
        search(
          query: "is:pr is:merged org:vargasjr-dev ${authorQuery} merged:>=${sinceDate}"
          type: ISSUE
          first: 100
          ${after}
        ) {
          pageInfo { hasNextPage endCursor }
          nodes { ... on PullRequest { mergedAt } }
        }
      }`;

      const res: Response = await fetch(GITHUB_GRAPHQL_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query }),
      });

      if (!res.ok) break;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = await res.json();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const search: any = data.data?.search;
      if (!search) break;

      for (const node of search.nodes ?? []) {
        if (!node.mergedAt) continue;
        const day: string = node.mergedAt.slice(0, 10);
        if (!grid[day]) grid[day] = { vargas: 0, vargasJR: 0 };
        grid[day][field]++;
      }

      hasMore = search.pageInfo?.hasNextPage ?? false;
      cursor = search.pageInfo?.endCursor ?? null;
    }
  }

  await Promise.all([
    fetchForAuthor("author:dvargas92495", "vargas"),
    fetchForAuthor("author:app/vargas-jr", "vargasJR"),
  ]);

  return grid;
}

// ── SVG rendering ────────────────────────────────────────────────────────────

function cellColor(d: DayData): string {
  if (d.vargas > 0 && d.vargasJR > 0) return COLOR_BOTH;
  if (d.vargas > 0) return COLOR_VARGAS;
  return COLOR_VARGASJR;
}

function cellOpacity(total: number): number {
  if (total <= 2) return 0.5;
  if (total <= 5) return 0.7;
  if (total <= 10) return 0.85;
  return 1;
}

function generateSVG(grid: GridData): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const start = new Date(today);
  start.setDate(start.getDate() - 52 * 7);
  start.setDate(start.getDate() - start.getDay()); // back to Sunday

  const CELL = 11;
  const GAP = 2;
  const STEP = CELL + GAP;
  const COLS = 53;
  const ROWS = 7;
  const PAD_LEFT = 8;
  const PAD_TOP = 36;
  const W = PAD_LEFT + COLS * STEP + 8;
  const H = PAD_TOP + ROWS * STEP + 24;

  const months: { label: string; col: number }[] = [];
  let lastMonth = -1;
  const cells: string[] = [];

  for (let col = 0; col < COLS; col++) {
    for (let row = 0; row < ROWS; row++) {
      const d = new Date(start);
      d.setDate(d.getDate() + col * 7 + row);
      if (d > today) continue;

      const key = d.toISOString().slice(0, 10);
      const data = grid[key] ?? { vargas: 0, vargasJR: 0 };
      const total = data.vargas + data.vargasJR;
      const color = total === 0 ? COLOR_EMPTY : cellColor(data);
      const opacity = total === 0 ? 1 : cellOpacity(total);

      const x = PAD_LEFT + col * STEP;
      const y = PAD_TOP + row * STEP;

      const label = d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      const tip =
        total === 0
          ? `${label}: no PRs`
          : `${label}: ${total} PR${total !== 1 ? "s" : ""} — Vargas ${data.vargas}, VargasJR ${data.vargasJR}`;

      cells.push(
        `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="2" fill="${color}" opacity="${opacity}"><title>${tip}</title></rect>`,
      );

      if (row === 0 && d.getMonth() !== lastMonth) {
        lastMonth = d.getMonth();
        months.push({
          label: d.toLocaleDateString("en-US", { month: "short" }),
          col,
        });
      }
    }
  }

  const monthLabels = months
    .map(
      ({ label, col }) =>
        `<text x="${PAD_LEFT + col * STEP}" y="16" class="month">${label}</text>`,
    )
    .join("\n  ");

  const legendY = H - 6;
  const legendItems = [
    { color: COLOR_VARGAS, label: "Vargas", x: W - 185 },
    { color: COLOR_VARGASJR, label: "VargasJR", x: W - 118 },
    { color: COLOR_BOTH, label: "Both", x: W - 43 },
  ];
  const legend = legendItems
    .map(
      ({ color, label, x }) =>
        `<rect x="${x}" y="${legendY - 8}" width="9" height="9" rx="2" fill="${color}"/>` +
        `<text x="${x + 13}" y="${legendY}" class="month">${label}</text>`,
    )
    .join("\n  ");

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <style>
    text { font-family: 'Segoe UI', Ubuntu, 'Helvetica Neue', Sans-Serif; }
    .title { font-size: 14px; font-weight: 600; fill: #e6edf3; }
    .month { font-size: 10px; fill: #6e7681; }
  </style>
  <rect width="${W}" height="${H}" rx="10" fill="#0d1117" stroke="#30363d" stroke-width="1"/>
  <text x="${PAD_LEFT}" y="16" class="title">PRs Merged</text>
  ${monthLabels}
  ${cells.join("\n  ")}
  ${legend}
</svg>`;
}

// ── Handler ──────────────────────────────────────────────────────────────────

export async function GET() {
  const grid = await fetchMergedPRs();
  const svg = generateSVG(grid);

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
