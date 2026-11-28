import type { Metadata } from "next";
import type { ReactNode } from "react";
import { publicEnv } from "@/lib/env";
import { NotConfigured } from "@/components/NotConfigured";
import { Providers } from "@/components/Providers";
import { ThemeSync } from "@/components/ThemeSync";
import { getMyProfile } from "@/lib/room/server";
import { NewsProvider } from "@/design/Selvedge";
import { tickerNews } from "@/lib/engage/ticker.server";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AppLayout({ children }: { children: ReactNode }) {
  if (!publicEnv()) return <NotConfigured />;
  const [profile, news] = await Promise.all([getMyProfile(), tickerNews()]);
  return (
    <Providers>
      <ThemeSync account={profile?.theme ?? null} />
      {/* The strip under each page's title carries the admin's news inside the app. */}
      <NewsProvider news={news}>
        <div className="relative z-[1] min-h-dvh">{children}</div>
      </NewsProvider>
    </Providers>
  );
}