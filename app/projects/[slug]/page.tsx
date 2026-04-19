import Link from "next/link";
import { notFound } from "next/navigation";
import { PROJECTS, getProject } from "@/lib/projects";

export function generateStaticParams() {
  return PROJECTS.map((p) => ({ slug: p.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }) {
  const project = getProject(params.slug);
  if (!project) return { title: "Not Found" };
  return {
    title: `${project.name} — VargasJR`,
    description: project.tagline,
  };
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  live: {
    label: "Live",
    className: "bg-green-500/20 text-green-400 border-green-500/30",
  },
  "in-progress": {
    label: "In Progress",
    className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  },
  parked: {
    label: "Parked",
    className: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  },
};

export default function ProjectDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  const project = getProject(params.slug);
  if (!project) notFound();

  const badge = STATUS_BADGE[project.status];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 text-white">
      <div className="max-w-3xl mx-auto px-6 py-16">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-8">
          <Link href="/" className="hover:text-primary transition-colors">
            Home
          </Link>
          <span>/</span>
          <Link
            href="/projects"
            className="hover:text-primary transition-colors"
          >
            Projects
          </Link>
          <span>/</span>
          <span className="text-gray-400">{project.name}</span>
        </div>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <span className="text-5xl">{project.emoji}</span>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-4xl font-bold">{project.name}</h1>
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-full border ${badge.className}`}
                >
                  {badge.label}
                </span>
              </div>
              <p className="text-gray-400 mt-1">{project.tagline}</p>
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-6 mb-8">
          <h2 className="text-lg font-semibold mb-3">About</h2>
          <p className="text-gray-300 leading-relaxed">{project.description}</p>
        </div>

        {/* Tech Stack */}
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-6 mb-8">
          <h2 className="text-lg font-semibold mb-3">Tech Stack</h2>
          <div className="flex flex-wrap gap-2">
            {project.tags.map((tag) => (
              <span
                key={tag}
                className="text-sm px-3 py-1 rounded-full bg-gray-700/60 text-gray-300"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Links */}
        <div className="flex flex-wrap gap-4">
          {project.url && (
            <a
              href={project.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-primary/20 text-primary border border-primary/30 px-5 py-2.5 rounded-lg hover:bg-primary/30 transition"
            >
              <span>🌐</span> Visit Site
            </a>
          )}
          {project.repo && (
            <a
              href={project.repo}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-gray-800 text-gray-300 border border-gray-700 px-5 py-2.5 rounded-lg hover:border-gray-600 transition"
            >
              <span>📦</span> Source Code
            </a>
          )}
        </div>

        {/* Back */}
        <div className="mt-12 pt-8 border-t border-gray-800">
          <Link
            href="/projects"
            className="text-sm text-gray-500 hover:text-primary transition-colors"
          >
            ← All Projects
          </Link>
        </div>
      </div>
    </div>
  );
}
