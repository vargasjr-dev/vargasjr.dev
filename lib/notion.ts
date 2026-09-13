/**
 * Resolve a Notion page into Markdown at request time.
 *
 * Blog posts store `notion: <page-id>` in their frontmatter instead of a
 * content body; this module fetches the page's blocks from the Notion API
 * and converts them to Markdown for the blog renderer.
 *
 * The fetch is cached (revalidate) so Vercel's CDN serves it — Notion is
 * only hit once per revalidation window per page.
 */

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";
/** How long a resolved page is cached before re-fetching. */
export const NOTION_REVALIDATE_SECONDS = 3600;

interface RichText {
  type?: string;
  plain_text: string;
  href?: string | null;
  annotations?: {
    bold?: boolean;
    italic?: boolean;
    code?: boolean;
    strikethrough?: boolean;
  };
}

interface NotionBlock {
  type: string;
  has_children: boolean;
  id: string;
  // block objects are keyed by their type
  [key: string]: unknown;
}

function apiKey(): string {
  const key = process.env.NOTION_API_KEY;
  if (!key) throw new Error("NOTION_API_KEY is not set");
  return key;
}

interface NotionListResponse {
  results: NotionBlock[];
  has_more: boolean;
  next_cursor?: string;
}

interface NotionQueryResponse {
  results: unknown[];
  has_more: boolean;
  next_cursor?: string;
}

async function notionFetch(
  path: string,
  revalidate: number,
): Promise<NotionListResponse> {
  const res = await fetch(`${NOTION_API}${path}`, {
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Notion-Version": NOTION_VERSION,
    },
    next: { revalidate },
  });
  if (!res.ok) {
    throw new Error(`notion api ${path} failed: ${res.status}`);
  }
  return res.json();
}

/** Query a Notion database with a JSON filter body (not cached —
 *  status changes in Notion show up immediately). */
export async function queryNotionDatabase(
  databaseId: string,
  body: Record<string, unknown>,
): Promise<unknown[]> {
  const res = await fetch(`${NOTION_API}/databases/${databaseId}/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body ?? {}),
    // POST fetches aren't cached by Next anyway — be explicit so status
    // flips in Notion show up immediately
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`notion database query failed: ${res.status}`);
  }
  const data = (await res.json()) as NotionQueryResponse;
  return data.results ?? [];
}

function richTextToMarkdown(rich: RichText[]): string {
  return rich
    .map((r) => {
      let text = r.plain_text;
      if (!text) return "";
      const a = r.annotations ?? {};
      if (a.code) text = `\`${text}\``;
      if (a.bold) text = `**${text}**`;
      if (a.italic) text = `*${text}*`;
      if (a.strikethrough) text = `~~${text}~~`;
      if (r.href) text = `[${text}](${r.href})`;
      return text;
    })
    .join("");
}

async function blockToMarkdown(
  block: NotionBlock,
  depth: number,
): Promise<string> {
  const t = block.type;
  const body = block[t] as
    | {
        rich_text?: RichText[];
        language?: string;
        url?: string;
        caption?: RichText[];
      }
    | undefined;
  const text = richTextToMarkdown(body?.rich_text ?? []);
  const indent = "  ".repeat(depth);

  switch (t) {
    case "paragraph":
      return text;
    case "heading_1":
      return `# ${text}`;
    case "heading_2":
      return `## ${text}`;
    case "heading_3":
      return `### ${text}`;
    case "bulleted_list_item":
      return `${indent}- ${text}`;
    case "numbered_list_item":
      return `${indent}1. ${text}`;
    case "quote":
      return `> ${text}`;
    case "code":
      return `\`\`\`${body?.language ?? ""}\n${text}\n\`\`\``;
    case "divider":
      return `---`;
    case "image": {
      const url = (body as { url?: string })?.url ?? "";
      return `![${richTextToMarkdown(body?.caption ?? [])}](${url})`;
    }
    case "bookmark":
    case "embed": {
      const url = (block[t] as { url?: string })?.url ?? "";
      return `[${url}](${url})`;
    }
    // callouts/toggles render their text; unknown block types degrade to text
    case "callout":
    case "toggle":
      return text;
    default:
      return text;
  }
}

/** Resolve a Notion page (by page id) into a Markdown string. */
export async function resolveNotionPage(
  pageId: string,
  revalidate = NOTION_REVALIDATE_SECONDS,
): Promise<string> {
  const out: string[] = [];
  let cursor: string | undefined;
  let numberedIndex = 0;
  let prevType = "";

  do {
    const data = await notionFetch(
      `/blocks/${pageId}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ""}`,
      revalidate,
    );
    for (const block of data.results as NotionBlock[]) {
      // restart numbering when a numbered list is interrupted
      if (
        block.type === "numbered_list_item" &&
        prevType !== "numbered_list_item"
      ) {
        numberedIndex = 0;
      }
      prevType = block.type;

      let md = await blockToMarkdown(block, 0);
      if (block.type === "numbered_list_item") {
        numberedIndex += 1;
        md = md.replace(/^(\s*)1\./, `$1${numberedIndex}.`);
      }
      if (md) out.push(md);

      if (block.has_children) {
        out.push(await resolveNotionChildren(block.id, 1, revalidate));
      }
    }
    cursor = data.has_more ? (data.next_cursor as string) : undefined;
  } while (cursor);

  return out.join("\n\n");
}

async function resolveNotionChildren(
  blockId: string,
  depth: number,
  revalidate: number,
): Promise<string> {
  const out: string[] = [];
  let cursor: string | undefined;
  do {
    const data = await notionFetch(
      `/blocks/${blockId}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ""}`,
      revalidate,
    );
    for (const block of data.results as NotionBlock[]) {
      const md = await blockToMarkdown(block, depth);
      if (md) out.push(md);
      if (block.has_children) {
        out.push(await resolveNotionChildren(block.id, depth + 1, revalidate));
      }
    }
    cursor = data.has_more ? (data.next_cursor as string) : undefined;
  } while (cursor);
  return out.join("\n\n");
}
