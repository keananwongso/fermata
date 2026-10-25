import type { Metadata } from "next";
import { PageHead } from "@/components/ui";
import { AskPanel } from "@/components/ask/panel";

export const metadata: Metadata = { title: "Ask the books · Fermata", description: "Ask Fermata anything about its books, by voice or by typing. Read only." };

export default function Page() {
  return (
    <div className="space-y-8">
      <PageHead title="Ask the books">
        Ask out loud or type. Read only, and every number comes from the books.
      </PageHead>
      <AskPanel className="card p-5 sm:p-8 lg:p-10" />
    </div>
  );
}
