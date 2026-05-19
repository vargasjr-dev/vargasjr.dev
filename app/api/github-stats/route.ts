/**
 * GET /api/github-stats
 *
 * Returns a branded SVG card showing PRs merged split between Vargas
 * (human — @dvargas92495) and VargasJR (bot — app/vargas-jr) across the
 * vargasjr-dev GitHub org.
 *
 * Used directly as an image in the dvargasfuertes GitHub profile README:
 *   ![Stats](https://vargasjr.dev/api/github-stats)
 *
 * Requires GITHUB_TOKEN env var (classic PAT, read:user + public_repo).
 * Results are cached for 1 hour via Cache-Control + Next.js revalidation.
 */

const GITHUB_GRAPHQL_URL = "https://api.github.com/graphql";

// Brand colors (locked May 10, 2026)
const COLOR_VARGAS = "#3ba4dc"; // sky blue
const COLOR_VARGASJR = "#fb923c"; // orange

async function getPRCounts(): Promise<{ vargas: number; vargasJR: number }> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return { vargas: 0, vargasJR: 0 };
  }

  const query = `{
    vargas: search(
      query: "is:pr is:merged org:vargasjr-dev author:dvargas92495"
      type: ISSUE
      first: 0
    ) { issueCount }
    vargasJR: search(
      query: "is:pr is:merged org:vargasjr-dev author:app/vargas-jr"
      type: ISSUE
      first: 0
    ) { issueCount }
  }`;

  try {
    const res = await fetch(GITHUB_GRAPHQL_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
      next: { revalidate: 3600 },
    });

    if (!res.ok) return { vargas: 0, vargasJR: 0 };

    const data = await res.json();
    return {
      vargas: data.data?.vargas?.issueCount ?? 0,
      vargasJR: data.data?.vargasJR?.issueCount ?? 0,
    };
  } catch {
    return { vargas: 0, vargasJR: 0 };
  }
}

function generateSVG(vargas: number, vargasJR: number): string {
  const total = vargas + vargasJR;
  const W = 495;
  const H = 175;
  const BAR_W = 330;
  const BAR_H = 12;
  const BAR_X = 115;
  const COUNT_X = BAR_X + BAR_W + 14;

  const vargasBarW =
    total > 0 ? Math.max(6, Math.round((vargas / total) * BAR_W)) : 0;
  const vargasJRBarW =
    total > 0 ? Math.max(6, Math.round((vargasJR / total) * BAR_W)) : 0;

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <style>
    text { font-family: 'Segoe UI', Ubuntu, 'Helvetica Neue', Sans-Serif; }
    .title { font-size: 16px; font-weight: 600; fill: #e6edf3; }
    .label { font-size: 13px; fill: #8b949e; }
    .count { font-size: 13px; font-weight: 700; }
    .sub   { font-size: 11px; fill: #6e7681; }
  </style>

  <!-- Card -->
  <rect width="${W}" height="${H}" rx="10" fill="#0d1117" stroke="#30363d" stroke-width="1"/>

  <!-- Title -->
  <text x="22" y="34" class="title">⚔️  Vargas + VargasJR — PRs Merged</text>

  <!-- Vargas bar -->
  <text x="22" y="72" class="label">Vargas</text>
  <rect x="${BAR_X}" y="60" width="${BAR_W}" height="${BAR_H}" rx="6" fill="#21262d"/>
  <rect x="${BAR_X}" y="60" width="${vargasBarW}" height="${BAR_H}" rx="6" fill="${COLOR_VARGAS}"/>
  <text x="${COUNT_X}" y="72" class="count" fill="${COLOR_VARGAS}">${vargas.toLocaleString()}</text>

  <!-- VargasJR bar -->
  <text x="22" y="112" class="label">VargasJR</text>
  <rect x="${BAR_X}" y="100" width="${BAR_W}" height="${BAR_H}" rx="6" fill="#21262d"/>
  <rect x="${BAR_X}" y="100" width="${vargasJRBarW}" height="${BAR_H}" rx="6" fill="${COLOR_VARGASJR}"/>
  <text x="${COUNT_X}" y="112" class="count" fill="${COLOR_VARGASJR}">${vargasJR.toLocaleString()}</text>

  <!-- Totals / attribution -->
  <text x="22" y="152" class="sub">${total.toLocaleString()} total PRs merged · vargasjr-dev org</text>
  <text x="${W - 22}" y="152" class="sub" text-anchor="end">vargasjr.dev/api/github-stats</text>
</svg>`;
}

export async function GET() {
  const { vargas, vargasJR } = await getPRCounts();
  const svg = generateSVG(vargas, vargasJR);

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
