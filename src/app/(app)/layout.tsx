import type { Metadata } from "next";
import type { ReactNode } from "react";
import { publicEnv } from "@/lib/env";
import { NotConfigured } from "@/components/NotConfigured";
import { Providers } from "@/components/Providers";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AppLayout({ children }: { children: ReactNode }) {
  if (!publicEnv()) return <NotConfigured />;
  return (
    <Providers>
      <div className="relative z-[1] min-h-dvh">{children}</div>
    </Providers>
  );
}