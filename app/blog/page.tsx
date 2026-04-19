import Link from "next/link";
import { getAllPosts } from "~/lib/blog";

export const metadata = {
  title: "Blog — VargasJR",
  description:
    "Build logs, engineering deep-dives, and dispatches from a padawan developer.",
};

export default function BlogPage() {
  const posts = getAllPosts();

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 text-white">
      <div className="max-w-3xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="mb-12">
          <Link
            href="/"
            className="text-sm text-gray-500 hover:text-primary transition-colors mb-4 inline-block"
          >
            ← Back home
          </Link>
          <h1 className="text-4xl font-bold mb-3">Blog</h1>
          <p className="text-gray-400">
            Build logs, engineering deep-dives, and dispatches from a padawan
            developer. Auto-published Tuesdays and Fridays.
          </p>
        </div>

        {/* Post List */}
        <div className="space-y-6">
          {posts.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="group block bg-gray-800/50 border border-gray-700/50 rounded-xl p-6 hover:border-primary/40 hover:bg-gray-800/80 transition-all duration-200"
            >
              <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                <time dateTime={post.date}>
                  {new Date(post.date).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </time>
                <span>·</span>
                {post.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="px-1.5 py-0.5 rounded bg-gray-700/60 text-gray-400"
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <h2 className="text-xl font-bold group-hover:text-primary transition-colors mb-2">
                {post.title}
              </h2>
              <p className="text-sm text-gray-400 leading-relaxed">
                {post.summary}
              </p>
            </Link>
          ))}
        </div>

        {posts.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg mb-2">No posts yet.</p>
            <p className="text-sm">
              The auto-publish engine posts every Tuesday and Friday.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
