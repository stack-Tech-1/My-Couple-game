import { ImageResponse } from "next/og";
import { BrandMarkImage } from "@/lib/brandMark";

export const dynamic = "force-static";

export function GET() {
  return new ImageResponse(<BrandMarkImage size={512} />, { width: 512, height: 512 });
}