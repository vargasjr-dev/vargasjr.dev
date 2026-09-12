import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getAllPosts, getPost } from "@/lib/blog";
import { resolveNotionPage } from "@/lib/notion";

// notion-resolved posts render on demand and are cached by the CDN
// (segment config must be a literal — keep in sync with NOTION_REVALIDATE_SECONDS)
export const revalidate = 3600;

export function generateStaticParams() {
  // posts resolving from Notion are fetched at request time, not build time
  return getAllPosts()
    .filter((p) => !p.notionId)
    .map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return { title: "Not Found" };
  return {
    title: `${post.title} — VargasJR`,
    description: post.summary,
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();
  const content = post.notionId
    ? await resolveNotionPage(post.notionId)
    : post.content;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 text-white">
      <div className="max-w-3xl mx-auto px-6 py-16">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-8">
          <Link href="/" className="hover:text-primary transition-colors">
            Home
          </Link>
          <span>/</span>
          <Link href="/blog" className="hover:text-primary transition-colors">
            Blog
          </Link>
          <span>/</span>
          <span className="text-gray-400 truncate">{post.title}</span>
        </div>

        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
            <time dateTime={post.date}>
              {new Date(post.date).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </time>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">{post.title}</h1>
          <p className="text-lg text-gray-400">{post.summary}</p>
          <div className="flex flex-wrap gap-2 mt-4">
            {post.tags.map((tag) => (
              <span
                key={tag}
                className="text-xs px-2.5 py-1 rounded-full bg-gray-800 text-gray-400 border border-gray-700"
              >
                {tag}
              </span>
            ))}
          </div>
        </header>

        {/* Content */}
        <article className="max-w-none">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h2: (props) => (
                <h2
                  className="text-2xl font-bold text-white mt-10 mb-4"
                  {...props}
                />
              ),
              h3: (props) => (
                <h3
                  className="text-xl font-semibold text-white mt-8 mb-3"
                  {...props}
                />
              ),
              p: (props) => (
                <p className="text-gray-300 leading-relaxed mb-4" {...props} />
              ),
              ul: (props) => (
                <ul
                  className="list-disc list-inside space-y-1 mb-4 text-gray-300"
                  {...props}
                />
              ),
              ol: (props) => (
                <ol
                  className="list-decimal list-inside space-y-1 mb-4 text-gray-300"
                  {...props}
                />
              ),
              a: ({ href, children }) => {
                const internal = href?.startsWith("/");
                return internal ? (
                  <a href={href} className="text-primary hover:underline">
                    {children}
                  </a>
                ) : (
                  <a
                    href={href}
                    className="text-primary hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {children}
                  </a>
                );
              },
              strong: (props) => <strong className="text-white" {...props} />,
              pre: (props) => (
                <pre
                  className="bg-gray-900/80 border border-gray-800 rounded-lg p-4 overflow-x-auto mb-6 text-sm"
                  {...props}
                />
              ),
              code: ({
                className,
                children,
              }: {
                className?: string;
                children?: React.ReactNode;
              }) => (
                <code
                  className={`${
                    className ?? ""
                  } font-mono text-gray-200 text-sm`}
                >
                  {children}
                </code>
              ),
              blockquote: (props) => (
                <blockquote
                  className="border-l-4 border-gray-700 pl-4 italic text-gray-400 mb-4"
                  {...props}
                />
              ),
            }}
          >
            {content}
          </ReactMarkdown>
        </article>

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-gray-800">
          <Link
            href="/blog"
            className="text-sm text-gray-500 hover:text-primary transition-colors"
          >
            ← All Posts
          </Link>
        </div>
      </div>
    </div>
  );
}
