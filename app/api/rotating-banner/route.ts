/**
 * GET /api/rotating-banner
 *
 * Returns a self-hosted animated SVG that rotates through three phrases
 * for use on the dvargasfuertes GitHub profile README.
 *
 * Animation: each phrase slides up and fades in, holds, then slides up
 * and fades out. Full cycle: 9s (3s per phrase).
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

  // pct helpers for keyframe percentages
  const inEnd = ((0.3 / phaseSeconds) * 100).toFixed(1); // ~10%
  const outStart = (((phaseSeconds - 0.3) / phaseSeconds) * 100).toFixed(1); // ~90%

  const texts = PHRASES.map((phrase, i) => {
    const delay = i * phaseSeconds;
    return `  <text class="phrase" style="animation-delay:${delay}s" x="${width / 2}" y="${height / 2 + 12}">${phrase}</text>`;
  }).join("\n");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <style>
      text.phrase {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
        font-size: 30px;
        font-weight: 700;
        fill: #3ba4dc;
        text-anchor: middle;
        opacity: 0;
        animation: cycle ${cycleSeconds}s cubic-bezier(0.4, 0, 0.2, 1) infinite;
      }
      @keyframes cycle {
        0%       { opacity: 0; transform: translateY(16px); }
        ${inEnd}%  { opacity: 1; transform: translateY(0);    }
        ${outStart}% { opacity: 1; transform: translateY(0);    }
        100%     { opacity: 0; transform: translateY(-16px); }
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
