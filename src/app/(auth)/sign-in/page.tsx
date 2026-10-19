import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/design/Logo";
import { publicEnv } from "@/lib/env";
import { safeNext } from "@/lib/safeNext";
import { getUser } from "@/lib/room/server";
import { SignInForm } from "./SignInForm";
import { NotConfigured } from "@/components/NotConfigured";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default async function SignIn({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  if (!publicEnv()) return <NotConfigured />;
  const user = await getUser();
  if (user) redirect(next);

  const creating = sp.intent === "create";
  const joining = next.startsWith("/join/");

  return (
    <div className="relative z-[1] mx-auto flex min-h-dvh max-w-6xl flex-col px-4 py-5 sm:px-8">
      <Link href="/" className="self-start rounded-md">
        <Logo />
      </Link>
      <div className="grid flex-1 items-center gap-16 py-12 lg:grid-cols-2">
        <div className="max-w-md">
          <p className="eyebrow text-accent-ink">{joining ? "You've been invited" : creating ? "New room" : "Welcome back"}</p>
          <h1 className="display mt-4 text-[clamp(2.8rem,8vw,4.6rem)]">
            {joining ? "Someone saved you a seat." : creating ? "Let's get you a room." : "Pull up a chair."}
          </h1>
          <p className="mt-5 text-[1.05rem] leading-relaxed text-muted">
            No passwords. We&apos;ll email you a link, or you can use Google. Your partner signs in on their own phone.
          </p>
        </div>
        <div className="w-full max-w-md lg:justify-self-end">
          <SignInForm next={next} linkError={sp.error === "link"} />
        </div>
      </div>
    </div>
  );
}