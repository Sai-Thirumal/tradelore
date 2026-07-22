import type { MetadataRoute } from "next";
import { seoPages, siteUrl } from "./(seo)/seo-pages";

const publicRoutes = ["", ...seoPages.map((page) => `/${page.slug}`)];

export default function sitemap(): MetadataRoute.Sitemap {
  return publicRoutes.map((route) => ({
    url: `${siteUrl}${route}`,
    lastModified: new Date("2026-07-22"),
  }));
}
