/** Raster-safe brand mark used by generated PNG icons and OG images. */
export function BrandMarkImage({ size }: { size: number }) {
  return (
    <div style={{ width: size, height: size, background: "#1c1416", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: size * 0.22 }}>
      <svg width={size * 0.72} height={size * 0.72} viewBox="0 0 64 64">
        <circle cx="25" cy="32" r="13" fill="none" stroke="#f6efe6" strokeWidth="4" />
        <circle cx="39" cy="32" r="13" fill="none" stroke="#e8563a" strokeWidth="4" />
        <path d="M32 21.2a13 13 0 0 1 0 21.6" fill="none" stroke="#f6efe6" strokeWidth="4" strokeLinecap="round" />
      </svg>
    </div>
  );
}