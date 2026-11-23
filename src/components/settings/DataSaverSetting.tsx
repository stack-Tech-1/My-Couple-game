"use client";

import { cn } from "@/lib/cn";
import { useDataSaver, type DataSaverPref } from "@/lib/dataSaver";

/** Data saver, on this device: auto, on or off. In the room's settings and Solo's. */
export function DataSaverSetting() {
  const { pref, auto, setPref } = useDataSaver();
  const options: { key: DataSaverPref; label: string }[] = [
    { key: "auto", label: "Auto" },
    { key: "on", label: "On" },
    { key: "off", label: "Off" },
  ];
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="font-semibold" id="data-saver-label">Data saver</p>
        <p className="mt-0.5 text-[0.85rem] text-muted">
          Smaller voice notes and photos, and stickers and photos wait for a tap before loading. On this device only.
          {pref === "auto" ? (auto ? " Your phone says data is limited, so it's on." : " It switches on when your phone is in data-saver mode or on a slow network.") : ""}
        </p>
      </div>
      <div role="radiogroup" aria-labelledby="data-saver-label" className="flex rounded-full border border-line bg-raised p-1">
        {options.map((o) => (
          <button
            key={o.key}
            type="button"
            role="radio"
            aria-checked={pref === o.key}
            onClick={() => setPref(o.key)}
            className={cn("rounded-full px-3.5 py-1.5 text-[0.85rem] font-semibold", pref === o.key ? "bg-fg text-bg" : "text-muted hover:text-fg")}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
