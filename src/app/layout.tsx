import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { MobileNav, Sidebar } from "@/components/shell/Sidebar";
import { ReactorLog } from "@/components/shell/ReactorLog";
import { SITE_NAME, SITE_URL } from "@/lib/meta";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono-jb" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_NAME,
  description: "Interactive visualizations of Kris Kowal's A General Theory of Reactivity.",
  applicationName: SITE_NAME,
  keywords: ["reactivity", "promises", "streams", "observables", "signals", "behaviors", "back pressure", "gtor", "Kris Kowal"],
  openGraph: { siteName: SITE_NAME, type: "website", locale: "en_US" },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = { themeColor: "#0a0c11", colorScheme: "dark" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`}>
      <body className="font-sans antialiased">
        <div className="flex min-h-dvh">
          <Sidebar />
          <div className="min-w-0 flex-1">
            <MobileNav />
            <main className="mx-auto max-w-7xl px-4 pt-10 pb-24 sm:px-8">{children}</main>
          </div>
        </div>
        <ReactorLog />
      </body>
    </html>
  );
}
