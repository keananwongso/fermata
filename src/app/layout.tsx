import type { Metadata } from "next";
import { Inter, Manrope, IBM_Plex_Mono, Noto_Music } from "next/font/google";
import "lenis/dist/lenis.css";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope" });
const music = Noto_Music({ subsets: ["music"], weight: "400", variable: "--font-music" });
const plex = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-plex-mono" });

export const metadata: Metadata = {
  title: "Fermata",
  description: "Every line settles on its own. Fermata only holds where it should.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${manrope.variable} ${plex.variable} ${music.variable}`}>
      <body className="flex min-h-dvh flex-col">
        <Providers>
          <Header />
          <main className="mx-auto w-full max-w-page flex-1 px-4 pb-20 pt-8 lg:px-10 lg:pb-28 lg:pt-12">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
