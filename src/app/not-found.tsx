import Link from "next/link";
import { Logo } from "@/design/Logo";

export default function NotFound() {
  return (
    <div className="relative z-[1] mx-auto flex min-h-dvh max-w-xl flex-col px-4 py-5 sm:px-8">
      <Link href="/" className="self-start"><Logo /></Link>
      <div className="flex flex-1 flex-col justify-center">
        <p className="display tabular text-[7rem] leading-none text-line">404</p>
        <h1 className="display mt-2 text-[clamp(2.4rem,8vw,3.6rem)]">This page wandered off.</h1>
        <p className="mt-4 text-muted">Could be a typo, could be an old link. Either way, the room&apos;s this way.</p>
        <Link href="/room" className="mt-8 inline-flex h-12 w-fit items-center rounded-full bg-fg px-6 font-semibold text-bg">Take me to the room</Link>
      </div>
    </div>
  );
}