"use client";

import { useState } from "react";
import { Toggle } from "@/design/Field";
import { IconButton } from "@/design/Button";
import { toast } from "@/design/toast";
import { HOUSE_RULES } from "@/games/houseRules";
import { gameMeta } from "@/games/catalog";
import { updateHouseRules } from "@/lib/room/actions";
import { useRoom } from "@/lib/realtime/RoomProvider";

/** Per-game house rules, shared by the room. Changes apply to the next game started. */
export function HouseRules() {
  const { bundle } = useRoom();
  const saved = (bundle.room.settings.houseRules ?? {}) as Record<string, Record<string, unknown>>;
  const [rules, setRules] = useState<Record<string, Record<string, unknown>>>(() =>
    Object.fromEntries(Object.entries(HOUSE_RULES).map(([id, def]) => [id, def.schema.parse(saved[id] ?? {})])),
  );

  const change = (gameId: string, key: string, value: unknown) => {
    const next = { ...rules[gameId], [key]: value };
    setRules((r) => ({ ...r, [gameId]: next }));
    void updateHouseRules(bundle.room.id, gameId, next).then((r) => (r.ok ? toast.info("House rules updated.", "They kick in from the next game.") : toast.error(r.error)));
  };

  return (
    <div className="space-y-8">
      {Object.entries(HOUSE_RULES).map(([gameId, def]) => (
        <div key={gameId}>
          <h3 className="display text-[1.4rem]">{gameMeta(gameId)?.name}</h3>
          <div className="mt-1 divide-y divide-line">
            {def.fields.map((f) =>
              f.type === "bool" ? (
                <Toggle key={f.key} label={f.label} description={f.description} checked={!!rules[gameId]?.[f.key]} onChange={(v) => change(gameId, f.key, v)} />
              ) : (
                <div key={f.key} className="flex items-center justify-between gap-6 py-3">
                  <div>
                    <p className="font-semibold">{f.label}</p>
                    <p className="text-[0.85rem] text-muted">{f.description}</p>
                  </div>
                  <div className="flex items-center gap-1" role="group" aria-label={f.label}>
                    <IconButton icon="minus" label={`Fewer: ${f.label}`} disabled={Number(rules[gameId]?.[f.key]) <= f.min} onClick={() => change(gameId, f.key, Number(rules[gameId]?.[f.key]) - 1)} />
                    <span className="display tabular w-8 text-center text-[1.4rem]" aria-live="polite">{String(rules[gameId]?.[f.key])}</span>
                    <IconButton icon="plus" label={`More: ${f.label}`} disabled={Number(rules[gameId]?.[f.key]) >= f.max} onClick={() => change(gameId, f.key, Number(rules[gameId]?.[f.key]) + 1)} />
                  </div>
                </div>
              ),
            )}
          </div>
        </div>
      ))}
    </div>
  );
}