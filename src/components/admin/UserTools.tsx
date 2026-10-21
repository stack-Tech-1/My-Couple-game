"use client";

import { useEffect, useState, useTransition, type FormEvent } from "react";
import { Button } from "@/design/Button";
import { TextField } from "@/design/Field";
import { Modal } from "@/design/Modal";
import { toast } from "@/design/toast";
import { deleteUserAccount, findUser, setSuspended, type AdminUser } from "@/lib/admin/actions";

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "Never");

export function UserTools({ initialEmail = "" }: { initialEmail?: string }) {
  const [email, setEmail] = useState(initialEmail);
  const [user, setUser] = useState<AdminUser | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [typed, setTyped] = useState("");

  const lookup = (address: string) =>
    start(async () => {
      const res = await findUser(address);
      if (!res.ok) {
        setError(res.error);
        setUser(undefined);
        return;
      }
      setError(null);
      setUser(res.data);
    });

  // Opened from the list with ?email=…: look it up straight away.
  useEffect(() => {
    if (initialEmail) lookup(initialEmail);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per address
  }, [initialEmail]);

  function onSearch(e: FormEvent) {
    e.preventDefault();
    lookup(email);
  }

  const suspended = !!user?.banned_until && Date.parse(user.banned_until) > Date.now();

  function toggleSuspend() {
    if (!user) return;
    start(async () => {
      const res = await setSuspended(user.id, !suspended);
      if (!res.ok) return void toast.error(res.error);
      toast.success(suspended ? "Account restored." : "Account suspended.", suspended ? "They can sign in again." : "They can't sign in; an open session ends within the hour.");
      lookup(user.email);
    });
  }

  function remove() {
    if (!user) return;
    start(async () => {
      const res = await deleteUserAccount(user.id, typed);
      if (!res.ok) return void toast.error(res.error);
      setConfirmOpen(false);
      setTyped("");
      setUser(null);
      toast.success("Account deleted.", "Their partner keeps the room and gets a fresh invite code.");
    });
  }

  return (
    <div className="mt-8">
      <form onSubmit={onSearch} className="flex items-end gap-3">
        <div className="flex-1">
          <TextField label="Email address" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" autoComplete="off" error={error} required />
        </div>
        <Button type="submit" loading={pending && !confirmOpen} className="mb-[1px]">
          Find
        </Button>
      </form>

      {user === null ? <p className="mt-8 text-muted">No account uses that email.</p> : null}

      {user ? (
        <section aria-label="Account" className="mt-8 rounded-[18px] border border-line bg-raised p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-[1.1rem] font-semibold">{user.display_name || "No name yet"}</p>
              <p className="truncate text-[0.9rem] text-muted">{user.email}</p>
            </div>
            <div className="flex gap-2">
              {suspended ? <span className="rounded-full bg-accent-ink px-2.5 py-1 text-[0.72rem] font-bold uppercase tracking-wide text-bg">Suspended</span> : null}
              {user.is_admin ? <span className="rounded-full bg-fg px-2.5 py-1 text-[0.72rem] font-bold uppercase tracking-wide text-bg">Admin</span> : null}
            </div>
          </div>
          <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 text-[0.88rem]">
            <div>
              <dt className="text-muted">Joined</dt>
              <dd>{when(user.created_at)}</dd>
            </div>
            <div>
              <dt className="text-muted">Last sign-in</dt>
              <dd>{when(user.last_sign_in_at)}</dd>
            </div>
            <div>
              <dt className="text-muted">Room</dt>
              <dd>{user.room_id ? (user.paired ? "Paired with a partner" : "Waiting for a partner") : "No room yet"}</dd>
            </div>
          </dl>
          <div className="mt-6 flex flex-wrap gap-3 border-t border-line pt-5">
            <Button variant="outline" onClick={toggleSuspend} loading={pending && !confirmOpen} disabled={user.is_admin}>
              {suspended ? "Restore account" : "Suspend account"}
            </Button>
            <Button variant="danger" onClick={() => setConfirmOpen(true)} disabled={user.is_admin}>
              Delete account
            </Button>
          </div>
          {user.is_admin ? <p className="mt-3 text-[0.8rem] text-muted">Admins can&apos;t be suspended or deleted here. Remove admin rights first with npm run admin:grant -- {user.email} --revoke.</p> : null}
        </section>
      ) : null}

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Delete this account?"
        description="Everything they own is erased for good. Their partner keeps the room, shared history and gets a fresh invite code. This can't be undone."
      >
        <TextField label={`Type ${user?.email ?? "their email"} to confirm`} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
        <div className="mt-5 flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
            Keep it
          </Button>
          <Button variant="danger" onClick={remove} loading={pending} disabled={typed.trim().toLowerCase() !== user?.email.toLowerCase()}>
            Delete forever
          </Button>
        </div>
      </Modal>
    </div>
  );
}
