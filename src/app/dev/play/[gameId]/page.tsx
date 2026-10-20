import { notFound } from "next/navigation";
import { GAME_LOGIC } from "@/games/logic";
import { Sandbox } from "./Sandbox";
import { Providers } from "@/components/Providers";

export const metadata = { robots: { index: false } };

/** Dev-only two-seat sandbox: real game logic, both players side by side, no backend. */
export default async function DevPlay({ params }: { params: Promise<{ gameId: string }> }) {
  if (process.env.NODE_ENV === "production" && process.env.AMAH_SANDBOX !== "1") notFound();
  const { gameId } = await params;
  if (!GAME_LOGIC[gameId]) notFound();
  return (
    <Providers>
      <Sandbox gameId={gameId} />
    </Providers>
  );
}