import type { MetadataRoute } from "next";
import { getAllPosts } from "@/lib/blog";
import { PROJECTS } from "@/lib/projects";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = getAllPosts();

  const staticPages: MetadataRoute.Sitemap = [
    { url: "https://vargasjr.dev", lastModified: new Date(), priority: 1.0 },
    {
      url: "https://vargasjr.dev/about",
      lastModified: new Date(),
      priority: 0.8,
    },
    {
      url: "https://vargasjr.dev/projects",
      lastModified: new Date(),
      priority: 0.8,
    },
    {
      url: "https://vargasjr.dev/blog",
      lastModified: new Date(),
      priority: 0.9,
    },
  ];

  const projectPages: MetadataRoute.Sitemap = PROJECTS.map((p) => ({
    url: `https://vargasjr.dev/projects/${p.slug}`,
    lastModified: new Date(),
    priority: 0.7,
  }));

  const blogPages: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `https://vargasjr.dev/blog/${post.slug}`,
    lastModified: post.date,
    priority: 0.6,
  }));

  return [...staticPages, ...projectPages, ...blogPages];
}
