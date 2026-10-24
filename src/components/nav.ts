export const TABS = [
  { href: "/run", label: "Run" },
  { href: "/stories", label: "Case rooms" },
  { href: "/rules", label: "Rules" },
  { href: "/evaluation", label: "Evaluation" },
  { href: "/record", label: "Record" },
];

// The hosted site is only the landing page and the demo: the console spends real API calls and writes to the
// books, so it runs locally (yours, or anyone's own clone with their own keys). Set on Vercel.
export const PUBLIC_SITE = process.env.NEXT_PUBLIC_FERMATA_PUBLIC === "1";
export const REPO_URL = "https://github.com/keananwongso/fermata";

// The landing page and the public demo.
export const SITE_LINKS = [
  { href: "/#how", label: "How it works" },
  { href: "/demo", label: "Live demo" },
  PUBLIC_SITE ? { href: REPO_URL, label: "Run it yourself" } : { href: "/run", label: "Console" },
];
