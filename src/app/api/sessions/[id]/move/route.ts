import { z } from "zod";
import { submitMove, ApiError } from "@/lib/games/server";
import { moveBody } from "@/lib/games/types";
import { handle, readJson } from "@/lib/games/http";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params;
    if (!z.uuid().safeParse(id).success) throw new ApiError(404, "That game has wandered off.");
    const parsed = moveBody.safeParse(await readJson(req));
    if (!parsed.success) throw new ApiError(400, "That request was garbled.");
    return submitMove(id, parsed.data.move, parsed.data.expectedVersion);
  });
}