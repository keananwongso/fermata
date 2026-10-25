// The landing page's illustration of what keeps a mistake small: the rules the learning year learned from answers, each
// with its backtest and its per-payment limit. Read from the learning year, so every number is real. How it works
// lives on its own page (/how).
import { MONTH_LABELS } from "../../convex/lib/domain";
import { num, rpShort } from "../../convex/lib/format";
import { LY } from "./learningYear";

// Trust: the rules the learning year learned from answers, each with its backtest and the most it settles a payment.
export function LearnedRules() {
  return (
    <div className="frame">
      <div className="card">
        <div className="eyebrow border-b border-hairline px-4 py-2.5">Rules learned from answers this year</div>
        <ul className="divide-y divide-hairline">
          {LY.rules.map((r) => (
            <li key={`${r.id}v${r.version}`} className="px-4 py-3">
              <div className="flex items-baseline gap-3">
                <span className="num w-7 shrink-0 text-[12px] font-medium text-hold-ink">{r.id}</span>
                <span className="min-w-0 flex-1 truncate text-[13px] text-body" title={r.title}>{r.title}</span>
                <span className="shrink-0 text-[11.5px] text-faint">{MONTH_LABELS[r.month - 1]} · {r.by === "claude" ? "Claude" : r.by === "code" ? "Code" : "Scripted"}</span>
              </div>
              <div className="mt-1 pl-10 text-[11.5px] leading-snug text-secondary">
                Backtest <span className="num text-ink">{num(r.backtest.covered - r.backtest.wrong)}</span> of <span className="num">{num(r.backtest.covered)}</span> right · <span className="whitespace-nowrap">nothing over <span className="num">{rpShort(r.program.limitIdr)}</span></span> a payment
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
