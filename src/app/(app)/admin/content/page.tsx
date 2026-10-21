import Link from "next/link";
import { builtInKey, isKind, KIND_ORDER, KINDS, type ContentKind } from "@/lib/content/catalog";
import { getOverrides } from "@/lib/content/server";
import { ContentEditor, type Row } from "@/components/admin/ContentEditor";
import { cn } from "@/lib/cn";

export default async function AdminContent({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const { kind: raw } = await searchParams;
  const kind: ContentKind = isKind(raw) ? raw : "daily_question";
  const def = KINDS[kind];
  const o = await getOverrides();
  const hidden = new Set(o.hidden.filter((h) => h.kind === kind).map((h) => h.key));

  const summary = def.summary as (i: unknown) => string;
  const rows: Row[] = [
    ...o.added
      .filter((a) => a.kind === kind && (def.schema as { safeParse: (v: unknown) => { success: boolean } }).safeParse(a.body).success)
      .reverse()
      .map((a) => ({ key: a.id, text: summary(a.body), added: true, hidden: hidden.has(a.id), heat: (a.body as { heat?: number }).heat })),
    ...(def.builtIn as () => unknown[])().map((item) => {
      const key = builtInKey(kind, item);
      return { key, text: summary(item), added: false, hidden: hidden.has(key), heat: (item as { heat?: number }).heat };
    }),
  ];
  const groups = ["Everyday", "Games", "After Dark"] as const;

  return (
    <div>
      <h1 className="display text-[2.6rem] leading-none">Content</h1>
      <p className="mt-2 max-w-2xl text-[0.9rem] text-muted">
        Add your own questions, prompts and ideas, or switch off built-in ones. New games use the changes straight away; games already in progress keep the cards they drew.
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[14rem_1fr]">
        <nav aria-label="Decks" className="flex gap-6 overflow-x-auto lg:flex-col lg:gap-5">
          {groups.map((g) => (
            <div key={g} className="min-w-max">
              <p className="eyebrow text-muted">{g}</p>
              <ul className="mt-2 flex gap-1 lg:flex-col">
                {KIND_ORDER.filter((k) => KINDS[k].group === g).map((k) => (
                  <li key={k}>
                    <Link prefetch={false}
                      href={`/admin/content?kind=${k}`}
                      aria-current={k === kind ? "page" : undefined}
                      className={cn("block whitespace-nowrap rounded-[10px] px-3 py-1.5 text-[0.9rem] font-semibold", k === kind ? "bg-fg text-bg" : "text-muted hover:bg-sunk hover:text-fg")}
                    >
                      {KINDS[k].label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <ContentEditor key={kind} kind={kind} label={def.label} usedIn={def.usedIn} daily={!!def.daily} rows={rows} />
      </div>
    </div>
  );
}
