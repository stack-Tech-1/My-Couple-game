"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/design/Button";
import { Modal } from "@/design/Modal";
import { TextField } from "@/design/Field";
import { toast } from "@/design/toast";
import { cn } from "@/lib/cn";
import { endSeat, findPlusUser, giveAdminPlus, refundPayment, setPlusLaunch } from "@/lib/plus/admin-actions";
import type { AdminPlusUser } from "@/lib/plus/admin";

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
/** "2026-11-14T09:00" in the browser's own time, for a datetime-local input. */
const localInput = (iso: string) => {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

/** The launch switch: Plus is off (everything free), scheduled, or live. */
export function LaunchControl({ launchedAt, earlyCount, earlyDone }: { launchedAt: string | null; earlyCount: number; earlyDone: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [value, setValue] = useState(launchedAt ? localInput(launchedAt) : "");
  const [confirm, setConfirm] = useState<"now" | "off" | null>(null);
  const live = !!launchedAt && Date.parse(launchedAt) <= Date.now();
  const scheduled = !!launchedAt && !live;

  const run = (at: string | null, msg: string) =>
    start(async () => {
      const r = await setPlusLaunch(at);
      setConfirm(null);
      if (!r.ok) return void toast.error(r.error);
      toast.success(msg, r.data.early != null ? `${r.data.early.toLocaleString()} early users have their free month.` : undefined);
      router.refresh();
    });

  return (
    <div>
      <p className="text-[1.05rem]">
        {live ? (
          <>
            <b className="text-[#3f9a5c]">Live</b> since {when(launchedAt!)}.
          </>
        ) : scheduled ? (
          <>
            <b className="text-[#b07a12]">Scheduled</b> for {when(launchedAt!)}. Until then everything is free.
          </>
        ) : (
          <>
            <b>Off.</b> Everything in Amah is free, and no Plus screens show.
          </>
        )}
      </p>
      <p className="mt-1 text-[0.85rem] text-muted">
        {launchedAt
          ? `Free month for early users: ${earlyCount.toLocaleString()} ${earlyDone ? "given" : "queued for launch day"}.`
          : "Setting a launch date gives everyone who joined before it a free month, starting on launch day."}
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        {!live ? (
          <>
            <label className="block">
              <span className="text-[0.82rem] font-semibold">Launch date and time (your time)</span>
              <input type="datetime-local" value={value} onChange={(e) => setValue(e.target.value)} className="mt-1.5 block h-11 rounded-[12px] border-[1.5px] border-line bg-raised px-3 font-semibold" />
            </label>
            <Button variant="outline" disabled={!value || pending} onClick={() => run(new Date(value).toISOString(), "Launch day set.")}>
              {scheduled ? "Move launch" : "Schedule launch"}
            </Button>
            <Button disabled={pending} onClick={() => setConfirm("now")}>Launch now</Button>
          </>
        ) : null}
        {launchedAt ? (
          <Button variant="ghost" className="text-accent-ink" disabled={pending} onClick={() => setConfirm("off")}>
            Switch Plus off
          </Button>
        ) : null}
      </div>

      <Modal open={confirm === "now"} onClose={() => setConfirm(null)} title="Launch Amah Plus now?" description="Plus games lock for anyone without Plus. Everyone who joined before now gets a free month straight away.">
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setConfirm(null)}>Not yet</Button>
          <Button loading={pending} onClick={() => run(new Date().toISOString(), "Amah Plus is live.")}>Launch now</Button>
        </div>
      </Modal>
      <Modal
        open={confirm === "off"}
        onClose={() => setConfirm(null)}
        title="Switch Plus off?"
        description={live ? "Everything becomes free again straight away. Nobody loses the Plus they have or paid for; it's just not needed while Plus is off. Card plans keep renewing, so only do this for an emergency." : "The launch is cancelled and the queued free months are removed. Nothing has been charged."}
      >
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setConfirm(null)}>Keep it</Button>
          <Button variant="danger" loading={pending} onClick={() => run(null, "Plus is off.")}>Switch off</Button>
        </div>
      </Modal>
    </div>
  );
}

/** Refund one payment through Paystack. */
export function RefundButton({ reference, amount }: { reference: string; amount: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="text-[0.82rem] font-semibold text-accent-ink underline underline-offset-2">
        Refund
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={`Refund ${amount}?`} description={`Payment ${reference}. Paystack returns the full amount the way it was paid (it can take up to 10 working days). The Plus it bought ends now, and a card plan stops renewing.`}>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            variant="danger"
            loading={pending}
            onClick={() =>
              start(async () => {
                const r = await refundPayment(reference);
                setOpen(false);
                if (!r.ok) return void toast.error(r.error);
                toast.success("Refunded.");
                router.refresh();
              })
            }
          >
            Refund {amount}
          </Button>
        </div>
      </Modal>
    </>
  );
}

const SOURCE: Record<string, string> = { paid: "Paid", gift: "Gift", trial: "Trial", early: "Thank-you month", admin: "From the team" };

/** Look someone up by email: their Plus, every seat, and buttons to give or end Plus. */
export function PlusPersonTools() {
  const [email, setEmail] = useState("");
  const [person, setPerson] = useState<AdminPlusUser | null | undefined>(undefined);
  const [pending, start] = useTransition();
  const [length, setLength] = useState<"7d" | "1m" | "3m" | "1y">("1m");

  const look = (e?: string) =>
    start(async () => {
      const r = await findPlusUser(e ?? email);
      if (!r.ok) return void toast.error(r.error);
      setPerson(r.data);
    });

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          look();
        }}
        className="flex flex-wrap items-end gap-3"
      >
        <div className="min-w-0 flex-1">
          <TextField label="Their email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
        </div>
        <Button type="submit" variant="outline" loading={pending && person === undefined}>
          Look up
        </Button>
      </form>

      {person === null ? <p className="mt-4 text-muted">Nobody with that email.</p> : null}
      {person ? (
        <div className="mt-5 rounded-[14px] border border-line p-4">
          <p className="font-semibold">
            {person.name ?? "No name yet"} <span className="font-normal text-muted">{person.email}</span>
          </p>
          <p className="mt-1 text-[0.9rem]">
            {person.until ? (
              <>
                Has Plus until <b>{day(person.until)}</b>.
              </>
            ) : (
              "No Plus right now."
            )}{" "}
            <span className="text-muted">{person.trialUsed ? "Free trial used." : "Free trial not used."}</span>
          </p>

          <div className="mt-4 flex flex-wrap items-end gap-3">
            <label className="block">
              <span className="text-[0.82rem] font-semibold">Give Plus</span>
              <select value={length} onChange={(e) => setLength(e.target.value as typeof length)} className="mt-1.5 block h-11 rounded-[12px] border-[1.5px] border-line bg-raised px-3 font-semibold">
                <option value="7d">7 days</option>
                <option value="1m">1 month</option>
                <option value="3m">3 months</option>
                <option value="1y">1 year</option>
              </select>
            </label>
            <Button
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await giveAdminPlus(person.id, length);
                  if (!r.ok) return void toast.error(r.error);
                  toast.success(`Plus until ${day(r.data.until)}.`, "Added after any Plus they already had.");
                  look(person.email);
                })
              }
            >
              Give Plus
            </Button>
          </div>

          {person.seats.length ? (
            <table className="mt-5 w-full text-left text-[0.85rem]">
              <caption className="sr-only">Their Plus seats</caption>
              <thead className="text-muted">
                <tr>
                  <th className="py-1.5 font-semibold">How</th>
                  <th className="py-1.5 font-semibold">From</th>
                  <th className="py-1.5 font-semibold">To</th>
                  <th className="py-1.5" />
                </tr>
              </thead>
              <tbody>
                {person.seats.map((s) => {
                  const ended = !!s.revoked_at || Date.parse(s.ends_at) <= Date.now();
                  return (
                    <tr key={s.id} className={cn("border-t border-line", ended && "text-muted")}>
                      <td className="py-2">
                        {SOURCE[s.source] ?? s.source}
                        {s.given_by_name && s.source !== "admin" ? ` from ${s.given_by_name}` : ""}
                      </td>
                      <td className="py-2">{day(s.starts_at)}</td>
                      <td className="py-2">{s.revoked_at ? `Ended ${day(s.revoked_at)}` : day(s.ends_at)}</td>
                      <td className="py-2 text-right">
                        {!ended ? (
                          <button
                            type="button"
                            className="font-semibold text-accent-ink underline underline-offset-2"
                            disabled={pending}
                            onClick={() =>
                              start(async () => {
                                const r = await endSeat(s.id);
                                if (!r.ok) return void toast.error(r.error);
                                toast.success("Seat ended.");
                                look(person.email);
                              })
                            }
                          >
                            End now
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
