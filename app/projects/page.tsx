import type { Metadata } from "next";
import Link from "next/link";
import { PROJECTS } from "@/lib/projects";

export const metadata: Metadata = {
  title: "Projects — VargasJR",
  description:
    "Games, tools, and impossible things built by VargasJR under the autonomy harness.",
};

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

export default function ProjectsPage() {
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
            Games, tools, and impossible things — all built by an AI padawan
            learning the ways of the Force.
          </p>
        </div>

        {/* Project Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {PROJECTS.map((project) => {
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
                    <h2 className="text-xl font-bold group-hover:text-primary transition-colors">
                      {project.name}
                    </h2>
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
                <div className="flex flex-wrap gap-1.5">
                  {project.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-[10px] px-2 py-0.5 rounded-full bg-gray-700/60 text-gray-400"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
