"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BackButton } from "@/design/BackButton";
import { Button } from "@/design/Button";
import { TextField, Toggle } from "@/design/Field";
import { Icon } from "@/design/icons";
import { Modal } from "@/design/Modal";
import { toast } from "@/design/toast";
import { cn } from "@/lib/cn";
import { deleteAccount, setAnnouncementEmails, signOut, updateMyPrefs } from "@/lib/room/actions";
import { applyTheme, resolveTheme, saveThemePref, type ThemePref } from "@/lib/theme/theme";
import type { Profile } from "@/lib/room/types";
import type { FeedbackThread } from "@/lib/feedback/types";
import { ProfileEditorFor } from "@/components/profile/ProfileEditor";
import { DataSaverSetting } from "@/components/settings/DataSaverSetting";
import { FeedbackHub } from "@/components/feedback/FeedbackHub";
import { PageBackdrop } from "@/components/room/HomeBackdrop";
import { PAGE_LOOKS } from "@/games/look";

/**
 * Settings that belong to the person, not a room: name and mark, sound, look, data saver, emails,
 * help, and the account. Room things (people, house rules, After Dark) stay in the room.
 */
export function SoloSettings({
  profile,
  soundOn,
  announcementEmails,
  feedback,
  homeRoomId,
}: {
  profile: Profile;
  soundOn: boolean;
  announcementEmails: boolean;
  feedback: { threads: FeedbackThread[]; unread: number };
  homeRoomId: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [sound, setSound] = useState(soundOn);
  const [theme, setTheme] = useState<ThemePref>(profile.theme ?? "auto");
  const [emails, setEmails] = useState(announcementEmails);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  function toggleSound(v: boolean) {
    setSound(v);
    void updateMyPrefs({ sound_enabled: v }).then((r) => {
      if (!r.ok) {
        setSound(!v);
        toast.error(r.error);
      } else router.refresh();
    });
  }
  function pickTheme(t: ThemePref) {
    setTheme(t);
    saveThemePref(t);
    applyTheme(resolveTheme(t));
    void updateMyPrefs({ theme: t }).then((r) => (r.ok ? router.refresh() : toast.error(r.error)));
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

  return (
    <div className="relative isolate mx-auto max-w-2xl pb-16 pt-6">
      <div className="relative isolate max-sm:pb-12">
        <PageBackdrop motif={PAGE_LOOKS.settings.motif} bg={PAGE_LOOKS.settings.bg} ink={PAGE_LOOKS.settings.ink} fit />
        <BackButton href="/solo" label="Solo" />
        <h1 className="display mt-5 text-[clamp(2.6rem,8vw,3.8rem)] leading-none max-sm:text-[#f6efe6]">Settings</h1>
      </div>

      <Card title="Just for you">
        <ProfileEditorFor profile={profile} />
        <div className="mt-5 border-t border-line">
          <Toggle checked={sound} onChange={toggleSound} label="Sounds" description="Game sounds and music. The speaker button on the Solo bar does the same." />
        </div>
        <p className="mt-5 text-[0.82rem] font-semibold">Look</p>
        <div role="radiogroup" aria-label="Look" className="mt-2 grid grid-cols-3 gap-2">
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
              className={cn("cut-sm flex flex-col items-start gap-2 border-[1.5px] p-3.5 text-left text-[0.9rem] font-semibold", theme === k ? "border-line-strong bg-raised" : "border-line")}
            >
              <Icon name={icon} size={20} className={theme === k ? "text-accent" : "text-muted"} />
              {label}
            </button>
          ))}
        </div>
        <div className="mt-4 border-t border-line">
          <DataSaverSetting />
          <Toggle checked={emails} onChange={toggleEmails} label="Announcement emails" description="Now and then: new games and important news. Sign-in emails always arrive." />
        </div>
      </Card>

      {homeRoomId ? (
        <Card title="Your room">
          <p className="text-muted">People, house rules, notifications and After Dark live in your room&apos;s settings.</p>
          <Link prefetch={false} href={`/room/${homeRoomId}/settings`} className="mt-3 inline-flex items-center gap-1.5 font-semibold underline underline-offset-4">
            Room settings <Icon name="arrowRight" size={16} />
          </Link>
        </Card>
      ) : null}

      <Card title="Help & feedback">
        <p className="mb-5 text-muted">Found a bug, have an idea, or a question you think everyone should play? Tell us. A real person reads every message.</p>
        <FeedbackHub userId={profile.id} threads={feedback.threads} unread={feedback.unread} spicyOpen={false} />
      </Card>

      <Card title="Account">
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" icon="exit" onClick={() => start(async () => { await signOut(); router.push("/"); router.refresh(); })}>Sign out</Button>
          <Button variant="ghost" className="text-accent-ink" onClick={() => setDeleteOpen(true)}>Delete my account</Button>
        </div>
      </Card>

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

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="cloth mt-5 p-5">
      <h2 className="eyebrow mb-4 text-muted">{title}</h2>
      {children}
    </section>
  );
}
