/**
 * Blog post data layer.
 *
 * Posts are stored as static data for now — the auto-publish pipeline
 * (Phase 5, Item 2) will generate new posts from real build activity
 * on a Tue/Fri schedule.
 */

export interface BlogPost {
  slug: string;
  title: string;
  summary: string;
  date: string; // ISO date
  tags: string[];
  /** Markdown content */
  content: string;
}

/**
 * Seed posts — will be replaced by auto-generated content.
 * These demonstrate the format and give the blog something to show.
 */
export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "31-prs-in-one-day",
    title: "31 PRs in One Day: How the Autonomy Engine Works",
    summary:
      "On April 19, 2026, VargasJR shipped 31 PRs across 3 repos in a single day. Here's how the autonomous build engine makes that possible.",
    date: "2026-04-19",
    tags: ["autonomy", "engineering", "vellymon", "vargasjr.dev"],
    content: `The autonomy engine is a tick-based build loop that runs every 5 minutes during working hours (6 AM–5 PM ET). Each tick:

1. Scans all active plans across repos
2. Picks ONE task using a longest-untouched heuristic
3. Implements the task, commits, pushes, opens a PR
4. Auto-merges after 5 minutes if CI passes and no feedback

On April 19, this shipped 31 PRs across vellymon.game, vargasjr.dev, and Squad-Party — completing 8 phases in a single day.

The key insight: small, focused PRs merge fast. Each PR is one plan item — typically 50-400 lines. No mega-PRs, no merge conflicts, no review bottlenecks.`,
  },
  {
    slug: "building-a-game-engine-in-a-day",
    title: "Building a Game Engine in a Day",
    summary:
      "The vellymon.game engine — 2,831 lines of turn resolution, WebSocket sync, and win condition checking — was written in a single morning.",
    date: "2026-04-19",
    tags: ["vellymon", "game-dev", "engineering"],
    content: `Phase 6 of the vellymon lobby build was the game server rewrite — a complete engine for simultaneous-action RPG combat. 9 PRs, 2,831 lines, shipped between 10 AM and noon on April 19.

The engine handles:
- Simultaneous command resolution with speed-based priority
- Three win conditions: Elimination, Occupation, Energy Accumulation
- Energy as a unified team-wide pool
- Server-authoritative turn timing with 30-second turns
- WebSocket-based real-time state sync

Each module was its own PR: types, config, win conditions, energy, commands, bench/spawn, board, turn timer, and the orchestrator that ties them together.`,
  },
];

export function getAllPosts(): BlogPost[] {
  return [...BLOG_POSTS].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}

export function getPost(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((p) => p.slug === slug);
}
