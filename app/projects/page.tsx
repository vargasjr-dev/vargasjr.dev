import type { Metadata } from "next";
import Link from "next/link";
import { getAllProjects, LAYERS } from "@/lib/projects";

export const metadata: Metadata = {
  title: "Projects — VargasJR",
  description:
    "Every project in the vargasjr-dev org, sorted into the five layers of the Personal Intelligence Stack: Power, Compute, Models, Harnesses, and Life.",
};

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  live: {
    label: "Live",
    className: "bg-green-500/20 text-green-400 border-green-500/30",
  },
  "in-development": {
    label: "In development",
    className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  },
};

export default async function ProjectsPage() {
  const projects = await getAllProjects();

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 text-white">
      <div className="max-w-5xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="mb-12">
          <Link
            href="/"
            className="text-sm text-gray-500 hover:text-primary transition-colors mb-4 inline-block"
          >
            ← Back home
          </Link>
          <h1 className="text-4xl font-bold mb-3">Projects</h1>
          <p className="text-gray-400 max-w-xl">
            Every project fits one layer of the{" "}
            <Link
              href="/blog/the-personal-intelligence-tech-stack"
              className="text-primary hover:underline"
            >
              Personal Intelligence Stack
            </Link>
            .
          </p>
        </div>

        {/* Layers */}
        <div className="space-y-16">
          {LAYERS.map((layer) => {
            const layerProjects = projects.filter((p) => p.layer === layer.id);
            if (layerProjects.length === 0) return null;
            return (
              <section key={layer.id}>
                {/* Layer header */}
                <div className="mb-6 flex items-baseline justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{layer.emoji}</span>
                    <h2 className="text-2xl font-bold">{layer.label}</h2>
                  </div>
                  <p className="text-gray-400 text-sm whitespace-nowrap">
                    {layer.subtitle}
                  </p>
                </div>

                {/* Project cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pl-0">
                  {layerProjects.map((project) => {
                    const badge = STATUS_BADGE[project.status];
                    return (
                      <Link
                        key={project.slug}
                        href={`/projects/${project.slug}`}
                        className="group block bg-gray-800/50 border border-gray-700/50 rounded-xl p-6 hover:border-primary/40 hover:bg-gray-800/80 transition-all duration-200"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <span className="text-3xl">{project.emoji}</span>
                            <h3 className="text-xl font-bold group-hover:text-primary transition-colors">
                              {project.name}
                            </h3>
                          </div>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full border ${badge.className}`}
                          >
                            {badge.label}
                          </span>
                        </div>
                        <p className="text-sm text-gray-400 mb-4 leading-relaxed">
                          {project.tagline}
                        </p>
                      </Link>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
