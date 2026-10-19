import type { z } from "zod";
import { whotRulesSchema } from "./whot/logic";
import { ludoRulesSchema } from "./ludo/logic";
import { ayoRulesSchema } from "./ayo/logic";

type Field =
  | { key: string; type: "bool"; label: string; description: string }
  | { key: string; type: "number"; label: string; description: string; min: number; max: number };

/** House-rule toggles shown in room settings. The schema is the single source of truth for defaults. */
export const HOUSE_RULES: Record<string, { schema: z.ZodType<Record<string, unknown>>; fields: Field[] }> = {
  whot: {
    schema: whotRulesSchema as unknown as z.ZodType<Record<string, unknown>>,
    fields: [
      { key: "stackPicks", type: "bool", label: "Stack picks", description: "Defend a Pick Two with a 2 (or a Pick Three with a 5) and pass the total on." },
      { key: "generalMarketHold", type: "bool", label: "General Market holds", description: "Whoever plays 14 goes again after their partner draws." },
      { key: "announceLastCard", type: "bool", label: "Call 'last card'", description: "Forget to call it when you're down to one and you pick two." },
      { key: "handSize", type: "number", label: "Starting hand", description: "Cards dealt to each player.", min: 4, max: 8 },
    ],
  },
  ludo: {
    schema: ludoRulesSchema as unknown as z.ZodType<Record<string, unknown>>,
    fields: [
      { key: "exitOnOne", type: "bool", label: "Leave the yard on a 1", description: "A 1 brings a token out as well as a 6." },
      { key: "exactHome", type: "bool", label: "Exact roll home", description: "You need the exact number to get a token home." },
      { key: "bonusRolls", type: "bool", label: "Bonus rolls", description: "Capturing or getting home earns another roll." },
      { key: "threeSixes", type: "bool", label: "Three sixes forfeit", description: "A third six in a row ends your turn." },
    ],
  },
  ayo: {
    schema: ayoRulesSchema as unknown as z.ZodType<Record<string, unknown>>,
    fields: [{ key: "grandSlam", type: "bool", label: "Grand slam counts", description: "Capturing every seed on your partner's side is allowed." }],
  },
};