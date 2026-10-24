import type { Metadata } from "next";
import { PageHead } from "@/components/ui";
import { AskPanel } from "@/components/ask/panel";

export const metadata: Metadata = { title: "Ask the books · Fermata", description: "Ask Fermata anything about its books, by voice or by typing. Read only." };

export default function Page() {
  return (
    <div className="space-y-8">
      <PageHead title="Ask the books">
        Ask about this year&apos;s books out loud, or type it. The answer is spoken and shown, and every number on screen comes from the
        books, never from the model.
      </PageHead>
      <AskPanel />
    </div>
  );
}
