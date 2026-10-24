// Approximate US dollars beside a headline rupiah figure, for readers who don't think in rupiah. One fixed rate, not a
// quote: about Rp 16,000 to the dollar. Rounded to two significant figures so it reads as approximate ("about $3M").
// It gives the size, not the sign: the rupiah figure beside it carries that. Headline figures only, never table rows.
export const IDR_PER_USD = 16_000;

export function usdApprox(idr: number): string {
  const usd = Math.abs(idr) / IDR_PER_USD;
  const [scale, unit] = usd >= 1e9 ? [1e9, "B"] : usd >= 1e6 ? [1e6, "M"] : usd >= 1e3 ? [1e3, "K"] : [1, ""];
  return `about $${Number((usd / scale).toPrecision(2))}${unit}`;
}
