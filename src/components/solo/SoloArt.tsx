import { GameArt } from "@/games/GameArt";
import { soloGame } from "@/lib/solo/catalog";

/** The drawing on each Solo game's card. Bots reuse their board game's drawing. */
export function SoloArt({ id, className }: { id: string; className?: string }) {
  const g = soloGame(id);
  if (g?.base) return <GameArt id={g.base} accent={g.look.accent} className={className} />;
  const ink = "#1c1416";
  switch (id) {
    case "blend-am":
      return (
        <svg viewBox="0 0 120 90" className={className} aria-hidden>
          <g stroke={ink} strokeWidth="2.5">
            <rect x="14" y="10" width="28" height="28" rx="5" fill="#2a4a8a" />
            <rect x="44" y="10" width="28" height="28" rx="5" fill="#2a4a8a" />
            <rect x="74" y="10" width="28" height="28" rx="5" fill="#e8563a" />
            <rect x="44" y="40" width="28" height="28" rx="5" fill="#fbf7f1" />
            <rect x="74" y="40" width="28" height="28" rx="5" fill="#3f8a5c" />
          </g>
        </svg>
      );
    case "ajo":
      return (
        <svg viewBox="0 0 120 90" className={className} aria-hidden>
          <g stroke={ink} strokeWidth="2.5" fontFamily="Manrope, sans-serif" fontWeight="800" textAnchor="middle">
            <rect x="8" y="16" width="50" height="50" rx="10" fill="#f2d27a" />
            <text x="33" y="47" fontSize="15" stroke="none" fill={ink}>₦50</text>
            <rect x="62" y="16" width="50" height="50" rx="10" fill="#e8a0b0" />
            <text x="87" y="47" fontSize="14" stroke="none" fill={ink}>₦200</text>
          </g>
        </svg>
      );
    case "okada-rush":
      return (
        <svg viewBox="0 0 120 90" className={className} aria-hidden>
          <g stroke={ink} strokeWidth="2.5">
            <rect x="26" y="40" width="60" height="18" rx="8" fill="#e8563a" />
            <circle cx="34" cy="64" r="10" fill="#2a2426" />
            <circle cx="78" cy="64" r="10" fill="#2a2426" />
            <circle cx="52" cy="28" r="9" fill="#f3c9b7" />
            <circle cx="70" cy="30" r="8" fill="#bcd3e6" />
            <path d="M86 44 l14 -8" />
          </g>
        </svg>
      );
    case "fix-am":
      return (
        <svg viewBox="0 0 120 90" className={className} aria-hidden>
          <g stroke={ink} strokeWidth="2.5">
            <rect x="22" y="8" width="24" height="24" rx="4" fill="#9fd0e6" />
            <rect x="48" y="8" width="24" height="24" rx="4" fill="#9fd0e6" />
            <rect x="74" y="8" width="24" height="24" rx="4" fill="#fbf7f1" strokeDasharray="4 3" />
            <rect x="22" y="34" width="24" height="24" rx="4" fill="#9b7a5c" />
            <rect x="48" y="34" width="24" height="24" rx="4" fill="#8a7d74" />
            <rect x="74" y="34" width="24" height="24" rx="4" fill="#9b7a5c" />
            <rect x="22" y="60" width="24" height="24" rx="4" fill="#3f7a46" />
            <rect x="48" y="60" width="24" height="24" rx="4" fill="#3f7a46" />
            <rect x="74" y="60" width="24" height="24" rx="4" fill="#3f7a46" />
          </g>
        </svg>
      );
    case "oro":
      return (
        <svg viewBox="0 0 120 90" className={className} aria-hidden>
          <g stroke={ink} strokeWidth="2.5" fontFamily="Manrope, sans-serif" fontWeight="800" textAnchor="middle" fontSize="16">
            {["Ọ", "R", "Ọ"].map((l, i) => (
              <g key={i}>
                <rect x={14 + i * 32} y="28" width="28" height="28" rx="6" fill={i === 1 ? "#e9b13c" : "#fbf7f1"} />
                <text x={28 + i * 32} y="48" stroke="none" fill={ink}>{l}</text>
              </g>
            ))}
          </g>
        </svg>
      );
    case "reflex":
      return (
        <svg viewBox="0 0 120 90" className={className} aria-hidden>
          <circle cx="60" cy="45" r="30" fill="#f6d26a" stroke={ink} strokeWidth="2.5" />
          <path d="M60 45 V25 M60 45 L76 52" stroke={ink} strokeWidth="3" strokeLinecap="round" />
        </svg>
      );
    default:
      return null;
  }
}
