import { z } from "zod";
import { resign, ApiError } from "@/lib/games/server";
import { handle } from "@/lib/games/http";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params;
    if (!z.uuid().safeParse(id).success) throw new ApiError(404, "That game has wandered off.");
    return resign(id);
  });
}