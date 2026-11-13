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
    case "pump-am":
      return (
        <svg viewBox="0 0 120 90" className={className} aria-hidden>
          <rect x="22" y="6" width="76" height="80" rx="14" fill="#e8563a" stroke={ink} strokeWidth="2.5" />
          <rect x="30" y="14" width="60" height="50" rx="8" fill="#6cc6ea" stroke={ink} strokeWidth="2" />
          <path d="M48 62 L50 34 L52 62Z M70 62 L72 40 L74 62Z" fill="#f6c453" stroke={ink} strokeWidth="1.2" />
          <ellipse cx="50" cy="56" rx="9" ry="3" fill="none" stroke="#ff7eb6" strokeWidth="3" />
          <ellipse cx="66" cy="28" rx="8" ry="6" fill="none" stroke="#7cd36b" strokeWidth="3" transform="rotate(-25 66 28)" />
          <ellipse cx="40" cy="30" rx="7" ry="5" fill="none" stroke="#f6c453" strokeWidth="3" transform="rotate(30 40 30)" />
          <circle cx="40" cy="75" r="7" fill="#e9b13c" stroke={ink} strokeWidth="2" />
          <circle cx="80" cy="75" r="7" fill="#3f74d8" stroke={ink} strokeWidth="2" />
        </svg>
      );
    case "bash-am":
      return (
        <svg viewBox="0 0 120 90" className={className} aria-hidden>
          <g stroke={ink} strokeWidth="2">
            {[0, 1, 2, 3].map((i) => <rect key={"a" + i} x={8 + i * 27} y="10" width="23" height="11" rx="2" fill={["#e8563a", "#e9b13c", "#3f74d8", "#2f8a4e"][i]} />)}
            {[0, 1, 2].map((i) => <rect key={"b" + i} x={21 + i * 27} y="24" width="23" height="11" rx="2" fill={["#f2a7a0", "#b48cff", "#e9b13c"][i]} />)}
            <circle cx="66" cy="54" r="6" fill="#f6efe6" />
            <rect x="40" y="72" width="44" height="9" rx="4" fill="#c98a4a" />
          </g>
        </svg>
      );
    case "zobo-sort":
      return (
        <svg viewBox="0 0 120 90" className={className} aria-hidden>
          {[0, 1, 2].map((i) => (
            <g key={i} transform={`translate(${30 + i * 30} 84)`} stroke={ink} strokeWidth="2">
              <path d="M-11 -46 q0 -6 6 -10 v-12 h10 v12 q6 4 6 10 v40 q0 6 -6 6 h-10 q-6 0 -6 -6z" fill="#fbf7f1" />
              <rect x="-10" y={-22} width="20" height="16" fill={["#8f1d40", "#ffa63d", "#8fd14f"][i]} stroke="none" />
              <rect x="-10" y={-36} width="20" height="14" fill={["#ffa63d", "#8f1d40", "#efe2c2"][i]} stroke="none" />
              <path d="M-11 -46 q0 -6 6 -10 v-12 h10 v12 q6 4 6 10 v40 q0 6 -6 6 h-10 q-6 0 -6 -6z" fill="none" />
            </g>
          ))}
        </svg>
      );
    case "catch-am":
      return (
        <svg viewBox="0 0 120 90" className={className} aria-hidden>
          <g stroke={ink} strokeWidth="2">
            <circle cx="40" cy="22" r="9" fill="#e09a2e" />
            <circle cx="76" cy="14" r="8" fill="#f6c453" />
            <path d="M88 38 q-10 1 -10 8 q0 8 10 9 q10 -1 10 -9 q0 -7 -10 -8z" fill="#e02a1a" />
            <path d="M30 56 L36 82 Q60 88 84 82 L90 56Z" fill="#c9924a" />
            <ellipse cx="60" cy="56" rx="30" ry="5" fill="#d9a85e" />
          </g>
        </svg>
      );
    case "mosquito-wahala":
      return (
        <svg viewBox="0 0 120 90" className={className} aria-hidden>
          <g stroke={ink} strokeWidth="2">
            <rect x="46" y="44" width="28" height="40" rx="5" fill="#3f9a3a" />
            <rect x="52" y="36" width="16" height="9" rx="3" fill="#c9c2b8" />
            <rect x="49" y="56" width="22" height="14" rx="2" fill="#f6c453" />
          </g>
          <g fill="#1c1416" stroke={ink} strokeWidth="1.2">
            <ellipse cx="34" cy="20" rx="2" ry="7" />
            <ellipse cx="88" cy="26" rx="2" ry="7" transform="rotate(30 88 26)" />
          </g>
          <g fill="rgba(200,220,255,.8)" stroke={ink} strokeWidth="1">
            <ellipse cx="28" cy="14" rx="7" ry="3" />
            <ellipse cx="40" cy="14" rx="7" ry="3" />
            <ellipse cx="84" cy="18" rx="7" ry="3" />
            <ellipse cx="94" cy="22" rx="7" ry="3" />
          </g>
          <circle cx="60" cy="28" r="7" fill="rgba(235,245,255,.9)" stroke={ink} strokeWidth="1" />
        </svg>
      );
    case "mama-put":
      return (
        <svg viewBox="0 0 120 90" className={className} aria-hidden>
          <g stroke={ink} strokeWidth="2">
            <ellipse cx="60" cy="56" rx="44" ry="18" fill="#fdfbf6" />
            <ellipse cx="50" cy="54" rx="22" ry="9" fill="#e86a24" />
            <ellipse cx="80" cy="50" rx="7" ry="4.5" fill="#f09a2a" />
            <ellipse cx="88" cy="56" rx="7" ry="4.5" fill="#f09a2a" />
            <path d="M66 58 q4 -6 12 -2 q4 6 -4 9 q-8 1 -8 -7z" fill="#7a2408" />
          </g>
          <g stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity=".9">
            <path d="M46 30 q-5 -7 0 -14" />
            <path d="M58 28 q-5 -7 0 -14" />
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
