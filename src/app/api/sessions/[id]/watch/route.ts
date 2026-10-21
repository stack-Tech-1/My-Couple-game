import { z } from "zod";
import { watchSnapshot, ApiError } from "@/lib/games/server";
import { handle } from "@/lib/games/http";

/** Spectator view of a live friend-room game (members who aren't playing). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params;
    if (!z.uuid().safeParse(id).success) throw new ApiError(404, "That game has wandered off.");
    return watchSnapshot(id);
  });
}
