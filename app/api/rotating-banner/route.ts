/**
 * GET /api/rotating-banner
 *
 * Returns a self-hosted animated SVG that rotates through three phrases
 * for use on the dvargasfuertes GitHub profile README.
 *
 * Animation: each phrase fades in, holds, then fades out. Full cycle: 9s
 * (3s per phrase). Uses SMIL rather than CSS animations so the rotation
 * works anywhere SVG images render (GitHub serves the file in <img>).
 *
 * Static fallback: renderers without SMIL show only the first phrase —
 * the later phrases carry opacity="0" so they never clobber each other
 * the way they did when rotation relied on CSS animation-delay.
 *
 * Brand colors: #3ba4dc (sky blue primary)
 */

const PHRASES = [
  "Evangelist of Personal Intelligence",
  "Open Source Maximalist",
  "Tinkerer of Games",
];

export async function GET() {
  const width = 620;
  const height = 70;
  const cycleSeconds = 9;
  const phaseSeconds = cycleSeconds / PHRASES.length; // 3s each

  // Each phrase is visible for the first third of its 9s cycle. keyTimes are
  // fractions of the full cycle; trailing zeros hold the phrase hidden for
  // the rest of the rotation.
  const keyTimes = [0, 0.11, 0.22, 0.33, 1].join(";");
  const values = "0;1;1;0;0";

  const texts = PHRASES.map((phrase, i) => {
    const delay = i * phaseSeconds;
    // Only the first phrase is visible in static renderers (no SMIL); the
    // rest stay hidden until their animation begins.
    const staticOpacity = i === 0 ? 1 : 0;
    return `  <text opacity="${staticOpacity}" x="${width / 2}" y="${height / 2 + 12}">
    <animate attributeName="opacity" begin="${delay}s" dur="${cycleSeconds}s" repeatCount="indefinite" values="${values}" keyTimes="${keyTimes}" />
    ${phrase}
  </text>`;
  }).join("\n");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <style>
      text {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
        font-size: 30px;
        font-weight: 700;
        fill: #3ba4dc;
        text-anchor: middle;
      }
    </style>
  </defs>
${texts}
</svg>`;

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}
