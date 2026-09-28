import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
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
    sitemap: "https://rallygames.vercel.app/sitemap.xml",
  };
}
