/**
 * GET /api/github-stats
 *
 * Returns a GitHub-style contribution grid SVG showing PRs merged per day
 * across the vargasjr-dev org, split between Vargas (@dvargas92495) and
 * VargasJR (app/vargas-jr). Each cell has a <title> tooltip with the
 * per-day breakdown on hover.
 *
 * Auth: uses GITHUB_PRIVATE_KEY env var (PKCS#1 RSA PEM, already in Vercel)
 * to mint a GitHub App installation token via node:crypto — no PAT needed.
 *
 * Caching: historical days (before today) are cached in-process + Vercel Blob.
 * On cold start, reads cached historical data from Blob. Only today + the last
 * 7 days are re-fetched on each miss. Full cold-start fetch (no Blob data)
 * covers the past year. Persists historical data to Blob on each update.
 */

import { createSign } from "node:crypto";
import { list, put } from "@vercel/blob";

const GITHUB_GRAPHQL_URL = "https://api.github.com/graphql";
const GITHUB_APP_ID = process.env.GITHUB_APP_ID ?? "1344447";
const GITHUB_INSTALLATION_ID = process.env.GITHUB_INSTALLATION_ID ?? "97994364";

// Brand colors
const COLOR_VARGAS = "#3ba4dc";
const COLOR_VARGASJR = "#fb923c";
const COLOR_BOTH = "#a78bfa";
const COLOR_EMPTY = "#161b22";

type DayData = { vargas: number; vargasJR: number };
type GridData = Record<string, DayData>;

// ── Per-day cache ─────────────────────────────────────────────────────────────
// Historical days (before today) never change — kept in-process and persisted to Blob.
// Today + recent 7 days are re-fetched on cache miss.
const historicalCache = new Map<string, DayData>();
let recentCache: { fetchedAt: number; data: GridData } | null = null;
let blobLoaded = false; // track if we've already tried to load from Blob this instance
const RECENT_TTL_MS = 60 * 60 * 1000; // re-fetch recent window every 1h
const BLOB_CACHE_KEY = "github-stats-cache.json";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// ── JWT + token ───────────────────────────────────────────────────────────────

function signJWT(payload: Record<string, unknown>): string {
  const rawKey = (process.env.GITHUB_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");
  if (!rawKey) throw new Error("GITHUB_PRIVATE_KEY not set");

  const header = Buffer.from(
    JSON.stringify({ alg: "RS256", typ: "JWT" }),
  ).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signingInput = `${header}.${body}`;

  const sign = createSign("RSA-SHA256");
  sign.update(signingInput);
  return `${signingInput}.${sign.sign(rawKey, "base64url")}`;
}

async function getInstallationToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const jwt = signJWT({ iat: now - 60, exp: now + 540, iss: GITHUB_APP_ID });

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
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed ${res.status}: ${text}`);
  }
  const data = (await res.json()) as { token: string };
  return data.token;
}

// ── PR data fetching ──────────────────────────────────────────────────────────

async function fetchPRsForRange(
  token: string,
  sinceDate: string,
): Promise<GridData> {
  const grid: GridData = {};

  async function fetchForAuthor(
    authorQuery: string,
    field: keyof DayData,
  ): Promise<void> {
    let cursor: string | null = null;
    let hasMore = true;

    while (hasMore) {
      const after = cursor ? `, after: "${cursor}"` : "";
      const query = `{
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

      const res = await fetch(GITHUB_GRAPHQL_URL, {
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

// ── Vercel Blob persistence ───────────────────────────────────────────────────

async function loadHistoricalFromBlob(): Promise<void> {
  if (blobLoaded || !process.env.BLOB_READ_WRITE_TOKEN) {
    return; // already tried, or Blob not available
  }
  blobLoaded = true;

  try {
    const blobs = await list({ prefix: BLOB_CACHE_KEY });
    if (!blobs.blobs.length) return; // no cache file yet

    const blob = blobs.blobs[0];
    const response = await fetch(blob.url);
    if (!response.ok) return;

    const cached = (await response.json()) as Record<string, DayData>;
    for (const [day, data] of Object.entries(cached)) {
      historicalCache.set(day, data);
    }
    console.log(
      `[github-stats] loaded ${historicalCache.size} cached days from Blob`,
    );
  } catch (err) {
    // Graceful fallback: Blob unavailable, just continue with in-process cache
    console.warn("[github-stats] failed to load from Blob:", err);
  }
}

async function saveHistoricalToBlob(): Promise<void> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return; // Blob not configured yet
  }

  if (historicalCache.size === 0) {
    return; // nothing to save
  }

  try {
    const cached = Object.fromEntries(historicalCache);
    await put(BLOB_CACHE_KEY, JSON.stringify(cached), {
      contentType: "application/json",
    });
    console.log(
      `[github-stats] persisted ${historicalCache.size} cached days to Blob`,
    );
  } catch (err) {
    // Graceful fallback: Blob write failed, but in-process cache is intact
    console.warn("[github-stats] failed to save to Blob:", err);
  }
}

async function getMergedPRGrid(): Promise<GridData> {
  const todayStr = today();
  const now = Date.now();

  // On cold start, try to load historical cache from Blob (only once per instance)
  if (historicalCache.size === 0 && !blobLoaded) {
    await loadHistoricalFromBlob();
  }

  // Is recent cache still fresh?
  const recentFresh =
    recentCache && now - recentCache.fetchedAt < RECENT_TTL_MS;

  if (historicalCache.size > 0 && recentFresh) {
    // Serve everything from cache
    return {
      ...Object.fromEntries(historicalCache),
      ...recentCache!.data,
    };
  }

  // Need to (re)fetch. Determine the right range:
  // - Cold start: fetch full year
  // - Warm / recent stale: only fetch last 8 days (keeps historical cache intact)
  const isWarm = historicalCache.size > 0;
  const since = new Date();
  if (isWarm) {
    since.setDate(since.getDate() - 8);
  } else {
    since.setFullYear(since.getFullYear() - 1);
  }
  const sinceDate = since.toISOString().slice(0, 10);

  let token: string;
  try {
    token = await getInstallationToken();
  } catch (err) {
    console.error("[github-stats] token error:", err);
    // Return whatever we have cached rather than empty grid
    return {
      ...Object.fromEntries(historicalCache),
      ...(recentCache?.data ?? {}),
    };
  }

  const fresh = await fetchPRsForRange(token, sinceDate);

  // Persist completed days to historical cache
  for (const [day, data] of Object.entries(fresh)) {
    if (day < todayStr) {
      historicalCache.set(day, data);
    }
  }

  // Save historical cache to Blob (in background; don't wait for it)
  saveHistoricalToBlob().catch(() => {
    // already logged in saveHistoricalToBlob
  });

  // Cache recent window (today + any days fetched this run)
  const recentData: GridData = {};
  for (const [day, data] of Object.entries(fresh)) {
    if (day >= todayStr) recentData[day] = data;
  }
  recentCache = { fetchedAt: now, data: recentData };

  return {
    ...Object.fromEntries(historicalCache),
    ...recentData,
  };
}

// ── SVG rendering ─────────────────────────────────────────────────────────────

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
  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);

  const start = new Date(todayDate);
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
      if (d > todayDate) continue;

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

// ── Handler ───────────────────────────────────────────────────────────────────

export async function GET() {
  const grid = await getMergedPRGrid();
  const svg = generateSVG(grid);

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
