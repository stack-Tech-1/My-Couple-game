"use client";

import Link from "next/link";
import { AboutEditor } from "@/components/profile/AboutEditor";
import { ProfileEditor } from "@/components/profile/ProfileEditor";
import { PetNames } from "@/components/profile/PetNames";
import { BirthdayEditor } from "@/components/profile/BirthdayEditor";
import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/design/Button";
import { TextField, Toggle } from "@/design/Field";
import { Modal } from "@/design/Modal";
import { Icon } from "@/design/icons";
import { toast } from "@/design/toast";
import { cn } from "@/lib/cn";
import { useRoom } from "@/lib/realtime/RoomProvider";
import { deleteAccount, leaveFriendRoom, leaveRoom, renameRoom, setAnnouncementEmails, signOut, updateMyPrefs } from "@/lib/room/actions";
import { FriendPeople } from "@/components/friends/FriendPeople";
import { applyTheme, resolveTheme, saveThemePref, type ThemePref } from "@/lib/theme/theme";
import { HouseRules } from "@/components/room/HouseRules";
import { ReportDialog } from "@/components/safety/ReportDialog";
import { BlockDialog } from "@/components/safety/BlockDialog";
import { useDataSaver, type DataSaverPref } from "@/lib/dataSaver";
import { FeedbackHub } from "@/components/feedback/FeedbackHub";
import { NotificationSettings } from "@/components/room/NotificationSettings";
import type { PushPrefs } from "@/lib/push/types";
import type { FeedbackThread } from "@/lib/feedback/types";
import { afterDarkOpen } from "@/lib/room/afterDark";
import { setOptIn } from "@/lib/afterdark/actions";

export function SettingsView({ announcementEmails, feedback, push }: { announcementEmails: boolean; feedback: { threads: FeedbackThread[]; unread: number }; push: { publicKey: string | null; prefs: PushPrefs } }) {
  const { bundle } = useRoom();
  const router = useRouter();
  const { room, me, partner, members, rooms } = bundle;
  const friendsRoom = room.kind === "friends";
  const isOwner = room.owner_id === me.profile.id;
  const others = members.filter((m) => m.profile.id !== me.profile.id);
  // Leaving a friend room you own: who takes over ("" = the longest-standing member).
  const [heir, setHeir] = useState("");
  const [name, setName] = useState(room.name);
  const [theme, setTheme] = useState<ThemePref>(me.profile.theme ?? "auto");
  const [sound, setSound] = useState(me.member.sound_enabled);
  const [emails, setEmails] = useState(announcementEmails);
  const [pending, start] = useTransition();
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  function saveName(e: FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await renameRoom(room.id, name);
      if (res.ok) toast.success("Renamed.", friendsRoom ? "Everyone in the room will see it." : "Your partner will see it right away.");
      else toast.error(res.error);
    });
  }

  function pickTheme(t: ThemePref) {
    setTheme(t);
    saveThemePref(t);
    applyTheme(resolveTheme(t));
    void updateMyPrefs({ theme: t }).then((r) => {
      if (!r.ok) toast.error(r.error);
      else router.refresh();
    });
  }

  function toggleEmails(v: boolean) {
    setEmails(v);
    void setAnnouncementEmails(v).then((r) => {
      if (!r.ok) {
        setEmails(!v);
        toast.error(r.error);
      }
    });
  }

  function toggleSound(v: boolean) {
    setSound(v);
    void updateMyPrefs({ sound_enabled: v }).then((r) => !r.ok && toast.error(r.error));
  }

  return (
    <div className="mx-auto max-w-2xl pt-8">
      <Link prefetch={false} href={`/room/${room.id}`} className="inline-flex items-center gap-1.5 text-[0.9rem] font-semibold text-muted hover:text-fg">
        <Icon name="arrowLeft" size={16} /> Room
      </Link>
      <h1 className="display mt-6 text-[clamp(2.6rem,8vw,3.8rem)]">Settings</h1>

      <Section title="The room">
        {friendsRoom && !isOwner ? (
          <p className="text-muted">
            <b className="text-fg">{room.name}</b> is a friend room. Only {members.find((m) => m.profile.id === room.owner_id)?.profile.display_name ?? "the owner"} can rename it or invite people.
          </p>
        ) : (
        <form onSubmit={saveName} className="flex items-end gap-3">
          <div className="flex-1">
            <TextField label="Room name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
          </div>
          <Button type="submit" variant="outline" loading={pending} disabled={name.trim() === room.name}>Save</Button>
        </form>
        )}
        {friendsRoom ? null : (
        <p className="mt-4 text-[0.9rem] text-muted">
          {partner ? <>Paired with <b className="text-fg">{partner.profile.display_name}</b>{room.paired_at ? ` since ${new Date(room.paired_at).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}` : ""}.</> : <>Still waiting on your person. Invite code <b className="tabular text-fg">{room.invite_code}</b>.</>}
        </p>
        )}
      </Section>

      {friendsRoom ? (
        <Section title="People" id="people">
          <FriendPeople />
        </Section>
      ) : null}

      <Section title="Your rooms" id="rooms">
        <p className="mb-4 text-muted">
          {rooms.length > 1
            ? "Switch rooms from the room name at the top of the screen."
            : "Got a best friend or a group chat that needs a rematch? A friend room fits up to eight people, with Whot, Ludo, Ayo and more. Your couple room stays just for the two of you."}
        </p>
        <Link prefetch={false} href="/room/new" className="inline-flex items-center gap-1.5 font-semibold underline underline-offset-4">
          Start or join a friend room <Icon name="arrowRight" size={16} />
        </Link>
      </Section>

      <Section title="Just for you" id="you">
        <ProfileEditor />
        <BirthdayEditor />
        <AboutEditor />
        <PetNames />
        <p className="mt-8 text-[0.82rem] font-semibold">Theme</p>
        <div role="radiogroup" aria-label="Theme" className="mt-2 grid grid-cols-3 gap-2">
          {([
            ["day", "sun", "Day"],
            ["night", "moon", "Night"],
            ["auto", "refresh", "Match device"],
          ] as const).map(([k, icon, label]) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={theme === k}
              onClick={() => pickTheme(k)}
              className={cn("flex flex-col items-start gap-2 rounded-[14px] border-[1.5px] p-3.5 text-left text-[0.9rem] font-semibold", theme === k ? "border-line-strong bg-raised" : "border-line")}
            >
              <Icon name={icon} size={20} className={theme === k ? "text-accent" : "text-muted"} />
              {label}
            </button>
          ))}
        </div>
        <div className="mt-4 border-t border-line">
          <Toggle checked={sound} onChange={toggleSound} label="Sounds" description="Soft clicks, card snaps and a little fanfare when you win. Off by default." />
          <Toggle checked={emails} onChange={toggleEmails} label="Announcement emails" description="Now and then: new games and important news. Sign-in emails always arrive." />
          <DataSaverSetting />
        </div>
      </Section>

      <Section title="Notifications" id="notifications">
        <NotificationSettings publicKey={push.publicKey} prefs={push.prefs} />
      </Section>

      <Section title="House rules" id="house-rules">
        <p className="mb-6 text-muted">{friendsRoom ? "Shared by everyone in this room." : "Shared by both of you."} Every family plays these differently; argue it out here, not mid-game.</p>
        <HouseRules />
      </Section>

      {friendsRoom ? null : (
      <Section title="After dark" id="after-dark">
        <p className="leading-relaxed text-muted">
          An 18+ section with five flirty games. It stays locked until <b className="text-fg">both</b> of you have confirmed you&apos;re over 18 and opted in, each on your own phone. The heat never goes above the lower of your two limits, any card can be skipped without a reason, and it has its own PIN and a one-tap exit.
        </p>
        {me.member.spicy_opt_in ? (
          <div className="mt-4 border-t border-line">
            <Toggle
              label="After Dark open from my side"
              description="Switch off to close it for both of you, instantly. Any card in progress finishes first. No PIN needed, no reason given."
              checked
              onChange={() => start(async () => {
                const r = await setOptIn(false);
                if (!r.ok) return void toast.error(r.error);
                toast.info("Closed.");
                router.refresh();
              })}
            />
          </div>
        ) : null}
        <Link prefetch={false} href={`/room/${room.id}/after-dark`} className="mt-4 inline-flex items-center gap-1.5 font-semibold underline underline-offset-4">
          {me.member.spicy_opt_in ? "Manage After Dark" : "How After Dark works"} <Icon name="arrowRight" size={16} />
        </Link>
      </Section>
      )}

      {partner ? (
        <Section title="Safety" id="safety">
          <p className="mb-5 text-muted">
            If {partner.profile.display_name} is making you uncomfortable or breaking our rules, tell us. They won&apos;t know you reported them. Blocking takes you out
            of the room for good.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => setReportOpen(true)}>Report {partner.profile.display_name}</Button>
            <Button variant="danger" onClick={() => setBlockOpen(true)}>Block {partner.profile.display_name}</Button>
          </div>
          <p className="mt-4 text-[0.85rem] text-muted">To report one message, open the chat and press and hold it (or right-click on a computer).</p>
        </Section>
      ) : null}

      <Section title="Help & feedback" id="feedback">
        <p className="mb-5 text-muted">Found a bug, have an idea, or a question you think everyone should play? Tell us. A real person reads every message.</p>
        <FeedbackHub userId={me.profile.id} threads={feedback.threads} unread={feedback.unread} spicyOpen={afterDarkOpen(bundle)} />
        <Link prefetch={false} href={`/room/${room.id}?tour=1`} className="mt-6 inline-flex items-center gap-1.5 font-semibold underline underline-offset-4">
          Replay the welcome tour <Icon name="arrowRight" size={16} />
        </Link>
      </Section>

      <Section title="Account">
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" icon="exit" onClick={() => start(async () => { await signOut(); router.push("/"); router.refresh(); })}>Sign out</Button>
          <Button variant="danger" onClick={() => setLeaveOpen(true)}>Leave this room</Button>
          <Button variant="ghost" className="text-accent-ink" onClick={() => setDeleteOpen(true)}>Delete my account</Button>
        </div>
      </Section>

      {partner ? (
        <>
          <ReportDialog open={reportOpen} onClose={() => setReportOpen(false)} partnerName={partner.profile.display_name} onBlockInstead={() => setBlockOpen(true)} />
          <BlockDialog open={blockOpen} onClose={() => setBlockOpen(false)} partnerName={partner.profile.display_name} />
        </>
      ) : null}
      <Modal
        open={leaveOpen}
        onClose={() => setLeaveOpen(false)}
        title="Leave the room?"
        description={
          friendsRoom
            ? others.length
              ? `Everyone else keeps the room and its chat. You can come back with the invite code.${isOwner ? " Choose who looks after it next." : ""}`
              : "The room will be deleted, since nobody else is in it."
            : partner
              ? `You'll be unpaired from ${partner.profile.display_name}. They keep the room and its history, and get a fresh invite code. After Dark closes; your own After Dark answers stay private to you and are never shown to anyone.`
              : "The room will be deleted, since nobody else is in it."
        }
      >
        {friendsRoom && isOwner && others.length ? (
          <label className="mb-5 block">
            <span className="text-[0.82rem] font-semibold">New owner</span>
            <select value={heir} onChange={(e) => setHeir(e.target.value)} className="mt-1.5 h-12 w-full rounded-[12px] border-[1.5px] border-line bg-raised px-3 font-semibold">
              <option value="">Whoever has been here longest ({others[0]!.profile.display_name})</option>
              {others.map((o) => (
                <option key={o.profile.id} value={o.profile.id}>{o.profile.display_name}</option>
              ))}
            </select>
          </label>
        ) : null}
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setLeaveOpen(false)}>Stay</Button>
          <Button
            variant="danger"
            loading={pending}
            onClick={() => start(async () => {
              const res = friendsRoom ? await leaveFriendRoom(room.id, heir || null) : await leaveRoom();
              if (!res.ok) return void toast.error(res.error);
              // Hard navigation: the room's live listeners are about to see us leave. /room picks another room, if any.
              window.location.assign(rooms.length > 1 ? "/room" : "/onboarding?step=room");
            })}
          >
            Leave
          </Button>
        </div>
      </Modal>

      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Delete everything?" description="This removes your account and everything you've written: answers, notes, photos, cards and picks. It can't be undone.">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await deleteAccount(confirmText.trim().toLowerCase());
              if (!res.ok) return void toast.error(res.error);
              window.location.assign("/?deleted=1");
            });
          }}
          className="flex flex-col gap-4"
        >
          <TextField label='Type "delete" to confirm' value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoComplete="off" />
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>Keep my account</Button>
            <Button type="submit" variant="danger" loading={pending} disabled={confirmText.trim().toLowerCase() !== "delete"}>Delete forever</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function Section({ title, id, children }: { title: string; id?: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id ?? title}-h`} className="mt-12 scroll-mt-24 border-t-[1.5px] border-line-strong pt-5">
      <h2 id={`${id ?? title}-h`} className="eyebrow mb-5 text-muted">{title}</h2>
      {children}
    </section>
  );
}
function DataSaverSetting() {
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
