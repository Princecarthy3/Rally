import type { MetadataRoute } from "next";

const siteUrl = "https://rallygames.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/auth/",
          "/dashboard/",
          "/friends/",
          "/history/",
          "/leaderboard/",
          "/messages/",
          "/profile/",
          "/room/",
          "/shop/",
        ],
      },
    ],

    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
