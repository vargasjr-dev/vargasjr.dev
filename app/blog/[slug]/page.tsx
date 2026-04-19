import Link from "next/link";
import { notFound } from "next/navigation";
import { BLOG_POSTS, getPost } from "~/lib/blog";

export function generateStaticParams() {
  return BLOG_POSTS.map((p) => ({ slug: p.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }) {
  const post = getPost(params.slug);
  if (!post) return { title: "Not Found" };
  return {
    title: `${post.title} — VargasJR`,
    description: post.summary,
  };
}

export default function BlogPostPage({
  params,
}: {
  params: { slug: string };
}) {
  const post = getPost(params.slug);
  if (!post) notFound();

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
        <article className="prose prose-invert prose-gray max-w-none">
          {post.content.split("\n\n").map((paragraph, i) => (
            <p key={i} className="text-gray-300 leading-relaxed mb-4">
              {paragraph}
            </p>
          ))}
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
