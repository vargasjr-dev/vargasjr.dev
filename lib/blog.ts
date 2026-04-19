/**
 * Blog post data layer — file-based storage.
 *
 * Posts live as Markdown files in data/blog/ with YAML frontmatter.
 * The auto-publish pipeline (Phase 5, Item 2) will generate new .md
 * files from real build activity on a Tue/Fri schedule.
 *
 * Frontmatter schema:
 *   title: string
 *   date: string (ISO date, e.g. "2026-04-19")
 *   tags: string[]
 *   summary: string
 */

import fs from "fs";
import path from "path";
import matter from "gray-matter";

const BLOG_DIR = path.join(process.cwd(), "data", "blog");

export interface BlogPost {
  slug: string;
  title: string;
  summary: string;
  date: string;
  tags: string[];
  /** Raw Markdown content (no frontmatter) */
  content: string;
}

/**
 * Parse a single .md file into a BlogPost.
 * Returns null if the file is malformed or missing required fields.
 */
function parsePost(filename: string): BlogPost | null {
  try {
    const filePath = path.join(BLOG_DIR, filename);
    const raw = fs.readFileSync(filePath, "utf-8");
    const { data, content } = matter(raw);

    if (!data.title || !data.date || !data.summary) {
      console.warn(`[blog] Skipping ${filename}: missing required frontmatter`);
      return null;
    }

    return {
      slug: filename.replace(/\.md$/, ""),
      title: data.title,
      summary: data.summary,
      date: data.date,
      tags: Array.isArray(data.tags) ? data.tags : [],
      content: content.trim(),
    };
  } catch (err) {
    console.warn(`[blog] Failed to parse ${filename}:`, err);
    return null;
  }
}

/**
 * Get all blog posts, sorted newest-first.
 * Reads from data/blog/*.md at request time (no caching — Next.js
 * handles this via its own caching layer in production).
 */
export function getAllPosts(): BlogPost[] {
  if (!fs.existsSync(BLOG_DIR)) return [];

  const files = fs
    .readdirSync(BLOG_DIR)
    .filter((f) => f.endsWith(".md"))
    .sort();

  const posts = files.map(parsePost).filter((p): p is BlogPost => p !== null);

  return posts.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
}

/**
 * Get a single post by slug.
 */
export function getPost(slug: string): BlogPost | undefined {
  const filename = `${slug}.md`;
  const filePath = path.join(BLOG_DIR, filename);

  if (!fs.existsSync(filePath)) return undefined;

  return parsePost(filename) ?? undefined;
}

/**
 * Get all unique tags across all posts, sorted alphabetically.
 */
export function getAllTags(): string[] {
  const posts = getAllPosts();
  const tags = new Set<string>();
  for (const post of posts) {
    for (const tag of post.tags) {
      tags.add(tag);
    }
  }
  return [...tags].sort();
}
