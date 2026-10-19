import { createSession, ApiError } from "@/lib/games/server";
import { createSessionBody } from "@/lib/games/types";
import { handle, readJson } from "@/lib/games/http";

export async function POST(req: Request) {
  return handle(async () => {
    const parsed = createSessionBody.safeParse(await readJson(req));
    if (!parsed.success) throw new ApiError(400, "That request was garbled.");
    return createSession(parsed.data.gameId, parsed.data.config, parsed.data.rematchOf);
  });
}