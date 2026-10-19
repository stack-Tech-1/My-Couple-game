"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/design/Button";
import { joinRoom } from "@/lib/room/actions";
import { track } from "@/lib/analytics";

export function JoinButton({ code }: { code: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="mt-10">
      <Button
        size="lg"
        variant="accent"
        loading={pending}
        iconRight="arrowRight"
        onClick={() =>
          start(async () => {
            const res = await joinRoom(code);
            if (!res.ok) return setError(res.error);
            track("room_joined", { via: "link" });
            router.push(`/room/${res.data.id}`);
          })
        }
      >
        Take the seat
      </Button>
      {error ? <p role="alert" className="mt-4 font-medium text-accent-ink">{error}</p> : null}
    </div>
  );
}