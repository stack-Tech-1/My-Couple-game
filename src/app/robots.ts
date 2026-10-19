import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: ["/", "/terms", "/privacy", "/adults"], disallow: ["/room", "/onboarding", "/account", "/join", "/sign-in", "/auth", "/api"] }],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}