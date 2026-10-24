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

// The site header: the guided path is the live demo (its button), the explore path is the dashboard (Ask the books
// lives inside it). Locally the console is one more link.
export const SITE_LINKS = [
  { href: "/#how", label: "How it works" },
  { href: "/dashboard", label: "Dashboard" },
  ...(PUBLIC_SITE ? [] : [{ href: "/run", label: "Console" }]),
];

// The footer has room for every way in.
export const FOOTER_LINKS = [
  ...SITE_LINKS,
  { href: "/demo", label: "Live demo" },
  { href: "/dashboard?view=ask", label: "Ask the books" },
  { href: REPO_URL, label: "Source on GitHub" },
];

// The call to action after the demo: the console where it is served, otherwise the repo to run it from.
export const CONSOLE_LINK = PUBLIC_SITE ? { href: REPO_URL, label: "Run it yourself" } : { href: "/run", label: "Open the console" };
