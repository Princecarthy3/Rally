import type { MetadataRoute } from "next";

const siteUrl = "https://rallygames.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: siteUrl,
      lastModified: new Date(),
    },
    {
      url: `${siteUrl}/games`,
      lastModified: new Date(),
    },
    {
      url: `${siteUrl}/about`,
      lastModified: new Date(),
    },
    {
      url: `${siteUrl}/privacy`,
      lastModified: new Date(),
    },
    {
      url: `${siteUrl}/terms`,
      lastModified: new Date(),
    },
    {
      url: `${siteUrl}/community-guidelines`,
      lastModified: new Date(),
    },
    {
      url: `${siteUrl}/games`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${siteUrl}/games/emoji-decode`,
    },
    {
      url: `${siteUrl}/games/sudoku-battle`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${siteUrl}/games/mancala`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
  ];
}
