import { BUILDINGS } from "@/lib/solo/games/bashwall";

const LOT_W = 58;
const lotX = (i: number) => 6 + i * 59;

function Building({ id, x }: { id: string; x: number }) {
  if (id === "shed")
    return (
      <g>
        <rect x={x + 5} y="40" width="46" height="36" fill="#b5673a" />
        <path d={`M${x} 42 ${x + 28} 22 ${x + 56} 42z`} fill="#7c2f16" />
        <rect x={x + 21} y="56" width="14" height="20" fill="#3a251b" />
      </g>
    );
  if (id === "generator")
    return (
      <g>
        <rect x={x + 5} y="32" width="46" height="44" fill="#3f7a8f" />
        <rect x={x + 2} y="27" width="52" height="7" fill="#1f4d5c" />
        <rect x={x + 12} y="42" width="12" height="12" fill="#fff0c2" />
        <rect x={x + 32} y="42" width="12" height="12" fill="#fff0c2" />
      </g>
    );
  if (id === "mechanic")
    return (
      <g>
        <rect x={x + 3} y="38" width="50" height="38" fill="#8a8f96" />
        <rect x={x + 10} y="50" width="36" height="26" fill="#3b4048" />
        <rect x={x + 3} y="30" width="50" height="10" fill="#d9542c" />
      </g>
    );
  if (id === "chemist")
    return (
      <g>
        <rect x={x + 5} y="30" width="46" height="46" fill="#f3e6d3" />
        <rect x={x + 5} y="30" width="46" height="9" fill="#2f8a4e" />
        <rect x={x + 25} y="46" width="6" height="18" fill="#2f8a4e" />
        <rect x={x + 19} y="52" width="18" height="6" fill="#2f8a4e" />
      </g>
    );
  return (
    <g>
      <rect x={x + 5} y="36" width="46" height="40" fill="#59606a" />
      <path d={`M${x + 5} 36 ${x + 28} 24 ${x + 51} 36z`} fill="#2b3037" />
      <circle cx={x + 28} cy="54" r="9" fill="#f6c453" />
      <rect x={x + 26} y="44" width="4" height="20" fill="#2b3037" />
    </g>
  );
}

/** The street you're building: finished buildings, and marked-out plots for the rest. */
export function YourStreet({ built }: { built: readonly string[] }) {
  const have = BUILDINGS.filter((b) => built.includes(b.id));
  const label = have.length ? `Your street: ${have.map((b) => b.name).join(", ")}, with ${BUILDINGS.length - have.length} empty plots.` : "Your street: five empty plots.";
  return (
    <svg viewBox="0 0 306 92" role="img" aria-label={label} className="block h-auto w-full">
      <rect width="306" height="92" fill="#f7c58a" />
      <circle cx="262" cy="22" r="13" fill="#fff0c2" />
      <rect y="76" width="306" height="16" fill="#6d5a4d" />
      {BUILDINGS.map((b, i) =>
        built.includes(b.id) ? (
          <Building key={b.id} id={b.id} x={lotX(i)} />
        ) : (
          <rect key={b.id} x={lotX(i) + 4} y="42" width={LOT_W - 10} height="33" fill="none" stroke="#7c2f16" strokeWidth="1.6" strokeDasharray="4 4" />
        ),
      )}
    </svg>
  );
}
