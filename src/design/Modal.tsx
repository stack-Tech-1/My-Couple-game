"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { IconButton } from "./Button";

/**
 * Native <dialog> modal: focus trapping, Escape and inert background for free.
 * Slides up from the bottom on phones, centres on larger screens.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  // Unique per modal: a page can hold several (rules and resign on a game, for one).
  const titleId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-labelledby={titleId}
      className={cn(
        "amah-modal m-0 mt-auto w-full max-w-none rounded-t-[22px] border border-line bg-bg p-0 text-fg",
        "sm:m-auto sm:max-w-lg sm:rounded-[22px]",
        "backdrop:bg-[rgba(18,12,14,.55)]",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4 px-6 pt-6">
        <div>
          <h2 id={titleId} className="display text-[1.9rem]">
            {title}
          </h2>
          {description ? <p className="mt-2 text-muted">{description}</p> : null}
        </div>
        <IconButton icon="close" label="Close" onClick={onClose} className="-mr-2 -mt-1" />
      </div>
      <div className="px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5">{children}</div>
    </dialog>
  );
}