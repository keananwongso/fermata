import type { Metadata } from "next";
import { Inter_Tight, IBM_Plex_Mono, Noto_Music } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Header } from "@/components/header";

const inter = Inter_Tight({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-inter-tight" });
const music = Noto_Music({ subsets: ["music"], weight: "400", variable: "--font-music" });
const plex = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-plex-mono" });

export const metadata: Metadata = {
  title: "Fermata",
  description: "Every line settles on its own. Fermata only holds where it should.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${plex.variable} ${music.variable}`}>
      <body>
        <Providers>
          <Header />
          <main className="mx-auto max-w-[1240px] px-10 pb-[72px] pt-10">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
