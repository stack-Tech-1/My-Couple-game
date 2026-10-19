import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type FieldShellProps = { label: string; hint?: ReactNode; error?: string | null; id: string; children: ReactNode };

function FieldShell({ label, hint, error, id, children }: FieldShellProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[0.82rem] font-semibold text-fg">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-err`} role="alert" className="text-[0.8rem] font-medium text-accent-ink">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-[0.8rem] text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

const control =
  "w-full rounded-[var(--radius)] border-[1.5px] border-line bg-raised px-4 text-[1rem] text-fg " +
  "placeholder:text-muted/70 transition-colors hover:border-[color-mix(in_srgb,var(--line-strong)_40%,var(--line))] " +
  "focus:border-line-strong focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 " +
  "aria-[invalid=true]:border-accent-ink";

type InputProps = InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: ReactNode; error?: string | null };

export const TextField = forwardRef<HTMLInputElement, InputProps>(function TextField(
  { label, hint, error, className, id, ...rest },
  ref,
) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <FieldShell label={label} hint={hint} error={error} id={fid}>
      <input
        ref={ref}
        id={fid}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fid}-err` : hint ? `${fid}-hint` : undefined}
        className={cn(control, "h-12", className)}
        {...rest}
      />
    </FieldShell>
  );
});

type AreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; hint?: ReactNode; error?: string | null };

export const TextArea = forwardRef<HTMLTextAreaElement, AreaProps>(function TextArea(
  { label, hint, error, className, id, ...rest },
  ref,
) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <FieldShell label={label} hint={hint} error={error} id={fid}>
      <textarea
        ref={ref}
        id={fid}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fid}-err` : hint ? `${fid}-hint` : undefined}
        className={cn(control, "min-h-28 py-3 leading-relaxed", className)}
        {...rest}
      />
    </FieldShell>
  );
});

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: ReactNode;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-6 py-3">
      <div className="min-w-0">
        <label htmlFor={id} className="block font-semibold">
          {label}
        </label>
        {description ? <p className="mt-0.5 text-[0.85rem] text-muted">{description}</p> : null}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative mt-0.5 h-7 w-12 shrink-0 rounded-full border-[1.5px] transition-colors disabled:opacity-45",
          checked ? "border-fg bg-fg" : "border-line bg-sunk",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full transition-[left,background-color] duration-200 ease-[var(--ease-weight)]",
            checked ? "left-[calc(100%-1.4rem)] bg-accent" : "left-[3px] bg-muted",
          )}
        />
      </button>
    </div>
  );
}