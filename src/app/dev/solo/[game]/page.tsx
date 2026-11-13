import { notFound } from "next/navigation";
import { soloGame } from "@/lib/solo/catalog";
import { Providers } from "@/components/Providers";
import { SoloSandbox } from "./SoloSandbox";

export const metadata = { robots: { index: false } };

/** Dev-only: a Solo game on its own, no account or database. */
export default async function DevSolo({ params }: { params: Promise<{ game: string }> }) {
  if (process.env.NODE_ENV === "production" && process.env.AMAH_SANDBOX !== "1") notFound();
  const { game } = await params;
  if (!soloGame(game) || soloGame(game)!.kind === "bot") notFound();
  return (
    <Providers>
      <div className="mx-auto max-w-[460px] px-4 pb-16 pt-6">
        <SoloSandbox gameId={game} />
      </div>
    </Providers>
  );
}
