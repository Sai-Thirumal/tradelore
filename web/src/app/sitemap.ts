import type { MetadataRoute } from "next";
import { seoPages, siteUrl } from "./(seo)/seo-pages";
import { blogUrl, publishedBlogPosts } from "./blog/blog-posts";

const publicRoutes = ["", ...seoPages.map((page) => `/${page.slug}`), "/blog"];

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    ...publicRoutes.map((route) => ({ url: `${siteUrl}${route}`, lastModified: new Date("2026-07-22") })),
    ...publishedBlogPosts.map((post) => ({ url: blogUrl(post.slug), lastModified: new Date(post.modifiedAt) })),
  ];
}
