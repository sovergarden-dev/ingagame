import { useEffect, useState } from "react";
import { nextScreenshot } from "@/domain/trust";
import type { Screenshot } from "@/domain/types";

/** Thumbnails stay lazy. The large frame mounts only after a shot is opened. */
export function ScreenshotGallery({ shots }: { shots: Screenshot[] }) {
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    if (open === null) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(null);
      if (event.key === "ArrowRight")
        setOpen((index) => nextScreenshot(index ?? 0, shots.length, 1));
      if (event.key === "ArrowLeft")
        setOpen((index) => nextScreenshot(index ?? 0, shots.length, -1));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, shots.length]);

  const current = open === null ? null : shots[open];

  return (
    <div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {shots.map((shot, index) => (
          <li key={shot.id}>
            <button
              type="button"
              className="block w-full overflow-hidden rounded-xl border border-border"
              onClick={() => setOpen(index)}
            >
              <img
                src={shot.url}
                alt={shot.alt}
                loading="lazy"
                width={640}
                height={360}
                className="aspect-video w-full object-cover"
              />
            </button>
          </li>
        ))}
      </ul>
      {current && open !== null ? (
        <div
          className="mt-3 overflow-hidden rounded-xl border border-border"
          role="dialog"
          aria-label={current.alt}
        >
          <img
            src={current.url}
            alt={current.alt}
            width={1280}
            height={720}
            className="aspect-video w-full object-cover"
          />
          <p className="px-3 py-2 text-xs text-muted-foreground">
            {open + 1} / {shots.length}
          </p>
        </div>
      ) : null}
    </div>
  );
}
