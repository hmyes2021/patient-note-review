import { useEffect, useRef, type ReactNode } from "react";
import { CloseIcon } from "./Icons";

const FOCUSABLE = 'button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  titleId: string;
  variant?: "sheet" | "drawer";
  children: ReactNode;
  footer?: ReactNode;
}

/** Native modal <dialog>: traps focus, closes with Escape, restores focus to the opener. */
export function Sheet({ open, onClose, title, titleId, variant = "sheet", children, footer }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      opener.current = document.activeElement as HTMLElement | null;
      d.showModal();
      d.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    } else if (!open && d.open) {
      d.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={variant}
      aria-labelledby={titleId}
      onClose={() => {
        onClose();
        const el = opener.current;
        if (el && document.contains(el)) el.focus();
      }}
      onClick={(e) => { if (e.target === ref.current) ref.current?.close(); }}
      onKeyDown={(e) => {
        // Keep Tab inside the dialog (browsers otherwise let focus leave to the toolbar).
        if (e.key !== "Tab" || !ref.current) return;
        const items = [...ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
        if (!items.length) return;
        const first = items[0], last = items[items.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && (active === first || !ref.current.contains(active))) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
      }}
    >
      {open && (
        <div className={`flex flex-col ${variant === "drawer" ? "h-full" : "max-h-[inherit]"}`}>
          <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
            <h2 id={titleId} tabIndex={-1} data-autofocus className="text-xl font-bold">{title}</h2>
            <button type="button" className="btn btn-quiet !min-h-11 !min-w-11 !p-0 !no-underline" onClick={() => ref.current?.close()}>
              <CloseIcon /><span className="sr-only">Close</span>
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer && <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line px-5 py-3">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}
