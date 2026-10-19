import type { Rules as RulesT } from "@/games/_engine/types";

export function Rules({ rules }: { rules: RulesT }) {
  return (
    <div>
      <p className="text-[1.08rem] leading-relaxed">{rules.summary}</p>
      <dl className="mt-8 space-y-6">
        {rules.sections.map((s) => (
          <div key={s.title} className="grid gap-2 border-t border-line pt-4 sm:grid-cols-[10rem_1fr]">
            <dt className="eyebrow pt-1 text-muted">{s.title}</dt>
            <dd className="space-y-2 leading-relaxed">
              {s.body.map((b) => (
                <p key={b}>{b}</p>
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}