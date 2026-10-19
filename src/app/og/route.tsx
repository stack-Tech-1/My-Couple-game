import { ImageResponse } from "next/og";
import { APP_NAME } from "@/lib/config";
import { BrandMarkImage } from "@/lib/brandMark";

export const dynamic = "force-static";

export function GET() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", background: "#f6efe6", color: "#1c1416", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 80 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <BrandMarkImage size={72} />
          <span style={{ fontSize: 44, fontWeight: 700, letterSpacing: -1 }}>{APP_NAME.toLowerCase()}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: 104, lineHeight: 0.95, letterSpacing: -4, fontFamily: "serif" }}>Game night for</span>
          <span style={{ fontSize: 104, lineHeight: 0.95, letterSpacing: -4, fontFamily: "serif" }}>
            exactly <span style={{ color: "#e8563a", marginLeft: 24 }}>two</span>&nbsp;people.
          </span>
        </div>
        <div style={{ display: "flex", gap: 28, fontSize: 28, color: "#57474a" }}>
          <span>Cards</span><span>·</span><span>Board games</span><span>·</span><span>Love notes</span><span>·</span><span>After dark</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}