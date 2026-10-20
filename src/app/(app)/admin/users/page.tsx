import { UserTools } from "@/components/admin/UserTools";

export default function AdminUsers() {
  return (
    <div className="max-w-2xl">
      <h1 className="display text-[2.6rem] leading-none">Users</h1>
      <p className="mt-2 text-[0.9rem] text-muted">
        Look someone up by their exact email to help with support or deal with abuse. You see account facts only, never what they&apos;ve written or shared.
      </p>
      <UserTools />
    </div>
  );
}
