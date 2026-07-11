import type { MetadataRoute } from "next";

const siteUrl = "https://www.tradelore.co.in";

const publicRoutes = [""];

export default function sitemap(): MetadataRoute.Sitemap {
  return publicRoutes.map((route) => ({
    url: `${siteUrl}${route}`,
  }));
}
