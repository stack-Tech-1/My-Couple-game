import type { Metadata } from "next";
import type { ReactNode } from "react";
import { inboxCounts, requireAdminPage } from "@/lib/admin/server";
import { AdminNav } from "@/components/admin/AdminNav";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin" };

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdminPage();
  const c = await inboxCounts();
  return (
    <>
      <AdminNav inbox={c.feedback + c.suggestions + c.reports} />
      <main className="mx-auto max-w-6xl px-4 pb-24 pt-8 sm:px-8">{children}</main>
    </>
  );
}
