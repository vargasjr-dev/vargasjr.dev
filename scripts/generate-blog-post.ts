#!/usr/bin/env npx tsx
/**
 * Auto-Blog Generator
 *
 * Fetches recent merged PRs across all vargasjr-dev repos,
 * summarizes the activity, and writes a Markdown blog post
 * to data/blog/.
 *
 * Designed to run on a Tue/Fri schedule via GitHub Actions.
 *
 * Usage:
 *   GITHUB_TOKEN=... npx tsx scripts/generate-blog-post.ts
 *
 * Environment:
 *   GITHUB_TOKEN — GitHub token with repo read access
 *   DAYS_BACK    — How many days of activity to include (default: 3)
 */

import fs from "fs";
import path from "path";

const GITHUB_API = "https://api.github.com";
const ORG = "vargasjr-dev";
const REPOS = ["vellymon.game", "vargasjr.dev", "Squad-Party", "personal-os"];
const BLOG_DIR = path.join(process.cwd(), "data", "blog");

interface MergedPR {
  repo: string;
  number: number;
  title: string;
  merged_at: string;
  additions: number;
  deletions: number;
}

async function fetchMergedPRs(repo: string, since: Date): Promise<MergedPR[]> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN is required");

  const headers: Record<string, string> = {
    Authorization: `token ${token}`,
    Accept: "application/vnd.github+json",
  };

  // Fetch recently closed PRs (merged ones)
  const url = `${GITHUB_API}/repos/${ORG}/${repo}/pulls?state=closed&sort=updated&direction=desc&per_page=50`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    console.warn(`[warn] Failed to fetch ${repo} PRs: ${res.status}`);
    return [];
  }

  const prs = (await res.json()) as Array<{
    number: number;
    title: string;
    merged_at: string | null;
    additions: number;
    deletions: number;
  }>;

  return prs
    .filter((pr) => pr.merged_at && new Date(pr.merged_at) >= since)
    .map((pr) => ({
      repo,
      number: pr.number,
      title: pr.title,
      merged_at: pr.merged_at!,
      additions: pr.additions || 0,
      deletions: pr.deletions || 0,
    }));
}

function generateSlug(date: Date): string {
  const iso = date.toISOString().split("T")[0];
  const day = date
    .toLocaleDateString("en-US", { weekday: "long" })
    .toLowerCase();
  return `${iso}-${day}-build-log`;
}

function generatePost(prs: MergedPR[], since: Date, now: Date): string {
  const dateStr = now.toISOString().split("T")[0];
  const sinceStr = since.toISOString().split("T")[0];

  // Group by repo
  const byRepo = new Map<string, MergedPR[]>();
  for (const pr of prs) {
    const list = byRepo.get(pr.repo) || [];
    list.push(pr);
    byRepo.set(pr.repo, list);
  }

  // Stats
  const totalPRs = prs.length;
  const totalAdditions = prs.reduce((sum, pr) => sum + pr.additions, 0);
  const totalDeletions = prs.reduce((sum, pr) => sum + pr.deletions, 0);
  const activeRepos = byRepo.size;

  // Tags from repo names
  const tags = Array.from(byRepo.keys()).map((r) =>
    r.replace(/\./g, "-").toLowerCase(),
  );
  tags.unshift("build-log");

  // Frontmatter
  const frontmatter = [
    "---",
    `title: "Build Log: ${totalPRs} PRs across ${activeRepos} repos"`,
    `date: "${dateStr}"`,
    `tags: ${JSON.stringify(tags)}`,
    `summary: "${totalPRs} PRs merged across ${activeRepos} repos since ${sinceStr}. ${totalAdditions.toLocaleString()} lines added, ${totalDeletions.toLocaleString()} removed."`,
    "---",
  ].join("\n");

  // Body
  const sections: string[] = [];

  for (const [repo, repoPrs] of byRepo) {
    const sorted = repoPrs.sort(
      (a, b) =>
        new Date(a.merged_at).getTime() - new Date(b.merged_at).getTime(),
    );

    sections.push(`## ${repo}\n`);
    sections.push(`${sorted.length} PRs merged:\n`);

    for (const pr of sorted) {
      const net = pr.additions - pr.deletions;
      const sign = net >= 0 ? "+" : "";
      sections.push(`- **#${pr.number}** ${pr.title} (${sign}${net} lines)`);
    }

    sections.push("");
  }

  // Summary footer
  sections.push("---\n");
  sections.push(
    `*Generated automatically from ${totalPRs} merged PRs between ${sinceStr} and ${dateStr}.*`,
  );

  return `${frontmatter}\n\n${sections.join("\n")}\n`;
}

async function main() {
  const daysBack = parseInt(process.env.DAYS_BACK || "3", 10);
  const now = new Date();
  const since = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);

  console.log(
    `[blog] Fetching PRs since ${since.toISOString()} across ${REPOS.length} repos...`,
  );

  const allPRs: MergedPR[] = [];
  for (const repo of REPOS) {
    const prs = await fetchMergedPRs(repo, since);
    allPRs.push(...prs);
    console.log(`  ${repo}: ${prs.length} merged PRs`);
  }

  if (allPRs.length === 0) {
    console.log("[blog] No PRs found in the window. Skipping post generation.");
    process.exit(0);
  }

  const slug = generateSlug(now);
  const content = generatePost(allPRs, since, now);
  const filePath = path.join(BLOG_DIR, `${slug}.md`);

  // Don't overwrite existing posts
  if (fs.existsSync(filePath)) {
    console.log(`[blog] Post already exists: ${slug}.md — skipping.`);
    process.exit(0);
  }

  fs.mkdirSync(BLOG_DIR, { recursive: true });
  fs.writeFileSync(filePath, content);
  console.log(`[blog] ✅ Generated: ${slug}.md (${allPRs.length} PRs)`);
}

main().catch((err) => {
  console.error("[blog] Fatal:", err);
  process.exit(1);
});
