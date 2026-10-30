"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/design/Button";
import { toast } from "@/design/toast";
import { acceptChallengeLink } from "@/lib/solo/challenge-actions";

/** Joins the sender's friend room (if there's space) and opens the game with the target. */
export function AcceptChallenge({ token }: { token: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      size="lg"
      variant="accent"
      className="w-full"
      loading={pending}
      onClick={() =>
        start(async () => {
          const r = await acceptChallengeLink(token);
          if (!r.ok) return void toast.error(r.error);
          if (r.data.roomNote) toast.info(r.data.roomNote);
          router.push(`/solo/${r.data.gameId}?challenge=${token}`);
        })
      }
    >
      Play now
    </Button>
  );
}
