// The console's key for Convex functions that write, start a run or call Claude (see convex/lib/console.ts).
// Set NEXT_PUBLIC_FERMATA_CONSOLE_KEY in .env.local only; the hosted site never has it.
export const CONSOLE_KEY: string | undefined = process.env.NEXT_PUBLIC_FERMATA_CONSOLE_KEY || undefined;
