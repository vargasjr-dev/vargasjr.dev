/**
 * GET /api/github-stats
 *
 * Returns a GitHub-style contribution grid SVG showing PRs merged per day
 * across the vargasjr-dev org, split between Vargas (@dvargas92495) and
 * VargasJR (app/vargas-jr). Each cell has a <title> tooltip with the
 * per-day breakdown on hover.
 *
 * Requires GITHUB_TOKEN env var (classic PAT, read:user + public_repo).
 * Results are cached for 1 hour.
 */

const GITHUB_GRAPHQL_URL = "https://api.github.com/graphql";

// Brand colors
const COLOR_VARGAS = "#3ba4dc";
const COLOR_VARGASJR = "#fb923c";
const COLOR_BOTH = "#a78bfa"; // purple when both contributed same day
const COLOR_EMPTY = "#161b22";
const COLOR_LIGHT = "#21262d";

type DayData = { vargas: number; vargasJR: number };
type GridData = Record<string, DayData>; // key: "YYYY-MM-DD"

async function fetchMergedPRs(): Promise<GridData> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return {};

  const grid: GridData = {};
  const since = new Date();
  since.setFullYear(since.getFullYear() - 1);
  const sinceISO = since.toISOString();

  // Fetch both authors in parallel — paginate up to 500 PRs each
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
          query: "is:pr is:merged org:vargasjr-dev ${authorQuery} merged:>=${sinceISO.slice(0, 10)}"
          type: ISSUE
          first: 100
          ${after}
        ) {
          pageInfo { hasNextPage endCursor }
          nodes {
            ... on PullRequest { mergedAt }
          }
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
        const day = node.mergedAt.slice(0, 10);
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

function cellColor(d: DayData): string {
  const total = d.vargas + d.vargasJR;
  if (total === 0) return COLOR_LIGHT;
  if (d.vargas > 0 && d.vargasJR > 0) return COLOR_BOTH;
  if (d.vargas > 0) return COLOR_VARGAS;
  return COLOR_VARGASJR;
}

function cellOpacity(d: DayData): number {
  const total = d.vargas + d.vargasJR;
  if (total === 0) return 1;
  if (total <= 2) return 0.5;
  if (total <= 5) return 0.7;
  if (total <= 10) return 0.85;
  return 1;
}

function generateSVG(grid: GridData): string {
  // Build a 52-week × 7-day grid anchored to today
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Start from the Sunday 52 weeks ago
  const start = new Date(today);
  start.setDate(start.getDate() - 52 * 7);
  // rewind to Sunday
  start.setDate(start.getDate() - start.getDay());

  const CELL = 11;
  const GAP = 2;
  const STEP = CELL + GAP;
  const COLS = 53;
  const ROWS = 7;
  const PAD_LEFT = 8;
  const PAD_TOP = 36;

  const W = PAD_LEFT + COLS * STEP + 8;
  const H = PAD_TOP + ROWS * STEP + 8;

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
      const opacity = cellOpacity(data);

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

      // Month label — first cell of a new month
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

  // Legend
  const legendY = H - 6;
  const legendItems = [
    { color: COLOR_VARGAS, label: "Vargas", x: W - 180 },
    { color: COLOR_VARGASJR, label: "VargasJR", x: W - 115 },
    { color: COLOR_BOTH, label: "Both", x: W - 42 },
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
