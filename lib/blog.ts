/**
 * Blog post data layer — Notion-backed.
 *
 * All posts live in the "Blog Posts" Notion database. Only pages whose
 * Status is "Published" render on the blog. Post bodies are Notion page
 * content, resolved to Markdown at request time (lib/notion.ts) and
 * CDN-cached — there are no markdown files anymore.
 */

import { queryNotionDatabase } from "./notion";

const BLOG_POSTS_DB = "3dafa8e8-a0df-8004-b431-f4f837e3ef6c";

export interface BlogPost {
  slug: string;
  title: string;
  summary: string;
  date: string;
  tags: string[];
  /** Notion page id — content resolves from it at request time */
  notionId: string;
  /** Always empty; content comes from Notion via resolveNotionPage */
  content: string;
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

interface BlogPostsDbPage {
  id: string;
  created_time: string;
  properties: {
    Name?: { title?: { plain_text: string }[] };
  };
}

/**
 * Get all published blog posts, sorted newest-first.
 * Cached via the fetch layer (see queryNotionDatabase).
 */
export async function getAllPosts(): Promise<BlogPost[]> {
  const pages = await queryNotionDatabase(BLOG_POSTS_DB, {
    filter: { property: "Status", status: { equals: "Published" } },
  });

  return (pages as BlogPostsDbPage[])
    .map((page) => {
      const title = (page.properties?.Name?.title ?? [])
        .map((t) => t.plain_text)
        .join("")
        .trim();
      return {
        slug: slugify(title) || page.id,
        title,
        summary: "",
        date: page.created_time,
        tags: [],
        notionId: page.id,
        content: "",
      };
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

/**
 * Get a single published post by slug.
 */
export async function getPost(slug: string): Promise<BlogPost | undefined> {
  return (await getAllPosts()).find((p) => p.slug === slug);
}
