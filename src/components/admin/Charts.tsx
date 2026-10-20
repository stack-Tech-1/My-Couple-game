"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { compact } from "@/lib/format";

/*
 * Small, dependency-free charts for the admin overview. One hue (--series) per chart, thin marks,
 * recessive hairline grid, a hover/focus readout on every chart and a table view behind each.
 */

const fmtDay = (d: string, long = false) => new Date(`${d}T00:00:00Z`).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC", ...(long ? { weekday: "short" } : {}) });

function niceMax(v: number): number {
  if (v <= 4) return 4;
  const step = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * step >= v) return m * step;
  return 10 * step;
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.floor(e!.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

export type Point = { d: string; v: number };

function TableView({ caption, rows, valueLabel }: { caption: string; rows: Point[]; valueLabel: string }) {
  return (
    <details className="mt-3 text-[0.85rem]">
      <summary className="cursor-pointer text-muted hover:text-fg">Show as table</summary>
      <div className="mt-2 max-h-64 overflow-y-auto rounded-[10px] border border-line">
        <table className="w-full">
          <caption className="sr-only">{caption}</caption>
          <thead className="sticky top-0 bg-sunk text-left text-muted">
            <tr>
              <th className="px-3 py-1.5 font-semibold">Day</th>
              <th className="px-3 py-1.5 text-right font-semibold">{valueLabel}</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {[...rows].reverse().map((r) => (
              <tr key={r.d} className="border-t border-line">
                <td className="px-3 py-1">{fmtDay(r.d, true)}</td>
                <td className="px-3 py-1 text-right">{r.v.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

const H = 190;
const PAD = { top: 14, right: 40, bottom: 26, left: 34 };

/** Values over time: a 2px line with a 10% wash, crosshair readout, labelled end point. */
export function TrendChart({ title, data, unit }: { title: string; data: Point[]; unit: string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(Math.max(0, ...data.map((p) => p.v)));
  const iw = Math.max(0, width - PAD.left - PAD.right);
  const ih = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (data.length <= 1 ? iw : (i / (data.length - 1)) * iw);
  const y = (v: number) => PAD.top + ih - (v / max) * ih;
  const line = data.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join("");
  const area = data.length ? `${line}L${x(data.length - 1)},${PAD.top + ih}L${x(0)},${PAD.top + ih}Z` : "";
  const last = data.length - 1;
  const ticks = [0, max / 2, max];

  function locate(e: PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const rel = (e.clientX - rect.left - PAD.left) / (iw || 1);
    setHover(Math.max(0, Math.min(last, Math.round(rel * last))));
  }
  function onKey(e: KeyboardEvent<SVGSVGElement>) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    setHover((h) => Math.max(0, Math.min(last, (h ?? last) + (e.key === "ArrowRight" ? 1 : -1))));
  }
  const hp = hover !== null ? data[hover] : null;

  return (
    <figure>
      <figcaption className="text-[0.95rem] font-semibold">{title}</figcaption>
      <div ref={ref} className="relative mt-3">
        {width > 0 ? (
          <svg
            width={width}
            height={H}
            role="img"
            aria-label={`${title}. Use the arrow keys to read each day.`}
            tabIndex={0}
            onPointerMove={locate}
            onPointerLeave={() => setHover(null)}
            onKeyDown={onKey}
            onBlur={() => setHover(null)}
            className="block touch-pan-y outline-none focus-visible:outline-2 focus-visible:outline-offset-4"
          >
            {ticks.map((t) => (
              <g key={t}>
                <line x1={PAD.left} x2={PAD.left + iw} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth={1} />
                <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-[var(--fg-muted)] text-[11px] tabular-nums">
                  {compact(t)}
                </text>
              </g>
            ))}
            {data.length ? (
              <>
                {[0, Math.floor(last / 2), last].filter((v, i, a) => a.indexOf(v) === i).map((i) => (
                  <text key={i} x={x(i)} y={H - 6} textAnchor={i === 0 ? "start" : i === last ? "end" : "middle"} className="fill-[var(--fg-muted)] text-[11px]">
                    {fmtDay(data[i]!.d)}
                  </text>
                ))}
                <path d={area} fill="var(--series)" fillOpacity={0.1} />
                <path d={line} fill="none" stroke="var(--series)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                <circle cx={x(last)} cy={y(data[last]!.v)} r={4} fill="var(--series)" stroke="var(--bg-raised)" strokeWidth={2} />
                <text x={x(last) + 8} y={y(data[last]!.v)} dy="0.32em" className="fill-[var(--fg)] text-[12px] font-semibold tabular-nums">
                  {compact(data[last]!.v)}
                </text>
                {hp ? (
                  <g aria-hidden>
                    <line x1={x(hover!)} x2={x(hover!)} y1={PAD.top} y2={PAD.top + ih} stroke="var(--fg-muted)" strokeWidth={1} />
                    <circle cx={x(hover!)} cy={y(hp.v)} r={4.5} fill="var(--series)" stroke="var(--bg-raised)" strokeWidth={2} />
                  </g>
                ) : null}
              </>
            ) : null}
          </svg>
        ) : (
          <div style={{ height: H }} />
        )}
        {hp && width ? (
          <Tip left={x(hover!)} width={width}>
            <span className="block text-[1rem] font-semibold tabular-nums">
              {hp.v.toLocaleString()} <span className="text-[0.8rem] font-normal text-muted">{unit}</span>
            </span>
            <span className="block text-[0.75rem] text-muted">{fmtDay(hp.d, true)}</span>
          </Tip>
        ) : null}
      </div>
      <TableView caption={title} rows={data} valueLabel={unit} />
    </figure>
  );
}

/** Counts per day as columns (<=24px, rounded data end), each column its own hover target. */
export function ColumnChart({ title, data, unit }: { title: string; data: Point[]; unit: string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(Math.max(0, ...data.map((p) => p.v)));
  const iw = Math.max(0, width - PAD.left - PAD.right);
  const ih = H - PAD.top - PAD.bottom;
  const slot = data.length ? iw / data.length : 0;
  const bw = Math.max(1, Math.min(24, slot - 2));
  const y = (v: number) => PAD.top + ih - (v / max) * ih;
  const ticks = [0, max / 2, max];
  const last = data.length - 1;
  const hp = hover !== null ? data[hover] : null;

  return (
    <figure>
      <figcaption className="text-[0.95rem] font-semibold">{title}</figcaption>
      <div ref={ref} className="relative mt-3">
        {width > 0 ? (
          <svg width={width} height={H} role="img" aria-label={title} onPointerLeave={() => setHover(null)} className="block">
            {ticks.map((t) => (
              <g key={t}>
                <line x1={PAD.left} x2={PAD.left + iw} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth={1} />
                <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-[var(--fg-muted)] text-[11px] tabular-nums">
                  {compact(t)}
                </text>
              </g>
            ))}
            {data.map((p, i) => {
              const cx = PAD.left + slot * i + slot / 2;
              const h = (p.v / max) * ih;
              const r = Math.min(4, bw / 2, h);
              const top = PAD.top + ih - h;
              const x0 = cx - bw / 2;
              // Rounded data end, square at the baseline.
              const d = h > 0 ? `M${x0},${PAD.top + ih}V${top + r}Q${x0},${top} ${x0 + r},${top}H${x0 + bw - r}Q${x0 + bw},${top} ${x0 + bw},${top + r}V${PAD.top + ih}Z` : "";
              return (
                <g key={p.d}>
                  {d ? <path d={d} fill="var(--series)" opacity={hover === null || hover === i ? 1 : 0.55} /> : null}
                  <rect
                    x={PAD.left + slot * i}
                    y={PAD.top}
                    width={slot}
                    height={ih}
                    fill="transparent"
                    tabIndex={-1}
                    onPointerEnter={() => setHover(i)}
                    onPointerDown={() => setHover(i)}
                  />
                </g>
              );
            })}
            {data.length
              ? [0, last].filter((v, i, a) => a.indexOf(v) === i).map((i) => (
                  <text key={i} x={PAD.left + slot * i + slot / 2} y={H - 6} textAnchor={i === 0 ? "start" : "end"} className="fill-[var(--fg-muted)] text-[11px]">
                    {fmtDay(data[i]!.d)}
                  </text>
                ))
              : null}
          </svg>
        ) : (
          <div style={{ height: H }} />
        )}
        {hp && width ? (
          <Tip left={PAD.left + slot * hover! + slot / 2} width={width}>
            <span className="block text-[1rem] font-semibold tabular-nums">
              {hp.v.toLocaleString()} <span className="text-[0.8rem] font-normal text-muted">{unit}</span>
            </span>
            <span className="block text-[0.75rem] text-muted">{fmtDay(hp.d, true)}</span>
          </Tip>
        ) : null}
      </div>
      <TableView caption={title} rows={data} valueLabel={unit} />
    </figure>
  );
}

function Tip({ left, width, children }: { left: number; width: number; children: ReactNode }) {
  const w = 132;
  const l = Math.max(0, Math.min(width - w, left - w / 2));
  return (
    <div aria-hidden className="pointer-events-none absolute top-0 z-10 rounded-[10px] border border-line bg-raised px-3 py-2 shadow-[0_10px_30px_-14px_rgba(28,20,22,.45)]" style={{ left: l, width: w }}>
      {children}
    </div>
  );
}

/** Horizontal bars, sorted, value at the tip. HTML so long names wrap instead of clipping. */
export function BarList({ rows, valueLabel }: { rows: { label: string; value: number; note?: string }[]; valueLabel: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) return <p className="py-6 text-center text-[0.9rem] text-muted">No games started in this period yet.</p>;
  return (
    <ul className="flex flex-col gap-2.5" aria-label={valueLabel}>
      {rows.map((r) => (
        <li key={r.label} className="group grid grid-cols-[minmax(7rem,11rem)_1fr] items-center gap-3" title={`${r.label}: ${r.value.toLocaleString()} ${valueLabel}${r.note ? `, ${r.note}` : ""}`}>
          <span className="truncate text-[0.88rem]">{r.label}</span>
          <span className="flex items-center gap-2">
            <span className="h-[18px] rounded-r-[4px] bg-[var(--series)] transition-opacity group-hover:opacity-80" style={{ width: `${Math.max(1.5, (r.value / max) * 82)}%` }} />
            <span className="whitespace-nowrap text-[0.82rem] tabular-nums">
              <span className="font-semibold">{r.value.toLocaleString()}</span>
              {r.note ? <span className="text-muted"> · {r.note}</span> : null}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Weekly cohorts: share of each sign-up week still active N weeks later. One hue, light → dark. */
export function RetentionGrid({ rows }: { rows: { week: string; size: number; weeks: (number | null)[] }[] }) {
  if (!rows.length) return <p className="py-6 text-center text-[0.9rem] text-muted">No sign-ups in the last eight weeks.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[30rem] border-separate border-spacing-[2px] text-[0.85rem]">
        <caption className="sr-only">Weekly retention: percentage of each sign-up week active in each following week</caption>
        <thead>
          <tr className="text-left text-muted">
            <th className="px-2 py-1.5 font-semibold">Signed up</th>
            <th className="px-2 py-1.5 text-right font-semibold">People</th>
            {[1, 2, 3, 4].map((k) => (
              <th key={k} className="px-2 py-1.5 text-center font-semibold">
                Week {k}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {rows.map((r) => (
            <tr key={r.week}>
              <td className="whitespace-nowrap px-2 py-1.5">Week of {fmtDay(r.week)}</td>
              <td className="px-2 py-1.5 text-right">{r.size}</td>
              {r.weeks.map((v, k) => (
                <td
                  key={k}
                  className={cn("rounded-[4px] px-2 py-1.5 text-center", v === null && "text-muted")}
                  style={v === null ? undefined : { background: `color-mix(in srgb, var(--series) ${Math.round(Math.min(70, v * 0.7))}%, var(--bg-raised))` }}
                >
                  {v === null ? "–" : `${v}%`}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
