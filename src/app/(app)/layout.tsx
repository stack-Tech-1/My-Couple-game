import type { Metadata } from "next";
import type { ReactNode } from "react";
import { publicEnv } from "@/lib/env";
import { NotConfigured } from "@/components/NotConfigured";
import { Providers } from "@/components/Providers";
import { ThemeSync } from "@/components/ThemeSync";
import { getMyProfile } from "@/lib/room/server";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AppLayout({ children }: { children: ReactNode }) {
  if (!publicEnv()) return <NotConfigured />;
  const profile = await getMyProfile();
  return (
    <Providers>
      <ThemeSync account={profile?.theme ?? null} />
      <div className="relative z-[1] min-h-dvh">{children}</div>
    </Providers>
  );
}