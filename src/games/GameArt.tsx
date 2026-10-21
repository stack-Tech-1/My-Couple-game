import type { ReactNode } from "react";

/**
 * Tile illustrations. One shared language: 160x110 canvas, 2px ink line,
 * a single flat accent fill, and a soft offset "misprint" shadow in the accent.
 * Every drawing is built from the game's own objects.
 */

type ArtProps = { id: string; accent: string; className?: string; title?: string };

const S = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

function Misprint({ accent, children }: { accent: string; children: ReactNode }) {
  return (
    <>
      <g transform="translate(3 3)" opacity=".28" style={{ color: accent }}>
        {children}
      </g>
      {children}
    </>
  );
}

const art: Record<string, (a: string) => ReactNode> = {
  "connect-four": (a) => (
    <>
      <rect x="34" y="18" width="92" height="76" rx="8" {...S} />
      {[0, 1, 2, 3].map((r) =>
        [0, 1, 2, 3, 4].map((c) => {
          const filled = (r === 3 && c < 4) || (r === 2 && c === 1);
          return <circle key={`${r}${c}`} cx={48 + c * 16} cy={32 + r * 16} r={5.6} fill={filled ? (c % 2 ? "currentColor" : a) : "none"} stroke="currentColor" strokeWidth={1.6} />;
        }),
      )}
      <path d="M40 100h80" {...S} />
    </>
  ),
  whot: (a) => (
    <>
      <g transform="rotate(-12 64 58)">
        <rect x="40" y="20" width="44" height="64" rx="5" {...S} fill="var(--bg-raised)" />
        <path d="M62 40l9 16H53z" {...S} fill={a} />
      </g>
      <g transform="rotate(10 98 56)">
        <rect x="76" y="22" width="44" height="64" rx="5" {...S} fill="var(--bg-raised)" />
        <circle cx="98" cy="54" r="9" {...S} />
        <text x="82" y="34" fontSize="9" fontWeight="800" fill="currentColor">20</text>
      </g>
    </>
  ),
  ludo: (a) => (
    <>
      <rect x="40" y="14" width="80" height="80" rx="4" {...S} />
      <path d="M40 54h80M80 14v80M66 14v80M94 14v80M40 40h80M40 68h80" {...S} strokeWidth={1.2} opacity=".5" />
      <path d="M66 40h28v28H66z" fill={a} stroke="currentColor" strokeWidth={2} />
      <circle cx="52" cy="27" r="6" {...S} fill="currentColor" />
      <path d="M106 75c0-5 3-8 6-8s6 3 6 8l-2 8h-8z" {...S} fill={a} />
    </>
  ),
  ayo: (a) => (
    <>
      <rect x="22" y="30" width="116" height="52" rx="26" {...S} />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <g key={i}>
          <circle cx={40 + i * 16} cy={46} r={6} {...S} strokeWidth={1.6} />
          <circle cx={40 + i * 16} cy={66} r={6} {...S} strokeWidth={1.6} />
        </g>
      ))}
      {[[38, 45], [42, 47], [56, 65], [88, 46], [90, 48], [86, 47], [120, 66]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={1.9} fill={i % 2 ? "currentColor" : a} />
      ))}
    </>
  ),
  "word-duel": (a) => (
    <>
      {[0, 1, 2, 3, 4].map((i) => (
        <rect key={i} x={30 + i * 21} y={30} width={17} height={17} rx={2} {...S} fill={i === 1 || i === 4 ? a : i === 2 ? "currentColor" : "none"} />
      ))}
      {[0, 1, 2, 3, 4].map((i) => (
        <rect key={i} x={30 + i * 21} y={55} width={17} height={17} rx={2} {...S} strokeWidth={1.4} opacity={0.55} fill={i === 0 ? a : "none"} />
      ))}
      <path d="M36 86h88" {...S} strokeDasharray="2 6" />
    </>
  ),
  "reflex-duel": (a) => (
    <>
      <circle cx="80" cy="54" r="30" {...S} fill={a} />
      <path d="M84 30l-14 26h12l-6 22 16-28H80z" {...S} fill="var(--bg-raised)" />
      <path d="M30 54h12M118 54h12M80 10v8M80 90v8" {...S} />
    </>
  ),
  "draw-guess": (a) => (
    <>
      <rect x="28" y="16" width="104" height="76" rx="4" {...S} />
      <path d="M46 72c8-22 18-30 28-26 9 4 4 18 14 18 9 0 12-14 20-20" {...S} />
      <path d="M108 30l10 10-26 26-12 2 2-12z" {...S} fill={a} />
      <text x="40" y="34" fontSize="13" fontWeight="800" fill="currentColor">?</text>
    </>
  ),
  "know-me-trivia": (a) => (
    <>
      <path d="M38 22h56l12 12v52H38z" {...S} />
      <path d="M94 22v12h12" {...S} />
      <path d="M48 46h40M48 58h30M48 70h36" {...S} strokeWidth={1.6} />
      <circle cx="112" cy="76" r="15" {...S} fill={a} />
      <path d="M106 76l4 4 8-9" {...S} stroke="var(--bg-raised)" />
    </>
  ),
  "split-clues": (a) => (
    <>
      <path d="M30 26h46v58H30z" {...S} />
      <path d="M84 26h46v58H84z" {...S} />
      <circle cx="76" cy="55" r="9" {...S} fill={a} />
      <path d="M84 55a9 9 0 0 0 0 0" {...S} />
      <path d="M40 40h26M40 50h20M94 64h26M94 72h18" {...S} strokeWidth={1.5} />
    </>
  ),
  "in-sync": (a) => (
    <>
      <path d="M26 40c10 0 14 10 24 10s14-10 24-10 14 10 24 10 14-10 24-10 14 10 14 10" {...S} />
      <path d="M26 66c10 0 14 10 24 10s14-10 24-10 14 10 24 10 14-10 24-10 14 10 14 10" {...S} stroke={a} />
      <circle cx="122" cy="50" r="5" fill="currentColor" />
      <circle cx="122" cy="76" r="5" fill={a} />
    </>
  ),
  "memory-match": (a) => (
    <>
      {[0, 1, 2, 3].map((c) =>
        [0, 1].map((r) => (
          <rect key={`${c}${r}`} x={32 + c * 25} y={20 + r * 36} width={20} height={30} rx={3} {...S} fill={(c === 1 && r === 0) || (c === 3 && r === 1) ? a : "none"} />
        )),
      )}
      <path d="M52 34c20-14 40 10 54 26" {...S} strokeDasharray="3 5" />
    </>
  ),
  "beat-the-clock": (a) => (
    <>
      <circle cx="80" cy="58" r="32" {...S} />
      <path d="M80 58V36M80 58l14 10" {...S} />
      <path d="M80 26a32 32 0 0 1 30 22L80 58z" fill={a} opacity=".9" />
      <path d="M72 18h16M80 18v8" {...S} />
    </>
  ),
  riddles: (a) => (
    <>
      <path d="M62 40c0-12 8-18 18-18s18 6 18 16c0 12-18 14-18 26v4" {...S} strokeWidth={3} />
      <circle cx="80" cy="84" r="4" fill="currentColor" />
      <path d="M108 22l4 8 8 4-8 4-4 8-4-8-8-4 8-4z" fill={a} />
      <path d="M40 60l3 6 6 3-6 3-3 6-3-6-6-3 6-3z" fill={a} opacity=".8" />
    </>
  ),
  "naija-trivia": (a) => (
    <>
      <rect x="34" y="24" width="30" height="62" fill={a} />
      <rect x="64" y="24" width="30" height="62" {...S} />
      <rect x="94" y="24" width="30" height="62" fill={a} />
      <rect x="34" y="24" width="90" height="62" {...S} />
      <circle cx="79" cy="55" r="11" {...S} fill="var(--bg-raised)" />
      <text x="74.5" y="60" fontSize="13" fontWeight="800" fill="currentColor">?</text>
    </>
  ),
  "pidgin-palava": (a) => (
    <>
      <path d="M28 30h56v34H54l-12 10V64H28z" {...S} />
      <path d="M132 46H82v32h30l12 10V78h8z" {...S} fill={a} />
      <path d="M40 44h32M40 52h20" {...S} strokeWidth={1.6} />
      <text x="94" y="68" fontSize="12" fontWeight="800" fill="var(--bg-raised)">abeg</text>
    </>
  ),
  "emoji-guess": (a) => (
    <>
      <circle cx="58" cy="54" r="24" {...S} fill={a} />
      <circle cx="50" cy="48" r="3" fill="currentColor" />
      <circle cx="66" cy="48" r="3" fill="currentColor" />
      <path d="M46 60c6 8 18 8 24 0" {...S} />
      <path d="M100 74V34l26-6v40" {...S} />
      <circle cx="94" cy="76" r="7" {...S} />
      <circle cx="120" cy="70" r="7" {...S} />
    </>
  ),
  "dont-laugh": (a) => (
    <>
      <circle cx="80" cy="56" r="34" {...S} fill={a} />
      <path d="M62 46h10M88 46h10" {...S} stroke="currentColor" strokeWidth={3} />
      <path d="M64 70h32" {...S} strokeWidth={3} />
      <path d="M118 30c4-6 10-6 12 0" {...S} />
      <path d="M30 80c2 6 8 8 12 4" {...S} />
    </>
  ),
  "most-likely": (a) => (
    <>
      <circle cx="48" cy="44" r="12" {...S} />
      <circle cx="112" cy="44" r="12" {...S} />
      <circle cx="80" cy="40" r="14" {...S} fill={a} />
      <path d="M28 92c2-14 10-22 20-22s18 8 20 22M92 92c2-14 10-22 20-22s18 8 20 22" {...S} />
      <path d="M60 92c2-16 10-26 20-26s18 10 20 26" {...S} />
      <path d="M80 10v12M74 16l6 6 6-6" {...S} stroke={a} strokeWidth={2.5} />
    </>
  ),
  "love-styles": (a) => (
    <>
      <path d="M80 92S36 66 36 42c0-12 9-20 20-20 10 0 18 7 24 15 6-8 14-15 24-15 11 0 20 8 20 20 0 24-44 50-44 50z" {...S} />
      <path d="M80 92S56 76 50 58h60c-6 18-30 34-30 34z" fill={a} />
      <path d="M52 42h56" {...S} strokeWidth={1.4} opacity=".5" />
    </>
  ),
  "same-page": (a) => (
    <>
      <path d="M80 30c-12-8-30-10-48-6v62c18-4 36-2 48 6z" {...S} />
      <path d="M80 30c12-8 30-10 48-6v62c-18-4-36-2-48 6z" {...S} fill={a} />
      <path d="M80 30v62" {...S} />
      <path d="M42 46h26M42 58h22M92 46h26M92 58h22" {...S} strokeWidth={1.5} />
    </>
  ),
  "how-well": (a) => (
    <>
      <circle cx="62" cy="54" r="26" {...S} />
      <circle cx="98" cy="54" r="26" {...S} />
      <path d="M80 35a26 26 0 0 1 0 38 26 26 0 0 1 0-38z" fill={a} />
    </>
  ),
  "daily-question": (a) => (
    <>
      <rect x="44" y="20" width="72" height="72" rx="6" {...S} />
      <path d="M44 38h72M60 14v12M100 14v12" {...S} />
      <text x="66" y="78" fontSize="34" fontWeight="700" fill={a} fontFamily="var(--font-display)">?</text>
    </>
  ),
  "story-chain": (a) => (
    <>
      <path d="M30 30h60M30 44h80M30 58h50" {...S} />
      <path d="M30 72h70M30 86h40" {...S} stroke={a} />
      <path d="M112 66l12 12-22 22-14 2 2-14z" {...S} />
    </>
  ),
  "this-or-that": (a) => (
    <>
      <rect x="26" y="26" width="48" height="58" rx="24" {...S} fill={a} />
      <rect x="86" y="26" width="48" height="58" rx="4" {...S} />
      <text x="73" y="60" fontSize="12" fontWeight="800" fill="currentColor">or</text>
    </>
  ),
  "deep-questions": (a) => (
    <>
      <path d="M24 34c14-8 26 8 40 0s26-8 40 0 22 6 32 0" {...S} />
      <path d="M34 54c12-6 22 6 34 0s22-6 34 0 18 4 26 0" {...S} opacity=".7" />
      <path d="M46 74c10-4 18 4 26 0s18-4 26 0" {...S} opacity=".45" />
      <circle cx="80" cy="92" r="5" fill={a} />
    </>
  ),
  "love-notes": (a) => (
    <>
      <rect x="32" y="30" width="96" height="62" rx="4" {...S} />
      <path d="M32 32l48 34 48-34" {...S} />
      <circle cx="80" cy="66" r="10" fill={a} stroke="currentColor" strokeWidth={2} />
      <path d="M76 66c0-3 4-4 4-1 0-3 4-2 4 1 0 3-4 5-4 5s-4-2-4-5z" fill="var(--bg-raised)" />
    </>
  ),
  "memory-lane": (a) => (
    <>
      <g transform="rotate(-8 64 58)">
        <rect x="34" y="22" width="56" height="64" {...S} fill="var(--bg-raised)" />
        <rect x="40" y="28" width="44" height="40" fill={a} />
        <path d="M44 62l12-14 10 10 6-6 10 10" {...S} stroke="var(--bg-raised)" />
      </g>
      <g transform="rotate(9 104 58)">
        <rect x="80" y="26" width="52" height="60" {...S} fill="var(--bg-raised)" />
        <path d="M88 76h34" {...S} strokeWidth={1.5} />
      </g>
    </>
  ),
  "date-night": (a) => (
    <>
      <circle cx="80" cy="56" r="36" {...S} />
      {[0, 60, 120, 180, 240, 300].map((d) => (
        <path key={d} d="M80 56V20" {...S} strokeWidth={1.4} transform={`rotate(${d} 80 56)`} />
      ))}
      <path d="M80 56L80 20A36 36 0 0 1 111 38z" fill={a} />
      <path d="M74 10h12l-6 10z" fill="currentColor" />
      <circle cx="80" cy="56" r="5" fill="currentColor" />
    </>
  ),
  "compliment-battle": (a) => (
    <>
      <path d="M30 28h50v30H50l-12 10V58h-8z" {...S} />
      <path d="M130 44H80v30h30l12 10V74h8z" {...S} fill={a} />
      <path d="M100 56c0-3 4-4 4-1 0-3 4-2 4 1 0 3-4 5-4 5s-4-2-4-5z" fill="var(--bg-raised)" />
    </>
  ),
  "bucket-list": (a) => (
    <>
      <path d="M48 30h64l-8 64H56z" {...S} />
      <path d="M44 30h72" {...S} />
      <path d="M62 50l6 6 12-12" {...S} stroke={a} strokeWidth={3} />
      <path d="M64 72h32" {...S} strokeWidth={1.6} />
    </>
  ),
  "truth-or-dare": (a) => (
    <>
      <g transform="rotate(-10 62 56)">
        <rect x="38" y="22" width="46" height="66" rx="5" {...S} fill="var(--bg-raised)" />
        <text x="47" y="62" fontSize="13" fontWeight="800" fill="currentColor">T</text>
      </g>
      <g transform="rotate(10 100 56)">
        <rect x="78" y="22" width="46" height="66" rx="5" {...S} fill={a} />
        <text x="94" y="62" fontSize="13" fontWeight="800" fill="var(--bg-raised)">D</text>
      </g>
    </>
  ),
  "spicy-dice": (a) => (
    <>
      <rect x="32" y="32" width="44" height="44" rx="8" {...S} transform="rotate(-10 54 54)" />
      <rect x="84" y="34" width="44" height="44" rx="8" {...S} fill={a} transform="rotate(12 106 56)" />
      <circle cx="54" cy="54" r="4" fill="currentColor" />
      <path d="M100 52c0-3 6-4 6-1 0-3 6-2 6 1 0 4-6 7-6 7s-6-3-6-7z" fill="var(--bg-raised)" />
    </>
  ),
  "hot-seat": (a) => (
    <>
      <path d="M52 30c0-6 4-10 10-10h36c6 0 10 4 10 10v30H52z" {...S} />
      <path d="M44 60h72v12H44zM52 72v22M108 72v22" {...S} />
      <path d="M80 34c-6 6-8 10-8 14a8 8 0 0 0 16 0c0-4-2-8-8-14z" fill={a} />
    </>
  ),
  "never-have-i": (a) => (
    <>
      <path d="M50 92V54c0-4 6-4 6 0V40c0-4 6-4 6 0v-6c0-4 6-4 6 0v6c0-4 6-4 6 0v26c4-6 12-6 10 0l-8 16c-3 6-8 10-14 10z" {...S} />
      <path d="M102 34l20 20M122 34l-20 20" {...S} stroke={a} strokeWidth={3} />
    </>
  ),
  "fantasy-match": (a) => (
    <>
      <rect x="28" y="28" width="44" height="56" rx="5" {...S} />
      <rect x="88" y="28" width="44" height="56" rx="5" {...S} />
      <path d="M40 56l6 6 14-14" {...S} />
      <path d="M100 56l6 6 14-14" {...S} />
      <path d="M72 56h16" {...S} stroke={a} strokeWidth={3} />
      <circle cx="80" cy="56" r="4" fill={a} />
    </>
  ),
};

export function GameArt({ id, accent, className, title }: ArtProps) {
  const draw = art[id];
  return (
    <svg viewBox="0 0 160 110" className={className} role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      {draw ? <Misprint accent={accent}>{draw(accent)}</Misprint> : <circle cx="80" cy="55" r="24" {...S} />}
    </svg>
  );
}
