import type { Metadata } from "next";
import type { ReactNode } from "react";
import { requireAdminPage } from "@/lib/admin/server";
import { AdminNav } from "@/components/admin/AdminNav";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin" };

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdminPage();
  return (
    <>
      <AdminNav />
      <main className="mx-auto max-w-6xl px-4 pb-24 pt-8 sm:px-8">{children}</main>
    </>
  );
}
