import type { Metadata, Viewport } from "next";
import { APP_DESCRIPTION, APP_NAME, APP_TAGLINE, siteUrl } from "@/lib/config";
import { ServiceWorker } from "@/components/ServiceWorker";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: `${APP_NAME}: ${APP_TAGLINE}`, template: `%s · ${APP_NAME}` },
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6efe6" },
    { media: "(prefers-color-scheme: dark)", color: "#120c0e" },
  ],
};

// Applies the saved theme before first paint so night mode never flashes paper.
const themeBoot = `try{var t=localStorage.getItem("twain-theme");if(t==="night"||(t==="auto"&&matchMedia("(prefers-color-scheme: dark)").matches)){document.documentElement.dataset.theme="night"}}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBoot }} />
        {/* Self-hosted fonts (see globals.css): preloaded so the display face is there for first paint. */}
        <link rel="preload" href="/fonts/fraunces-latin-v1.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/manrope-latin-v1.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      </head>
      <body>
        {/* Client providers (query cache, motion, toasts) live in the app and auth layouts, so the
            marketing pages ship almost no JavaScript. */}
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}