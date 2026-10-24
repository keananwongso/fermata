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

// The landing page, the dashboard and the public demo.
export const SITE_LINKS = [
  { href: "/#how", label: "How it works" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/ask", label: "Ask the books" },
  { href: "/demo", label: "Live demo" },
  PUBLIC_SITE ? { href: REPO_URL, label: "Run it yourself" } : { href: "/run", label: "Console" },
];

// The call to action after the demo: the console where it is served, otherwise the repo to run it from.
export const CONSOLE_LINK = PUBLIC_SITE ? { href: REPO_URL, label: "Run it yourself" } : { href: "/run", label: "Open the console" };
