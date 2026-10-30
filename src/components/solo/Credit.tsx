import type { FixPicture } from "./games/FixAm";

/** The photo credit, linked to the photo's source page when there is one. */
export function Credit({ picture, className }: { picture: FixPicture; className?: string }) {
  return (
    <p className={`text-[0.72rem] text-muted ${className ?? ""}`}>
      {picture.creditUrl ? (
        <a href={picture.creditUrl} target="_blank" rel="noopener noreferrer" className="underline decoration-dotted underline-offset-2 hover:text-fg">
          {picture.credit}
        </a>
      ) : (
        picture.credit
      )}
    </p>
  );
}
