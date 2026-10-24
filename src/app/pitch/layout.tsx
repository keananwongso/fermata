import type { Metadata } from "next";

export const metadata: Metadata = { title: "Fermata · Pitch", description: "The Fermata pitch, built from the same recorded run as the demo." };

export default function PitchLayout({ children }: { children: React.ReactNode }) {
  return children;
}
