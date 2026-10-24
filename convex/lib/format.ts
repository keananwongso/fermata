// Display helpers: rupiah with thousands separators, short dates like "3 Jun".
import { MONTH_LABELS } from "./domain";

export function rp(n: number): string {
  const sign = n < 0 ? "-" : "";
  return sign + "Rp " + Math.abs(Math.round(n)).toLocaleString("en-US");
}

export function rpShort(n: number): string {
  const a = Math.abs(n);
  const sign = n < 0 ? "minus " : "";
  if (a >= 1e9) return `${sign}Rp ${trim(a / 1e9)}bn`;
  if (a >= 1e6) return `${sign}Rp ${trim(a / 1e6)}m`;
  if (a >= 1e3) return `${sign}Rp ${trim(a / 1e3)}k`;
  return `${sign}Rp ${a}`;
}

function trim(x: number): string {
  const digits = x >= 100 ? 0 : x >= 10 ? 1 : 2;
  return x.toFixed(digits).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

export function num(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

export function pct(x: number, digits = 1): string {
  return (x * 100).toFixed(digits).replace(/\.0$/, "") + "%";
}

export function shortDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${Number(d)} ${MONTH_LABELS[Number(m) - 1]}`;
}
