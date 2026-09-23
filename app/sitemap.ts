import type { MetadataRoute } from "next";
import { getAllPosts } from "@/lib/blog";
import { getAllProjects } from "@/lib/projects";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await getAllPosts();
  const projects = await getAllProjects();

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
    {
      url: "https://vargasjr.dev/sms-consent",
      lastModified: new Date(),
      priority: 0.5,
    },
    {
      url: "https://vargasjr.dev/terms",
      lastModified: new Date(),
      priority: 0.5,
    },
    {
      url: "https://vargasjr.dev/privacy",
      lastModified: new Date(),
      priority: 0.5,
    },
  ];

  const projectPages: MetadataRoute.Sitemap = projects.map((p) => ({
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
