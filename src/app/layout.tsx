import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Source_Serif_4 } from "next/font/google";
import Link from "next/link";
import { Nav } from "@/components/nav";
import "./globals.css";

const sans = Geist({ variable: "--font-sans-face", subsets: ["latin"] });
const serif = Source_Serif_4({ variable: "--font-serif-face", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-mono-face", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Frontier Radar", template: "%s · Frontier Radar" },
  description:
    "Technology frontier intelligence: research, engineering, product and commercial signals across 15 technology domains.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfbf9" },
    { media: "(prefers-color-scheme: dark)", color: "#121212" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${sans.variable} ${serif.variable} ${mono.variable} min-h-dvh`}>
        <header className="mx-auto flex max-w-3xl items-baseline gap-6 px-4 pt-6 pb-2 sm:px-6">
          <Link href="/" className="shrink-0 font-serif text-lg font-semibold tracking-tight">
            Frontier Radar
          </Link>
          <Nav />
        </header>
        <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">{children}</main>
        <footer className="mx-auto flex max-w-3xl flex-wrap gap-x-5 gap-y-2 border-t border-line px-4 py-6 text-sm text-faint sm:px-6">
          <Link href="/framework" className="hover:text-ink">
            Framework
          </Link>
          <Link href="/people" className="hover:text-ink">
            People
          </Link>
          <span className="basis-full">Titles, short excerpts and links only. Every item links to its original source.</span>
        </footer>
      </body>
    </html>
  );
}
