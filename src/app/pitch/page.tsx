"use client";
import { Deck } from "@/components/pitch/deck";
import { SLIDES } from "@/components/pitch/slides";

export default function PitchPage() {
  return <Deck slides={SLIDES} />;
}
