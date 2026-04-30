import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, X } from "lucide-react";
import { cn } from "@/utils/cn";

type ConfirmDialogTone = "brand" | "danger";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  tone?: ConfirmDialogTone;
  icon?: ReactNode;
  isPending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const toneStyles: Record<ConfirmDialogTone, { icon: string; confirm: string }> = {
  brand: {
    icon: "bg-brand-100 text-brand-600 dark:bg-brand-950/50 dark:text-brand-200",
    confirm: "bg-brand-600 text-white hover:bg-brand-700 focus-visible:ring-brand-500",
  },
  danger: {
    icon: "bg-red-50 text-red-500 dark:bg-red-950/40 dark:text-red-200",
    confirm: "bg-red-500 text-white hover:bg-red-600 focus-visible:ring-red-500",
  },
};

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  tone = "brand",
  icon,
  isPending = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isPending) onCancel();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPending, onCancel, open]);

  if (!open) return null;

  const styles = toneStyles[tone];

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 px-4 py-4 backdrop-blur-sm sm:items-center"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isPending) onCancel();
      }}
    >
      <section
        aria-modal="true"
        role="dialog"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
        className="w-full max-w-md rounded-3xl border border-slate-100 bg-white p-5 shadow-soft dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="mb-4 flex items-start gap-3">
          <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl", styles.icon)}>
            {icon ?? <AlertTriangle size={21} />}
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="confirm-dialog-title" className="text-lg font-bold text-slate-900 dark:text-slate-100">
              {title}
            </h2>
            <p id="confirm-dialog-description" className="mt-1 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              {description}
            </p>
          </div>
          <button
            type="button"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            aria-label={cancelLabel}
            disabled={isPending}
            onClick={onCancel}
          >
            <X size={18} />
          </button>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            className="btn-secondary order-2 sm:order-1"
            disabled={isPending}
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={cn(
              "order-1 rounded-2xl px-4 py-3 font-semibold shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 sm:order-2",
              styles.confirm
            )}
            disabled={isPending}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>,
    document.body
  );
}
