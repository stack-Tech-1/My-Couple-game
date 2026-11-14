/**
 * Our place, drawn: a Lagos sitting room that fills up as a couple earns things. Each item is a
 * layer that appears once it's earned; the empty room is warm walls, a window and a floor.
 */
export function PlaceScene({ have, level, className }: { have: string[]; level: number; className?: string }) {
  const h = new Set(have);
  const plant = h.has("plant_flower") ? 4 : h.has("plant_big") ? 3 : h.has("plant_mid") ? 2 : 1;
  return (
    <svg viewBox="0 0 390 360" className={className} role="img" aria-label={`Your place, with ${have.length} things in it`}>
      <defs>
        <linearGradient id="pl-wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f3d9b5" />
          <stop offset="1" stopColor="#e7c597" />
        </linearGradient>
        <linearGradient id="pl-floor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#b9743f" />
          <stop offset="1" stopColor="#874f26" />
        </linearGradient>
        <linearGradient id="pl-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7fbedd" />
          <stop offset="1" stopColor="#cfe8ef" />
        </linearGradient>
        <linearGradient id="pl-gold" x1="0" x2="1">
          <stop offset="0" stopColor="#9a6b1f" />
          <stop offset=".35" stopColor="#f9e08a" />
          <stop offset=".6" stopColor="#c9952e" />
          <stop offset="1" stopColor="#a8761f" />
        </linearGradient>
      </defs>
      {/* Room */}
      <rect width="390" height="250" fill="url(#pl-wall)" />
      <rect y="250" width="390" height="110" fill="url(#pl-floor)" />
      <g stroke="#a0612f" strokeWidth="1.5" opacity=".45">
        <path d="M0 278H390M0 308H390M0 340H390" />
      </g>
      <rect y="244" width="390" height="8" fill="#8a5228" />

      {/* Window, always there */}
      <rect x="28" y="38" width="112" height="122" rx="6" fill="url(#pl-sky)" stroke="#7a4d2a" strokeWidth="6" />
      <path d="M84 38V160M28 98H140" stroke="#7a4d2a" strokeWidth="4" />
      <circle cx="116" cy="66" r="11" fill="#ffe08a" />
      <path d="M36 150 q14 -18 28 0 q14 -14 26 0" fill="none" stroke="#5d9a5a" strokeWidth="3" opacity=".7" />
      {h.has("curtains") ? (
        <g fill="#c2321f">
          <path d="M18 30 Q40 96 30 168 L18 168Z" />
          <path d="M150 30 Q128 96 138 168 L150 168Z" />
          <rect x="14" y="26" width="140" height="6" rx="3" fill="#6b3f1f" />
        </g>
      ) : null}

      {/* Fairy lights along the top */}
      {h.has("lights") ? (
        <g>
          <path d="M0 14 Q48 30 97 14 T195 14 T292 14 T390 14" fill="none" stroke="#5a4636" strokeWidth="1.2" />
          {Array.from({ length: 16 }, (_, i) => (
            <circle key={i} cx={12 + i * 24.5} cy={14 + Math.sin(i * 0.8) * 7 + 6} r="3.4" fill={["#ffd66b", "#ff9a6e", "#9fe0a8", "#a8c8ff"][i % 4]} className="pl-twinkle" style={{ animationDelay: `${(i % 5) * 0.4}s` }} />
          ))}
        </g>
      ) : null}

      {/* Ceiling fan */}
      {h.has("fan") ? (
        <g transform="translate(260 0)">
          <rect x="-2" y="0" width="4" height="22" fill="#5a4636" />
          <g className="pl-spin" style={{ transformBox: "fill-box", transformOrigin: "center" }}>
            <ellipse cx="-26" cy="26" rx="26" ry="5" fill="#8a5a33" />
            <ellipse cx="26" cy="26" rx="26" ry="5" fill="#8a5a33" />
          </g>
          <circle cx="0" cy="26" r="6" fill="#5a4636" />
        </g>
      ) : null}

      {/* Wall: photos, certificate, painting, clock, bucket list board, gold frame */}
      {h.has("photo") ? (
        <g>
          <rect x="168" y="48" width="62" height="76" rx="3" fill="#fffaf0" stroke="#3a2a1e" strokeWidth="4" />
          <rect x="177" y="57" width="44" height="50" fill="#e8a46b" />
          <circle cx="191" cy="77" r="8" fill="#e8563a" />
          <circle cx="207" cy="79" r="8" fill="#3a5bb8" />
          <path d="M177 107 L221 107 L221 98 Q199 86 177 98Z" fill="#6aa86a" />
        </g>
      ) : null}
      {h.has("photo2") ? (
        <g>
          <rect x="236" y="56" width="34" height="42" rx="2" fill="#fffaf0" stroke="#3a2a1e" strokeWidth="3" />
          <rect x="241" y="61" width="24" height="26" fill="#9fc6e0" />
          <rect x="146" y="100" width="18" height="22" rx="2" fill="#fffaf0" stroke="#3a2a1e" strokeWidth="2.5" />
          <rect x="149" y="103" width="12" height="13" fill="#f2c56b" />
        </g>
      ) : null}
      {h.has("certificate") ? (
        <g>
          <rect x="290" y="52" width="76" height="56" rx="3" fill="#0d3b2e" stroke="url(#pl-gold)" strokeWidth="4" />
          <text x="328" y="78" textAnchor="middle" fontFamily="Fraunces, Georgia, serif" fontWeight="700" fontSize="17" fill="#f4e2b0">
            Lv {level}
          </text>
          <text x="328" y="96" textAnchor="middle" fontFamily="Manrope, sans-serif" fontWeight="700" fontSize="8" fill="#d6ad55">
            TOGETHER
          </text>
        </g>
      ) : null}
      {h.has("painting") ? (
        <g>
          <rect x="290" y="120" width="76" height="52" rx="2" fill="#2b3f8f" stroke="#5a3b1d" strokeWidth="4" />
          {[0, 1, 2, 3].map((i) => (
            <circle key={i} cx={304 + i * 16} cy="138" r="5" fill="none" stroke="#e8eefc" strokeWidth="2" />
          ))}
          {[0, 1, 2, 3].map((i) => (
            <path key={i} d={`M${298 + i * 16} 160 l8 -8 l8 8`} fill="none" stroke="#e8eefc" strokeWidth="2" />
          ))}
        </g>
      ) : null}
      {h.has("clock") ? (
        <g transform="translate(250 136)">
          <circle r="15" fill="#fffaf0" stroke="#3a2a1e" strokeWidth="3" />
          <path d="M0 0V-9M0 0L6 4" stroke="#3a2a1e" strokeWidth="2" strokeLinecap="round" />
        </g>
      ) : null}
      {h.has("board") ? (
        <g>
          <rect x="170" y="134" width="56" height="42" rx="3" fill="#c9a26b" stroke="#6b4423" strokeWidth="3" />
          <rect x="175" y="139" width="20" height="13" fill="#fffaf0" transform="rotate(-6 185 145)" />
          <rect x="199" y="140" width="21" height="13" fill="#ffe7a8" transform="rotate(5 209 146)" />
          <rect x="183" y="157" width="22" height="12" fill="#d8f0d0" />
          <circle cx="185" cy="141" r="2" fill="#c2321f" />
          <circle cx="209" cy="142" r="2" fill="#c2321f" />
        </g>
      ) : null}
      {h.has("gold") ? (
        <g>
          <rect x="232" y="104" width="46" height="26" rx="2" fill="url(#pl-gold)" />
          <rect x="237" y="109" width="36" height="16" fill="#fff6dc" />
          <text x="255" y="121" textAnchor="middle" fontFamily="Manrope, sans-serif" fontWeight="800" fontSize="8" fill="#7a5512">
            100
          </text>
        </g>
      ) : null}

      {/* Bookshelf (left of the sofa) */}
      {h.has("bookshelf") ? (
        <g>
          <rect x="6" y="170" width="44" height="82" fill="#7a4a24" />
          <rect x="10" y="176" width="36" height="2.5" fill="#5a361a" />
          <rect x="10" y="202" width="36" height="2.5" fill="#5a361a" />
          <rect x="10" y="228" width="36" height="2.5" fill="#5a361a" />
          {[["#c2321f", 12], ["#3a5bb8", 18], ["#e8a43a", 24]].map(([c, x]) => (
            <rect key={x as number} x={x as number} y="182" width="5" height="20" fill={c as string} />
          ))}
          {h.has("books")
            ? [["#2f8a4a", 12], ["#7b3fa0", 18], ["#c2321f", 24], ["#f2c56b", 30], ["#3a5bb8", 36], ["#e8563a", 14], ["#5a9e4b", 22], ["#a8761f", 30]].map(([c, x], i) => (
                <rect key={i} x={x as number} y={i < 5 ? 208 : 234} width="5" height={i < 5 ? 20 : 16} fill={c as string} />
              ))
            : null}
        </g>
      ) : null}

      {/* Plant: grows with the streak */}
      <g transform="translate(66 252)">
        <rect x="-16" y="-2" width="32" height="30" rx="5" fill="#c7553a" />
        <rect x="-18" y="-6" width="36" height="7" rx="3" fill="#a8432c" />
        <g fill="#3d8b4a">
          {plant >= 1 ? <path d="M0 -6 Q-8 -20 -2 -30 Q4 -18 0 -6Z" /> : null}
          {plant >= 2 ? <path d="M0 -6 Q-22 -26 -14 -52 Q2 -30 0 -6Z M0 -6 Q20 -30 18 -54 Q4 -32 0 -6Z" /> : null}
          {plant >= 3 ? <path d="M0 -6 Q-4 -50 4 -86 Q10 -48 0 -6Z M0 -6 Q-30 -40 -24 -74 Q-6 -44 0 -6Z M0 -6 Q28 -46 30 -78 Q8 -44 0 -6Z" /> : null}
        </g>
        {plant >= 4 ? (
          <g fill="#ff8fb1">
            <circle cx="4" cy="-88" r="6" />
            <circle cx="-24" cy="-76" r="5" />
            <circle cx="30" cy="-80" r="5" />
            <circle cx="4" cy="-88" r="2.2" fill="#ffd66b" />
          </g>
        ) : null}
      </g>

      {/* Lamp */}
      {h.has("lamp") ? (
        <g>
          <path d="M110 252V196" stroke="#3a2a1e" strokeWidth="3.5" />
          <rect x="100" y="250" width="20" height="4" rx="2" fill="#3a2a1e" />
          <path d="M95 196 L125 196 L118 172 L102 172Z" fill="#f6c453" />
          <ellipse cx="110" cy="200" rx="24" ry="5" fill="#ffe7a0" opacity=".35" />
        </g>
      ) : null}

      {/* Rug and floor things */}
      {h.has("rug") ? (
        <g>
          <ellipse cx="248" cy="312" rx="118" ry="26" fill="#a02c2c" />
          <ellipse cx="248" cy="312" rx="100" ry="19" fill="none" stroke="#f2c56b" strokeWidth="3" strokeDasharray="8 6" />
          <ellipse cx="248" cy="312" rx="62" ry="10" fill="none" stroke="#1f3f7a" strokeWidth="3" />
        </g>
      ) : null}
      {h.has("sofa") ? (
        <g>
          <rect x="150" y="198" width="210" height="62" rx="18" fill="#2f6f5e" />
          <rect x="138" y="186" width="40" height="84" rx="16" fill="#28604f" />
          <rect x="332" y="186" width="40" height="84" rx="16" fill="#28604f" />
          <rect x="166" y="214" width="84" height="34" rx="10" fill="#3b8571" />
          <rect x="258" y="214" width="84" height="34" rx="10" fill="#3b8571" />
          <rect x="150" y="266" width="8" height="10" fill="#3a2a1e" />
          <rect x="352" y="266" width="8" height="10" fill="#3a2a1e" />
        </g>
      ) : null}
      {h.has("cushions") ? (
        <g>
          <rect x="176" y="200" width="34" height="26" rx="7" fill="#e8a43a" transform="rotate(-8 193 213)" />
          <path d="M180 206 l26 14 M180 218 l20 -10" stroke="#c2321f" strokeWidth="3" transform="rotate(-8 193 213)" />
          <rect x="304" y="200" width="34" height="26" rx="7" fill="#7b3fa0" transform="rotate(8 321 213)" />
          <circle cx="321" cy="213" r="6" fill="#f2c56b" />
        </g>
      ) : null}
      {h.has("guitar") ? (
        <g transform="translate(374 190) rotate(14)">
          <rect x="-2" y="-58" width="5" height="50" fill="#5a361a" />
          <ellipse cx="0" cy="0" rx="13" ry="16" fill="#c9852e" />
          <ellipse cx="0" cy="-12" rx="10" ry="11" fill="#c9852e" />
          <circle cx="0" cy="-2" r="4" fill="#3a2a1e" />
        </g>
      ) : null}
      {h.has("radio") ? (
        <g transform="translate(94 134)">
          <rect x="0" y="0" width="40" height="24" rx="5" fill="#c2321f" />
          <circle cx="12" cy="12" r="7" fill="#3a2a1e" />
          <rect x="24" y="7" width="11" height="3" fill="#fffaf0" />
          <rect x="24" y="14" width="11" height="3" fill="#fffaf0" />
          <path d="M30 0 L38 -14" stroke="#3a2a1e" strokeWidth="2" />
        </g>
      ) : null}
      {h.has("tv") ? (
        <g transform="translate(66 318)">
          <rect x="-34" y="-30" width="68" height="44" rx="4" fill="#1c1416" />
          <rect x="-29" y="-25" width="58" height="34" rx="2" fill="#3a5bb8" />
          <path d="M-29 -2 L-10 -14 L6 -4 L29 -18 L29 9 L-29 9Z" fill="#5a9e4b" opacity=".8" />
          <rect x="-24" y="14" width="48" height="14" rx="2" fill="#6b3f1f" />
        </g>
      ) : null}
      {h.has("table") ? (
        <g>
          <ellipse cx="250" cy="300" rx="62" ry="15" fill="#6b3f1f" />
          <rect x="246" y="300" width="8" height="18" fill="#5a361a" />
          <rect x="222" y="287" width="22" height="14" rx="2" fill="#fffaf0" transform="rotate(-12 233 294)" />
          <rect x="248" y="289" width="22" height="14" rx="2" fill="#fffaf0" transform="rotate(9 259 296)" />
          <circle cx="233" cy="294" r="3.5" fill="#c2321f" transform="rotate(-12 233 294)" />
          <rect x="255" y="293" width="7" height="7" fill="#c2321f" transform="rotate(9 259 296)" />
        </g>
      ) : null}
      {h.has("ludo") ? (
        <g transform="translate(286 286)">
          <rect x="0" y="0" width="22" height="22" fill="#fffaf0" stroke="#3a2a1e" strokeWidth="1.5" />
          <rect x="0" y="0" width="9" height="9" fill="#c2321f" />
          <rect x="13" y="0" width="9" height="9" fill="#2f8a4a" />
          <rect x="0" y="13" width="9" height="9" fill="#3a5bb8" />
          <rect x="13" y="13" width="9" height="9" fill="#e8a43a" />
        </g>
      ) : null}
      {h.has("trophy") ? (
        <g transform="translate(28 140)">
          <rect x="-22" y="23" width="44" height="5" rx="1" fill="#6b3f1f" />
          <path d="M-12 -14 H12 V-4 Q12 8 0 10 Q-12 8 -12 -4Z" fill="url(#pl-gold)" />
          <rect x="-3" y="10" width="6" height="8" fill="#c9952e" />
          <rect x="-9" y="18" width="18" height="5" rx="1" fill="#6b3f1f" />
        </g>
      ) : null}
      {h.has("cat") ? (
        <g transform="translate(338 326)">
          <ellipse cx="0" cy="0" rx="22" ry="11" fill="#e3954a" />
          <circle cx="-18" cy="-8" r="9" fill="#e3954a" />
          <path d="M-25 -14 L-23 -22 L-18 -16Z M-16 -16 L-11 -22 L-11 -14Z" fill="#e3954a" />
          <path d="M20 2 Q34 -4 30 -16" stroke="#e3954a" strokeWidth="5" fill="none" strokeLinecap="round" />
          <path d="M-21 -8 h2 M-16 -8 h2" stroke="#3a2a1e" strokeWidth="1.5" />
        </g>
      ) : null}
      <style>{`
        .pl-twinkle { animation: pl-tw 2.4s ease-in-out infinite; }
        @keyframes pl-tw { 0%,100% { opacity: 1 } 50% { opacity: .45 } }
        .pl-spin { animation: pl-spin 1.6s linear infinite; }
        @keyframes pl-spin { to { transform: rotate(360deg) } }
        @media (prefers-reduced-motion: reduce) { .pl-twinkle, .pl-spin { animation: none } }
      `}</style>
    </svg>
  );
}
